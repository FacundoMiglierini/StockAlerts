import { z } from 'zod';
import { Market, StrategyType } from '../../../generated/prisma/enums.js';
import { strategyParamsSchemas } from '../../alarms/strategies/strategy-params.schema.js';

// A recipe turns a table of rows into a set of ready-to-create alarms. Both
// recipes below produce MANUAL_THRESHOLD alarms — the two-phase (BUY at
// `trigger`, then SELL at `target`) evolution of the original script's
// `Trade` — with prices frozen at import time, exactly like the old CSV
// rows were. Pure and side-effect free: PortfoliosService owns persistence,
// this only plans.
export const RecipeType = {
  // One alarm per row: the row already carries its own trigger/target.
  EXPLICIT_THRESHOLDS: 'EXPLICIT_THRESHOLDS',
  // The old `--newtrades` ladder: N rungs per row, derived from a reference
  // price (the old script's last local max) and the import-wide options.
  DRAWDOWN_LADDER: 'DRAWDOWN_LADDER',
} as const;
export type RecipeType = (typeof RecipeType)[keyof typeof RecipeType];

export const MAX_ROWS = 500;
export const MAX_ENTRIES = 10;
export const MAX_ALARMS = 500;

// Which leg of the two-phase MANUAL_THRESHOLD cycle an alarm starts in.
// SELL is for a position already bought (the old CSV's status=1 with the
// BUY already notified): the alarm starts past its BUY notification, so the
// worker only watches for `target` instead of waiting for a new dip.
export const Phase = { BUY: 'BUY', SELL: 'SELL' } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export interface PlannedAlarm {
  ticker: string;
  market: Market;
  strategyType: typeof StrategyType.MANUAL_THRESHOLD;
  params: { trigger: number; target: number };
  // 1-based ladder rung. Explicit rows don't carry one, so it's derived
  // once all rows are known (see numberExplicitRungs); null only until then.
  rung: number | null;
  phase: Phase;
}

// `row` is the 1-based index into the submitted rows (null for an error
// about the import as a whole, e.g. invalid ladder options).
export interface RowError {
  row: number | null;
  message: string;
}

export interface PlanResult {
  // Alarms for every row that validated. The caller decides what to do when
  // `errors` is non-empty: preview shows both, create refuses outright.
  alarms: PlannedAlarm[];
  errors: RowError[];
}

// Accepts a number or a numeric string, so the frontend can pass raw CSV
// cells straight through and the backend stays the single validator.
const positiveNumber = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  z.number({ error: 'must be a number' }).positive('must be greater than 0'),
);

// Same shape rule as the frontend's isValidTicker (src/validation.ts).
const TICKER_RE = /^[A-Z0-9.-]{1,10}$/;

const baseRowSchema = z.object({
  ticker: z
    .string({ error: 'is required' })
    .trim()
    .toUpperCase()
    .regex(TICKER_RE, 'must be 1-10 characters: A-Z, 0-9, "." or "-"'),
  market: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    z.enum(Market, { error: 'must be one of USA, CRYPTO, BYMA' }),
  ),
});

const explicitRowSchema = baseRowSchema.extend({
  trigger: positiveNumber,
  target: positiveNumber,
  // Optional column; a blank cell (raw CSV) means BUY, same as omitting it.
  phase: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.trim().toUpperCase() || undefined
        : value,
    z.enum(Phase, { error: 'must be BUY or SELL' }).default(Phase.BUY),
  ),
});

const ladderRowSchema = baseRowSchema.extend({
  reference: positiveNumber,
});

const ladderOptionsSchema = z.object(
  {
    dropPct: z
      .number({ error: 'must be a number' })
      .gt(0, 'must be greater than 0')
      .lt(1, 'must be less than 1 (a fraction, e.g. 0.2 for 20%)'),
    gainPct: z
      .number({ error: 'must be a number' })
      .positive('must be greater than 0'),
    entries: z
      .number({ error: 'must be a number' })
      .int('must be a whole number')
      .min(1, 'must be at least 1')
      .max(MAX_ENTRIES, `must be at most ${MAX_ENTRIES}`),
  },
  { error: 'are required' },
);

function issuesToErrors(error: z.ZodError, row: number | null): RowError[] {
  return error.issues.map((issue) => ({
    row,
    message: issue.path.length
      ? `${issue.path.join('.')}: ${issue.message}`
      : issue.message,
  }));
}

// The worker's resolve_symbol() (worker/worker/market.py) appends these
// itself, and the frontend's ticker lists store tickers bare for the same
// reason — a suffixed ticker here would double up ("AGRO.BA.BA") and fail
// at price-fetch time, so reject it up front instead.
function suffixError(ticker: string, market: Market): string | null {
  if (market === Market.BYMA && ticker.endsWith('.BA')) {
    return 'ticker: BYMA tickers are entered without the ".BA" suffix (it is added automatically)';
  }
  if (market === Market.CRYPTO && ticker.endsWith('-USD')) {
    return 'ticker: crypto tickers are entered without the "-USD" suffix (it is added automatically)';
  }
  return null;
}

