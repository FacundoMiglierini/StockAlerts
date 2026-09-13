"""Mirrors the enums owned by the backend's Prisma schema
(backend/prisma/schema.prisma) — no shared codegen across languages, so
these are hand-kept in sync. Members are plain strings (StrEnum), so they
bind into raw SQL params and compare against `::text`-cast columns exactly
like the bare string literals this replaced.
"""

from __future__ import annotations

from enum import StrEnum


class AlarmStatus(StrEnum):
    ACTIVE = "ACTIVE"
    TRIGGERED = "TRIGGERED"
    DISABLED = "DISABLED"


class NotificationStatus(StrEnum):
    NOT_NOTIFIED = "NOT_NOTIFIED"
    NOTIFIED_ONCE = "NOTIFIED_ONCE"
    NOTIFIED_TWICE = "NOTIFIED_TWICE"


class Market(StrEnum):
    USA = "USA"
    CRYPTO = "CRYPTO"
    BYMA = "BYMA"
