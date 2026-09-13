from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


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
