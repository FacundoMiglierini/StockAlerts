from __future__ import annotations

import pandas as pd
import yfinance as yf


class YFinanceProvider:
    """Unofficial API, no key required. Used as the fallback provider — it
    can break without notice, which is exactly why it isn't primary."""

    def get_daily_history(self, ticker: str, period: str) -> pd.DataFrame:
        data = yf.download(
            ticker, period=period, interval="1d", progress=False, auto_adjust=True
        )
        if data.empty:
            raise ValueError(f"No price history returned for {ticker}")
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        return data[["Open", "High", "Low", "Close"]]
