# Syncer Architecture — Google Sheets → Supabase

> **Canonical reference** for the financial data sync pipeline. Trust this file and the
> source code over `SYSTEM_REPORT.md` / `PROJECT_CONTEXT.md` where they conflict.
>
> Last verified against code: **2026-06-18**.

This document describes the **existing financial-data syncer** end-to-end (AppScript →
Edge Function → browser pull → Supabase), how secrets/keys flow between the layers, the
known deviations from the intended design, and — in §6 — the **now-built EFB Audit syncer**
that reuses this pattern (sharing the transport, with an independent data path).

---

## 1. High-level flow

The sync is a **two-step flow** kicked off by an MC user from the Admin page
([\_app.admin.tsx](../../src/routes/_app.admin.tsx) → "Google Sheets Sync" card → "Run Sync").

```
┌─────────────┐   ① POST {mode,term,month}      ┌──────────────────────────┐
│  Browser    │   + Supabase JWT (Bearer)       │  Supabase Edge Function  │
│  (Admin UI) │ ───────────────────────────────▶│  trigger-sheet-sync      │
│ useSheetSync│                                  │  • verify JWT            │
└─────────────┘                                  │  • require mc_user role  │
       │                                         │  • forward + secret      │
       │                                         └────────────┬─────────────┘
       │                                                      │ ② POST {secret,mode,term,month}
       │                                                      ▼
       │                                         ┌──────────────────────────┐
       │                                         │  Google AppScript (doPost)│
       │                                         │  syncCombinedTallMaster   │
       │                                         │  • read per-LC PnL/CFS tabs│
       │                                         │  • write MASTER_COMBINED_  │
       │                                         │    TALL master tab         │
       │                                         └────────────┬─────────────┘
       │   ③ {ok,rowsWritten,warnings}                        │
       │◀─────────────────────────────────────────────────────┘
       │
       │   ④ syncSheetData()  — read MASTER_COMBINED_TALL via Sheets API v4 (API key)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser parses + aggregates per (entity, month) → upserts to Supabase:   │
│    monthly_metrics · revenue_streams · cost_breakdown                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 1 (Trigger / consolidate):** the browser asks the Edge Function to run the
AppScript, which **rebuilds** the `MASTER_COMBINED_TALL` tab from the raw per-LC sheets.

**Step 2 (Pull / ingest):** once the AppScript returns `ok`, the browser reads the freshly
rebuilt master tab and writes the aggregated results into Postgres.

Both steps are orchestrated by one hook call: [useSheetSync.ts](../../src/hooks/useSheetSync.ts) `sync()`.

---

## 2. Layer-by-layer

### 2.1 Browser — `useSheetSync` hook

File: [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts)

- Exposes `sync({ mode, term?, month? })`, plus `loading`, `result`, `error`.
- `SyncMode`:
  - `"current"` → auto-sets `month` to the first-of-this-month ISO date; AppScript syncs only the latest consolidated workbook.
  - `"term"` → requires `term` (e.g. `"25-26"`); AppScript syncs only that term's workbook.
  - `"all"` → every configured workbook.
- Step 1: `fetch(`${VITE_SUPABASE_URL}/functions/v1/trigger-sheet-sync`)` with the user's
  `session.access_token` as `Bearer`. Sends **only** `{ mode, term, month }` — no secrets.
- Step 2: on `ok`, calls `syncSheetData()` and merges the webhook's `rowsWritten` /
  `warnings` into the `ExtendedSyncResult` shown in the Admin UI.

### 2.2 Edge Function — `trigger-sheet-sync` (the secret-holding proxy)

File: [supabase/functions/trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts)

Deno function. Its entire job is to be a **trusted proxy** so the AppScript webhook URL and
shared secret never reach the browser.

1. **Authenticate** — reads the `Authorization` header, constructs a Supabase client with
   the caller's JWT, calls `supabase.auth.getUser()`. No user → 401.
2. **Authorize** — queries `user_roles` for the user; requires `mc_user`. Else → 403.
3. **Forward** — POSTs `{ secret, sync, mode, term, month }` to the AppScript webhook URL.
   `sync` defaults to `"financial"`; the audit flow sends `"audit"` so the same endpoint
   can route both syncers.
4. **Relay** — returns the AppScript JSON `{ ok, rowsWritten, warnings }` (or `{ ok:false, error }`) verbatim to the browser, with CORS headers.

### 2.3 Google AppScript — `MASTER_COMBINED_TALL` builder

This is **not currently in the repo** (it lives in the Apps Script editor). A reference copy
is committed at [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)
— see §5 for why a committed copy matters and the secret-handling caveat.

Entry point: `doPost(e)`

1. Parses `e.postData.contents` → `{ secret, sync, mode, term, month }`.
2. Rejects if `secret !== WEBHOOK_SECRET` (returns `{ ok:false, error:"Unauthorized" }`).
3. Routes by `sync`:

- `"audit"` → `syncAuditConsolidationMasterSheet(month)`.
- default `"financial"` → `syncCombinedTallMasterSheet(mode, term, month)`.

4. Returns `{ ok:true, rowsWritten, warnings }`.

`syncCombinedTallMasterSheet(mode, filterTerm, filterMonth)`

- Selects which source workbooks to process from `CONSOLIDATED_SHEETS`:
  - `"term"` → only the matching term's workbook.
  - `"current"` → only the **last** entry in `CONSOLIDATED_SHEETS` (latest term).
  - `"all"` (default) → every workbook.
- For each workbook, iterates tabs. A tab is processed if its name **starts with** `PNL` /
  `[PNL]` (→ `Report_Type = "PnL"`) or `CFS` / `[CFS]` (→ `Report_Type = "CFS"`). The LC name
  is the tab name with the `PNL`/`CFS` prefix stripped. Tabs named `CONSOLIDATED` are skipped.
- `_extractTallRows()` per tab:
  - Finds the header row (first row whose col A == `GFB CODE` or col B == `DESCRIPTION`).
  - Treats every column from index 2 onward as a **date column**, parsed by
    `_parseDateHeaderCombTall` into `{ year, month(abbr), date("YYYY-MM-01") }`.
  - For each data row, keeps it only if col A matches `^\d{4}-` (a real GFB code) **or** the
    description is one of the `ALLOWED` summary lines (then `GFB_Code = "SUMMARY"`):
    `LC Revenue, LC Costs, Net Income before NMF & Tax, Total Assets, Total Liabilities,
