from worker.strategies.registry import STRATEGY_REGISTRY

# Must match the backend's StrategyType enum exactly
# (backend/prisma/schema.prisma) — see registry.py's own comment. This test
# exists so a rename on one side without the other fails loudly here
# instead of silently dropping alarms at runtime.
EXPECTED_STRATEGY_TYPES = {
    "MANUAL_THRESHOLD",
    "SMA_CROSSOVER",
    "RSI",
    "MACD",
    "BOLLINGER",
    "SUPPORT_RESISTANCE",
}


def test_registry_keys_match_the_backend_strategy_type_enum():
    assert set(STRATEGY_REGISTRY.keys()) == EXPECTED_STRATEGY_TYPES


def test_every_registered_strategy_is_callable():
    for evaluate in STRATEGY_REGISTRY.values():
        assert callable(evaluate)
