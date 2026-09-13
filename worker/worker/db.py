"""Raw-SQL access to the shared Postgres database.

The schema is owned by the backend's Prisma migrations (see
../backend/prisma/schema.prisma) — this module only reads/writes it. Column
names are quoted camelCase (e.g. "userId") because that's what Prisma
generates; enum columns are cast to/from text explicitly because psycopg
binds parameters as text and Postgres won't implicitly compare/assign a
custom enum type against a bare text-typed parameter.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from . import config
from .enums import AlarmStatus, Market, NotificationStatus
from .market import resolve_symbol

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        # Prisma's DATABASE_URL uses the psycopg2-style "postgresql://"
        # scheme; SQLAlchemy needs the driver named explicitly for psycopg3.
        url = config.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
        # Prisma's `?schema=` query param isn't a libpq connection option —
        # psycopg rejects it outright. The schema is "public" either way.
        parts = urlsplit(url)
        query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
        url = urlunsplit(parts._replace(query=urlencode(query)))
        _engine = create_engine(url, pool_pre_ping=True)
    return _engine


@dataclass
class Alarm:
    id: str
    user_id: str
    ticker: str
    strategy_type: str
    params: dict[str, Any]
    notification_status: NotificationStatus
    market: Market


def fetch_active_alarms_by_symbol() -> dict[str, list[Alarm]]:
    """Active alarms grouped by resolved price-provider symbol (not raw
    ticker), so the caller fetches prices once per distinct series. Grouping
    by raw ticker would incorrectly merge alarms whose tickers collide
    across markets (e.g. a US-listed ADR and a same-named company or CEDEAR
    listed on BYMA).
    """
    query = text(
        f"""
        SELECT id, "userId", ticker, "strategyType"::text AS "strategyType", params,
               "notificationStatus"::text AS "notificationStatus", market::text AS market
        FROM alarms
        WHERE status::text = '{AlarmStatus.ACTIVE}'
        """
    )
    grouped: dict[str, list[Alarm]] = defaultdict(list)
    with get_engine().connect() as conn:
        for row in conn.execute(query).mappings():
            alarm = Alarm(
                id=row["id"],
                user_id=row["userId"],
                ticker=row["ticker"],
                strategy_type=row["strategyType"],
                params=row["params"],
                notification_status=NotificationStatus(row["notificationStatus"]),
                market=Market(row["market"]),
            )
            grouped[resolve_symbol(alarm.ticker, alarm.market)].append(alarm)
    return grouped


@dataclass
class UserContact:
    email: str
    # channel type (e.g. "TELEGRAM") -> that channel's externalId. Empty if
    # the user hasn't linked anything beyond email.
    channels: dict[str, str]


def fetch_user_contact(user_id: str) -> UserContact | None:
    user_query = text("SELECT email FROM users WHERE id = :user_id")
    channels_query = text(
        'SELECT type::text AS type, "externalId" FROM notification_channels WHERE "userId" = :user_id'
    )
    with get_engine().connect() as conn:
        user_row = conn.execute(user_query, {"user_id": user_id}).first()
        if not user_row:
            return None
        channel_rows = conn.execute(channels_query, {"user_id": user_id}).mappings()
        channels = {row["type"]: row["externalId"] for row in channel_rows}
    return UserContact(email=user_row[0], channels=channels)


def apply_alarm_result(alarm_id: str, *, notification_status: NotificationStatus, status: AlarmStatus) -> None:
    """Persist a strategy evaluation's outcome: new notification status and alarm status."""
    query = text(
        f"""
        UPDATE alarms
        SET "notificationStatus" = CAST(:notification_status AS "NotificationStatus"),
            status = CAST(:status AS "AlarmStatus"),
            "triggeredAt" = CASE WHEN :status = '{AlarmStatus.TRIGGERED}' THEN :triggered_at ELSE "triggeredAt" END,
            "updatedAt" = :updated_at
        WHERE id = :id
        """
    )
    now = datetime.now(timezone.utc)
    with get_engine().begin() as conn:
        conn.execute(
            query,
            {
                "id": alarm_id,
                "notification_status": notification_status,
                "status": status,
                "triggered_at": now,
                "updated_at": now,
            },
        )
