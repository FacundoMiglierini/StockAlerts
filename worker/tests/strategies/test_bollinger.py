from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.bollinger import evaluate

PARAMS = {"period": 5, "stdDev": 1.5}


def test_fires_when_close_is_at_or_above_the_upper_band(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 15.0])
    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is not None
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "above the upper" in result.message


def test_fires_when_close_is_at_or_below_the_lower_band(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 5.0])
    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is not None
    assert "below the lower" in result.message


def test_no_signal_within_established_normal_volatility(prices_factory):
    # A close within the range recent history already shows shouldn't read
    # as a breakout — only a genuine flat-then-jump does (see the two tests
    # above, whose baseline history has ~zero volatility).
    prices = prices_factory(closes=[10, 11, 9, 10.5, 10.2])
    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is None


def test_already_notified_alarms_stay_silent(prices_factory):
    prices = prices_factory(closes=[10, 10, 10, 10, 15.0])
    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOTIFIED_ONCE, market=Market.USA)

    assert result is None
