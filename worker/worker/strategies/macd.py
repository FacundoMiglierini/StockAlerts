from __future__ import annotations

import pandas as pd

from ..enums import Market
from .base import single_shot
from .indicators import macd as compute_macd


@single_shot
def evaluate(
    ticker: str, params: dict, prices: pd.DataFrame, market: Market
) -> str | None:
    macd_line, signal_line = compute_macd(
        prices["Close"],
        params["fastPeriod"],
        params["slowPeriod"],
        params["signalPeriod"],
    )
    if len(macd_line.dropna()) < 2 or len(signal_line.dropna()) < 2:
        return None

    crossed_up = (
        macd_line.iloc[-2] <= signal_line.iloc[-2]
        and macd_line.iloc[-1] > signal_line.iloc[-1]
    )
    crossed_down = (
        macd_line.iloc[-2] >= signal_line.iloc[-2]
        and macd_line.iloc[-1] < signal_line.iloc[-1]
    )

    if crossed_up:
        direction = "above"
    elif crossed_down:
        direction = "below"
    else:
        return None

    return f"{ticker}: MACD crossed {direction} its signal line"
