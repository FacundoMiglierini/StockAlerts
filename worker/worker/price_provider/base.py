from __future__ import annotations

from typing import Protocol

import pandas as pd

_OHLC_COLUMNS = ["Open", "High", "Low", "Close"]


class PriceProvider(Protocol):
    """Port for fetching price data. Swapping/adding a provider should never
    require touching strategy code — see ../strategies/."""

    def get_daily_history(self, ticker: str, period: str) -> pd.DataFrame:
        """Daily OHLC bars, ascending by date, columns: Open, High, Low, Close.

        The last row covers the current (possibly still-open) trading day,
        so strategies needing "today's" low/high read `prices.iloc[-1]`
        rather than making a second intraday request.
        """
        ...


def validate_daily_history(ticker: str, data: pd.DataFrame) -> None:
    """Raises if `data` is empty or contains OHLC values no real market bar
    produces — missing, zero/negative, or a High below its own Low.

    A provider glitch (seen live: yfinance returning a bar with Low == 0
    for a thinly-traded BYMA ticker) doesn't always come back as an
    exception — it can look like a perfectly normal, non-empty frame. Left
    unchecked, that garbage flows straight into strategy evaluation: a
    spurious Low of 0 satisfies `today["Low"] <= trigger` for nearly any
    manual_threshold, firing a false BUY and permanently advancing
    `notificationStatus` to NOTIFIED_ONCE — so the *next* (correct) run then
    checks the SELL/target leg against a state that was never really
    reached, firing a second, equally spurious notification. Every provider
    must call this before returning, so a bad fetch is treated exactly like
    the existing "no data" case: the caller's `except Exception` in
    `run.py` skips that symbol's alarms for this tick instead of corrupting
    their state.
    """
    if data.empty:
        raise ValueError(f"No price history returned for {ticker}")

    ohlc = data[_OHLC_COLUMNS]
    if ohlc.isna().any().any():
        raise ValueError(f"Price history for {ticker} contains missing OHLC values")
    if (ohlc <= 0).any().any():
        raise ValueError(
            f"Price history for {ticker} contains non-positive OHLC values"
        )
    if (data["High"] < data["Low"]).any():
        raise ValueError(f"Price history for {ticker} has a High below its Low")
