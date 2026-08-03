# User Account Management: Self Change-Password, Admin Edit/Reset-Password/Delete

## Context

Right now (`src/routes/login.tsx`, `src/routes/_app.admin.tsx`) the only post-signup account management is an MC admin assigning a role/entity in the Admin page. There is no way for a user to change their own password, recover a forgotten one, or for an MC admin to remove a user, reset their password, or fix their name — all real gaps for an internal tool where people will inevitably forget passwords or leave AIESEC and need offboarding. This plan adds those capabilities using Supabase Auth's built-in support, matching this repo's existing patterns.

Key constraint discovered during exploration: **this app builds as a static SPA** (`vite.config.ts` sets `cloudflare: false` + `tanstackStart.spa.enabled`, no `dist/server` worker — see CLAUDE.md). There is no live Node/TanStack server function runtime in production, so `client.server.ts` (the unused service-role client) cannot be wired up via a TanStack `createServerFn` — it would never run once deployed. Every existing privileged operation instead runs as a **Supabase Edge Function** (`trigger-financial-sync`, `pull-financial-data`, etc. in `supabase/functions/`), invoked by the browser via `fetch()` with the user's JWT, verified inside the function, then acting with the service-role key server-side. All new admin actions (reset-password, delete-user) must follow this same Edge Function pattern, not a server function.

### ⚠️ Revision (2026-08-03): email-based forgot-password flow dropped — Supabase free tier can't support it

Checked current Supabase docs. On the free tier, **without a custom SMTP provider**, all auth emails (signup confirmation, password recovery, etc. combined) are rate-limited to **2 emails/hour project-wide**, with no SLA, and are explicitly documented as "for testing only, not production." Setting up custom SMTP (Resend, SES, Postmark, SendGrid, Brevo, ZeptoMail) is the documented fix but is an external/deferred decision, not something to build around right now.

**Decision:** defer the email-based forgot-password flow entirely. `src/routes/forgot-password.tsx` and `src/routes/reset-password.tsx` (built in Phase 1) have been **deleted**, and the "Forgot password?" link on `login.tsx` has been replaced with static text: *"Forgot your password? Contact your MC/EFB admin to reset it."*

**Replacement flow — admin-issued temporary password:**
- An MC admin resets a user's password from `/admin` to a temporary value (`supabase.auth.admin.updateUserById(uid, { password })` — service-role only, confirmed via docs this works and requires no confirmation flow).
- Self-service password change (already-logged-in users, not via a temp password) still requires re-entering the current password, per the original scope decision.

### ⚠️ Revision (2026-08-03, same day): forced "must change password" flow also deferred

Checked docs: **there is no built-in "must change password on next login" flag in Supabase Auth** — it would have to be modeled ourselves (a new `profiles.must_change_password` column + a route-guard redirect). Decided this is more than needed right now: **deferred**, not built.

Simplified replacement: after an admin resets a user's password to a temp value, the user just logs in with it normally and can go to `/account` (Phase 1) whenever they like to set their own password. No forced redirect, no new migration, no new column for this pass.

