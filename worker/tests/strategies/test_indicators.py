from __future__ import annotations

import math

import pandas as pd

from worker.strategies.indicators import bollinger_bands, ema, macd, rsi, sma


class TestSma:
    def test_rolling_mean_with_leading_nans(self):
        result = sma(pd.Series([1.0, 2, 3, 4, 5]), period=3)
        assert result.iloc[:2].isna().all()
        assert result.iloc[2:].tolist() == [2.0, 3.0, 4.0]


class TestEma:
    def test_constant_series_stays_constant(self):
        result = ema(pd.Series([10.0] * 10), period=3)
        assert (result == 10.0).all()

    def test_reacts_faster_than_a_longer_span(self):
        series = pd.Series([1.0] * 5 + [10.0] * 5)
        fast = ema(series, period=2)
        slow = ema(series, period=10)
        # Both start moving toward 10 once the jump happens, but the
        # shorter span should have moved further by the very next bar.
        assert fast.iloc[5] > slow.iloc[5]


class TestRsi:
    def test_strictly_increasing_prices_hit_100(self):
        result = rsi(pd.Series(range(1, 15), dtype=float), period=5)
        assert result.iloc[-1] == 100.0

    def test_strictly_decreasing_prices_hit_0(self):
        result = rsi(pd.Series(range(14, 0, -1), dtype=float), period=5)
        assert result.iloc[-1] == 0.0

    def test_below_warmup_period_is_nan(self):
        result = rsi(pd.Series([1.0, 2.0, 3.0]), period=14)
        assert result.isna().all()


class TestMacd:
    def test_flat_series_has_no_signal(self):
        macd_line, signal_line = macd(pd.Series([10.0] * 30), fast_period=12, slow_period=26, signal_period=9)
        assert macd_line.iloc[-1] == 0.0
        assert signal_line.iloc[-1] == 0.0

    def test_upward_jump_produces_a_positive_macd_line(self):
        series = pd.Series([10.0] * 30 + [20.0] * 10)
        macd_line, _ = macd(series, fast_period=5, slow_period=10, signal_period=3)
        assert macd_line.iloc[-1] > 0


class TestBollingerBands:
    def test_zero_volatility_collapses_bands_to_the_mean(self):
        lower, upper = bollinger_bands(pd.Series([10.0] * 10), period=5, std_dev=2)
        assert lower.iloc[-1] == 10.0
        assert upper.iloc[-1] == 10.0

    def test_upper_band_is_always_above_lower_when_volatile(self):
        series = pd.Series([10.0, 12, 9, 13, 8, 14, 7, 15, 6, 16])
        lower, upper = bollinger_bands(series, period=5, std_dev=2)
        valid = ~lower.isna()
        assert (upper[valid] > lower[valid]).all()
        assert not math.isnan(upper.iloc[-1])
