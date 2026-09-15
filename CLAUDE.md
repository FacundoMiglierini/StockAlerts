# Stock Alerts — project context

## Vision

Personal stock price alert system. Evolves a single Python script (yfinance +
CSV-based alarms) into a proper multi-service app: configurable, built-in
alert strategies plus manual price alerts, a web UI, and multi-user access
for a small trusted group. Self-hosted on a home Linux server.

## Architecture

Monorepo, three services, communicating **only through the shared
PostgreSQL database** — no direct RPC/HTTP between backend and worker.

```
stock-alerts/
  backend/     NestJS — auth, CRUD for users/alerts/strategies, REST + WebSocket API
  worker/      Python — cron job: fetches prices, evaluates strategies, writes triggered alerts
  frontend/    React (Vite, SPA, static build) — dashboard, alert management
  docker-compose.yml
```

Rationale for splitting backend and worker by language: the strategy engine
(moving averages, RSI, MACD, Bollinger Bands, support/resistance) is a
numerical/pandas problem where Python's ecosystem (`pandas-ta`, `ta`, `scipy`)
is far more mature than anything available in the Node ecosystem. NestJS +
Clean Architecture is used for the API/auth/business-rules layer, which is
where that pattern earns its keep.

## Tech stack

- **Backend**: NestJS, Clean Architecture, TypeScript, Passport + JWT.
- **Worker**: Python, pandas, pandas-ta (or `ta`), APScheduler or system cron.
  No Celery/Redis for v1 — keep the process count low given the 8GB RAM budget.
- **Frontend**: React + Vite, built as a static SPA (no SSR — served via
  Caddy/Nginx to save memory on the home server).
- **Database**: PostgreSQL (not SQLite — two processes write/read
  concurrently, and SQLite's file locking doesn't handle that well at this
  scale).
- **Deployment**: Docker Compose on a home Linux server, 8GB RAM total
  budget. Ballpark footprint: NestJS ~150-250MB, worker ~150-300MB (spikes
  during computation), Postgres ~200-400MB, Nginx/Caddy negligible. Monitor
  with `docker stats` after first deploy rather than trusting these numbers
  blindly.

### Deploying for free (frontend on Netlify, backend/worker on a home server)

Chosen split (2026-09-13): the frontend is a static SPA build, deployed to
**Netlify** (free `*.netlify.app` subdomain, free HTTPS) straight from the
`frontend/` directory — no home-server RAM/bandwidth spent serving it, and
Netlify's own build step reads `VITE_API_URL` as a build-time env var the
same way `docker-compose.yml`'s `frontend` service's build `args` do
locally. Backend, worker, and Postgres stay home-hosted via
`docker-compose.yml` — they need to reach the DB and hold secrets.

The gap this split creates: Netlify needs a public HTTPS URL for the
backend, and there's no purchased domain. Solved with **Tailscale
Funnel** rather than router port-forwarding + a free dynamic-DNS
subdomain (the more "traditional" option) — Funnel needs no port
forwarding at all and works even behind CGNAT, which residential ISPs
increasingly use and which silently breaks port-forwarding entirely.
`docker-compose.yml`'s `tailscale` service (`profiles: ["funnel"]` — never
started by a plain `docker compose up`, only relevant on the actual
home-server deploy) is a sidecar on `network_mode: "service:backend"`, so
from inside it `backend`'s port 3000 is just `localhost:3000`.

Everything below is the actual, ordered checklist for taking this from
local dev (this repo, `docker compose up` on a laptop) to the real split —
Postgres/backend/worker on the Mini PC, frontend on Netlify. Nothing here
has been run against the Mini PC yet; local dev has only ever exercised
`docker-compose.yml`'s default services.

**Part A — Postgres/backend/worker on the Mini PC**

