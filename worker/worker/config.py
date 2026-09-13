import os

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


DATABASE_URL = _require("DATABASE_URL")

# How much daily-bar history to pull per ticker per tick. Needs to cover the
# slowest strategy parameter in use (e.g. a 200-day SMA) with some buffer.
PRICE_HISTORY_PERIOD = os.getenv("WORKER_PRICE_HISTORY_PERIOD", "1y")

# Seconds between evaluation passes when run as a long-lived loop (main.py).
# A one-shot run (run.py) ignores this and exits after a single pass.
POLL_INTERVAL_SECONDS = int(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "3600"))

FINNHUB_API_KEY = os.getenv("WORKER_FINNHUB_API_KEY")
# Off by default: Finnhub's free tier can't serve historical daily candles
# (/stock/candle returns 403 — paid-plan-only). Flip this on only if you've
# upgraded past the free tier. See worker/CLAUDE.md.
FINNHUB_HISTORY_ENABLED = os.getenv("WORKER_FINNHUB_HISTORY_ENABLED", "false").lower() == "true"
FINNHUB_BASE_URL = os.getenv("WORKER_FINNHUB_BASE_URL", "https://finnhub.io/api/v1")

MAIL_HOST = os.getenv("WORKER_MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("WORKER_MAIL_PORT", "465"))
MAIL_USERNAME = os.getenv("WORKER_MAIL_USERNAME")
MAIL_EMAIL = os.getenv("WORKER_MAIL_EMAIL")
MAIL_PASSWORD = os.getenv("WORKER_MAIL_PASSWORD")

# Free — no per-message cost. One bot token for the whole deployment (via
# @BotFather); each user links their own chat id through the backend
# (PATCH /users/me). See worker/CLAUDE.md for the linking steps.
TELEGRAM_BOT_TOKEN = os.getenv("WORKER_TELEGRAM_BOT_TOKEN")
TELEGRAM_API_BASE_URL = os.getenv("WORKER_TELEGRAM_API_BASE_URL", "https://api.telegram.org")
