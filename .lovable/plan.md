
# AIESEC Sri Lanka — Finance Intelligence Dashboard

A secure, role-based finance dashboard for ASL with national + LC views, audit tools, and live Google Sheets sync.

## Auth & RBAC (foundation)
- **Email + password** sign-in (Lovable Cloud auth).
- **Roles table** (`user_roles`) separate from profiles: `lc_user`, `mc_user`, `efb_user`, plus `entity_id` on profile for LC users.
- **Postgres RLS** enforces:
  - LC users → only rows where `entity = their_entity`
  - MC users → all entities, read/write on allowed tables
  - EFB users → read-only across all entities
- Server-side filter layer on every query (defense in depth, not just UI).
- Auto-locked Entity filter for LC users (hidden, not just disabled).

## Data sync from Google Sheet
- **Google Sheets connector** (OAuth) pulling from your sheet ID.
- Server function `syncFinanceData` parses tabs into normalized tables: `entities`, `monthly_metrics`, `revenue_streams`, `cost_breakdown`, `budget_actual`, `audit_scores`, `monthly_review`.
- Manual "Refresh" button + scheduled background sync (hourly).
- Handles missing values, normalizes dates, maps function codes (iGV/iGT/oGV/oGT/ELD/EwA/BD).
- Schema designed first; if sheet columns differ we map best-effort and flag gaps.

## Pages

**1. Home Dashboard (Global Overview)**
KPI cards: Global Ranking, AP Ranking, Total Revenue, NPM, GPM, Equity Growth, Finance Health Index, Finance OD Score. Trend sparklines.

**2. LC Dashboard**
- Bank balance line chart (time-series)
- Inflow vs Outflow bar, Net Cash Movement
- Assets / Liabilities / Receivables / Liquidity / Equity cards
- Revenue & Cost breakdown by function (pie + stacked bar)
- GPM by function

**3. Budget vs Actual**
Variance table, color-coded (green/amber/red), drill by function.

**4. Performance Analysis**
- Date range picker (to-date cumulative OR custom period)
- Period vs period (Q1 vs Q2, term vs term)
- Entity vs national average (MC/EFB only)

**5. EFB Audit & Reports**
Monthly audit breakdown, quarterly reports, audit scoring, export.

**6. Finance Monthly Review**
Pass/fail tracker, remarks history per LC.

**7. Help & Contacts**
Key finance roles directory.

## Global filters (RBAC-aware)
Entity (locked for LC) · Date range · Function · Term — all charts react live.

## Design
AIESEC palette (#037EF3 primary, #0CB9C1, #F48924, #F85A40, #7552CC, #00C16E, #FFC845, neutrals #52565E / #F5F5F5). Clean corporate cards + tabs, shadcn/ui, recharts. Fully responsive.

## v1 scope
**Ship everything** in one build: Auth/RBAC + Sheets sync + all 7 pages + filters. EFB and Monthly Review will use the same sync pipeline so adding them now is cheap.

## Post-approval setup needed from you
1. Connect Google Sheets (OAuth prompt)
2. Create first MC admin account (you'll then assign roles/entities to other users from an admin panel)
