"""Integration tests for worker/db.py against a real Postgres — separate
from tests/ (pure unit tests, no DB) both in directory and in how they're
run; see worker/CLAUDE.md's Testing section for why and how.
"""

from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from worker.enums import AlarmStatus, Market, NotificationStatus

TEST_DATABASE_URL = "postgresql://test:test@localhost:5433/test?schema=public"
BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"

# Must happen before `worker.db` (or anything importing `worker.config`) is
# ever imported anywhere in this process — config.py reads DATABASE_URL
# from the environment at import time, not per-call. A hard assignment,
# not setdefault: integration tests always target postgres-test,
# regardless of whatever worker/.env has for local dev.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from worker import db  # noqa: E402 (must follow the os.environ assignment above)


@pytest.fixture(scope="session", autouse=True)
def _apply_migrations():
    """Applies the backend's Prisma migrations to postgres-test once per
    test session. Assumes `docker compose --profile test up -d
    postgres-test` is already running (see worker/CLAUDE.md) — this does
    not start that container itself, only migrates it. Requires Node/npm
    and the backend's node_modules to be installed, since the schema is
    genuinely owned by the backend's Prisma migrations, not the worker.
    """
    subprocess.run(
        ["npx", "prisma", "migrate", "deploy"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        check=True,
    )


@pytest.fixture
def engine() -> Engine:
    return db.get_engine()


@pytest.fixture(autouse=True)
def clean_db(engine: Engine):
    """Every integration test starts from an empty database."""
    with engine.begin() as conn:
        conn.execute(
            text('TRUNCATE TABLE "users", "alarms", "notification_channels" CASCADE')
        )
    yield


def insert_user(engine: Engine, *, email: str = "user@test.com") -> str:
    user_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            text(
                'INSERT INTO users (id, email, "passwordHash", role, "createdAt") '
                "VALUES (:id, :email, 'x', 'USER', now())"
            ),
            {"id": user_id, "email": email},
        )
    return user_id


def insert_alarm(
    engine: Engine,
    *,
    user_id: str,
    ticker: str = "AAPL",
    strategy_type: str = "MANUAL_THRESHOLD",
    params: dict | None = None,
    status: AlarmStatus = AlarmStatus.ACTIVE,
    notification_status: NotificationStatus = NotificationStatus.NOT_NOTIFIED,
    market: Market = Market.USA,
) -> str:
    alarm_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO alarms
                    (id, "userId", ticker, "strategyType", params, status, "notificationStatus", market, "createdAt", "updatedAt")
                VALUES
                    (:id, :user_id, :ticker, CAST(:strategy_type AS "StrategyType"), CAST(:params AS jsonb),
                     CAST(:status AS "AlarmStatus"), CAST(:notification_status AS "NotificationStatus"),
                     CAST(:market AS "Market"), now(), now())
                """),
            {
                "id": alarm_id,
                "user_id": user_id,
                "ticker": ticker,
                "strategy_type": strategy_type,
                "params": json.dumps(params or {"trigger": 100, "target": 200}),
                "status": status,
                "notification_status": notification_status,
                "market": market,
            },
        )
    return alarm_id


def insert_channel(
    engine: Engine,
    *,
    user_id: str,
    channel_type: str = "TELEGRAM",
    external_id: str = "123",
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                'INSERT INTO notification_channels (id, "userId", type, "externalId", "createdAt") '
                'VALUES (:id, :user_id, CAST(:type AS "NotificationChannelType"), :external_id, now())'
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": channel_type,
                "external_id": external_id,
            },
        )


def fetch_alarm_row(engine: Engine, alarm_id: str) -> dict:
    with engine.connect() as conn:
        row = (
            conn.execute(
                text(
                    'SELECT status::text AS status, "notificationStatus"::text AS "notificationStatus", '
                    '"triggeredAt" FROM alarms WHERE id = :id'
                ),
                {"id": alarm_id},
            )
            .mappings()
            .first()
        )
    assert row is not None
    return dict(row)
