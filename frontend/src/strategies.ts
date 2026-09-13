import type { StrategyType } from './types'

export interface ParamField {
  name: string
  label: string
  default: number
  step?: number
  min?: number
  max?: number
}

// Mirrors backend/src/modules/alarms/strategies/strategy-params.schema.ts
// exactly — keep in sync when adding/changing a strategy.
export const STRATEGY_FIELDS: Record<StrategyType, ParamField[]> = {
  MANUAL_THRESHOLD: [
    { name: 'trigger', label: 'Trigger price', default: 0, step: 0.01, min: 0.01 },
    { name: 'target', label: 'Target price', default: 0, step: 0.01, min: 0.01 },
  ],
  SMA_CROSSOVER: [
    { name: 'fastPeriod', label: 'Fast period (days)', default: 50, step: 1, min: 1 },
    { name: 'slowPeriod', label: 'Slow period (days)', default: 200, step: 1, min: 1 },
  ],
  RSI: [
    { name: 'period', label: 'Period (days)', default: 14, step: 1, min: 1 },
    { name: 'oversold', label: 'Oversold threshold', default: 30, step: 1, min: 0, max: 100 },
    { name: 'overbought', label: 'Overbought threshold', default: 70, step: 1, min: 0, max: 100 },
  ],
  MACD: [
    { name: 'fastPeriod', label: 'Fast period (days)', default: 12, step: 1, min: 1 },
    { name: 'slowPeriod', label: 'Slow period (days)', default: 26, step: 1, min: 1 },
    { name: 'signalPeriod', label: 'Signal period (days)', default: 9, step: 1, min: 1 },
  ],
  BOLLINGER: [
    { name: 'period', label: 'Period (days)', default: 20, step: 1, min: 1 },
    { name: 'stdDev', label: 'Std deviations', default: 2, step: 0.1, min: 0.1 },
  ],
  SUPPORT_RESISTANCE: [
    { name: 'lookbackDays', label: 'Lookback (days)', default: 180, step: 1, min: 1 },
    { name: 'drawdownPct', label: 'Drawdown from high (0-1)', default: 0.1, step: 0.01, min: 0, max: 1 },
  ],
}

// Param field names that are denominated in the alarm's market currency
// (see markets.ts) rather than a plain number — AlarmForm appends the
// currency to these fields' labels dynamically instead of baking a symbol
// into `label` above, since the same strategy can be used across markets.
export const PRICE_FIELD_NAMES = new Set(['trigger', 'target'])

export const STRATEGY_LABELS: Record<StrategyType, string> = {
  MANUAL_THRESHOLD: 'Manual price threshold',
  SMA_CROSSOVER: 'SMA crossover',
  RSI: 'RSI overbought/oversold',
  MACD: 'MACD crossover',
  BOLLINGER: 'Bollinger Bands breakout',
  SUPPORT_RESISTANCE: 'Support/resistance breakout',
}
