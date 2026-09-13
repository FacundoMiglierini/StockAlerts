import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { StrategyType } from '../../../generated/prisma/enums.js';

// Parameter schema for each strategy type in the registry. The worker
// mirrors these shapes when it evaluates an alarm's `params` — keep the two
// in sync if a shape changes.
export const strategyParamsSchemas = {
  [StrategyType.MANUAL_THRESHOLD]: z.object({
    trigger: z.number().positive(),
    target: z.number().positive(),
  }),
  [StrategyType.SMA_CROSSOVER]: z
    .object({
      fastPeriod: z.number().int().positive(),
      slowPeriod: z.number().int().positive(),
    })
    .refine((p) => p.fastPeriod < p.slowPeriod, {
      message: 'fastPeriod must be smaller than slowPeriod',
    }),
  [StrategyType.RSI]: z.object({
    period: z.number().int().positive().default(14),
    oversold: z.number().min(0).max(100).default(30),
    overbought: z.number().min(0).max(100).default(70),
  }),
  [StrategyType.MACD]: z.object({
    fastPeriod: z.number().int().positive().default(12),
    slowPeriod: z.number().int().positive().default(26),
    signalPeriod: z.number().int().positive().default(9),
  }),
  [StrategyType.BOLLINGER]: z.object({
    period: z.number().int().positive().default(20),
    stdDev: z.number().positive().default(2),
  }),
  [StrategyType.SUPPORT_RESISTANCE]: z.object({
    lookbackDays: z.number().int().positive().default(180),
    drawdownPct: z.number().min(0).max(1),
  }),
} as const satisfies Record<StrategyType, z.ZodTypeAny>;

export function parseStrategyParams(strategyType: StrategyType, params: unknown) {
  const schema = strategyParamsSchemas[strategyType];
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new BadRequestException({
      message: `Invalid params for strategy ${strategyType}`,
      issues: result.error.issues,
    });
  }
  return result.data;
}
