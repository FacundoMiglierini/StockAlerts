# Frontend — conventions

React + Vite SPA: login, per-user alarm CRUD, Telegram linking. Root
context/vision is in the repo root `CLAUDE.md`. `backend/CLAUDE.md`
documents the API this talks to.

## Stack specifics

Scaffolded 2026-09-06 with very recent majors — same caveat as the other
services: verify an API before assuming training-data defaults still
apply.

- React 19, Vite 8, TypeScript 6, `oxlint`. `moduleResolution: "bundler"`
  (unlike the backend's `nodenext`) — relative imports do **not** need a
  `.js` extension here.
- `erasableSyntaxOnly: true` in `tsconfig.app.json` forbids TS constructs
  that need runtime code beyond type erasure: no `enum`, no constructor
  parameter properties (`constructor(public x: string)`), no namespaces.
  `src/api/client.ts`'s `ApiError` declares `status` as a field and assigns
  it in the constructor body for exactly this reason.
- React 19's `<SomeContext value={...}>` (no `.Provider`) and the `use()`
  hook are used in `src/auth/AuthContext.tsx` — don't "fix" these back to
  the older `.Provider`/`useContext` forms, they're intentional.
- Auth is a bare JWT in `localStorage` (`src/api/client.ts`), sent as
  `Authorization: Bearer`, not a cookie — so the backend's CORS is a
  wide-open `app.enableCors()` (see `backend/src/main.ts`) with no CSRF
  exposure from that choice.

## Structure

```
src/
  api/client.ts          fetch wrapper: base URL, auth header, error parsing
  auth/AuthContext.tsx    login/logout state, current user, token persistence
  types.ts                 mirrors backend/prisma/schema.prisma's enums/shapes
  strategies.ts            per-StrategyType form fields + labels — mirrors
                            backend's strategy-params.schema.ts
  validation.ts            client-side validators: email shape, ticker shape,
                            per-strategy cross-field checks (mirrors the
                            backend Zod schema's .refine() where one exists;
                            the rest are UX-only, not backend-enforced)
  tickers.ts               static curated ticker shortlists per market for
                            the autocomplete dropdown — convenience only, not
                            validation (see file header for why static).
                            BYMA entries (Merval shares and CEDEARs alike)
                            are stored WITHOUT a ".BA" suffix — the worker's
                            resolve_symbol() (worker/worker/market.py) always
                            appends ".BA" itself for any BYMA alarm; baking
                            it in here double-suffixes and breaks the fetch
  components/
    Layout.tsx              header nav (Alarms/Settings/Admin, the last only
                             when user.role === 'ADMIN') + <Outlet/>; mobile
                             nav collapses behind a hamburger toggle (<860px)
    ProtectedRoute.tsx       redirects to /login if not authenticated
    AdminRoute.tsx           nested inside ProtectedRoute; redirects non-admins
                             to /alarms — the actual authorization is
                             backend-enforced (@Roles(ADMIN)), this is UX only
    AlarmForm.tsx            create alarm, params fields driven by
                              strategies.ts; params are edited as strings,
                              not numbers (see in-file comment on why —
                              avoids a stuck-leading-zero bug)
    AlarmList.tsx            list + status actions (enable/disable/re-arm/
                              delete); delete goes through ConfirmDialog
    FiltersBar.tsx           client-side market/status/date-range filtering
                              for AlarmsPage — no backend query params, the
                              full list is already fetched
    TickerInput.tsx          ticker field with a searchable autocomplete
                              dropdown (tickers.ts); still free text
    Modal.tsx                generic centered modal (Escape/backdrop close)
    ConfirmDialog.tsx        Modal-based yes/no prompt — used for delete
                              alarm/user, disable user, and logout
    InviteUserModal.tsx      Modal-based email + role picker, POST
                              /users/invite — used from AdminPage.tsx
    Toast.tsx                ToastProvider/useToast — bottom-right
                              success/error popups, 4s auto-dismiss
    ThemeContext.tsx         ThemeProvider/useTheme — 'system'|'light'|'dark',
                              persisted in localStorage, applied as
                              data-theme on <html>. index.html has a small
                              inline script that reads the same storage key
                              and stamps data-theme before first paint, so
                              switching to it doesn't need a build step and
                              there's no flash of the wrong theme on load
  pages/
    LoginPage.tsx            client-side email/required checks backstop the
                              native type="email"/required constraints;
                              "Forgot password?" links to /forgot-password
    ForgotPasswordPage.tsx   email -> POST /auth/forgot-password -> always
                              shows the same "check your inbox" state,
                              regardless of whether the email exists
    ResetPasswordPage.tsx    reads ?token= from the URL (the emailed link),
                              new/confirm password -> POST /auth/reset-password
    AcceptInvitePage.tsx     same shape as ResetPasswordPage but for a new
                              account: reads ?token= from the emailed invite
                              link, new/confirm password -> POST
                              /auth/accept-invite -> "go to sign in" (no
                              auto-login, matching the reset-password flow)
    AlarmsPage.tsx           fetches/mutates alarms via api/client.ts; desktop
                              "New alarm" opens AlarmForm in a Modal, mobile
                              keeps the full-page /alarms/new flow; renders
                              FiltersBar above AlarmList when there's at
                              least one alarm
    CreateAlarmPage.tsx      mobile-only full-page alarm creation
    SettingsPage.tsx         Appearance (theme picker, via ThemeContext) +
                              Telegram chat id linking (PATCH /users/me)
    AdminPage.tsx            admin-only user roster (GET /users): a <table>
                              on desktop, a card list on mobile (CSS-toggled
                              at the same 860px breakpoint as everywhere
                              else), both driven by the same data — disable
                              goes through ConfirmDialog (revokes access),
                              enable doesn't (reversible, low-stakes).
                              "Invite" opens InviteUserModal (POST
                              /users/invite: email + role, no password set
                              here — see backend/CLAUDE.md's "Inviting
                              users"). A row with isDefaultAdmin true never
                              gets action buttons, self or not — it shows a
                              locked "Default admin" note instead (LockIcon)
                              since the backend rejects disabling/deleting
                              it unconditionally
```

## Keeping strategies.ts in sync

`STRATEGY_FIELDS` in `src/strategies.ts` must mirror
`backend/src/modules/alarms/strategies/strategy-params.schema.ts` exactly —
field names, and reasonable defaults/ranges. It's duplicated by hand rather
than shared/generated because the two are in different languages/runtimes
(bundled browser TS vs. server TS) and the field list changes rarely. When
adding a strategy type, update both, plus the worker's registry (see
`worker/CLAUDE.md`) — three places, by design (see root `CLAUDE.md`'s
strategy registry note).

