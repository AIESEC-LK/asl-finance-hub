# User Account Management: Forgot Password, Self Change-Password, Admin Edit/Delete

## Context

Right now (`src/routes/login.tsx`, `src/routes/_app.admin.tsx`) the only post-signup account management is an MC admin assigning a role/entity in the Admin page. There is no way for a user to recover a forgotten password, change their own password, or for an MC admin to remove a user or fix their name — all real gaps for an internal tool where people will inevitably forget passwords or leave AIESEC and need offboarding. This plan adds those four capabilities using Supabase Auth's built-in support, matching this repo's existing patterns.

Key constraint discovered during exploration: **this app builds as a static SPA** (`vite.config.ts` sets `cloudflare: false` + `tanstackStart.spa.enabled`, no `dist/server` worker — see CLAUDE.md). There is no live Node/TanStack server function runtime in production, so `client.server.ts` (the unused service-role client) cannot be wired up via a TanStack `createServerFn` — it would never run once deployed. Every existing privileged operation instead runs as a **Supabase Edge Function** (`trigger-financial-sync`, `pull-financial-data`, etc. in `supabase/functions/`), invoked by the browser via `fetch()` with the user's JWT, verified inside the function, then acting with the service-role key server-side. The new admin-delete-user action must follow this same Edge Function pattern, not a server function.

Scope decisions (confirmed with user):
- Admin edit stays to **name + role + entity** (no email editing — avoids a second privileged Auth Admin API surface for now).
- Delete user uses **soft delete** (`auth.admin.deleteUser(id, true)`).
- Self-service password change **requires re-entering the current password** (reauth via `signInWithPassword`) before calling `updateUser({ password })`.

## Supabase Auth APIs involved (confirmed via current docs)

- `supabase.auth.resetPasswordForEmail(email, { redirectTo })` → sends recovery email; `redirectTo` URL must be allow-listed in Supabase Dashboard → Auth → URL Configuration (Redirect URLs). Implicit flow fits this static SPA (no server-side token exchange needed).
- Client listens for `PASSWORD_RECOVERY` via `supabase.auth.onAuthStateChange`, then calls `supabase.auth.updateUser({ password })` on the recovery-linked session.
- `supabase.auth.updateUser({ password })` — also used for the logged-in self-service change, after reauth.
- `supabase.auth.admin.deleteUser(id, true)` — service-role only, **must run server-side** → new Edge Function. Confirmed `profiles.user_id` and `user_roles.user_id` are `ON DELETE CASCADE` to `auth.users(id)` (`supabase/migrations/20260424043656_...sql`), so no orphan rows to clean up manually.

## Files touched (new)
- `.claude/docs/plans/user-account-management.md` (this plan, persisted project-side)
- `src/routes/forgot-password.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/_app.account.tsx`
- `supabase/functions/admin-delete-user/index.ts`

## Files touched (edited)
- `src/routes/login.tsx` — add "Forgot password?" link
- `src/routes/_app.admin.tsx` — add name edit + delete button/dialog + delete handler
- `src/components/AppShell.tsx` — add nav link to `/account`

---

## Stop Gate 0 — Persist plan to the repo

Before any code changes: copy this plan file into the project at `.claude/docs/plans/user-account-management.md` and commit it (or leave staged, per user preference at the time). This makes the plan reviewable/diffable in-repo and durable beyond the local `~/.claude/plans/` scratch copy.

**⏸ STOP — wait for explicit go-ahead before starting Phase 1.**

---

## Phase 1: Forgot password + reset password flow

