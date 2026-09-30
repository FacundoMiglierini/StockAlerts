# Backend — conventions

NestJS API: auth, per-user alarm CRUD. Root context/vision is in the repo
root `CLAUDE.md` — read that first for the overall architecture and the
alarm/strategy data model.

## Stack specifics (bleeding-edge — verify before assuming an API)

Scaffolded with `@nestjs/cli` on 2026-09-06 and it pulled in very recent
majors: Nest 12, TypeScript 6, Vitest 4 (not Jest), Prisma 7. These behave
differently from the tutorials/training-data defaults:

- **ESM throughout.** `package.json` has `"type": "module"`, tsconfig uses
  `module`/`moduleResolution: "nodenext"`. Every relative import needs an
  explicit `.js` extension (`from './foo.js'`), even though the source file
  is `foo.ts`. This is not optional — `nodenext` resolution fails without
  it.
- **Prisma 7 has no datasource URL in schema.prisma.** The connection
  string lives in `prisma.config.ts` (used by the CLI: migrate/generate)
  and is passed to `PrismaClient` at runtime via a driver adapter —
  `@prisma/adapter-pg` here, see `src/common/prisma/prisma.service.ts`.
  Do not add `url = env("DATABASE_URL")` back into the datasource block;
  Prisma 7 rejects it.
- **Prisma CLI's `latest` npm tag currently points at an 8.0.0-rc.**
  Dependencies are pinned to `7.10.0` (last stable) deliberately — don't
  `npm update` prisma/@prisma/client past that without checking dist-tags
  again (`npm view prisma dist-tags`).
- **`prisma init` ships an agent-skills sync feature** that scaffolds
  `.claude/skills`, `.windsurf/skills`, `.agents/skills`, `skills-lock.json`
  into the repo. We deleted those — they're Prisma's own reference docs,
  not project content. If a future `prisma` command regenerates them,
  it's safe to delete again.
- **`PassportModule` must be imported with `.register({ defaultStrategy:
  'jwt' })`**, not bare `PassportModule`, in every module whose controller
  uses `JwtAuthGuard` (currently `auth`, `users`, `alarms`). Bare import
  doesn't provide `AuthModuleOptions` and throws `UnknownDependenciesException`
  at boot.
- **Vitest, not Jest**, is the test runner (`npm test`). `oxlint` is the
  linter (`npm run lint`), not ESLint.
- **Watch the `prisma` CLI version in `package.json`.** It drifted from the
  pinned `7.10.0` down to `6.19.3` at some point mid-session with no
  corresponding command run to explain it (`@prisma/client`/
  `@prisma/adapter-pg` stayed at `7.10.0` the whole time) — root cause never
  identified. A Prisma 6 CLI rejects this schema outright (`schema.prisma`
  has no `url` in the datasource block, which is Prisma 7-only), and the
  Docker build fails on `prisma generate` with a confusing "Argument url is
  missing" error. If that error shows up again: `grep '"prisma"' package.json`
  first — `npm install -D prisma@7.10.0` fixes it.

## Structure