## Running locally

```bash
cp .env.example .env.local   # VITE_API_URL, defaults to http://localhost:3000
npm install
npm run dev                  # http://localhost:5173
```

Needs the backend running and reachable at `VITE_API_URL` (`docker compose
up -d postgres backend` from the repo root is enough — the frontend doesn't
need the worker to demo alarm CRUD, only to see alarms actually trigger).

## Docker

Static build served by nginx (`Dockerfile`, `nginx.conf`) — matches the
root `CLAUDE.md`'s "no SSR, served via Caddy/Nginx" call. `VITE_API_URL` is
a **build-time** value (Vite inlines `import.meta.env.VITE_*` at build,
there's no runtime env for a static SPA) — passed as a Docker build arg in
`docker-compose.yml`. Changing it means rebuilding this service
(`docker compose up -d --build frontend`), not just restarting it.

`nginx.conf` does `try_files $uri /index.html` so client-side routes
(`/alarms`, `/settings`) don't 404 on a hard refresh.

## Browser verification

As of 2026-09-13, the UI has been clicked through end-to-end in a real
Chrome session against the dockerized stack — not just `npm run build`/
`npm run lint`. Covered across two passes that day: login success/failure,
create/disable/delete an alarm, the desktop modal and mobile full-page
create flows, the mobile nav dropdown, the SMA cross-field validator; then
the alarm filters bar (market/status/date-range, empty-state message,
clear-filters), the redesigned alarm card, the admin tab (create/disable/
enable/delete another user via curl + UI, self-action blocked, a disabled
user's login and live session both actually rejected), and the full
password-recovery flow (forgot-password's always-succeeds response,
mismatched-passwords validation, a real reset via a token pulled from the
DB, confirming the old password stops working and the token is single-use).
Do the same after any UI change: `docker compose up -d --build frontend`
bakes a fresh image, but the running container isn't recreated by `build`
alone — follow it with `docker compose up -d frontend`, and hard-reload
(`location.reload(true)` or devtools "Empty cache and hard reload") since
the browser can otherwise keep serving a stale bundle under the same dev
URL. Real narrow-viewport testing (`resize_window`) was unreliable in that
environment; the fallback that worked every time was injecting a `<style>`
override reproducing the `@media (max-width: 860px)` rules at full window
width — good enough to confirm the mobile CSS branch renders, not a
substitute for a real device/emulator pass before shipping something
layout-sensitive.
