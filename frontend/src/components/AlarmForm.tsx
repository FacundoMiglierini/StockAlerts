import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { Alarm, Market, StrategyType } from '../types';
import {
  STRATEGY_FIELDS,
  STRATEGY_LABELS,
  PRICE_FIELD_NAMES,
} from '../strategies';
import { MARKET_LABELS, CURRENCY_CODES } from '../markets';
import { isValidTicker, validateStrategyParams } from '../validation';
import { TickerInput } from './TickerInput';

interface Props {
  mode?: 'create' | 'edit';
  // Required when mode is 'edit': the alarm being edited, to seed the form
  // and to lock ticker/strategy/market (immutable after creation — see
  // root CLAUDE.md's data model notes).
  initialAlarm?: Alarm;
  onCreate?: (
    ticker: string,
    strategyType: StrategyType,
    market: Market,
    params: Record<string, number>,
  ) => Promise<void>;
  onSave?: (params: Record<string, number>) => Promise<void>;
}

// Params are edited as raw strings, not numbers: a controlled number input
// whose value is coerced to a number on every keystroke fights the user
// once a field holds "0" — deleting it round-trips through Number('') = 0,
// so React immediately puts the "0" back before the next keystroke lands,
// and new digits end up glued onto it (e.g. typing "5" over a "0" trigger
// price yields "50"). Keeping the field a free string during editing and
// only parsing on submit avoids that.
function defaultParamStrings(
  strategyType: StrategyType,
): Record<string, string> {
  return Object.fromEntries(
    STRATEGY_FIELDS[strategyType].map((f) => [f.name, String(f.default)]),
  );
}

export function AlarmForm({
  mode = 'create',
  initialAlarm,
  onCreate,
  onSave,
}: Props) {
  const isEdit = mode === 'edit';
  const [ticker, setTicker] = useState(initialAlarm?.ticker ?? '');
  const [market, setMarket] = useState<Market>(initialAlarm?.market ?? 'USA');
  const [strategyType, setStrategyType] = useState<StrategyType>(
    initialAlarm?.strategyType ?? 'MANUAL_THRESHOLD',
  );
  const [paramStrings, setParamStrings] = useState<Record<string, string>>(
    initialAlarm
      ? Object.fromEntries(
          Object.entries(initialAlarm.params).map(([k, v]) => [k, String(v)]),
        )
      : defaultParamStrings('MANUAL_THRESHOLD'),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleStrategyChange(next: StrategyType) {
    setStrategyType(next);
    setParamStrings(defaultParamStrings(next));
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);

    const trimmedTicker = ticker.trim().toUpperCase();
    if (!isEdit) {
      if (!trimmedTicker) {
        setError('Ticker is required');
        return;
      }
      if (!isValidTicker(trimmedTicker)) {
        setError('Ticker must be 1-10 letters/digits (e.g. AAPL, BTC, GGAL)');
        return;
      }
    }

    const params = Object.fromEntries(
      Object.entries(paramStrings).map(([key, value]) => [key, Number(value)]),
    );
    for (const [key, value] of Object.entries(params)) {
      if (Number.isNaN(value)) {
        const label =
          STRATEGY_FIELDS[strategyType].find((f) => f.name === key)?.label ??
          key;
        setError(`${label} must be a number`);
        return;
      }
    }
    const paramError = validateStrategyParams(strategyType, params);
    if (paramError) {
      setError(paramError);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await onSave!(params);
      } else {
        await onCreate!(trimmedTicker, strategyType, market, params);
        setTicker('');
        setParamStrings(defaultParamStrings(strategyType));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEdit ? 'update' : 'create'} alarm`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="alarm-form" onSubmit={handleSubmit} noValidate>
      <label>
        Ticker
        {isEdit ? (
          <input value={ticker} disabled />
        ) : (
          <TickerInput value={ticker} market={market} onChange={setTicker} />
        )}
      </label>
      <label>
        Market
        <select
          value={market}
          disabled={isEdit}
          onChange={(e) => setMarket(e.target.value as Market)}
        >
          {Object.entries(MARKET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Strategy
        <select
          value={strategyType}
          disabled={isEdit}
          onChange={(e) => handleStrategyChange(e.target.value as StrategyType)}
        >
          {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="param-grid param-grid-transition" key={strategyType}>
        {STRATEGY_FIELDS[strategyType].map((field) => (
          <label key={field.name}>
            {PRICE_FIELD_NAMES.has(field.name)
              ? `${field.label} (${CURRENCY_CODES[market]})`
              : field.label}
            <input
              type="number"
              step={field.step ?? 1}
              min={field.min}
              max={field.max}
              value={paramStrings[field.name]}
              onChange={(e) =>
                setParamStrings((prev) => ({
                  ...prev,
                  [field.name]: e.target.value,
                }))
              }
              onFocus={(e) => e.target.select()}
              required
            />
          </label>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={submitting}>
        {isEdit
          ? submitting
            ? 'Saving…'
            : 'Save changes'
          : submitting
            ? 'Creating…'
            : 'Create alarm'}
      </button>
    </form>
  );
}
