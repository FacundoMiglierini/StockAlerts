from __future__ import annotations

import pandas as pd
import yfinance as yf

from .base import validate_daily_history


class YFinanceProvider:
    """Unofficial API, no key required. Used as the fallback provider — it
    can break without notice, which is exactly why it isn't primary."""

    def get_daily_history(self, ticker: str, period: str) -> pd.DataFrame:
        data = yf.download(
            ticker, period=period, interval="1d", progress=False, auto_adjust=True
        )
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        data = data[["Open", "High", "Low", "Close"]] if not data.empty else data
        validate_daily_history(ticker, data)
        return data
