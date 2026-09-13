import pandas as pd
import pytest

from worker import config
from worker.price_provider import FallbackPriceProvider, get_price_provider
from worker.price_provider.finnhub_provider import FinnhubProvider
from worker.price_provider.yfinance_provider import YFinanceProvider

FAKE_HISTORY = pd.DataFrame({"Open": [1], "High": [1], "Low": [1], "Close": [1]})


class FakeProvider:
    def __init__(self, *, raises: bool = False):
        self.raises = raises
        self.calls = 0

    def get_daily_history(self, ticker, period):
        self.calls += 1
        if self.raises:
            raise RuntimeError("provider is down")
        return FAKE_HISTORY


def test_uses_the_primary_when_it_succeeds():
    primary = FakeProvider()
    fallback = FakeProvider()
    provider = FallbackPriceProvider(primary=primary, fallback=fallback)

    result = provider.get_daily_history("AAPL", "1y")

    assert result is FAKE_HISTORY
    assert primary.calls == 1
    assert fallback.calls == 0


def test_falls_back_when_the_primary_raises():
    primary = FakeProvider(raises=True)
    fallback = FakeProvider()
    provider = FallbackPriceProvider(primary=primary, fallback=fallback)

    result = provider.get_daily_history("AAPL", "1y")

    assert result is FAKE_HISTORY
    assert primary.calls == 1
    assert fallback.calls == 1


def test_goes_straight_to_fallback_when_there_is_no_primary():
    fallback = FakeProvider()
    provider = FallbackPriceProvider(primary=None, fallback=fallback)

    provider.get_daily_history("AAPL", "1y")

    assert fallback.calls == 1


class TestGetPriceProvider:
    def test_finnhub_disabled_by_default_even_with_an_api_key(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(config, "FINNHUB_API_KEY", "some-key")
        monkeypatch.setattr(config, "FINNHUB_HISTORY_ENABLED", False)

        provider = get_price_provider()

        assert provider._primary is None
        assert isinstance(provider._fallback, YFinanceProvider)

    def test_finnhub_used_as_primary_once_explicitly_enabled(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(config, "FINNHUB_API_KEY", "some-key")
        monkeypatch.setattr(config, "FINNHUB_HISTORY_ENABLED", True)

        provider = get_price_provider()

        assert isinstance(provider._primary, FinnhubProvider)

    def test_no_primary_at_all_without_an_api_key(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(config, "FINNHUB_API_KEY", None)
        monkeypatch.setattr(config, "FINNHUB_HISTORY_ENABLED", True)

        provider = get_price_provider()

        assert provider._primary is None
