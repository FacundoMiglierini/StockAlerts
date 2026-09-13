from __future__ import annotations

import pandas as pd

from ..enums import Market
from .base import single_shot
from .indicators import sma


@single_shot
def evaluate(ticker: str, params: dict, prices: pd.DataFrame, market: Market) -> str | None:
    fast = sma(prices["Close"], params["fastPeriod"])
    slow = sma(prices["Close"], params["slowPeriod"])
    if len(fast.dropna()) < 2 or len(slow.dropna()) < 2:
        return None

    crossed_up = fast.iloc[-2] <= slow.iloc[-2] and fast.iloc[-1] > slow.iloc[-1]
    crossed_down = fast.iloc[-2] >= slow.iloc[-2] and fast.iloc[-1] < slow.iloc[-1]

    if crossed_up:
        direction = "above"
    elif crossed_down:
        direction = "below"
    else:
        return None

    return f"{ticker}: {params['fastPeriod']}-day SMA crossed {direction} the {params['slowPeriod']}-day SMA"
