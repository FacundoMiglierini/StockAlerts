"""The evolution of the original script's Trade: a single trigger/target
pair, two-phase (BUY then SELL), tracked via `notificationStatus`
(NOT_NOTIFIED/NOTIFIED_ONCE/NOTIFIED_TWICE) exactly as before — just
per-user and DB-backed now instead of a CSV row.
"""

from __future__ import annotations

import pandas as pd

from ..enums import AlarmStatus, Market, NotificationStatus
from ..market import currency_symbol
from .base import EvaluationResult


def evaluate(
    ticker: str,
    params: dict,
    prices: pd.DataFrame,
    notification_status: NotificationStatus,
    market: Market,
) -> EvaluationResult | None:
    trigger = params["trigger"]
    target = params["target"]
    today = prices.iloc[-1]
    currency = currency_symbol(market)

    if (
        notification_status == NotificationStatus.NOT_NOTIFIED
        and today["Low"] <= trigger
    ):
        return EvaluationResult(
            new_notification_status=NotificationStatus.NOTIFIED_ONCE,
            new_status=AlarmStatus.ACTIVE,
            message=f"BUY {ticker}: price hit trigger {currency}{trigger:.2f}",
        )

    if (
        notification_status == NotificationStatus.NOTIFIED_ONCE
        and today["High"] >= target
    ):
        return EvaluationResult(
            new_notification_status=NotificationStatus.NOTIFIED_TWICE,
            new_status=AlarmStatus.TRIGGERED,
            message=f"SELL {ticker}: price hit target {currency}{target:.2f}",
        )

    return None
