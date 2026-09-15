from __future__ import annotations

import logging

from .base import Contact, Notifier
from .email_notifier import EmailNotifier
from .telegram_notifier import TelegramNotifier

logger = logging.getLogger(__name__)

__all__ = ["Contact", "Notifier", "get_notifier"]


class CompositeNotifier:
    """Sends through every configured channel; one channel's failure (or a
    channel simply not being set up for a given user) doesn't block the
    others."""

    def __init__(self, notifiers: list[Notifier]) -> None:
        self._notifiers = notifiers

    def send(self, contact: Contact, subject: str, body: str) -> None:
        for notifier in self._notifiers:
            try:
                notifier.send(contact, subject, body)
            except Exception:
                logger.exception(
                    "%s failed to notify %s", type(notifier).__name__, contact.email
                )


def get_notifier() -> Notifier:
    return CompositeNotifier([EmailNotifier(), TelegramNotifier()])