LC Equity, Cash Inflow, Cash Outflow, Net Cash Movement`.
  - Emits one tall row per (row × non-zero numeric date cell), optionally filtered to
    `filterMonth`.
- `_writeTallSheet()` **clears and overwrites** the `MASTER_COMBINED_TALL` tab (full replace,
  not append) and re-creates a filter.

**Output schema** (the contract Step 2 depends on), one row per line-item-per-month:

| Col | Header        | Example                           | Notes                                                          |
| --: | ------------- | --------------------------------- | -------------------------------------------------------------- |
|   0 | `LC`          | `Kandy`                           | LC name (post-prefix-strip); must match `LC_CODE_TO_NAME` keys |
|   1 | `LC_Term`     | `25-26`                           | term                                                           |
|   2 | `Year`        | `2025`                            | integer                                                        |
|   3 | `Month`       | `Feb`                             | 3-letter abbr                                                  |
|   4 | `Date`        | `2025-02-01`                      | **first-of-month ISO — Step 2's `period_month`**               |
|   5 | `Report_Type` | `PnL` / `CFS`                     | segments PnL vs Cash Flow                                      |
|   6 | `GFB_Code`    | `7001-EX-RV-LC` / `SUMMARY`       | full GFB code                                                  |
|   7 | `Description` | `Direct Revenue: iGV Partner Fee` | line label                                                     |
|   8 | `Amount`      | `50000`                           | numeric LKR                                                    |

> The committed reference is split across [master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)
> and [master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs), which is the
> same layout used by the live Apps Script project. The shared globals are intentional.

### 2.4 Browser — `syncSheetData` (the ingest)

Files: [sync.ts](../../src/integrations/googleSheets/sync.ts),
[client.ts](../../src/integrations/googleSheets/client.ts),
[mapper.ts](../../src/integrations/googleSheets/mapper.ts).

1. **Fetch** — `client.ts` `fetchSheetData()` GETs
   `MASTER_COMBINED_TALL!A1:I10000` via Sheets API v4 using `VITE_GOOGLE_SHEETS_API_KEY`.
2. **Parse** — `mapper.ts` `parseRow()` turns each raw row into a `ParsedRow`:
   - Maps `LC` → entity name via `LC_CODE_TO_NAME`. Unknown LC → row dropped.
   - Looks up `GFB_Code` in the **exact `GFB_DICTIONARY`** to get `{ category, functionCode,
balanceField }`. (This replaced the old prefix/keyword heuristics — see note below.)
   - Categories: `revenue`, `cost`, `balance_sheet`, `cash_flow`, `unknown`.
3. **Aggregate** — `sync.ts` groups rows by `(entityName, periodMonth)` and accumulates:
   - PnL: `totalRevenue`, `totalCost`, plus per-`FunctionCode` revenue/cost.
   - CFS: `inflow`/`outflow`, and balance-sheet fields `bank_balance`, `assets`,
     `receivables`, `petty_cash`, `reserves`, `equity`, `liabilities`.
   - Derived: `npm = (rev-cost)/rev*100`; liquidity = `(bank+receivables)/liabilities`
     (capped at 999 when liabilities = 0); inflow/outflow fall back to PnL-derived values if
     no CFS rows present.
   - **MoCR note:** `petty_cash` and `reserves` are kept **separate** from `assets` to keep
     the MoCR numerator precise; the frontend adds them back for "Total Assets" display.
4. **Upsert** — into Supabase:
   - `monthly_metrics` — upsert on `(entity_id, period_month)`.
   - `revenue_streams` / `cost_breakdown` — **delete-then-insert** per `(entity_id,
period_month)` (no unique constraint on the function dimension), one row per function
     with a non-zero amount.

> **Heuristic → dictionary migration.** Older docs describe classification by GFB-code
> _prefix_ (`7xxx`=PnL, `1xxx`=CFS) and function-code-by-keyword matching. The current
> `mapper.ts` uses an **exact dictionary** (`GFB_DICTIONARY`) keyed on the full GFB code
> (e.g. `7001-EX-RV-LC`). Treat `mapper.ts` as the source of truth.

---

## 3. Secret & key handling (trust model)

| Secret / key                          | Stored where                                     |    Reaches browser?    | Purpose                                    |
| ------------------------------------- | ------------------------------------------------ | :--------------------: | ------------------------------------------ |
| User Supabase JWT                     | Browser session                                  | n/a (originates there) | Authn/authz to the Edge Function           |
| `APPSCRIPT_WEBHOOK_URL`               | Edge Function secret                             |           ❌           | Where the Edge Function calls AppScript    |
| `APPSCRIPT_SECRET` / `WEBHOOK_SECRET` | Edge Function secret + AppScript Script Property |           ❌           | Shared secret AppScript checks in `doPost` |
| `VITE_GOOGLE_SHEETS_API_KEY`          | `.env`, **bundled into browser**                 | ✅ (known limitation)  | Step 2 read of the master tab              |
| `VITE_SUPABASE_URL` / anon key        | Browser                                          |  ✅ (safe by design)   | RLS-enforced DB access                     |
| `SUPABASE_SERVICE_ROLE_KEY`           | Server only (no `VITE_` prefix)                  |           ❌           | Admin server ops (not used by this sync)   |

**Trust boundaries:**

- The **only** privileged secret-bearing hop (browser → AppScript) is gated behind the Edge
  Function's JWT + `mc_user` check. The browser can never call the AppScript webhook directly
  because it never sees the URL or secret.
- The **Step 2 read** is _not_ gated server-side — it uses the public Sheets API key baked
  into the bundle. Anyone with the bundle can read `MASTER_COMBINED_TALL`. The master sheet
  must therefore be considered "readable by anyone with the API key + sheet ID". The
  **writes** that result are still RLS-protected (only MC can write finance tables).

---

## 4. Known issues / deviations (sync-specific)

1. **Sheets API key exposed in the browser bundle** — inherent to the client-side Step 2.
   Mitigation would be to move the read into the Edge Function too.
2. **Stale re-export in [googleSheets/index.ts](../../src/integrations/googleSheets/index.ts)** —
   it re-exports `classifyRow` and `descriptionToFunctionCode`, which no longer exist in
   `mapper.ts` (replaced by `getGfbMapping`). Harmless only as long as nothing imports them;
   clean up the export list.
3. **`revenue_streams` / `cost_breakdown` delete-then-insert is not transactional** — a
   failure between delete and insert leaves a gap for that `(entity, month)` until the next
   successful sync.

---

## 5. Committed AppScript copy & secret externalization

The operational AppScript is mirrored at
[appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs) so the
logic Step 2 depends on is **version-controlled and reviewable** instead of living only in the
Apps Script editor. The committed copy:

- Contains **only the live `doPost` version**.
- Reads the shared secret from `PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")`
  **instead of a hardcoded string**, so no live secret is committed to git.

