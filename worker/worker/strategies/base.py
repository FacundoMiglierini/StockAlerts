from __future__ import annotations

from dataclasses import dataclass
from functools import wraps
from typing import Callable

import pandas as pd

from ..enums import AlarmStatus, Market, NotificationStatus


@dataclass
class EvaluationResult:
    new_notification_status: NotificationStatus
    new_status: AlarmStatus
    message: str


# Each strategy module exposes a module-level `evaluate` function matching
# this signature. Returns None if nothing triggered, otherwise the update to
# persist (and a message to notify the user with). `market` determines the
# currency of any price mentioned in `message` (see ..market.currency_symbol)
# — it's threaded through even to strategies whose message doesn't need it,
# so every registered strategy shares one call signature.
Strategy = Callable[
    [str, dict, pd.DataFrame, NotificationStatus, Market], "EvaluationResult | None"
]

# A single-shot strategy's trigger check: given the alarm's ticker/params/
# prices/market, return a message if it triggered, or None otherwise.
# Doesn't see or decide `notification_status`/`status` at all — `single_shot`
# supplies that part, since it's identical across every single-shot strategy.
Check = Callable[[str, dict, pd.DataFrame, Market], "str | None"]


def single_shot(check: Check) -> Strategy:
    """Turns a trigger `check` into a full `Strategy`: skip alarms that
    already fired, otherwise run `check` and wrap a trigger into the
    terminal NOTIFIED_ONCE/TRIGGERED result. Every strategy except
    MANUAL_THRESHOLD (the one two-phase strategy — BUY then SELL, so it
    can't be a one-shot check) fits this shape.
    """

    @wraps(check)
    def evaluate(
        ticker: str,
        params: dict,
        prices: pd.DataFrame,
        notification_status: NotificationStatus,
        market: Market,
    ) -> EvaluationResult | None:
        if notification_status != NotificationStatus.NOT_NOTIFIED:
            return None

        message = check(ticker, params, prices, market)
        if message is None:
            return None

        return EvaluationResult(
            new_notification_status=NotificationStatus.NOTIFIED_ONCE,
            new_status=AlarmStatus.TRIGGERED,
            message=message,
        )

    return evaluate
