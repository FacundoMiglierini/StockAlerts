from __future__ import annotations

import logging

import pandas as pd

from .. import config
from .base import PriceProvider
from .finnhub_provider import FinnhubProvider
from .yfinance_provider import YFinanceProvider

logger = logging.getLogger(__name__)


class FallbackPriceProvider:
    """Tries `primary` first, falls back to `fallback` on any error — so a
    Finnhub outage or rate limit doesn't stop the whole tick."""

    def __init__(self, primary: PriceProvider | None, fallback: PriceProvider) -> None:
        self._primary = primary
        self._fallback = fallback

    def get_daily_history(self, ticker: str, period: str) -> pd.DataFrame:
        if self._primary is not None:
            try:
                return self._primary.get_daily_history(ticker, period)
            except Exception:
                logger.warning("Primary price provider failed for %s, falling back", ticker, exc_info=True)
        return self._fallback.get_daily_history(ticker, period)


def get_price_provider() -> PriceProvider:
    # Finnhub's free tier returns 403 on /stock/candle (historical daily
    # bars) — confirmed live, it's paid-plan-only now. Wiring it in as
    # primary anyway would mean every ticker fails against Finnhub first,
    # every tick, forever, on a free-tier key. Only try it if explicitly
    # enabled (i.e. you've upgraded past the free tier).
    primary = (
        FinnhubProvider(config.FINNHUB_API_KEY)
        if config.FINNHUB_API_KEY and config.FINNHUB_HISTORY_ENABLED
        else None
    )
    return FallbackPriceProvider(primary=primary, fallback=YFinanceProvider())