**To deploy / sync the committed copy back to Apps Script:**

1. Apps Script editor → Project Settings → Script Properties → add `WEBHOOK_SECRET` (and, if
   you externalize them, the spreadsheet IDs).
2. Paste the committed `.gs` content, deploy as a Web App (Execute as: _me_; Access: _Anyone_),
   and keep the deployment URL in the Edge Function's `APPSCRIPT_WEBHOOK_URL` secret.

---

## 6. EFB Audit syncer (BUILT)

> **Status:** implemented in code. The committed Apps Script copy already includes the shared
> `sync` routing branch; the remaining manual step is to fill `AUDIT_SPREADSHEET_ID` in the
> deployed Apps Script project and redeploy both surfaces — see §6.9.

The audit syncer reuses the financial four-layer pattern but with **its own data path**
(source tab, master tab, client module, hook, Admin card, destination table). It **deviates
from the originally-planned "fully independent" design in one way**: per the requirement to
keep it in the **same Apps Script project**, it **shares the single AppScript web-app
endpoint and the single `trigger-sheet-sync` Edge Function**, routed by a `sync`
discriminator (an Apps Script project can host only one `doPost`). See §6.8.

### 6.1 Flow

```
Admin "Run Audit Sync"  (MC only)
   → useAuditSync.sync()        POST { sync:"audit" } + JWT
   → trigger-sheet-sync         verify JWT + mc_user → forward { secret, sync:"audit", … }
   → AppScript doPost           routes on params.sync → syncAuditConsolidationMasterSheet()
        reads "LEY Consolidation" → rebuilds MASTER_AUDIT_TALL (full overwrite)
   → ok { rowsWritten }
   → auditSync.ts syncAuditData()   read MASTER_AUDIT_TALL via Sheets API → audit_scores
```

