from __future__ import annotations

import os

import pandas as pd
import pytest

# worker.config requires DATABASE_URL at import time (see config.py's
# _require()), and several modules under test import it transitively
# (price_provider, notifications). Without this, the suite only works by
# accident when worker/.env happens to exist with a real value — setting it
# here first (before any worker.* import) makes the suite hermetic, so it
# also works in CI / a fresh clone with no .env at all. setdefault, not a
# hard assignment: a real DATABASE_URL already in the environment (e.g. a
# developer's shell) still wins, and load_dotenv() itself never overrides
# an already-set variable either.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")


def make_prices(
    closes: list[float],
    highs: list[float] | None = None,
    lows: list[float] | None = None,
    opens: list[float] | None = None,
) -> pd.DataFrame:
    """A daily OHLC frame shaped like what PriceProvider.get_daily_history
    returns. Highs/lows/opens default to the close (fine for tests that
    only care about one column) unless a scenario needs to diverge them.
    """
    return pd.DataFrame(
        {
            "Open": opens or closes,
            "High": highs or closes,
            "Low": lows or closes,
            "Close": closes,
        },
        index=pd.date_range("2026-01-01", periods=len(closes), freq="D"),
    )


@pytest.fixture
def prices_factory():
    return make_prices
