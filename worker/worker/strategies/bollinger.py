from __future__ import annotations

import pandas as pd

from ..enums import Market
from ..market import currency_symbol
from .base import single_shot
from .indicators import bollinger_bands


@single_shot
def evaluate(ticker: str, params: dict, prices: pd.DataFrame, market: Market) -> str | None:
    lower, upper = bollinger_bands(prices["Close"], params["period"], params["stdDev"])
    close = prices["Close"].iloc[-1]
    if pd.isna(lower.iloc[-1]) or pd.isna(upper.iloc[-1]):
        return None

    currency = currency_symbol(market)
    if close <= lower.iloc[-1]:
        return f"{ticker}: closed at {currency}{close:.2f}, at/below the lower Bollinger Band ({currency}{lower.iloc[-1]:.2f})"
    elif close >= upper.iloc[-1]:
        return f"{ticker}: closed at {currency}{close:.2f}, at/above the upper Bollinger Band ({currency}{upper.iloc[-1]:.2f})"
    return None
