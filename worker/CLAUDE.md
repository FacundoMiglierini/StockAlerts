# Worker — conventions

Python service: fetches prices, evaluates each active alarm's strategy,
persists results, and notifies the owning user. Root context/vision and the
alarm/strategy data model are in the repo root `CLAUDE.md` — read that
first. `backend/CLAUDE.md` documents the Prisma schema this service reads
and writes directly via SQL (no ORM shared between the two services).

## Structure

```
worker/
  config.py            env vars
  enums.py              AlarmStatus/NotificationStatus/Market StrEnums, hand-kept in sync with schema.prisma
  market.py              per-Market currency symbol + yfinance ticker-suffix resolution (see below)
  db.py                 raw SQL against the shared `alarms`/`users` tables
  price_provider/       PriceProvider port: yfinance (Finnhub wired in but off — see below)
  strategies/
    indicators.py        SMA/EMA/RSI/MACD/Bollinger, hand-rolled (see below)
    registry.py           StrategyType string -> evaluate() function
    <strategy>.py          one module per StrategyType, `evaluate(ticker, params, prices, notification_status, market) -> EvaluationResult | None`
  notifications/         Notifier port: email (SMTP) + Telegram, both sent on every trigger
  run.py                one evaluation pass — `python -m worker.run`; what production's host crontab actually invokes (see root CLAUDE.md's "Deploying for free" step 1a) — a fresh process every run means a single hung price-fetch can't take down all future runs
  main.py               loop wrapper around run.py — `python -m worker.main`; only used in local dev's `docker compose up` for convenience, never started in production
tests/                  unit tests (pytest, no DB) — mirrors the worker/ package layout
tests_integration/      db.py against a real Postgres — see Testing below
```

## Testing

```bash
uv run pytest                    # unit only — fast, no DB, this is the default
uv run pytest -v tests/strategies
docker compose --profile test up -d postgres-test   # from repo root, once
uv run pytest tests_integration  # db.py against a real Postgres
```

**Unit** (`tests/`, 50 tests, no DB) is where the actual trading logic
lives, so it's the most thoroughly covered part of the whole project: every
strategy's trigger/no-trigger/already-notified/insufficient-data cases, the
indicator math (`indicators.py`), `FallbackPriceProvider`'s primary/fallback
switching, `CompositeNotifier`'s per-channel failure isolation, and
`TelegramNotifier`'s no-op conditions.

