import type { StrategyType } from './types';

// Reasonably standard email shape check — mirrors the intent of the
// backend's class-validator @IsEmail() closely enough for client-side
// feedback; the backend remains the source of truth.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// Mirrors backend/src/modules/users/dto/create-user.dto.ts's @MinLength(8).
// Login itself doesn't enforce a minimum (existing passwords could predate
// this rule), so this is only used for stricter forms if ever needed.
export const MIN_PASSWORD_LENGTH = 8;

export function isValidTicker(value: string): boolean {
  return /^[A-Z0-9.-]{1,10}$/.test(value.trim().toUpperCase());
}

// Telegram chat ids are plain integers — negative for groups/channels
// (supergroups use a "-100" prefix, so up to ~14-15 digits). Not enforced
// by the backend (externalId is a free string, see
// notification-channels.service.ts) or the worker (passed straight through
// to Telegram's API) — this is just a client-side sanity check to catch
// obviously wrong input (letters, stray whitespace, an unedited placeholder).
export function isValidTelegramChatId(value: string): boolean {
  return /^-?\d{5,15}$/.test(value.trim());
}

// Cross-field sanity checks beyond the per-field min/max already declared
// in strategies.ts's STRATEGY_FIELDS. Mirrors
// backend/src/modules/alarms/strategies/strategy-params.schema.ts's
// .refine() where one exists (SMA_CROSSOVER); the rest are client-side-only
// UX guardrails the backend doesn't enforce, added on request.
export function validateStrategyParams(
  strategyType: StrategyType,
  params: Record<string, number>,
): string | null {
  switch (strategyType) {
    case 'MANUAL_THRESHOLD':
      if (!(params.trigger > 0)) return 'Trigger price must be greater than 0';
      if (!(params.target > 0)) return 'Target price must be greater than 0';
      return null;
    case 'SMA_CROSSOVER':
      if (!(params.fastPeriod < params.slowPeriod)) {
        return 'Fast period must be smaller than slow period';
      }
      return null;
    case 'RSI':
      if (!(params.oversold < params.overbought)) {
        return 'Oversold threshold must be smaller than overbought threshold';
      }
      return null;
    case 'MACD':
      if (!(params.fastPeriod < params.slowPeriod)) {
        return 'Fast period must be smaller than slow period';
      }
      return null;
    case 'BOLLINGER':
      if (!(params.stdDev > 0))
        return 'Standard deviations must be greater than 0';
      return null;
    case 'SUPPORT_RESISTANCE':
      if (!(params.lookbackDays > 0)) return 'Lookback must be greater than 0';
      return null;
    default:
      return null;
  }
}