### 6.2 Source structure — "LEY Consolidation" tab

The source is the **`LEY Consolidation`** tab of the _EFB Audit Performance Dashboard_
workbook — three **stacked LC × month matrices** (col B = section label / LC code; data from
col C; month headers are dates):

| Block (col B)         | Cell values                                                  |
| --------------------- | ------------------------------------------------------------ |
| `Audit Results`       | `Pass` / `Fail`                                              |
| `Audit Scores`        | fraction `0..1` (e.g. `0.93`)                                |
| `Quality Improvement` | month-over-month Δ of score (**derived; ignored on ingest**) |

QI is exactly `score[m] − score[m−1]`, so it is **not stored** — the audit page recomputes it
for display.

### 6.3 AppScript — same project, routed `doPost`

Committed reference: [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs).
Lives in the **same Apps Script project** as the financial builder and **reuses its globals**
— `WEBHOOK_SECRET`, `MASTER_SPREADSHEET_ID`, `_parseDateHeaderCombTall`. **Do not redeclare
those** (one shared namespace → redeclaration error).

One project = one `doPost`, so route on `params.sync`. The committed reference already has
this branch; keep the deployed Apps Script project aligned with it:

```js
var result =
  params.sync === "audit"
    ? syncAuditConsolidationMasterSheet(params.month || null)
    : syncCombinedTallMasterSheet(params.mode || "all", params.term || null, params.month || null);
```

