import pandas as pd
import pytest

from worker.price_provider.yfinance_provider import YFinanceProvider


def test_returns_clean_history(monkeypatch: pytest.MonkeyPatch):
    frame = pd.DataFrame({"Open": [100], "High": [105], "Low": [95], "Close": [102]})
    monkeypatch.setattr(
        "worker.price_provider.yfinance_provider.yf.download", lambda *a, **k: frame
    )

    result = YFinanceProvider().get_daily_history("AAPL", "1y")

    assert list(result.columns) == ["Open", "High", "Low", "Close"]


def test_raises_on_empty_history(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        "worker.price_provider.yfinance_provider.yf.download",
        lambda *a, **k: pd.DataFrame(columns=["Open", "High", "Low", "Close"]),
    )

    with pytest.raises(ValueError, match="No price history"):
        YFinanceProvider().get_daily_history("AAPL", "1y")


def test_raises_instead_of_passing_through_a_bad_bar(monkeypatch: pytest.MonkeyPatch):
    # The exact bug seen live: a glitched fetch for a thinly-traded BYMA
    # ticker came back non-empty but with Low == 0 for the latest bar. That
    # must fail loudly here rather than reach strategy evaluation, where it
    # would satisfy almost any manual_threshold trigger.
    frame = pd.DataFrame({"Open": [100], "High": [105], "Low": [0], "Close": [102]})
    monkeypatch.setattr(
        "worker.price_provider.yfinance_provider.yf.download", lambda *a, **k: frame
    )

    with pytest.raises(ValueError, match="non-positive"):
        YFinanceProvider().get_daily_history("AAPL", "1y")