0. Prerequisites on the Mini PC: Docker + the Compose plugin installed,
   this repo cloned/pulled there, and a real `.env` (`cp .env.example .env`
   then fill in every secret for real — `JWT_SECRET` to a fresh random
   value, `ADMIN_EMAIL`/`ADMIN_PASSWORD` to the real admin login,
   `BACKEND_MAIL_*`/`WORKER_MAIL_*` to a real SMTP credential (a Gmail
   app-password works, or a free-tier transactional provider like
   Brevo/Resend — emails silently fail-log rather than crash anything if
   left blank, but nobody receives them), `WORKER_TELEGRAM_BOT_TOKEN` if
   Telegram notifications matter, `WORKER_FINNHUB_API_KEY` only if that
   integration is ever flipped on. Leave `FRONTEND_URL` at its default for
   now — step 6 below comes back to it once the Netlify URL actually
   exists.
1. `docker compose up -d --build postgres backend worker` — **deliberately
   not `frontend`**: that service is only for local dev against this
   repo's own nginx container; the real frontend is Netlify-hosted (Part
   B), so running it here too would just burn RAM for a container nothing
   points at. Migrations apply automatically
   (`docker-entrypoint.sh` runs `prisma migrate deploy` on backend boot —
   see `backend/CLAUDE.md`'s Docker section), so no separate migration
   step is needed.
2. Generate a **reusable, non-ephemeral** Tailscale auth key at
   https://login.tailscale.com/admin/settings/keys, set it as `TS_AUTHKEY`
   in the Mini PC's `.env`.
3. In the Tailscale admin console's DNS tab, enable **HTTPS Certificates**
   for the tailnet — Funnel won't issue a cert without this.
4. `docker compose --profile funnel up -d tailscale`
5. `docker compose exec tailscale tailscale funnel --bg 3000` — one-time;
   the resulting config persists in the `tailscale_state` volume across
   restarts. Prints the public URL, e.g.
   `https://stock-alerts.<your-tailnet>.ts.net` — copy it, Part B needs it.
   If it errors asking for Funnel to be enabled, add to the tailnet's ACL
   policy: `"nodeAttrs": [{"target": ["autogroup:member"], "attr":
   ["funnel"]}]`.

Postgres and the worker are never exposed — only `backend`'s port needs a
public URL, and CORS is already wide-open (`app.enableCors()` in
`backend/src/main.ts`), so no backend code change is needed for the
Netlify origin specifically.

**Part B — Frontend on Netlify**

0. This repo has no git remote yet — Netlify's standard flow needs one
   (GitHub/GitLab/Bitbucket) to build from on every push. Push it to a
   GitHub repo first, or use `netlify deploy` (Netlify CLI) for a one-off
   manual deploy if a git remote isn't wanted yet.
1. In Netlify, "Add new site" → "Import an existing project" → pick the
   repo. Build settings: **Base directory** `frontend`, **Build command**
   `npm run build`, **Publish directory** `dist` (relative to the base
   directory).
2. Before the first deploy, add a site (or "deploy context") environment
   variable: `VITE_API_URL` = the Funnel URL from Part A step 5. This is
   read at **build time** (Vite inlines `import.meta.env.VITE_*`), same as
   `docker-compose.yml`'s `frontend` build `args` do locally — so changing
   it later always needs a re-deploy, not just a page refresh.
3. Deploy. Note the resulting `https://<site-name>.netlify.app` URL.

**Part C — Wire them together**

4. Back on the Mini PC, set `FRONTEND_URL` in `.env` to that Netlify URL
   (no trailing slash) — this is what password-reset/invite emails link
   to.
5. `docker compose up -d backend` — **not** `docker compose restart
   backend`. Compose only re-reads `.env`/interpolated environment values
   when a container is (re)created, not on a plain restart of an existing
   one; a restart silently keeps serving whatever `FRONTEND_URL` (or any
   other var) the container booted with. This bit twice during local
   testing of unrelated env changes this same way — always `up -d
   <service>` after editing `.env`, never just `restart`.
6. Verify from a network that isn't the tailnet (e.g. phone on cellular)
   that the Funnel URL responds — confirms it's really public, not just
   tailnet-reachable.
7. Smoke-test end to end from the actual Netlify URL: log in, confirm
   alarms load (proves CORS + Funnel + `VITE_API_URL` are all wired
   correctly); run "Forgot password?" and confirm the emailed link points
   at the Netlify domain, not `localhost` (proves `FRONTEND_URL`); check
   `docker compose logs worker` on the Mini PC for a clean evaluation pass
   with no crashes.

## Data provider strategy

**Revised after testing against a real Finnhub key:** Finnhub's free tier
no longer includes historical daily candles (`/stock/candle` returns 403,
"You don't have access to this resource" — paid-plan-only now). Free tier
still gives real-time quotes (`/quote`), just not the history the strategy
engine needs. So for now: **`yfinance` is the sole practical provider**
(free, no key, but unofficial and can break without notice). Finnhub
integration is still implemented and wired in behind the same
`PriceProvider` port — it's just off by default
(`WORKER_FINNHUB_HISTORY_ENABLED=false`) since trying it on a free-tier key
would just fail every ticker, every tick. Flip it on if the Finnhub plan is
ever upgraded.

Price fetching lives behind a `PriceProvider` port/interface (same
ports-and-adapters idea as Clean Architecture) so swapping or adding a
provider never touches the strategy engine.

## Auth model

Small trusted user group, not public signup. No self-registration endpoint —
accounts are created by the admin (seed script, or by inviting someone by
email + role — they set their own password via an emailed link, see
backend/CLAUDE.md's "Inviting users"). JWT-based sessions. Each user sees
their own alerts by default; add sharing/roles later only if actually
needed.

One admin account — the one `prisma/seed.ts` creates — is protected:
other admins can view it but can never disable or delete it (`User.
isDefaultAdmin`), so there's always at least one admin left who can
recover the system.

Two additions on top of that base (2026-09-13), both admin-role-gated via
the existing `@Roles(Role.ADMIN)`/`RolesGuard` pair:

- **Admin user management**: `User.active` is an admin kill switch (default
  `true`), checked at login and on every authenticated request (not just
  future logins) so disabling someone takes effect immediately. An admin
  can't disable or delete their own account. Frontend: an "Admin" nav tab,
  visible only to `role === 'ADMIN'`, listing every user with disable/
  enable/delete actions — disable goes through the same confirm-dialog
  pattern as deleting an alarm, since it revokes someone else's access.
- **Self-service password recovery**: a "Forgot password?" link on the
  login page emails a single-use, 1-hour token (backend has its own
  `nodemailer` client for this — see `backend/CLAUDE.md`'s "Password
  reset" section for why it doesn't go through the worker's notification
  path). The forgot-password endpoint always responds the same way whether
  or not the email is registered, so it never reveals which emails have
  accounts.

## Alert strategies (planned library)

- Manual price threshold (user sets an exact trigger/target).
- Moving average crossover (e.g. 50/200 SMA).
- RSI overbought/oversold.
- MACD crossover.
- Bollinger Bands breakout.
- Support/resistance breakout — the evolution of the original script's
  drawdown-from-local-max logic (`scipy.signal.argrelextrema`).

Each strategy is a self-contained unit the worker can evaluate independently
and register into a "strategy registry," so adding a new one doesn't require
touching existing strategies. This registry defines strategy *types* and
their parameter schemas — it is not itself per-user state.

## Data model — alarms are per-user strategy instances

A "strategy" in the registry is a template; an **alarm** is a user's
configured instance of it, scoped to one ticker. This is the same concept
the original script called a `Trade` (trigger/target/notified on one CSV
row), generalized to any strategy type and owned by a specific user.

Conceptually, one table (e.g. `alarms`):

```
alarms
  id
  user_id        -> owner; a user only ever sees/edits their own alarms
  ticker
  strategy_type  -> 'manual_threshold' | 'sma_crossover' | 'rsi' | 'macd' |
                    'bollinger' | 'support_resistance'
  market         -> 'usa' | 'crypto' | 'byma' (default usa) — the currency
                    (USD/USD/ARS) and how the worker resolves the ticker for
                    its price provider; 'usa' covers any US-listed ticker
                    needing no yfinance suffix (NASDAQ, NYSE, S&P 500
                    constituents, ETFs); 'byma' covers both CEDEARs
                    (depositary receipts of foreign stocks) and local
                    Argentine shares (e.g. Merval index constituents) since
                    both trade on BYMA in ARS and resolve the same way; set
                    once at creation, not user-editable afterward (same as
                    strategy_type) since changing it would mean the
                    ticker/params no longer describe the same instrument
  params         -> jsonb, shape depends on strategy_type
                    (e.g. manual_threshold: {trigger, target};
                     rsi: {period, overbought, oversold})
  status              -> active / triggered / disabled
  triggered_at
  notification_status -> mirrors the old script's notified flag (avoid re-sending)
  created_at
```

The worker's per-tick job is: load active alarms grouped by resolved
price-provider symbol — not raw ticker, since the same ticker string can
mean different securities on different markets (a US-listed ADR vs. a
same-named company or CEDEAR listed on BYMA) — fetch prices once per
symbol, dispatch each alarm to
its strategy's `evaluate()` function with its own `params`, and write back
any that triggered. The backend owns CRUD on `alarms` (validating `params`
against the strategy's schema); the worker only reads active alarms and
writes trigger results —
consistent with the "communicate only through the database" rule above.

## Testing

Both services with real logic to test (`backend`, `worker`) have unit
tests plus e2e/integration tests against a real, disposable Postgres —
`docker-compose.yml`'s `postgres-test` service (port 5433, `tmpfs` storage,
`profiles: ["test"]` so a plain `docker compose up` never starts it):

```bash
docker compose --profile test up -d postgres-test
cd backend && npm run test:e2e     # applies migrations itself, idempotent
cd worker && uv run pytest tests_integration
```

Deliberately one shared test database for both, not two — the schema is
one thing (owned by the backend's Prisma migrations), and the worker's
integration tests genuinely depend on that exact schema, not a
worker-owned copy of it. See `backend/CLAUDE.md` and `worker/CLAUDE.md`'s
Testing sections for what each actually covers.

## Conventions

- Environment variables: uppercase, prefixed by service where ambiguous
  (e.g. `WORKER_FINNHUB_API_KEY`, `BACKEND_JWT_SECRET`).
- Notifications go through an abstraction (`worker/worker/notifications/`):
  email via SMTP (matching the original script) and Telegram (free, no
  per-message cost — chosen over Twilio/SMS, which charges per message)
  both send on every trigger, each failing independently of the other. A
  user links Telegram by messaging the bot once and setting the resulting
  chat id via `PUT /users/me/channels/TELEGRAM` — see `worker/CLAUDE.md`
  for the exact steps. Twilio/SMS was considered and intentionally skipped
  for cost reasons; revisit only if a channel Telegram can't cover is
  actually needed.
- As each service gets scaffolded, give it its own `CLAUDE.md`
  (`backend/CLAUDE.md`, `worker/CLAUDE.md`, `frontend/CLAUDE.md`) with
  framework-specific conventions. Claude Code loads the root file at session
  start and pulls in nested ones automatically when it reads files in that
  subtree.