`syncAuditConsolidationMasterSheet(filterMonth?)` opens `AUDIT_SPREADSHEET_ID` →
`LEY Consolidation`, parses the three blocks (`_extractAuditConsolidation`), merges per
`(LC, month)`, and writes `MASTER_AUDIT_TALL` into `MASTER_SPREADSHEET_ID` (full overwrite).
Config constants (not secrets): `AUDIT_SPREADSHEET_ID` (**must be filled in**),
`AUDIT_SOURCE_TAB = "LEY Consolidation"`, `AUDIT_MASTER_TAB = "MASTER_AUDIT_TALL"`,
`AUDIT_TERM = "25-26"`.

**Output schema** (`MASTER_AUDIT_TALL`; the contract `auditSync.ts` depends on), one row per
`(LC, month)`:

| Col | Header                | Example         | → `audit_scores`                                |
| --: | --------------------- | --------------- | ----------------------------------------------- |
|   0 | `LC`                  | `Kandy` / `CC`  | short code/name → entity via `AUDIT_LC_TO_CODE` |
|   1 | `LC_Term`             | `25-26`         | —                                               |
|   2 | `Year`                | `2025`          | —                                               |
|   3 | `Month`               | `Jul`           | —                                               |
|   4 | `Date`                | `2025-07-01`    | `period_month`                                  |
|   5 | `Audit_Result`        | `Pass` / `Fail` | `remarks`                                       |
|   6 | `Audit_Score`         | `0.93`          | `score` (**raw fraction, no scaling**)          |
|   7 | `Quality_Improvement` | `0.06`          | **parsed but not stored** (derived in UI)       |

### 6.4 Edge Function — shared, routed by `sync`

[trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts) forwards
`sync: body.sync ?? "financial"`. Audit calls send `{ sync:"audit" }`; the financial flow
omits `sync` → defaults to `"financial"` (unchanged). Same JWT + `mc_user` gate ⇒ the audit
trigger is **MC-only** server-side.

### 6.5 Client pull — `auditSync.ts`

File: [src/integrations/googleSheets/auditSync.ts](../../src/integrations/googleSheets/auditSync.ts).

- `fetchSheetData(MASTER_SHEET_ID, "MASTER_AUDIT_TALL!A1:H10000")` (reuses the finance
  client + browser API key).
- **`AUDIT_LC_TO_CODE`** normalizes the inconsistent audit labels (some are entity _codes_
  `CC/CN/CS/NSBM/SLIIT/NIBM/USJ`, some are _names_ `Kandy/Rajarata/Ruhuna` whose codes differ
  `KDY/RAJ/RUH`) → entity `code` → `entity_id`. The dashboard covers **10 LCs (no Jaffna)**.
- Stores values **as-is**: `score` = fraction, `remarks` = Pass/Fail, `max_score` = `null`,
  `quarter` = `null`. QI not stored.
- **Delete-then-insert per `(entity_id, period_month)`** — `audit_scores` has no unique
  constraint to upsert on (only the non-unique `idx_audit_entity_period`).

### 6.6 Hook + Admin UI

