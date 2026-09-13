from __future__ import annotations

from . import bollinger, macd, manual_threshold, rsi, sma_crossover, support_resistance
from .base import EvaluationResult, Strategy

# Keys must match the backend's StrategyType enum
# (backend/prisma/schema.prisma) exactly — the backend validates each
# strategy's `params` shape before it ever reaches this table.
STRATEGY_REGISTRY: dict[str, Strategy] = {
    "MANUAL_THRESHOLD": manual_threshold.evaluate,
    "SMA_CROSSOVER": sma_crossover.evaluate,
    "RSI": rsi.evaluate,
    "MACD": macd.evaluate,
    "BOLLINGER": bollinger.evaluate,
    "SUPPORT_RESISTANCE": support_resistance.evaluate,
}

__all__ = ["STRATEGY_REGISTRY", "EvaluationResult"]
