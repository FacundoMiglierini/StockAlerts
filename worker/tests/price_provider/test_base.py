import pandas as pd
import pytest

from worker.price_provider.base import validate_daily_history


def _frame(opens, highs, lows, closes):
    return pd.DataFrame({"Open": opens, "High": highs, "Low": lows, "Close": closes})


def test_accepts_a_clean_frame():
    frame = _frame([100], [105], [95], [102])

    validate_daily_history("AAPL", frame)  # does not raise


def test_rejects_an_empty_frame():
    frame = _frame([], [], [], [])

    with pytest.raises(ValueError, match="No price history"):
        validate_daily_history("AAPL", frame)


def test_rejects_a_missing_value():
    frame = _frame([100], [105], [None], [102])

    with pytest.raises(ValueError, match="missing OHLC values"):
        validate_daily_history("AAPL", frame)


@pytest.mark.parametrize("bad_low", [0, -1])
def test_rejects_a_non_positive_value(bad_low):
    # The exact bug seen live: yfinance returning a bar with Low == 0 for a
    # thinly-traded ticker, which would otherwise satisfy almost any
    # manual_threshold trigger and fire a false BUY.
    frame = _frame([100], [105], [bad_low], [102])

    with pytest.raises(ValueError, match="non-positive"):
        validate_daily_history("AAPL", frame)


def test_rejects_high_below_low():
    frame = _frame([100], [90], [95], [92])

    with pytest.raises(ValueError, match="High below its Low"):
        validate_daily_history("AAPL", frame)
