"""The evolution of the original script's local-max drawdown logic
(`scipy.signal.argrelextrema`): find the most recent local high over the
lookback window, derive a support level as a drawdown percentage below it,
and trigger once price breaks below that level.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import argrelextrema

from ..enums import Market
from ..market import currency_symbol
from .base import single_shot


@single_shot
def evaluate(ticker: str, params: dict, prices: pd.DataFrame, market: Market) -> str | None:
    window = prices.tail(params["lookbackDays"])
    highs = window["High"].to_numpy()
    if len(highs) < 5:
        return None

    local_max_idx = argrelextrema(highs, np.greater, order=5)[0]
    if len(local_max_idx) == 0:
        return None

    last_local_max = float(highs[local_max_idx[-1]])
    support_level = last_local_max * (1 - params["drawdownPct"])
    today_low = float(window["Low"].iloc[-1])

    if today_low > support_level:
        return None

    currency = currency_symbol(market)
    return (
        f"{ticker}: broke below support {currency}{support_level:.2f} "
        f"({params['drawdownPct'] * 100:.0f}% off recent high {currency}{last_local_max:.2f})"
    )
