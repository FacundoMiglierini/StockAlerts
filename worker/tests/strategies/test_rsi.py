from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.rsi import evaluate

PARAMS = {"period": 5, "oversold": 30, "overbought": 70}


def test_fires_oversold_on_a_sustained_decline(prices_factory):
    prices = prices_factory(closes=list(range(14, 0, -1)))
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "oversold" in result.message


def test_fires_overbought_on_a_sustained_rally(prices_factory):
    prices = prices_factory(closes=list(range(1, 15)))
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert "overbought" in result.message


def test_no_signal_in_the_middle_of_the_range(prices_factory):
    prices = prices_factory(closes=[10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None


def test_already_notified_alarms_stay_silent(prices_factory):
    prices = prices_factory(closes=list(range(14, 0, -1)))
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOTIFIED_ONCE,
        market=Market.USA,
    )

    assert result is None


def test_below_warmup_period_is_a_safe_no_op(prices_factory):
    prices = prices_factory(closes=[10, 9])
    result = evaluate(
        "AAPL",
        PARAMS,
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None
