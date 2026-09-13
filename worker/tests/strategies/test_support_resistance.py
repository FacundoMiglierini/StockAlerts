from worker.enums import AlarmStatus, Market, NotificationStatus
from worker.strategies.support_resistance import evaluate

PARAMS = {"lookbackDays": 180, "drawdownPct": 0.5}


def _rise_then_fall(peak: int = 10) -> tuple[list[float], list[float]]:
    """Highs that rise 0..peak then fall back to 0 — an unambiguous local
    max at `peak`, with argrelextrema's order=5 needing that many points on
    each side to detect it at all."""
    highs = list(range(0, peak + 1)) + list(range(peak - 1, -1, -1))
    lows = [h - 1 for h in highs]
    return highs, lows


def test_fires_once_price_breaks_below_the_drawdown_level(prices_factory):
    highs, lows = _rise_then_fall()
    prices = prices_factory(closes=highs, highs=highs, lows=lows)

    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is not None
    assert result.new_status == AlarmStatus.TRIGGERED
    assert "support" in result.message


def test_no_signal_without_any_local_high_to_measure_from(prices_factory):
    # Monotonically rising highs never form a local max, so there's no
    # reference point to compute a support level from at all.
    highs = list(range(0, 21))
    prices = prices_factory(closes=highs, highs=highs, lows=[h - 1 for h in highs])

    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is None


def test_no_signal_when_the_dip_does_not_breach_support(prices_factory):
    highs = list(range(0, 11)) + [9, 8, 9, 9, 9, 9, 9, 9, 9, 9]
    lows = [h - 0.1 for h in highs]
    prices = prices_factory(closes=highs, highs=highs, lows=lows)

    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOT_NOTIFIED, market=Market.USA)

    assert result is None


def test_already_notified_alarms_stay_silent(prices_factory):
    highs, lows = _rise_then_fall()
    prices = prices_factory(closes=highs, highs=highs, lows=lows)

    result = evaluate("AAPL", PARAMS, prices, notification_status=NotificationStatus.NOTIFIED_ONCE, market=Market.USA)

    assert result is None
