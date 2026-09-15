from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

# Cosmetic-only tone classification shared by every Notifier that wants to
# color/icon-code an alert (email's accent bar, Telegram's leading emoji).
# MANUAL_THRESHOLD's two-phase messages start with "BUY"/"SELL" (see
# strategies/manual_threshold.py); every other strategy's message is
# direction-neutral. Never used for anything but display — a body that
# doesn't match either prefix just renders as "neutral".
ALERT_ICONS = {
    "bullish": "\U0001f4c8",
    "bearish": "\U0001f4c9",
    "neutral": "\U0001f514",
}


def classify_alert(body: str) -> str:
    if body.startswith("BUY"):
        return "bullish"
    if body.startswith("SELL"):
        return "bearish"
    return "neutral"


@dataclass
class Contact:
    email: str
    # channel type (e.g. "TELEGRAM") -> that channel's externalId, from the
    # backend's notification_channels table. A Notifier for a channel not
    # present here should no-op — see db.fetch_user_contact().
    channels: dict[str, str]


class Notifier(Protocol):
    def send(self, contact: Contact, subject: str, body: str) -> None:
        """Should no-op quietly if this channel isn't configured/linked for
        `contact` — see notifications/__init__.py's CompositeNotifier for
        how per-channel failures are isolated."""
        ...
