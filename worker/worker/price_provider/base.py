from __future__ import annotations

from typing import Protocol

import pandas as pd


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