// The old script rounded every price to 2 decimals, which flattens
// sub-dollar assets (DOGE at 0.15 would lose most of a 20% step).
function roundPrice(value: number, reference: number): number {
  return Number(value.toFixed(reference < 1 ? 6 : 2));
}

function planLadder(
  ticker: string,
  market: Market,
  reference: number,
  options: z.infer<typeof ladderOptionsSchema>,
): PlannedAlarm[] {
  const rungs: PlannedAlarm[] = [];
  for (let rung = 1; rung <= options.entries; rung++) {
    const trigger = roundPrice(
      reference * (1 - options.dropPct) ** rung,
      reference,
    );
    const target = roundPrice(trigger * (1 + options.gainPct), reference);
    rungs.push({
      ticker,
      market,
      strategyType: StrategyType.MANUAL_THRESHOLD,
      params: { trigger, target },
      rung,
      phase: Phase.BUY,
    });
  }
  return rungs;
}

// Explicit rows for one ticker are usually a hand-written ladder (the old
// CSV's shape), so number them the way a ladder would be: highest trigger
// first. Preview-only — rungs aren't stored on the alarm.
function numberExplicitRungs(alarms: PlannedAlarm[]): void {
  const groups = new Map<string, PlannedAlarm[]>();
  for (const alarm of alarms) {
    const key = `${alarm.market}:${alarm.ticker}`;
    groups.set(key, [...(groups.get(key) ?? []), alarm]);
  }
  for (const group of groups.values()) {
    group
      .sort((a, b) => b.params.trigger - a.params.trigger)
      .forEach((alarm, index) => {
        alarm.rung = index + 1;
      });
  }
}

export function expandRecipe(
  recipe: RecipeType,
  rows: unknown[],
  options: unknown,
): PlanResult {
  const errors: RowError[] = [];
  const alarms: PlannedAlarm[] = [];

  let ladderOptions: z.infer<typeof ladderOptionsSchema> | undefined;
  if (recipe === RecipeType.DRAWDOWN_LADDER) {
    const parsed = ladderOptionsSchema.safeParse(options);
    if (!parsed.success) {
      return {
        alarms: [],
        errors: issuesToErrors(parsed.error, null).map((e) => ({
          ...e,
          message: `ladder options ${e.message}`,
        })),
      };
    }
    ladderOptions = parsed.data;
  }

  if (rows.length === 0) {
    return {
      alarms: [],
      errors: [{ row: null, message: 'at least one row is required' }],
    };
  }

  const rowSchema =
    recipe === RecipeType.DRAWDOWN_LADDER ? ladderRowSchema : explicitRowSchema;
  const firstSeenAt = new Map<string, number>();

  rows.forEach((raw, index) => {
    const row = index + 1;

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(...issuesToErrors(parsed.error, row));
      return;
    }
    const data = parsed.data;

    const suffix = suffixError(data.ticker, data.market);
    if (suffix) {
      errors.push({ row, message: suffix });
      return;
    }

    // A ladder row expands to every rung itself, so a second row for the
    // same ticker is always a mistake. Explicit rows legitimately repeat a
    // ticker (one row per rung, like the old CSV), so only an identical
    // trigger/target pair counts as a duplicate there.
    const thresholds =
      'trigger' in data ? `${data.trigger}/${data.target}` : null;
    const key = `${data.market}:${data.ticker}:${thresholds ?? ''}`;
    const firstRow = firstSeenAt.get(key);
    if (firstRow !== undefined) {
      const what = thresholds
        ? `${data.ticker} on ${data.market} at ${thresholds}`
        : `${data.ticker} on ${data.market}`;
      errors.push({ row, message: `duplicate of row ${firstRow} (${what})` });
      return;
    }
    firstSeenAt.set(key, row);

    const planned =
      'reference' in data && ladderOptions
        ? planLadder(data.ticker, data.market, data.reference, ladderOptions)
        : 'trigger' in data
          ? [
              {
                ticker: data.ticker,
                market: data.market,
                strategyType: StrategyType.MANUAL_THRESHOLD,
                params: { trigger: data.trigger, target: data.target },
                rung: null,
                phase: data.phase,
              } satisfies PlannedAlarm,
            ]
          : [];

    // Every generated alarm goes through the same schema a hand-created one
    // does, so an import can never store a params shape the worker doesn't
    // expect (and catches a rung that rounded down to 0).
    const rowAlarms: PlannedAlarm[] = [];
    for (const alarm of planned) {
      const check = strategyParamsSchemas[alarm.strategyType].safeParse(
        alarm.params,
      );
      if (!check.success) {
        const where = alarm.rung === null ? '' : `rung ${alarm.rung}: `;
        errors.push({
          row,
          message: `${where}computed trigger/target is not a positive price (reference too small for these options)`,
        });
        return;
      }
      rowAlarms.push(alarm);
    }
    alarms.push(...rowAlarms);
  });

  if (recipe === RecipeType.EXPLICIT_THRESHOLDS) {
    numberExplicitRungs(alarms);
  }

  if (alarms.length > MAX_ALARMS) {
    errors.push({
      row: null,
      message: `this import would create ${alarms.length} alarms; the limit is ${MAX_ALARMS} per import`,
    });
  }

  return { alarms, errors };
}
