"""One evaluation pass: load active alarms, fetch prices once per resolved
price-provider symbol, dispatch each alarm to its strategy, persist and
notify anything that triggered. See ../CLAUDE.md and the root CLAUDE.md's
data model section.
"""

from __future__ import annotations

import logging

from . import config, db
from .notifications import Contact, get_notifier
from .price_provider import get_price_provider
from .strategies.registry import STRATEGY_REGISTRY

logger = logging.getLogger(__name__)


def run_once() -> None:
    alarms_by_symbol = db.fetch_active_alarms_by_symbol()
    if not alarms_by_symbol:
        logger.info("No active alarms.")
        return

    provider = get_price_provider()
    notifier = get_notifier()

    for symbol, alarms in alarms_by_symbol.items():
        try:
            prices = provider.get_daily_history(symbol, config.PRICE_HISTORY_PERIOD)
        except Exception:
            logger.exception(
                "Failed to fetch price history for %s, skipping its %d alarm(s)",
                symbol,
                len(alarms),
            )
            continue

        for alarm in alarms:
            evaluate = STRATEGY_REGISTRY.get(alarm.strategy_type)
            if evaluate is None:
                logger.error(
                    "Unknown strategy type %s for alarm %s",
                    alarm.strategy_type,
                    alarm.id,
                )
                continue

            try:
                result = evaluate(
                    alarm.ticker,
                    alarm.params,
                    prices,
                    alarm.notification_status,
                    alarm.market,
                )
            except Exception:
                logger.exception(
                    "Strategy %s failed for alarm %s (%s)",
                    alarm.strategy_type,
                    alarm.id,
                    symbol,
                )
                continue

            if result is None:
                continue

            db.apply_alarm_result(
                alarm.id,
                notification_status=result.new_notification_status,
                status=result.new_status,
            )
            logger.info("Alarm %s triggered: %s", alarm.id, result.message)

            user_contact = db.fetch_user_contact(alarm.user_id)
            if not user_contact:
                logger.error(
                    "No user found for alarm %s (userId=%s)", alarm.id, alarm.user_id
                )
                continue
            contact = Contact(email=user_contact.email, channels=user_contact.channels)
            notifier.send(contact, f"Stock alert: {alarm.ticker}", result.message)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_once()