**If revisited later:** add `profiles.must_change_password boolean not null default false`, set it `true` in `admin-reset-password`, check it in the `_app.tsx` route guard (redirect to `/account` if true and route isn't already `/account`), and clear it in the account page's change-password handler.

### Other free-tier facts confirmed (for reference)
- `supabase.auth.admin.updateUserById` / `deleteUser` — Admin API calls, work on free tier, service-role only, no email involved, no rate limit tied to the email quota.
- `supabase.auth.updateUser({ password })` (self-service, session-based) — normal Auth API, not affected by the email rate limit.
- Free tier Admin API and RLS-enforced queries are otherwise unrestricted by the email quota — only endpoints that **send mail** are capped at 2/hour.

Scope decisions (confirmed with user):
- Admin edit stays to **name + role + entity** (no email editing — avoids a second privileged Auth Admin API surface for now).
- Delete user uses **soft delete** (`auth.admin.deleteUser(id, true)`).
- Self-service password change **requires re-entering the current password** (reauth via `signInWithPassword`) before calling `updateUser({ password })`.
- Forgot-password is **admin-mediated only**, no email involved: admin sets a temp password, user logs in with it and can change it via `/account` whenever they like (no forced redirect — deferred, see above).

## Supabase Auth APIs involved (confirmed via current docs)

- `supabase.auth.updateUser({ password })` — used for the logged-in self-service change (after reauth), including after logging in with an admin-issued temp password.
- `supabase.auth.admin.updateUserById(uid, { password })` — service-role only, **must run server-side** → new Edge Function `admin-reset-password`. Sets the temp password directly, no confirmation flow, not rate-limited by the mail quota (no email sent).
- `supabase.auth.admin.deleteUser(id, true)` — service-role only, **must run server-side** → new Edge Function `admin-delete-user`. Confirmed `profiles.user_id` and `user_roles.user_id` are `ON DELETE CASCADE` to `auth.users(id)` (`supabase/migrations/20260424043656_...sql`), so no orphan rows to clean up manually.

## Files touched (new)
- `.claude/docs/plans/user-account-management.md` (this plan, persisted project-side)
- `src/routes/_app.account.tsx`
- `supabase/functions/admin-reset-password/index.ts`
- `supabase/functions/admin-delete-user/index.ts` (Phase 2; modified in Phase 3 to require prior deactivation + hard delete, not superseded/removed)
- `supabase/migrations/20260803000000_add_profile_deactivation_and_forced_password_change.sql` (Phase 3, built)
- `supabase/functions/admin-deactivate-user/index.ts` (Phase 3, built)
- `supabase/functions/admin-reactivate-user/index.ts` (Phase 3, built)

## Files touched (edited)
- `src/routes/login.tsx` — ~~add "Forgot password?" link~~ **done: replaced with static "contact your admin" text, no email link** (Phase 1, revised)
- `src/routes/_app.admin.tsx` — add name edit + reset-password button + delete button/dialog + handlers (Phase 2); replace delete with deactivate/reactivate (Phase 3)
- `src/components/AppShell.tsx` — add nav link to `/account`

## Files removed
- `src/routes/forgot-password.tsx` (deleted — email-based flow deferred)
- `src/routes/reset-password.tsx` (deleted — email-based flow deferred)
- `supabase/functions/admin-delete-user/index.ts` (Phase 3 — replaced by deactivate/reactivate, pending explicit go-ahead to remove the deployed function too)

---

## ~~Stop Gate 0~~ ✅ done — plan persisted to the repo

---

## ~~Phase 1: Forgot password + reset password flow~~ ✅ built, then reverted (2026-08-03)

Originally built `forgot-password.tsx` + `reset-password.tsx` using `resetPasswordForEmail` / `PASSWORD_RECOVERY` / `updateUser`. Verified working locally. **Reverted** after confirming the free-tier 2-emails/hour cap makes it unusable for real rollout to 11 LCs. Both files deleted; see the revision note above for the replacement design.

**⏸ STOP — review this revision before starting the new Phase 1 (below).**

---

## Phase 1 (revised): Self-service account page (no migration, no forced redirect)

### 1a. New route `src/routes/_app.account.tsx`
- Nests under `_app.tsx` like other authenticated pages — gets `AuthProvider`/`Gate` for free.
- **Change password** section: current password + new password + confirm. Reauth via `signInWithPassword({ email, password: currentPassword })`, then `updateUser({ password: newPassword })`. This is also how a user changes an admin-issued temp password — they log in with it normally, then come here.
- **Edit name** section: full name pre-filled from `useAuth().profile.full_name`; submit does `supabase.from("profiles").update({ full_name }).eq("user_id", user.id)` — confirmed permitted by the existing `"Users update own profile basic"` RLS policy, no migration needed — then `refresh()`.
- Add a nav entry in `AppShell.tsx` sidebar pointing to `/account`.

**Verification for Phase 1 (revised):**
- Log in normally → go to `/account` → change password with correct/incorrect current password (confirm incorrect is rejected) → edit full name → confirm it reflects immediately and in the Admin table.

**⏸ STOP — review Phase 1 (revised) in the browser before starting Phase 2.**

---

## Phase 2: Admin edit name + reset password + delete user

### 2a. Edit name (`src/routes/_app.admin.tsx`)
- Add an inline-editable `Input` in the existing user table row next to email, alongside the current Role/Entity `Select`s (`admin.tsx:146-190`). Reuses the same `supabase.from("profiles").update(...)` pattern already used by `setEntity()` (`admin.tsx:109`) — add a sibling `setFullName(uid, name)` function.

### 2b. Reset password (temp password, no email)
- Add a "Reset password" button per row. On click, POST to a new Edge Function `admin-reset-password` with `{ user_id }`, following the exact `fetch()` pattern already used in `useSheetSync.ts:47-60`.
- New Edge Function `supabase/functions/admin-reset-password/index.ts`, structure mirrors `trigger-financial-sync/index.ts`:
  1. CORS + OPTIONS handling (copy `corsHeaders` block).
  2. Verify JWT via anon-key client + `auth.getUser()`.
  3. Authorize: caller must have `mc_user` role.
  4. Read `{ user_id }` from body.
  5. Generate a random temp password server-side (e.g. crypto-random 10-12 char string).
  6. Service-role client: `auth.admin.updateUserById(user_id, { password: tempPassword })`.
  7. Return `{ ok: true, tempPassword }` — the admin reads it off-screen and relays it to the user manually (Slack/WhatsApp/in person), since we have no email channel. The user logs in with it and can change it themselves via `/account` (Phase 1) whenever they like — no forced redirect (deferred, see revision note above).
- In `_app.admin.tsx`, on success show the temp password in a dialog (e.g. reuse `alert-dialog.tsx`) with a "copy to clipboard" affordance and a note that it's shown once.

### 2c. Delete user
- Add a "Delete" button (shadcn `alert-dialog.tsx` for the confirm step — "This will permanently remove {name}'s access. Continue?"). On confirm, POST to `admin-delete-user` with the user's JWT, same fetch pattern.
- New Edge Function `supabase/functions/admin-delete-user/index.ts`, structure mirrors `trigger-financial-sync/index.ts`:
  1. CORS + OPTIONS handling.
  2. Verify JWT via anon-key client + `auth.getUser()`.
  3. Authorize: caller must have `mc_user` role.
  4. Read `{ user_id }`; guard against an admin deleting their own account (`user_id === caller's user.id` → 400).
  5. Service-role client: `auth.admin.deleteUser(user_id, true)` (soft delete).
  6. Return `{ ok: true }` / error JSON.
- Add inline handlers in `_app.admin.tsx` that do the fetch + reload the user list (`load()`) on success.
- Deploy note: `npx supabase functions deploy admin-reset-password admin-delete-user` (add both to the `deploy:fn` script in `package.json` alongside the existing four). `SUPABASE_SERVICE_ROLE_KEY` is provided automatically to every Edge Function by Supabase — no manual secret setup needed.

**Verification for Phase 2:**
- As an MC user, go to `/admin`, edit another test user's name, confirm it persists after `load()` re-fetch.
- Deploy both new functions to a dev/test Supabase project. Reset a test user's password from `/admin`, confirm the temp password is shown, log in as that user with it, confirm normal access (no forced redirect), then confirm they can change it via `/account`.
- Delete the throwaway test user from `/admin`; confirm the row disappears and the user can no longer sign in.

**⏸ STOP — review Phase 2 before final wrap-up.**

---

## Phase 3: Deactivate/reactivate + gated hard delete + forced password change on reset (2026-08-03)

### Why
- `admin-delete-user` uses `auth.admin.deleteUser(id, true)` — a **soft delete**. Soft delete does not cascade to `profiles`/`user_roles` (only a hard delete does), so the row keeps showing normally in the `/admin` table even after "deletion," which is confusing and was reported by the user as a bug.
- **Revised direction (this pass):** delete becomes a genuine **hard delete** (irreversible, matches the "cannot be undone" copy that was already in the UI), but is only reachable once a user has been deactivated first — a deliberate two-step "cool off then remove" flow, not a one-click permanent action. Deactivate/reactivate remains the everyday offboarding/re-onboarding tool; hard delete is for actually purging an account later.
- Since a migration is happening anyway, also un-defer the "must change password after an admin reset" flow noted in the Phase 1/2 revisions above — it was only deferred because it needed its own column.

### Design
- **Deactivate/reactivate**: Supabase Auth's native ban mechanism — `auth.admin.updateUserById(uid, { ban_duration: '876000h' })` (~100 years, effectively indefinite) blocks sign-in at the auth layer; `ban_duration: 'none'` lifts it. Enforced server-side by Supabase Auth itself (login fails outright), not just hidden in the UI.
- The `/admin` table reads only from `profiles`/`user_roles` (anon-key client, RLS-scoped) — no visibility into `auth.users.banned_until` without a new "list users" Edge Function. Instead: add `profiles.disabled boolean not null default false` as the UI-facing mirror of ban state, written only by the admin Edge Functions.
- **Hard delete gated on deactivation**: `admin-delete-user` (kept, not removed) checks `profiles.disabled` for the target first — if `false`, return a 400 ("Deactivate this user before deleting") instead of proceeding. If `true`, call `auth.admin.deleteUser(uid)` with no soft-delete flag (or explicit `false`) for a real hard delete; `profiles`/`user_roles` rows cascade-delete automatically (`ON DELETE CASCADE`, already confirmed in the original migration).
- **Forced password change on admin reset**: add `profiles.must_change_password boolean not null default false`. `admin-reset-password` sets it `true` after setting the temp password. The `_app.tsx` route guard (or a check inside `Gate`) redirects to `/account` whenever `profile.must_change_password` is true and the current route isn't already `/account`. The account page's change-password handler clears the flag (`must_change_password: false`) on successful `updateUser({ password })`, alongside the existing reauth step.
- All three new/changed columns are admin/self-write-scoped, not blanket user-writable — confirm the "Users update own profile basic" RLS policy's `WITH CHECK` doesn't let a user set `disabled` or `must_change_password` on themselves (only `full_name` should be self-editable; the account page's own name-edit call already only touches `full_name`).

### 3a. Migration
```sql
alter table public.profiles
  add column disabled boolean not null default false,
  add column must_change_password boolean not null default false;
```
- Review/tighten the "Users update own profile basic" UPDATE policy so self-service updates can only touch `full_name` (not `disabled`/`must_change_password`) — e.g. a column-scoped policy or an application-level check confirmed safe, whichever the existing policy shape supports.

### 3b. Edge Functions
- **`admin-deactivate-user`** (new): same auth/authz/self-guard pattern as today's delete function → service-role `updateUserById(uid, { ban_duration: '876000h' })` → `profiles.update({ disabled: true })`. Return `{ ok: true }`.
- **`admin-reactivate-user`** (new): same auth/authz (no self-guard needed) → `ban_duration: 'none'` → `profiles.update({ disabled: false })`. Return `{ ok: true }`.
- **`admin-delete-user`** (modified, not removed): keep the existing JWT/role/self-delete checks; add a lookup of the target's `profiles.disabled` — if not `true`, return 400 with a clear message; otherwise call `auth.admin.deleteUser(uid)` (hard delete — omit/ set the soft-delete arg to `false`). Return `{ ok: true }`.
- **`admin-reset-password`** (modified): after the existing `updateUserById(uid, { password: tempPassword })` call succeeds, also `profiles.update({ must_change_password: true }).eq('user_id', uid)` via the same service-role client, before returning `{ ok: true, tempPassword }`.
- Add `admin-deactivate-user` + `admin-reactivate-user` to `deploy:fn` in `package.json`.

### 3c. `_app.admin.tsx` UI
- `UserRow` gets `disabled: boolean` and (not needed in the table, only relevant on `/account`) — just `disabled` here.
- Row actions become three buttons depending on state:
  - Active (`!disabled`) → "Deactivate" (confirm dialog, reworded: "won't be able to log in until reactivated") + no delete button shown.
  - Deactivated (`disabled`) → "Reactivate" (**confirm dialog**: "This will restore {name}'s access — they'll be able to log in again.") **and** "Delete" (confirm dialog, reworded to make the hard-delete permanence explicit: "This will permanently and irreversibly delete {name}'s account. This cannot be undone.").
- All four destructive/state-changing actions (deactivate, reactivate, delete, **reset password**) go through a confirm dialog — reuse the existing `AlertDialog` with per-action title/description/confirm-label, rather than firing any of them directly on click. Reset password's dialog: "This will set a new temporary password for {name} and require them to change it on next login. Continue?" — the existing "click Reset password → temp password shown in a Dialog" behavior now happens only after this confirm step.
- Show a "Deactivated" badge/muted text next to the name when `disabled` is true, and visually de-emphasize the whole row (e.g. `opacity-60` on the `TableRow`) so deactivated users read as out-of-focus at a glance.
- Disable "Deactivate" for the caller's own row, same as today's delete guard.
- Add a "Show deactivated users" toggle above the table (simple `Checkbox`/`Switch`, default **off**) — when off, filter `users` to `!disabled` before rendering; when on, show everyone. Keeps the default view focused on active users while still making offboarded accounts reachable for reactivate/delete.

### 3d. `_app.tsx` / `_app.account.tsx` — forced password change
- In the `_app` route guard (or a lightweight check rendered inside `Gate`), if `profile.must_change_password` is true and the current path isn't `/account`, redirect to `/account`.
- `_app.account.tsx`'s change-password submit handler: after a successful `updateUser({ password })`, also clear `profiles.must_change_password` for the current user and `refresh()`.
- Optional UX nicety: show a one-line banner on `/account` when arriving because of a forced reset ("Your password was reset by an admin — please set a new one.").

**Verification for Phase 3:**
- Run the migration, regenerate `types.ts`.
- Deploy `admin-deactivate-user`, `admin-reactivate-user`, and the modified `admin-delete-user`/`admin-reset-password`; update `deploy:fn`.
- As MC: deactivate a throwaway test user → confirm "Deactivated" badge shows, user can't log in → try Delete on an **active** user directly (should be blocked/hidden) → reactivate → confirm login works again → deactivate again → Delete → confirm the row is fully gone and the user can never log in again (hard delete, no recovery).
- Reset a test user's password → confirm `must_change_password` gets set → log in as that user with the temp password → confirm they're redirected straight to `/account` regardless of what route they try → change password → confirm the redirect stops happening on subsequent logins.
- Confirm an admin cannot deactivate their own account, and that self-service profile updates still can't set `disabled`/`must_change_password` directly (e.g. via a raw REST call).

**✅ Phase 3 complete (2026-08-03).** Built and deployed:
- Migration `20260803000000_add_profile_deactivation_and_forced_password_change.sql` — adds `profiles.disabled` + `profiles.must_change_password`, plus a `SECURITY DEFINER` trigger (`protect_privileged_profile_columns`) that pins both columns to their old value for any non-service-role UPDATE (a user can flip `must_change_password` `true → false` themselves, e.g. from `/account`, but never `false → true`, and never touches `disabled`). This replaced the originally-planned "tighten the RLS policy" approach from the 3a sketch above — a trigger, not a policy rewrite.
- `admin-deactivate-user`, `admin-reactivate-user` — new Edge Functions, deployed. `admin-deactivate-user` has a self-guard (400 on `user_id === caller.id`).
- `admin-delete-user` — modified to require `profiles.disabled = true` on the target first (400 otherwise), then hard-deletes (`auth.admin.deleteUser(uid)`, no soft-delete flag).
- `admin-reset-password` — modified to set `must_change_password: true` after the password update, **and** (added later this session, beyond the original 3c/3d sketch) a self-guard rejecting `user_id === caller.id` with a 400 — admins must use `/account` to change their own password, not the admin reset button. Client-side, the "Reset password" button is now fully hidden (not just disabled) on the admin's own row in `_app.admin.tsx`, matching the existing self-hide pattern already used for Deactivate.
- `_app.admin.tsx` — deactivate/reactivate/delete/reset-password buttons, confirm dialogs, "Show deactivated users" toggle, deactivated-row styling — all built.
- Forced-redirect-to-`/account` when `must_change_password` is true, plus the `/account` banner and flag-clearing on password change — built.
- All four functions deployed via `--use-api`; `types.ts` regenerated to match.

**⏸ STOP — full browser walkthrough of Phase 3 (deactivate → login-blocked → delete-only-when-deactivated → forced-password-change redirect → admin-cannot-reset/deactivate-self) not yet explicitly confirmed by the user. Do this before considering the plan fully wrapped up.**

---

## Final verification (after all phases approved)
1. `npm run lint` and `npm run build` to confirm routes compile into `routeTree.gen.ts` correctly (auto-generated, don't hand-edit) and the static SPA build still succeeds.
2. Re-walk both flows (self change-password + name edit, admin edit/reset-password/delete/deactivate/reactivate) end-to-end once more after the full set of changes is in place, to catch any interaction effects (e.g. AppShell nav layout, admin table column widths).
3. Nothing has been committed yet — the user commits manually; the assistant must never run `git commit`.

## Deferred (not in this plan)
- Email-based forgot-password self-service flow — blocked on setting up custom SMTP (Resend/SES/Postmark/SendGrid/Brevo/ZeptoMail) in the Supabase Dashboard. Revisit once that's configured; at that point `resetPasswordForEmail` + a `/reset-password` landing page (already built once, see git history) can be reintroduced with minimal changes.
- ~~Forced "must change password on next login" flow~~ **un-deferred in Phase 3** (see above) — now built alongside the deactivate/reactivate migration.
- Admin editing user email — deferred, would need a second privileged Auth Admin API surface.