**Integration** (`tests_integration/`, 9 tests) exercises `db.py`'s raw SQL
against the same `postgres-test` Postgres the backend's e2e tests use (see
`backend/CLAUDE.md`) — deliberately shared, since the schema is genuinely
one thing owned by the backend's Prisma migrations, not two. Separate
directory from `tests/`, **not** picked up by a bare `uv run pytest`
(`pyproject.toml`'s `testpaths = ["tests"]` only) — run explicitly, and
only after `postgres-test` is up. `tests_integration/conftest.py`'s
session-scoped `_apply_migrations` fixture runs `npx prisma migrate
deploy` against it automatically (idempotent, requires Node/npm and the
backend's `node_modules` — a real cross-service dependency, not an
oversight: `db.py`'s SQL only means anything against that exact schema).

This is exactly the kind of test that would have caught the `CAST(:status
AS "AlarmStatus")` vs. `:status::"AlarmStatus"` bug (see below) on the spot
— a mock can't fail on invalid SQL syntax, only a real Postgres connection
can. `test_updates_notified_and_status` and
`test_sets_triggered_at_when_status_becomes_triggered` in
`tests_integration/test_db.py` are that regression test, whether or not
that's obvious from their names.

Two setup details that aren't obvious from the test files themselves:

- **`pyproject.toml` sets `pythonpath = ["."]`.** This isn't an installed
  package (no `[build-system]` — see the Docker section below), so without
  this pytest can't `import worker...` at all — it'll fail collection with
  `ModuleNotFoundError: No module named 'worker'`. Don't remove it.
- **`tests/conftest.py` sets a dummy `DATABASE_URL`** before any test
  module imports anything, via `os.environ.setdefault(...)`. `config.py`
  requires `DATABASE_URL` at import time, and several modules under test
  import `config` transitively (`price_provider`, `notifications`) — without
  this, the suite only passes by accident when `worker/.env` happens to
  already have a real value, and breaks on a fresh clone or in CI.
  `setdefault` (not a hard assignment) so a real env var, if one is set,
  still wins.

Constructing test price data: use the `prices_factory` fixture
(`tests/conftest.py`) rather than building `DataFrame`s by hand in each
test — it matches the exact shape `PriceProvider.get_daily_history` returns
(`Open`/`High`/`Low`/`Close`, `Close`-valued by default so a test only
needs to override the columns it actually cares about).

One non-obvious thing worth knowing before adding a Bollinger/support-
resistance test: **the current bar is always part of its own rolling
window.** A single extreme value among an otherwise-flat history can't
breach its own 2-standard-deviation Bollinger band (the point inflates its
own band by contributing to the std it's measured against) — reliably
triggering a breach in a test needs either a smaller `stdDev`/`period` or
an already-volatile baseline the new close diverges from. See
`test_bollinger.py`'s comments for a worked example.

## Why raw SQL instead of an ORM

The backend (Prisma) owns the schema; the worker only reads/writes it.
Prisma generates **camelCase, case-sensitive column names** (`"userId"`,
`"strategyType"`, `"triggeredAt"`) — quoted exactly like that in every
query in `db.py`. Two more Postgres/psycopg gotchas worth knowing before
touching `db.py`:

- **Enum columns need explicit casts.** psycopg binds parameters as plain
  text, so `status = :status` against a `"AlarmStatus"` enum column fails.
  Reading: cast the column (`status::text = 'ACTIVE'`). Writing: cast the
  parameter — but use `CAST(:status AS "AlarmStatus")`, **not**
  `:status::"AlarmStatus"`. The latter breaks: SQLAlchemy's `text()` bind
  parser treats a bind name immediately followed by `::` specially and
  silently fails to substitute it (the literal `:status::"AlarmStatus"`
  ends up sent to Postgres verbatim, a syntax error). Cost about an hour to
  track down — don't reintroduce it.
- **Prisma's `DATABASE_URL` has a `?schema=public` query param that isn't a
  real libpq option.** psycopg rejects it outright. `db.py`'s
  `get_engine()` strips it before connecting; the schema is `public` either
  way, so nothing is lost.

## Strategy evaluation contract

Every strategy module exposes a module-level `evaluate` matching this
signature (`registry.py` dispatches on it by name — see `Strategy` in
`strategies/base.py`):

```python
def evaluate(
    ticker: str, params: dict, prices: pd.DataFrame, notification_status: NotificationStatus, market: Market
) -> EvaluationResult | None
```

- `prices` is daily OHLC history (see `price_provider/base.py`); the last
  row covers the current, possibly still-open trading day — strategies
  needing "today's" low/high read `prices.iloc[-1]` rather than making a
  second intraday API call.
- `market` is the alarm's `Market` (`worker/enums.py`) — every registered
  strategy accepts it, even ones whose message doesn't need it (macd, rsi,
  sma_crossover), so `registry.py`/`run.py` can call every strategy with
  one uniform signature. Strategies that mention a price in `message`
  (`manual_threshold`, `bollinger`, `support_resistance`) call
  `worker/market.py`'s `currency_symbol(market)` to prefix it correctly
  (`US$` for USA/CRYPTO, `AR$` for BYMA) instead of hardcoding `$`.
- Return `None` if nothing triggered. Otherwise return an
  `EvaluationResult(new_notification_status, new_status, message)` —
  `run.py` persists it via `db.apply_alarm_result()` and sends `message` to
  the alarm's owner. `notification_status`/`status` (and their `new_*`
  counterparts) are `worker/enums.py`'s `NotificationStatus`/`AlarmStatus`
  — `enum.StrEnum`, so a member both *is* a string (binds into raw SQL
  params and `==`-compares against a plain string unmodified — see
  `db.py`'s casts) and gives typo-safety/autocomplete on top. These mirror
  `backend/prisma/schema.prisma`'s enums of the same name; there's no
  shared codegen across languages, so keep the two definitions in sync by
  hand.
- **`MANUAL_THRESHOLD` is the one two-phase strategy**, mirroring the
  original script's `Trade` (BUY at `trigger`, then SELL at `target`):
  `notification_status` goes `NOT_NOTIFIED` → `NOTIFIED_ONCE` (BUY, stays
  `ACTIVE`) → `NOTIFIED_TWICE` (SELL, becomes `TRIGGERED`). It implements
  `evaluate` directly since this two-phase shape is genuinely its own.
- **Every other strategy is single-shot**: `notification_status` goes
  `NOT_NOTIFIED` → `NOTIFIED_ONCE` and status → `TRIGGERED` the first time
  the condition is true, and it never fires again. Rather than each module
  repeating that guard and the `EvaluationResult(NOTIFIED_ONCE, TRIGGERED,
  ...)` wrap-up, they're written as a plain trigger check and decorated
  with `@single_shot` (`strategies/base.py`):
  ```python
  @single_shot
  def evaluate(ticker: str, params: dict, prices: pd.DataFrame, market: Market) -> str | None: ...
  ```
  `check` returns a message if it triggered, `None` otherwise —
  `single_shot` supplies the `notification_status` guard and builds the
  `EvaluationResult`, and `functools.wraps` keeps the decorated function
  named/registered as `evaluate` so `registry.py` and every caller are
  none the wiser. `macd.py`/`sma_crossover.py`/`rsi.py`/`bollinger.py`/
  `support_resistance.py` are all this shape; a class hierarchy (e.g.
  Template Method) was considered and rejected — `MANUAL_THRESHOLD`
  wouldn't fit the shared base at all, which would leave one subclass
  overriding everything, so a plain decorator on ordinary functions is
  the better fit than an OOP hierarchy here.
- A user can re-arm a triggered alarm by `PATCH`ing its status back to
  `ACTIVE` via the backend — `notificationStatus` is intentionally not
  exposed on that endpoint, since it's worker-owned state, not user-owned.
- Adding a new **single-shot** strategy: write its `check` and decorate it
  with `@single_shot`, add it to `STRATEGY_REGISTRY` in `registry.py`, and
  add its param schema to the backend's `strategy-params.schema.ts` (see
  `backend/CLAUDE.md`) — those two definitions must stay in sync.

## Price data: Finnhub free tier can't actually do this

Confirmed live against a real key: Finnhub's free tier returns 403 on
`/stock/candle` ("You don't have access to this resource" — paid-plan-only
now). It still serves `/quote` (a live snapshot) for free, but the
strategy engine needs daily history, which free-tier Finnhub can't provide.
So `get_price_provider()` only uses `yfinance` by default. `FinnhubProvider`
is fully implemented and wired into the same `FallbackPriceProvider`
port/adapter — set `WORKER_FINNHUB_HISTORY_ENABLED=true` to actually use it,
but only after upgrading the Finnhub plan; on a free-tier key it would just
fail every ticker, every tick, before falling back to yfinance anyway.
`FinnhubProvider`'s API host is `config.FINNHUB_BASE_URL`
(`WORKER_FINNHUB_BASE_URL`, defaults to `https://finnhub.io/api/v1`) rather
than a hardcoded literal — override only for a proxy/mock in tests or a
self-hosted mirror, not a normal deployment knob.

**Every provider must validate its own output before returning it.**
Confirmed live: yfinance returned a non-empty bar with `Low == 0` for a
thinly-traded BYMA ticker (MORI) — no exception, so the existing
`data.empty` check didn't catch it. That bar flowed straight into
`manual_threshold.evaluate`, where `today["Low"] <= trigger` is true for
almost any positive trigger — firing a false BUY and permanently advancing
`notificationStatus` to `NOTIFIED_ONCE`. The *next* (correct) run then
evaluated the SELL/target leg against that already-corrupted state and
fired again, which looks like "triggered twice" but is really one bad
fetch poisoning two runs. `price_provider/base.py`'s
`validate_daily_history()` rejects empty/missing/non-positive OHLC values
and a High below its own Low; both `YFinanceProvider` and `FinnhubProvider`
call it before returning, so a bad bar now raises the same way empty data
always has — `run.py`'s `except Exception` around the fetch skips that
symbol's alarms for the tick instead of corrupting their state. A
`notificationStatus` already corrupted by a run from before this check
existed needs a manual DB correction (back to `NOT_NOTIFIED`/`ACTIVE`) —
there's no automated recovery for that, since the worker can't tell a
real BUY apart from a false one after the fact.

## Notifications: email + Telegram, no Twilio

Both channels fire on every trigger via `CompositeNotifier`
(`notifications/__init__.py`) — one failing (or simply not being set up for
a given user) never blocks the other. Twilio/SMS was considered and
deliberately skipped: it charges per message beyond a small trial credit,
whereas Telegram's Bot API is genuinely free.

**One-time setup (you, the operator):**
1. Message [@BotFather](https://t.me/BotFather) on Telegram, `/newbot`, get
   a bot token.
2. Set `WORKER_TELEGRAM_BOT_TOKEN` in `.env`.

**Per-user linking (each user, once):**
1. Find the bot on Telegram (by the username you gave it in step 1) and
   send it any message (e.g. `/start`).
2. Look up your chat id:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` — find your message in
   the JSON, read `result[].message.chat.id`.
3. `PATCH /users/me` with `{"telegramChatId": "<that id>"}` (any
   authenticated user can set their own; there's no UI for this yet — see
   the root `CLAUDE.md` for the frontend status). Pass `null` to unlink.

If `WORKER_TELEGRAM_BOT_TOKEN` is unset, or a user's `telegramChatId` is
null, `TelegramNotifier.send()` just no-ops for that user — email still
goes out regardless. The Bot API host is `config.TELEGRAM_API_BASE_URL`
(`WORKER_TELEGRAM_API_BASE_URL`, defaults to `https://api.telegram.org`),
not a hardcoded literal — same reasoning as `FINNHUB_BASE_URL` above.

## Indicators are hand-rolled, not `pandas-ta`

`pandas-ta` is unmaintained and breaks on numpy ≥ 2.0 (it imports
`NaN` from numpy, removed in 2.0). SMA/EMA/RSI/MACD/Bollinger are short
enough to own directly in `strategies/indicators.py` instead.

## Running locally

Dependency management is [`uv`](https://docs.astral.sh/uv/), not
`pip`/`venv` directly — `pyproject.toml` + `uv.lock` are the source of
truth (there's no `requirements.txt` anymore).

```bash
docker compose up -d postgres   # from repo root
uv sync                         # creates .venv, installs from uv.lock
cp .env.example .env            # point DATABASE_URL at localhost:5432
uv run python -m worker.run     # one evaluation pass
```

`uv python pin` already fixed this project to 3.13 (see `.python-version`)
— `uv sync` will fetch that interpreter itself if it's not already
installed, no separate `python3.13 -m venv` step needed. Requires Python ≥
3.11 at a minimum (uses `enum.StrEnum`, added in 3.11, plus `X | None`
union syntax and `dict[str, ...]` generics) if you ever change the pin.

## Formatting

`black` (dev dependency group) formats the whole tree — no config beyond
its defaults:

```bash
uv run black worker tests tests_integration
```

If `uv run pytest`/`uv run black` fails with `bad interpreter: .../<old
dir name>/.venv/bin/python3: no such file or directory`, the `.venv` was
created under a since-renamed project path and its console-script shebangs
are stale — `uv run python -m pytest` (module form, bypasses the shebang)
works around it, or delete `.venv` and re-`uv sync` to fix it properly.

## Scheduling: host cron in production, long-lived loop only for local dev

**Reversed from the original decision below** (see root `CLAUDE.md`'s
"Deploying for free" Part A step 1a): production runs the host's crontab
invoking `docker compose run --rm worker uv run --no-dev python -m
worker.run` hourly — a fresh, one-shot process per tick — not the loop.
`docker-compose.yml`'s `worker` service (`python -m worker.main`, the
`while True: run_once(); sleep(POLL_INTERVAL)` loop below) still exists and
still runs via a plain `docker compose up`, but that's local-dev
convenience only; it is never started in production (`scripts/deploy.sh`
builds the `worker` image for cron to use but deliberately never `up -d`s
it).

The reason for the reversal: the loop's price-fetch call has no timeout
around it. If a single fetch hangs, that loop iteration never returns —
and since the process doesn't crash (just blocks forever), `restart:
unless-stopped` never kicks in to notice or recover. Every future hourly
run is silently dead until someone happens to check. A cron-triggered
one-shot avoids this entirely: each invocation is a fresh process, so a
hung run only costs that one run, not all subsequent ones. This is exactly
why `worker.run` (one evaluation pass, no loop) was kept separate from
`worker.main` from the start — it was already the right unit to schedule
once wall-clock cron became the better fit.

The original reasoning for choosing the loop, kept here since the
trade-offs it describes are real — they just ended up outweighed by the
hung-fetch risk above:

- **Self-healing for free.** `restart: unless-stopped` + Docker's own
  restart-on-boot means the loop survives a crash or a host reboot with
  zero extra setup. Host cron depends on the host's cron daemon being
  installed, enabled, and the machine being awake — one more thing to
  verify/monitor that Docker already handles.
- **One moving part instead of two.** Host cron means keeping a crontab
  entry on the home server in sync with the project, outside of
  `docker-compose.yml` — easy to lose track of, and invisible to `docker
  compose ps`.
- **No exec overhead per tick.** `docker compose run` starts a fresh
  container (deps loaded from scratch, even if `uv` makes that fast) every
  invocation; the loop pays that cost once.

## Docker: uv's official pattern, not `pip install`

`Dockerfile` copies the `uv` binary from `ghcr.io/astral-sh/uv` (Astral's
own recommended approach) rather than installing it via pip, then does
`uv sync --locked --no-install-project --no-dev` for dependencies (cached
as its own layer, keyed off `pyproject.toml`/`uv.lock` only) before copying
in `worker/` and syncing again. `--no-install-project`: this tree isn't a
distributable package (no `[build-system]` in `pyproject.toml`) — it's run
as `uv run python -m worker.main`, so there's nothing to install for
"worker" itself, only its dependencies. `--locked` fails the build outright
if `uv.lock` is out of sync with `pyproject.toml`, rather than silently
re-resolving — if that happens, run `uv lock` locally and commit the
updated lockfile.