### 1a. Forgot password (new route: `src/routes/forgot-password.tsx`)
- Copy the Card/Input/Label/Button structure from `login.tsx`. Single email field, "Send reset link" button.
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`.
- Add a "Forgot password?" link on `login.tsx`'s sign-in view.
- **Action needed on Supabase side**: add `<deployed-origin>/reset-password` to the allow-listed Redirect URLs in Auth settings — flag this explicitly to the user since it's a dashboard change, not code.

### 1b. Reset password landing page (new route: `src/routes/reset-password.tsx`)
- On mount, subscribe to `supabase.auth.onAuthStateChange`; when `event === "PASSWORD_RECOVERY"`, show a "set new password" form (reuse the password `Input` pattern from `login.tsx`, `minLength={6}`, plus a confirm-password field).
- Submit → `supabase.auth.updateUser({ password })` → on success, toast (`sonner`, already used in `_app.admin.tsx`) and `navigate({ to: "/" })`.
- If the page loads without a recovery session (direct nav, expired link), show an error state pointing back to `/forgot-password`.

**Verification for Phase 1:**
- `npm run dev`, sign up a throwaway test account → sign out → click "Forgot password?" → confirm the reset email arrives (or check Supabase Dashboard → Auth → Logs) → follow the link → confirm `PASSWORD_RECOVERY` fires and the new password saves → sign in with the new password.
- Confirm the redirect URL has been allow-listed in Supabase Auth settings for whichever environment is being tested (localhost is usually allow-listed by default for dev).

**⏸ STOP — review Phase 1 in the browser before starting Phase 2.**

---

## Phase 2: Self-service account page

### 2a. New route `src/routes/_app.account.tsx`
- Nests under `_app.tsx` like other authenticated pages (`_app.overview.tsx` etc.) — gets `AuthProvider`/`Gate` for free.
- Two sections in one Card-based page:
  - **Change password**: current password field + new password + confirm. On submit: reauth via `supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })`, then on success `supabase.auth.updateUser({ password: newPassword })`. Show a clear error if current password is wrong (don't leak which field failed beyond "current password incorrect").
  - **Edit name**: full name field pre-filled from `useAuth().profile.full_name`; submit does `supabase.from("profiles").update({ full_name }).eq("user_id", user.id)` — confirmed permitted by the existing `"Users update own profile basic"` RLS policy (`supabase/migrations/20260424043656_...sql:166-168`, `USING (auth.uid() = user_id)`), no migration needed — then call `refresh()` from `useAuth()` to update context.
- Add a nav entry in `AppShell.tsx` sidebar (small, always-visible link, e.g. under the user menu/avatar) pointing to `/account`.

**Verification for Phase 2:**
- Log in → go to `/account` → change password with correct/incorrect current password (confirm the incorrect case is rejected) → edit full name → confirm it reflects immediately (via `refresh()`) and in the Admin table.

**⏸ STOP — review Phase 2 in the browser before starting Phase 3.**

---

## Phase 3: Admin edit name + delete user

### 3a. Edit name (`src/routes/_app.admin.tsx`)
- Add an inline-editable `Input` (or click-to-edit) in the existing user table row next to email, alongside the current Role/Entity `Select`s (`admin.tsx:146-190`). Reuses the same `supabase.from("profiles").update(...)` pattern already used by `setEntity()` (`admin.tsx:109`) — add a sibling `setFullName(uid, name)` function.

### 3b. Delete user
- Add a "Delete" button (shadcn `alert-dialog.tsx` already in `src/components/ui/` for the confirm step — "This will permanently remove {name}'s access. Continue?"). On confirm, POST to a new Edge Function with the user's JWT, following the exact `fetch()` pattern already used in `useSheetSync.ts:47-60` (`VITE_SUPABASE_URL` + `/functions/v1/<name>` + `Authorization: Bearer <access_token>`).
- New Edge Function: `supabase/functions/admin-delete-user/index.ts`. Structure mirrors `trigger-financial-sync/index.ts` exactly:
  1. CORS + OPTIONS handling (copy `corsHeaders` block).
  2. Verify JWT via anon-key client + `auth.getUser()`.
  3. Authorize: caller must have `mc_user` role (same `user_roles` lookup).
  4. Read `{ user_id }` from request body; guard against an admin deleting their own account (`user_id === caller's user.id` → 400).
  5. Use a **service-role client** (`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, mirroring `client.server.ts`'s construction) to call `supabase.auth.admin.deleteUser(user_id, true)`.
  6. Return `{ ok: true }` / error JSON, same shape as the sync functions.
- Add a small inline handler in `_app.admin.tsx` (no need for a full `useX` hook given it's a single action) that does the fetch + reloads the user list (`load()`) on success.
- Deploy note: `npx supabase functions deploy admin-delete-user` (same as documented for the other four functions). `SUPABASE_SERVICE_ROLE_KEY` is provided automatically to every Edge Function by Supabase — no manual secret setup needed here (unlike the AppScript secrets, which are manually configured).

**Verification for Phase 3:**
- As an MC user, go to `/admin`, edit another test user's name, confirm it persists after `load()` re-fetch.
- Deploy `admin-delete-user` to a dev/test Supabase project, then from `/admin` delete the throwaway test user; confirm the row disappears from the admin table and the user can no longer sign in.

**⏸ STOP — review Phase 3 before final wrap-up.**

---

## Final verification (after all phases approved)
1. `npm run lint` and `npm run build` to confirm the new routes compile into `routeTree.gen.ts` correctly (auto-generated, don't hand-edit) and the static SPA build still succeeds.
2. Re-walk all three flows (forgot/reset password, self change-password + name edit, admin edit/delete) end-to-end once more after the full set of changes is in place, to catch any interaction effects (e.g. AppShell nav layout, admin table column widths).
