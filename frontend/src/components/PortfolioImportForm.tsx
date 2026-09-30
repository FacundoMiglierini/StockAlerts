import { useState } from 'react';
import type { ChangeEvent, SubmitEvent } from 'react';
import { api } from '../api/client';
import { parseCsv } from '../csv';
import { CURRENCY_SYMBOLS } from '../markets';
import type { Portfolio, PortfolioPlan, RecipeType } from '../types';

interface Props {
  onCreated: (portfolio: Portfolio) => void;
}

const RECIPE_LABELS: Record<RecipeType, string> = {
  DRAWDOWN_LADDER: 'Drawdown ladder (BUY steps below a reference price)',
  EXPLICIT_THRESHOLDS: 'Explicit thresholds (one trigger/target per row)',
};

const REQUIRED_COLUMNS: Record<RecipeType, string[]> = {
  DRAWDOWN_LADDER: ['ticker', 'market', 'reference'],
  EXPLICIT_THRESHOLDS: ['ticker', 'market', 'trigger', 'target'],
};

const EXAMPLE_CSV: Record<RecipeType, string> = {
  DRAWDOWN_LADDER: 'ticker,market,reference\nAAPL,USA,230\nGGAL,BYMA,7400',
  EXPLICIT_THRESHOLDS:
    'ticker,market,trigger,target\nAAPL,USA,180,240\nBTC,CRYPTO,50000,90000',
};

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function PortfolioImportForm({ onCreated }: Props) {
  const [recipe, setRecipe] = useState<RecipeType>('DRAWDOWN_LADDER');
  const [name, setName] = useState('');
  // Ladder options are edited as raw strings for the same reason AlarmForm's
  // params are (see the comment there): parsing on every keystroke fights
  // the user.
  const [dropPct, setDropPct] = useState('20');
  const [gainPct, setGainPct] = useState('20');
  const [entries, setEntries] = useState('3');
  const [csvText, setCsvText] = useState('');
  const [plan, setPlan] = useState<PortfolioPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null);

  // Any edit invalidates the preview, so "Create" can only ever submit
  // exactly what the user last saw previewed.
  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPlan(null);
      setError(null);
    };
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    edit(setCsvText)(await file.text());
    event.target.value = '';
  }

  // Validates inputs and builds the request body — the same one for
  // preview and create. Returns an error string instead of throwing so the
  // form can show it inline.
  function buildPayload(): { payload: object } | { error: string } {
    if (!name.trim()) return { error: 'Give the portfolio a name' };

    let parsed;
    try {
      parsed = parseCsv(csvText);
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid CSV' };
    }
    if (parsed.rows.length === 0) {
      return { error: 'Add a header row and at least one data row' };
    }
    const missing = REQUIRED_COLUMNS[recipe].filter(
      (column) => !parsed.headers.includes(column),
    );
    if (missing.length > 0) {
      return { error: `Missing column(s): ${missing.join(', ')}` };
    }

    if (recipe === 'EXPLICIT_THRESHOLDS') {
      return {
        payload: { name: name.trim(), recipe, rows: parsed.rows },
      };
    }

    const drop = Number(dropPct);
    const gain = Number(gainPct);
    const count = Number(entries);
    if (!(drop > 0 && drop < 100)) {
      return { error: 'Drop per step must be between 0 and 100 (%)' };
    }
    if (!(gain > 0))
      return { error: 'Gain per step must be greater than 0 (%)' };
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return {
        error: 'Entries per ticker must be a whole number from 1 to 10',
      };
    }
    return {
      payload: {
        name: name.trim(),
        recipe,
        options: { dropPct: drop / 100, gainPct: gain / 100, entries: count },
        rows: parsed.rows,
      },
    };
  }

  async function handlePreview(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setPlan(null);

    const built = buildPayload();
    if ('error' in built) {
      setError(built.error);
      return;
    }

    setBusy('preview');
    try {
      setPlan(
        await api.post<PortfolioPlan>('/portfolios/preview', built.payload),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    setError(null);
    const built = buildPayload();
    if ('error' in built) {
      setError(built.error);
      return;
    }

    setBusy('create');
    try {
      onCreated(await api.post<Portfolio>('/portfolios', built.payload));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create portfolio',
      );
      setBusy(null);
    }
  }

  const canCreate =
    plan !== null && plan.errors.length === 0 && plan.alarms.length > 0;

  return (
    <form className="alarm-form" onSubmit={handlePreview} noValidate>
      <label>
        Recipe
        <select
          value={recipe}
          onChange={(e) => edit(setRecipe)(e.target.value as RecipeType)}
        >
          {Object.entries(RECIPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Portfolio name
        <input
          value={name}
          maxLength={60}
          placeholder="e.g. US tech"
          onChange={(e) => edit(setName)(e.target.value)}
        />
      </label>

      {recipe === 'DRAWDOWN_LADDER' && (
        <div className="param-grid">
          <label>
            Drop per step (%)
            <input
              type="number"
              step="any"
              min={0}
              value={dropPct}
              onChange={(e) => edit(setDropPct)(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <label>
            Gain per step (%)
            <input
              type="number"
              step="any"
              min={0}
              value={gainPct}
              onChange={(e) => edit(setGainPct)(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <label>
            Entries per ticker
            <input
              type="number"
              step={1}
              min={1}
              max={10}
              value={entries}
              onChange={(e) => edit(setEntries)(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
        </div>
      )}

      <p className="portfolio-help">
        Columns: <code>{REQUIRED_COLUMNS[recipe].join(', ')}</code>. Tickers are
        entered bare (<code>AGRO</code>, not <code>AGRO.BA</code>;{' '}
        <code>BTC</code>, not <code>BTC-USD</code>) and <code>market</code> is
        USA, CRYPTO or BYMA. Use dots for decimals.
        {recipe === 'EXPLICIT_THRESHOLDS' && (
          <>
            {' '}
            A ticker may repeat with different trigger/target (one row per
            ladder step). Optional <code>phase</code> column: <code>BUY</code>{' '}
            (default) or <code>SELL</code> for a position you already bought —
            it skips the buy alert and only waits for the target.
          </>
        )}
        {recipe === 'DRAWDOWN_LADDER' &&
          ' Each ticker gets one BUY/SELL pair per entry: trigger = reference × (1 − drop)^step, target = trigger × (1 + gain). Reference is fixed now, e.g. the last local high — the ladder does not follow the price afterwards.'}
      </p>

      <label>
        Rows (CSV)
        <textarea
          className="portfolio-csv"
          rows={7}
          spellCheck={false}
          placeholder={EXAMPLE_CSV[recipe]}
          value={csvText}
          onChange={(e) => edit(setCsvText)(e.target.value)}
        />
      </label>
      <label>
        …or load a .csv file
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={handleFile}
        />
      </label>

      {error && <p className="error-text">{error}</p>}

      <button type="submit" disabled={busy !== null}>
        {busy === 'preview' ? 'Checking…' : 'Preview alarms'}
      </button>

      {plan && (
        <div className="portfolio-preview">
          {plan.errors.length > 0 && (
            <div className="portfolio-errors" role="alert">
              <strong>
                {plan.errors.length}{' '}
                {plan.errors.length === 1 ? 'problem' : 'problems'} to fix
              </strong>
              <ul>
                {plan.errors.map((e, i) => (
                  <li key={i}>
                    {e.row === null ? e.message : `Row ${e.row}: ${e.message}`}
                  </li>
                ))}
              </ul>
              <span className="text-muted">
                Row numbers count data rows, not the header.
              </span>
            </div>
          )}

          {plan.alarms.length > 0 && (
            <>
              <p className="portfolio-help">
                {plan.errors.length === 0
                  ? `${plan.alarms.length} ${plan.alarms.length === 1 ? 'alarm' : 'alarms'} will be created:`
                  : `${plan.alarms.length} valid ${plan.alarms.length === 1 ? 'alarm' : 'alarms'} so far (nothing is created until every row is valid):`}
              </p>
              <div className="portfolio-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Market</th>
                      <th>Step</th>
                      <th>Phase</th>
                      <th>Buy at</th>
                      <th>Sell at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.alarms.map((a, i) => (
                      <tr key={i}>
                        <td className="admin-table-email">{a.ticker}</td>
                        <td>{a.market}</td>
                        <td className="mono">{a.rung ?? '—'}</td>
                        <td>{a.phase === 'SELL' ? 'Sell (bought)' : 'Buy'}</td>
                        <td className="mono">
                          {CURRENCY_SYMBOLS[a.market]}
                          {formatPrice(a.params.trigger)}
                        </td>
                        <td className="mono">
                          {CURRENCY_SYMBOLS[a.market]}
                          {formatPrice(a.params.target)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {canCreate && (
            <button
              type="button"
              className="portfolio-create"
              disabled={busy !== null}
              onClick={handleCreate}
            >
              {busy === 'create'
                ? 'Creating…'
                : `Create ${plan.alarms.length} ${plan.alarms.length === 1 ? 'alarm' : 'alarms'}`}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
