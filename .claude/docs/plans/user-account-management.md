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
- `supabase/functions/admin-delete-user/index.ts`

## Files touched (edited)
- `src/routes/login.tsx` — ~~add "Forgot password?" link~~ **done: replaced with static "contact your admin" text, no email link** (Phase 1, revised)
- `src/routes/_app.admin.tsx` — add name edit + reset-password button + delete button/dialog + handlers
- `src/components/AppShell.tsx` — add nav link to `/account`

## Files removed
- `src/routes/forgot-password.tsx` (deleted — email-based flow deferred)
- `src/routes/reset-password.tsx` (deleted — email-based flow deferred)

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

## Final verification (after all phases approved)
1. `npm run lint` and `npm run build` to confirm routes compile into `routeTree.gen.ts` correctly (auto-generated, don't hand-edit) and the static SPA build still succeeds.
2. Re-walk both flows (self change-password + name edit, admin edit/reset-password/delete) end-to-end once more after the full set of changes is in place, to catch any interaction effects (e.g. AppShell nav layout, admin table column widths).

## Deferred (not in this plan)
- Email-based forgot-password self-service flow — blocked on setting up custom SMTP (Resend/SES/Postmark/SendGrid/Brevo/ZeptoMail) in the Supabase Dashboard. Revisit once that's configured; at that point `resetPasswordForEmail` + a `/reset-password` landing page (already built once, see git history) can be reintroduced with minimal changes.
- Forced "must change password on next login" flow after an admin password reset — would need a new `profiles.must_change_password` column + route-guard redirect (no Supabase-native support for this). See revision note above for the exact design if this gets picked back up.
- Admin editing user email — deferred, would need a second privileged Auth Admin API surface.