- [src/hooks/useAuditSync.ts](../../src/hooks/useAuditSync.ts) — two-step (trigger
  `sync:"audit"` → `syncAuditData()`), parallel to `useSheetSync`.
- [\_app.admin.tsx](../../src/routes/_app.admin.tsx) **"EFB Audit Sync"** card → **Run Audit
  Sync** button. MC-only at **two layers**: the Admin route's `beforeLoad` redirects non-MC
  users, and the Edge Function rejects non-`mc_user` with 403.

### 6.7 Audit page UI

[src/routes/\_app.audit.tsx](../../src/routes/_app.audit.tsx) reads `audit_scores`, pivots to
LC × month, and renders three sections in the system design language:

- **Audit Results** — matrix; Pass → green `CheckCircle2`, Fail → red `XCircle`.
- **Audit Scores** — per-LC **line chart** (trend + entity comparison).
- **Quality Improvement** — **line chart** of the derived MoM Δ.
- Date filter **floored at July 2025** (`AUDIT_MIN_DATE`) via the new opt-in `minDate` prop on
  the shared [Filters](../../src/components/Filters.tsx) (other pages unaffected).

### 6.8 Deviations from the original "fully independent" plan

| Original plan                                             | As built                                              | Why                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Separate Apps Script project                              | **Same project**, new file, `doPost` routed by `sync` | Requirement: keep it in the same project; one project allows only one `doPost`.                                                                  |
| Separate `trigger-audit-sync` Edge Function w/ own secret | **Shared `trigger-sheet-sync`**, routed by `sync`     | Same single AppScript endpoint/secret; less infra.                                                                                               |
| New folder paralleling `googleSheets/`                    | **Single `auditSync.ts`**                             | Audit ingest is one tab → one file is enough.                                                                                                    |
| Decide if `efb_user` may trigger                          | **MC-only** (Admin guard + Edge Function)             | `audit_scores` is EFB-writable per RBAC, but the trigger was scoped to MC by request. Loosen the Edge Function role check if EFB should trigger. |

### 6.9 To go live (manual, outside code)

1. Fill **`AUDIT_SPREADSHEET_ID`** in `master-audit-tall-sync.gs`.
2. Redeploy the AppScript — **Manage deployments → edit → New version** (keeps the same
   `/exec` URL).
3. Redeploy the Edge Function — `supabase functions deploy trigger-sheet-sync`.

Then **Admin → Run Audit Sync** runs the whole chain and the EFB Audit tab populates.

---

## 7. File index

| Layer                                    | File                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Admin UI (buttons, results)              | [src/routes/\_app.admin.tsx](../../src/routes/_app.admin.tsx)                                          |
| Orchestration hook (finance)             | [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts)                                           |
| Edge Function proxy (shared)             | [supabase/functions/trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts) |
| AppScript — finance (committed copy)     | [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)                 |
| Sheets API client (shared)               | [src/integrations/googleSheets/client.ts](../../src/integrations/googleSheets/client.ts)               |
| Row parser + GFB dictionary              | [src/integrations/googleSheets/mapper.ts](../../src/integrations/googleSheets/mapper.ts)               |
| Aggregate + upsert (finance)             | [src/integrations/googleSheets/sync.ts](../../src/integrations/googleSheets/sync.ts)                   |
| Public exports                           | [src/integrations/googleSheets/index.ts](../../src/integrations/googleSheets/index.ts)                 |
| **Audit — AppScript (committed copy)**   | [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs)                       |
| **Audit — client pull → `audit_scores`** | [src/integrations/googleSheets/auditSync.ts](../../src/integrations/googleSheets/auditSync.ts)         |
| **Audit — orchestration hook**           | [src/hooks/useAuditSync.ts](../../src/hooks/useAuditSync.ts)                                           |
| **Audit — page UI (matrix + charts)**    | [src/routes/\_app.audit.tsx](../../src/routes/_app.audit.tsx)                                          |
