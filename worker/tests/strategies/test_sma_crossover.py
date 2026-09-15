from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.sma_crossover import evaluate

PARAMS = {"fastPeriod": 2, "slowPeriod": 4}


def test_fires_once_fast_crosses_above_slow(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 10, 10, 20])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert result.new_notification_status == NotificationStatus.NOTIFIED_ONCE
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "above" in result.message


def test_fires_once_fast_crosses_below_slow(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 10, 10, 0])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert "below" in result.message


def test_no_signal_when_averages_never_cross(prices_factory):
    prices = prices_factory(closes=[10] * 10)
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None


def test_already_notified_alarms_stay_silent(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 10, 10, 20])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOTIFIED_ONCE,
        market=Market.USA,
    )

    assert result is None


def test_insufficient_history_is_a_safe_no_op(prices_factory):
    prices = prices_factory(closes=[10, 20])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None
