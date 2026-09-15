from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.manual_threshold import evaluate


def test_fires_buy_when_low_hits_trigger_and_stays_active(prices_factory):
    prices = prices_factory(closes=[100], lows=[90], highs=[105])
    result = evaluate(
        "AAPL",
        {"trigger": 95, "target": 150},
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is not None
    assert result.new_notification_status == NotificationStatus.NOTIFIED_ONCE
    assert result.new_status == AlarmStatus.ACTIVE
    assert "BUY" in result.message


def test_no_trigger_when_low_stays_above_trigger(prices_factory):
    prices = prices_factory(closes=[100], lows=[96], highs=[105])
    result = evaluate(
        "AAPL",
        {"trigger": 95, "target": 150},
        prices,
        notification_status=NotificationStatus.NOT_NOTIFIED,
        market=Market.USA,
    )

    assert result is None


def test_fires_sell_when_high_hits_target_and_completes(prices_factory):
    prices = prices_factory(closes=[155], lows=[150], highs=[160])
    result = evaluate(
        "AAPL",
        {"trigger": 95, "target": 150},
        prices,
        notification_status=NotificationStatus.NOTIFIED_ONCE,
        market=Market.USA,
    )

    assert result is not None
    assert result.new_notification_status == NotificationStatus.NOTIFIED_TWICE
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "SELL" in result.message


def test_no_sell_before_target_is_hit(prices_factory):
    prices = prices_factory(closes=[140], lows=[135], highs=[145])
    result = evaluate(
        "AAPL",
        {"trigger": 95, "target": 150},
        prices,
        notification_status=NotificationStatus.NOTIFIED_ONCE,
        market=Market.USA,
    )

    assert result is None


def test_fully_notified_never_fires_again(prices_factory):
    # In practice this alarm would already be TRIGGERED and excluded from
    # the active-alarms query — this just documents that the function
    # itself is a safe no-op if it were ever called again anyway.
    prices = prices_factory(closes=[1000], lows=[999], highs=[1001])
    result = evaluate(
        "AAPL",
        {"trigger": 95, "target": 150},
        prices,
        notification_status=NotificationStatus.NOTIFIED_TWICE,
        market=Market.USA,
    )

    assert result is None
