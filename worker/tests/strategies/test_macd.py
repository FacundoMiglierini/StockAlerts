from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.macd import evaluate

PARAMS = {"fastPeriod": 3, "slowPeriod": 6, "signalPeriod": 2}


def test_fires_once_macd_crosses_above_signal(prices_factory):
    prices = prices_factory(closes=[10.0] * 15 + [20.0])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "above" in result.message


def test_fires_once_macd_crosses_below_signal(prices_factory):
    prices = prices_factory(closes=[10.0] * 15 + [0.0])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert "below" in result.message


def test_no_signal_on_a_flat_series(prices_factory):
    prices = prices_factory(closes=[10.0] * 20)
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None


def test_already_notified_alarms_stay_silent(prices_factory):
    prices = prices_factory(closes=[10.0] * 15 + [20.0])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOTIFIED_ONCE,
        market=Market.USA,
    )

    assert result is None