```
src/
  common/
    prisma/        PrismaService (driver-adapter setup), PrismaModule (global)
    guards/         RolesGuard
    decorators/      @CurrentUser, @Roles
    mailer/         MailerService — backend-owned SMTP client (nodemailer),
                    password-reset and invite emails only. Separate from the
                    worker's own SMTP notifier (see below) since these must
                    send synchronously on request, not on the worker's
                    hourly poll — env vars are BACKEND_MAIL_* (mirrors the
                    worker's WORKER_MAIL_* shape under its own prefix)
  modules/
    auth/           login endpoint, JWT strategy/guard; password-reset.service.ts
                    (POST /auth/forgot-password, /auth/reset-password);
                    POST /auth/accept-invite (public — see "Inviting users"
                    below, InvitationService actually lives in modules/users/
                    but is used here too since AuthModule already imports
                    UsersModule)
    users/          user CRUD (admin-only create; no public signup);
                    PATCH /users/me/password self-service (email is the
                    identifier — not editable, anywhere); admin-only roster
                    (GET /users, PATCH /users/:id for enable/disable, DELETE
                    /users/:id) — see "Admin: user management" below;
                    invitation.service.ts (POST /users/invite) — see
                    "Inviting users" below
    notification-channels/  GET/PUT/DELETE /users/me/channels/:type — see
                             root CLAUDE.md's notifications section and
                             worker/CLAUDE.md for the Telegram linking steps
    alarms/         per-user alarm CRUD + strategy param validation
      strategies/strategy-params.schema.ts   <- Zod schema per StrategyType
    portfolios/     bulk alarm creation from a CSV-shaped table — see
                    "Portfolios" below
      recipes/expand-recipe.ts               <- pure rows -> alarms planner
  generated/prisma/  Prisma client output (gitignored, `npx prisma generate`)
prisma/
  schema.prisma
  migrations/
  seed.ts           creates the first admin user from ADMIN_EMAIL/ADMIN_PASSWORD env
```

## Admin: user management

`User.active` (added 2026-09-13, default `true`) is an admin-controlled
kill switch, distinct from a user disabling their own alarms. Checked in
two places so revoking access is immediate, not just for future logins:
`AuthService.login()` (blocks login outright) and `JwtStrategy.validate()`
(runs on every authenticated request — an already-issued JWT for a
disabled user stops working on its very next request, not just at
expiry). `UsersService.setActive()`/`.remove()` both refuse to let an
admin act on their own account (`BadRequestException`) — checked by
comparing the acting admin's id to the target, not by role, so it also
covers an admin acting on another admin. All three admin endpoints
(`GET /users`, `PATCH /users/:id`, `DELETE /users/:id`) are gated with the
same `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` pair the
existing `POST /users` already used.

`User.isDefaultAdmin` (added 2026-09-13, default `false`) marks the single
account `prisma/seed.ts` creates. `setActive()`/`.remove()` also refuse to
act on this account regardless of which admin is asking (checked in
addition to, not instead of, the self-action check above) — there's
always at least one admin left who can recover the system if every other
admin gets disabled by mistake. `GET /users` includes the flag so the
frontend can render this account as protected (no enable/disable/delete
controls) rather than just relying on the 400 it'd get back.

## Inviting users

An admin invites someone by email + role (`POST /users/invite`,
admin-gated) rather than setting their password directly — the existing
`POST /users` (admin sets the password) still exists but the frontend's
Admin page only surfaces the invite flow now. `InvitationService`
(`modules/users/invitation.service.ts`) reuses `PasswordResetService`'s
token shape exactly: a random 32-byte token, only its sha256 hash stored
(+ 1-hour expiry) in `UserInvitation`, emailed as a link via
`MailerService.sendInviteEmail()`. Differences from password reset:

- **Not public** — `POST /users/invite` is admin-gated, so unlike
  `forgot-password` there's no email-enumeration concern. A mail-send
  failure is thrown back to the calling admin as a 400 instead of being
  logged and swallowed — they need to know delivery failed so they can
  retry.
- A fresh invite for the same email deletes any still-outstanding
  (unaccepted) one first — only the most recently sent link works.
- Accepting (`POST /auth/accept-invite`, public, token + password)
  creates the actual `User` row with the invited `role` in the same
  transaction that marks the invitation `acceptedAt` — unlike password
  reset, which updates an existing user.

No relation from `UserInvitation` to `User`: the invitee doesn't have an
account until they accept, and `invitedByEmail` is a snapshot rather than
a FK so the row stays meaningful even if the inviting admin is later
removed.

## Password reset

