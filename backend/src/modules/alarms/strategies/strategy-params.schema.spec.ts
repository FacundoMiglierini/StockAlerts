import { BadRequestException } from '@nestjs/common';
import { parseStrategyParams } from './strategy-params.schema.js';
import { StrategyType } from '../../../generated/prisma/enums.js';

describe('parseStrategyParams', () => {
  describe('MANUAL_THRESHOLD', () => {
    it('accepts a valid trigger/target pair', () => {
      const result = parseStrategyParams(StrategyType.MANUAL_THRESHOLD, { trigger: 150, target: 180 });
      expect(result).toEqual({ trigger: 150, target: 180 });
    });

    it('rejects a non-positive trigger', () => {
      expect(() => parseStrategyParams(StrategyType.MANUAL_THRESHOLD, { trigger: 0, target: 180 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a missing target', () => {
      expect(() => parseStrategyParams(StrategyType.MANUAL_THRESHOLD, { trigger: 150 })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('SMA_CROSSOVER', () => {
    it('accepts fastPeriod smaller than slowPeriod', () => {
      const result = parseStrategyParams(StrategyType.SMA_CROSSOVER, { fastPeriod: 50, slowPeriod: 200 });
      expect(result).toEqual({ fastPeriod: 50, slowPeriod: 200 });
    });

    it('rejects fastPeriod >= slowPeriod', () => {
      expect(() =>
        parseStrategyParams(StrategyType.SMA_CROSSOVER, { fastPeriod: 200, slowPeriod: 50 }),
      ).toThrow(BadRequestException);
    });
  });

  describe('RSI', () => {
    it('fills in defaults for omitted fields', () => {
      const result = parseStrategyParams(StrategyType.RSI, {});
      expect(result).toEqual({ period: 14, oversold: 30, overbought: 70 });
    });

    it('rejects an out-of-range threshold', () => {
      expect(() => parseStrategyParams(StrategyType.RSI, { oversold: -1 })).toThrow(BadRequestException);
    });
  });

  describe('MACD', () => {
    it('fills in defaults for omitted fields', () => {
      const result = parseStrategyParams(StrategyType.MACD, {});
      expect(result).toEqual({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    });
  });

  describe('BOLLINGER', () => {
    it('fills in defaults for omitted fields', () => {
      const result = parseStrategyParams(StrategyType.BOLLINGER, {});
      expect(result).toEqual({ period: 20, stdDev: 2 });
    });
  });

  describe('SUPPORT_RESISTANCE', () => {
    it('fills in the lookbackDays default but still requires drawdownPct', () => {
      expect(() => parseStrategyParams(StrategyType.SUPPORT_RESISTANCE, {})).toThrow(BadRequestException);

      const result = parseStrategyParams(StrategyType.SUPPORT_RESISTANCE, { drawdownPct: 0.1 });
      expect(result).toEqual({ lookbackDays: 180, drawdownPct: 0.1 });
    });

    it('rejects a drawdownPct outside 0-1', () => {
      expect(() =>
        parseStrategyParams(StrategyType.SUPPORT_RESISTANCE, { drawdownPct: 1.5 }),
      ).toThrow(BadRequestException);
    });
  });

  it('includes the Zod issues on the thrown exception, for the API response', () => {
    try {
      parseStrategyParams(StrategyType.MANUAL_THRESHOLD, { trigger: -5 });
      expect.unreachable('expected parseStrategyParams to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { issues: unknown[] };
      expect(response.issues.length).toBeGreaterThan(0);
    }
  });
});
