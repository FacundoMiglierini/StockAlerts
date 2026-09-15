from __future__ import annotations

import pandas as pd

from ..enums import Market
from .base import single_shot
from .indicators import rsi as compute_rsi


@single_shot
def evaluate(
    ticker: str, params: dict, prices: pd.DataFrame, market: Market
) -> str | None:
    series = compute_rsi(prices["Close"], params["period"])
    latest = series.iloc[-1]
    if pd.isna(latest):
        return None

    if latest <= params["oversold"]:
        return f"{ticker}: RSI({params['period']}) at {latest:.1f}, oversold (<= {params['oversold']})"
    elif latest >= params["overbought"]:
        return f"{ticker}: RSI({params['period']}) at {latest:.1f}, overbought (>= {params['overbought']})"
    return None