Token flow (`password-reset.service.ts`): `POST /auth/forgot-password`
generates a random 32-byte token, stores only its sha256 hash (+ 1-hour
expiry) in `PasswordResetToken`, and emails the plaintext token as a link
via `MailerService`. Never returns anything other than 204 — whether the
email exists or the email send itself fails is deliberately swallowed
(logged, not thrown) so a caller can't distinguish "no such account" from
"account exists but mail delivery broke" by response code. `POST
/auth/reset-password` looks up by the hash, checks not expired/not
already used, updates the password, and deletes any other outstanding
tokens for that user in the same transaction. Requires `FRONTEND_URL` (no
trailing slash) to build the emailed link.

## Portfolios: bulk alarm creation

Replaces loading alarms one by one (added 2026-09-20). A `Portfolio`
(`id, userId, name`, unique per user) groups the alarms one import
creates; `Alarm.portfolioId` is nullable (null for hand-made alarms) and
`ON DELETE CASCADE`, so deleting a portfolio deletes its alarms. The worker
never reads `portfolioId` — it's purely a backend/UI grouping key, so the
"communicate only through the DB" rule is untouched (`db.py` selects an
explicit column list, so the new column doesn't affect it).

Endpoints (all JWT-guarded, scoped to the caller): `GET /portfolios` (with
`alarmCount`), `POST /portfolios/preview` (200, writes nothing),
`POST /portfolios` (one transaction: portfolio + every alarm, or nothing;
409 on a duplicate name), `DELETE /portfolios/:id`. The UI sends the
**same payload** to preview and create (`{ name, recipe, rows, options? }`),
so `PreviewPortfolioDto` tolerates `name` — the global `ValidationPipe`
forbids unknown properties.

`recipes/expand-recipe.ts` is a pure `expandRecipe(recipe, rows, options)
-> { alarms, errors }`; the DTO only validates the envelope, and each row
is validated there (Zod) so one bad row becomes a per-row `{ row, message }`
error instead of a 400 on the first problem. Create refuses if `errors` is
non-empty. Both recipes emit `MANUAL_THRESHOLD` alarms (BUY at `trigger`,
then SELL at `target`), and every generated alarm is re-checked against
`strategyParamsSchemas`:

- `EXPLICIT_THRESHOLDS`: row = `ticker, market, trigger, target`, 1 alarm.
- `DRAWDOWN_LADDER`: row = `ticker, market, reference`, plus import-wide
  `options { dropPct, gainPct, entries }` (fractions, `entries` 1–10). This
  is the old script's `--newtrades`: `trigger_i = reference × (1 − dropPct)^i`,
  `target_i = trigger_i × (1 + gainPct)`, prices **frozen at import time**
  (the reference is the caller's number — the backend has no price data;
  the old script used the last `argrelextrema` local high). Rounded to 2
  decimals, or 6 when the reference is below 1 (sub-dollar crypto).

Rules worth knowing before touching it: tickers are **bare** (same mapping
as the frontend — the worker's `resolve_symbol()` appends `.BA`/`-USD`),
so a BYMA ticker ending `.BA` or a CRYPTO ticker ending `-USD` is
rejected rather than silently stripped; `market` is case-insensitive;
numeric cells may be numbers or numeric strings (raw CSV cells pass
through); duplicate `ticker+market` rows in one import are rejected; at
most 500 rows and 500 resulting alarms per import. The backend can't tell
whether a rung's trigger is already above the current price — such a rung
fires on the worker's next tick, so reference prices should be checked
before importing.

## Alarms: adding a new strategy type

1. Add the value to the `StrategyType` enum in `prisma/schema.prisma`, then
   `npx prisma migrate dev --name add_<type>_strategy`.
2. Add its Zod param schema to `strategyParamsSchemas` in
   `src/modules/alarms/strategies/strategy-params.schema.ts`. This is the
   single point of truth for what a valid `params` payload looks like for
   that strategy — the worker's evaluator should mirror the same shape.
3. Nothing else in `alarms.service.ts`/`alarms.controller.ts` needs to
   change — params validation and CRUD are strategy-agnostic by design.

## Testing

Unit tests are `*.spec.ts`, **co-located next to the file they test** in
`src/` (Nest/Vitest convention) — not in `test/`, which is reserved for
end-to-end specs (`*.e2e-spec.ts`, run via `npm run test:e2e` /
`vitest.config.e2e.ts`). Both configs pick up `globals: true` +
`types: ["vitest/globals"]` (see `tsconfig.json`), so `describe`/`it`/
`expect`/`vi`/`beforeEach` are used **without importing them** — that's
intentional, not a missing import.

Coverage so far: `alarms.service`, `users.service`, `auth.service`,
`notification-channels.service`, and `strategy-params.schema` (every
strategy type's valid/invalid/default-filling cases). All of them construct
the service directly with a hand-rolled Prisma mock (`{ alarm: { findMany:
vi.fn(), ... } }` cast to `PrismaService`) rather than going through Nest's
`Test.createTestingModule` — there's no DI wiring worth testing here, just
plain method logic, so building the module is pure overhead. `bcrypt` is
mocked in `users.service.spec.ts` (real bcrypt is deliberately slow) with a
fake hash format (`` `hashed:${plain}` ``) that a fake `compare` can check
against — swap both if bcrypt's usage ever changes shape.

**`test/` now has real e2e coverage** (34 tests, `auth`/`alarms`/
`portfolios`/`notification-channels`): full HTTP requests via `supertest` against a real
Nest app (`test/helpers/app.ts` mirrors `main.ts`'s setup) and a real
Postgres — `docker-compose.yml`'s `postgres-test` service, profile-gated
(`profiles: ["test"]`) so a plain `docker compose up` never starts it, on
port 5433 with `tmpfs` storage so it's always empty on a fresh start. Start
it once with `docker compose --profile test up -d postgres-test`, then
`npm run test:e2e` — `test/global-setup.ts` applies migrations
automatically (idempotent: safe to leave the container running across
runs). `test/setup-env.ts` loads `.env.test` (copy `.env.test.example`) so
`DATABASE_URL` etc. point at port 5433, not the dev database on 5432 —
**never point `.env.test` at the dev DB**, since `test/helpers/reset-db.ts`
truncates `users`/`alarms`/`notification_channels` before every single
test.

Arrange-via-service, assert-via-HTTP is the pattern throughout: e.g.
`usersService.create(...)` (grabbed via `app.get(UsersService)`) to seed a
user directly, then real `supertest` requests to exercise the actual
HTTP/auth/validation layers. `fileParallelism: false` in
`vitest.config.e2e.ts` — these tests share one real database via truncation
between tests, so they can't run concurrently against it.

## Running locally

```bash
docker compose up -d postgres        # from repo root
npm install
npx prisma migrate dev               # apply schema, generate client
npm run seed                         # creates admin user from .env
npm run start:dev
```

`.env` (gitignored) holds `DATABASE_URL`, `JWT_SECRET`,
`JWT_EXPIRES_IN_SECONDS` (a number of seconds, not a duration string —
avoids `@nestjs/jwt`'s `ms`-string typing), the seed script's
`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `FRONTEND_URL` (builds the password-reset
email's link), and `BACKEND_MAIL_*` (SMTP creds for that email — the app
boots fine with these blank, since `ConfigService.getOrThrow` only throws
on an unset key, not an empty one; sending will just fail at request time
until real creds are set). See `.env.example`.

## Docker

`Dockerfile` builds once and copies the full `node_modules` (including
`prisma` CLI) into the runtime stage, because `docker-entrypoint.sh` runs
`prisma migrate deploy` before starting the app — there's no separate
migration step/job yet. Base image is `node:22-slim` (not `alpine`): several
native deps (`bcrypt`, Prisma's engine detection) expect glibc, not musl.
