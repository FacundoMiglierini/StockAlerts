"""Plain pandas/numpy indicator implementations.

Deliberately not using `pandas-ta` (unmaintained, breaks on numpy>=2.0) or
`ta` — these formulas are short enough to own directly and keep the
dependency list small.
"""

from __future__ import annotations

import pandas as pd


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(series: pd.Series, fast_period: int, slow_period: int, signal_period: int) -> tuple[pd.Series, pd.Series]:
    """Returns (macd_line, signal_line)."""
    macd_line = ema(series, fast_period) - ema(series, slow_period)
    signal_line = ema(macd_line, signal_period)
    return macd_line, signal_line


def bollinger_bands(series: pd.Series, period: int, std_dev: float) -> tuple[pd.Series, pd.Series]:
    """Returns (lower_band, upper_band)."""
    mid = sma(series, period)
    std = series.rolling(window=period).std()
    return mid - std_dev * std, mid + std_dev * std
