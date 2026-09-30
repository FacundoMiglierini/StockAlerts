import { MAX_ALARMS, RecipeType, expandRecipe } from './expand-recipe.js';

const LADDER = { dropPct: 0.2, gainPct: 0.2, entries: 3 };

describe('expandRecipe', () => {
  describe('DRAWDOWN_LADDER', () => {
    it("reproduces the old script's ladder: trigger = ref × (1-d)^i, target = trigger × (1+g)", () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [{ ticker: 'AAPL', market: 'USA', reference: 100 }],
        LADDER,
      );

      expect(errors).toEqual([]);
      expect(alarms).toEqual([
        {
          ticker: 'AAPL',
          market: 'USA',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 80, target: 96 },
          rung: 1,
          phase: 'BUY',
        },
        {
          ticker: 'AAPL',
          market: 'USA',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 64, target: 76.8 },
          rung: 2,
          phase: 'BUY',
        },
        {
          ticker: 'AAPL',
          market: 'USA',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 51.2, target: 61.44 },
          rung: 3,
          phase: 'BUY',
        },
      ]);
    });

    it('normalizes ticker/market and accepts numeric strings (raw CSV cells)', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [{ ticker: '  ggal ', market: ' byma', reference: '5000' }],
        { ...LADDER, entries: 1 },
      );

      expect(errors).toEqual([]);
      expect(alarms).toHaveLength(1);
      expect(alarms[0]).toMatchObject({
        ticker: 'GGAL',
        market: 'BYMA',
        params: { trigger: 4000, target: 4800 },
      });
    });

    it('uses 6 decimals instead of 2 when the reference is below 1', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [{ ticker: 'DOGE', market: 'CRYPTO', reference: 0.123456 }],
        { dropPct: 0.1, gainPct: 0.1, entries: 1 },
      );

      expect(errors).toEqual([]);
      expect(alarms[0].params).toEqual({ trigger: 0.11111, target: 0.122221 });
    });

    it('reports a row error when a rung rounds down to zero', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [{ ticker: 'SHIB', market: 'CRYPTO', reference: 0.0000001 }],
        LADDER,
      );

      expect(alarms).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0].row).toBe(1);
      expect(errors[0].message).toMatch(/rung 1/);
    });

    it.each([
      [{ dropPct: 0, gainPct: 0.2, entries: 3 }],
      [{ dropPct: 1, gainPct: 0.2, entries: 3 }],
      [{ dropPct: 0.2, gainPct: 0, entries: 3 }],
      [{ dropPct: 0.2, gainPct: 0.2, entries: 0 }],
      [{ dropPct: 0.2, gainPct: 0.2, entries: 11 }],
      [{ dropPct: 0.2, gainPct: 0.2, entries: 2.5 }],
      [{ dropPct: 0.2, gainPct: 0.2 }],
      [undefined],
    ])(
      'rejects invalid ladder options %j without expanding any row',
      (options) => {
        const { alarms, errors } = expandRecipe(
          RecipeType.DRAWDOWN_LADDER,
          [{ ticker: 'AAPL', market: 'USA', reference: 100 }],
          options,
        );

        expect(alarms).toEqual([]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.every((e) => e.row === null)).toBe(true);
      },
    );

    it('requires a positive reference', () => {
      const { errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [
          { ticker: 'AAPL', market: 'USA', reference: -5 },
          { ticker: 'MSFT', market: 'USA' },
          { ticker: 'NVDA', market: 'USA', reference: 'abc' },
        ],
        LADDER,
      );

      expect(errors.map((e) => e.row)).toEqual([1, 2, 3]);
      expect(errors.every((e) => e.message.startsWith('reference:'))).toBe(
        true,
      );
    });
  });

  describe('DRAWDOWN_LADDER duplicates', () => {
    it('rejects a second row for the same ticker+market, since each row already expands to every rung', () => {
      const { errors } = expandRecipe(
        RecipeType.DRAWDOWN_LADDER,
        [
          { ticker: 'AAPL', market: 'USA', reference: 100 },
          { ticker: 'AAPL', market: 'USA', reference: 120 },
        ],
        LADDER,
      );

      expect(errors).toEqual([
        { row: 2, message: 'duplicate of row 1 (AAPL on USA)' },
      ]);
    });
  });

  describe('EXPLICIT_THRESHOLDS', () => {
    it('maps each row 1:1 to a MANUAL_THRESHOLD alarm, values untouched', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [
          { ticker: 'aapl', market: 'usa', trigger: 150.123, target: '210' },
          { ticker: 'BTC', market: 'crypto', trigger: 50000, target: 90000 },
        ],
        undefined,
      );

      expect(errors).toEqual([]);
      expect(alarms).toEqual([
        {
          ticker: 'AAPL',
          market: 'USA',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 150.123, target: 210 },
          rung: 1,
          phase: 'BUY',
        },
        {
          ticker: 'BTC',
          market: 'CRYPTO',
          strategyType: 'MANUAL_THRESHOLD',
          params: { trigger: 50000, target: 90000 },
          rung: 1,
          phase: 'BUY',
        },
      ]);
    });

    it('reads an optional phase column: SELL for bought positions, blank or missing means BUY', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [
          {
            ticker: 'HL',
            market: 'BYMA',
            trigger: 41380,
            target: 49656,
            phase: ' sell ',
          },
          {
            ticker: 'HL',
            market: 'BYMA',
            trigger: 33104,
            target: 39724.8,
            phase: 'BUY',
          },
          {
            ticker: 'XLF',
            market: 'BYMA',
            trigger: 29920,
            target: 34408,
            phase: '',
          },
          { ticker: 'AMD', market: 'BYMA', trigger: 25804.8, target: 30965.76 },
        ],
        undefined,
      );

      expect(errors).toEqual([]);
      expect(alarms.map((a) => a.phase)).toEqual(['SELL', 'BUY', 'BUY', 'BUY']);
    });

    it('numbers repeated tickers as a ladder, highest trigger first, keeping row order', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [
          { ticker: 'MORI', market: 'BYMA', trigger: 19.8, target: 27.72 },
          { ticker: 'MORI', market: 'BYMA', trigger: 33, target: 46.2 },
          { ticker: 'MORI', market: 'USA', trigger: 5, target: 6 },
          { ticker: 'MORI', market: 'BYMA', trigger: 11.88, target: 16.63 },
        ],
        undefined,
      );

      expect(errors).toEqual([]);
      expect(alarms.map((a) => [a.market, a.params.trigger, a.rung])).toEqual([
        ['BYMA', 19.8, 2],
        ['BYMA', 33, 1],
        ['USA', 5, 1],
        ['BYMA', 11.88, 3],
      ]);
    });

    it('rejects an unknown phase', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [
          {
            ticker: 'HL',
            market: 'BYMA',
            trigger: 1,
            target: 2,
            phase: 'HOLD',
          },
        ],
        undefined,
      );

      expect(alarms).toEqual([]);
      expect(errors).toEqual([
        { row: 1, message: 'phase: must be BUY or SELL' },
      ]);
    });

    it('allows several rows for one ticker (a ladder, one row per rung) as long as thresholds differ', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [
          {
            ticker: 'BTC',
            market: 'CRYPTO',
            trigger: 47937.19,
            target: 57524.63,
          },
          {
            ticker: 'BTC',
            market: 'CRYPTO',
            trigger: 38349.75,
            target: 46019.7,
          },
          {
            ticker: 'btc',
            market: 'crypto',
            trigger: '47937.19',
            target: 57524.63,
          },
        ],
        undefined,
      );

      expect(alarms).toHaveLength(2);
      expect(errors).toEqual([
        {
          row: 3,
          message: 'duplicate of row 1 (BTC on CRYPTO at 47937.19/57524.63)',
        },
      ]);
    });

    it('requires both trigger and target', () => {
      const { alarms, errors } = expandRecipe(
        RecipeType.EXPLICIT_THRESHOLDS,
        [{ ticker: 'AAPL', market: 'USA', trigger: 100 }],
        undefined,
      );

      expect(alarms).toEqual([]);
      expect(errors).toEqual([{ row: 1, message: 'target: must be a number' }]);
    });
  });

  describe('row validation shared by every recipe', () => {
    const explicit = (rows: unknown[]) =>
      expandRecipe(RecipeType.EXPLICIT_THRESHOLDS, rows, undefined);
    const ok = { trigger: 1, target: 2 };

    it('follows the frontend ticker mapping: BYMA/CRYPTO tickers are bare, no .BA / -USD suffix', () => {
      const { alarms, errors } = explicit([
        { ticker: 'AGRO.BA', market: 'BYMA', ...ok },
        { ticker: 'BTC-USD', market: 'CRYPTO', ...ok },
      ]);

      expect(alarms).toEqual([]);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        row: 1,
        message: expect.stringContaining('".BA"'),
      });
      expect(errors[1]).toEqual({
        row: 2,
        message: expect.stringContaining('"-USD"'),
      });
    });

    it('still accepts hyphenated/dotted USA tickers such as BRK-B', () => {
      const { alarms, errors } = explicit([
        { ticker: 'BRK-B', market: 'USA', ...ok },
      ]);

      expect(errors).toEqual([]);
      expect(alarms[0].ticker).toBe('BRK-B');
    });

    it('rejects unknown markets and malformed tickers, keeping valid rows', () => {
      const { alarms, errors } = explicit([
        { ticker: 'AAPL', market: 'NASDAQ', ...ok },
        { ticker: 'bad ticker!', market: 'USA', ...ok },
        { ticker: '', market: 'USA', ...ok },
        { market: 'USA', ...ok },
        { ticker: 'MSFT', market: 'USA', ...ok },
      ]);

      expect(errors.map((e) => e.row)).toEqual([1, 2, 3, 4]);
      expect(errors[0].message).toMatch(/^market:/);
      expect(errors[1].message).toMatch(/^ticker:/);
      expect(alarms.map((a) => a.ticker)).toEqual(['MSFT']);
    });

    it('rejects a row that is not an object', () => {
      const { errors } = explicit(['AAPL', null, 42]);

      expect(errors.map((e) => e.row)).toEqual([1, 2, 3]);
    });

    it('rejects identical rows but allows the same ticker on another market', () => {
      const { alarms, errors } = explicit([
        { ticker: 'AAPL', market: 'USA', ...ok },
        { ticker: 'aapl', market: 'usa', ...ok },
        { ticker: 'AAPL', market: 'BYMA', ...ok },
      ]);

      expect(errors).toEqual([
        { row: 2, message: 'duplicate of row 1 (AAPL on USA at 1/2)' },
      ]);
      expect(alarms.map((a) => `${a.ticker}:${a.market}`)).toEqual([
        'AAPL:USA',
        'AAPL:BYMA',
      ]);
    });

    it('rejects an empty import', () => {
      const { alarms, errors } = explicit([]);

      expect(alarms).toEqual([]);
      expect(errors).toEqual([
        { row: null, message: 'at least one row is required' },
      ]);
    });

    it(`rejects an import that would create more than ${MAX_ALARMS} alarms`, () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({
        ticker: `T${i}`,
        market: 'USA',
        reference: 100,
      }));

      const { errors } = expandRecipe(RecipeType.DRAWDOWN_LADDER, rows, {
        dropPct: 0.1,
        gainPct: 0.1,
        entries: 10,
      });

      expect(errors).toEqual([
        {
          row: null,
          message: expect.stringContaining(`${MAX_ALARMS}`),
        },
      ]);
    });
  });
});
