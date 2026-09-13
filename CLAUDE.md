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

### Deployment split option (frontend on free-tier cloud)

The frontend is a static SPA build, which fits free static hosts (Vercel,
Netlify, Cloudflare Pages) with a free `*.vercel.app`/`*.pages.dev`
subdomain — no home-server RAM/bandwidth spent serving it, and it's
reachable without exposing the home network. Backend, worker, and Postgres
stay home-hosted (they need to reach the DB and hold secrets).

Trade-off if split this way: the frontend needs to reach the backend API
over the public internet, which means either (a) exposing the backend
through something like a Cloudflare Tunnel or reverse-proxy with a domain +
TLS, or (b) keeping frontend home-hosted too and only doing this split
later if remote access becomes a real need. Not required for v1 — worth
deciding once the backend API exists and remote access is actually wanted.

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
