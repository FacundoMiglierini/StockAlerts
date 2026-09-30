// Mirrors backend/prisma/schema.prisma's enums exactly — keep in sync.
export type StrategyType =
  | 'MANUAL_THRESHOLD'
  | 'SMA_CROSSOVER'
  | 'RSI'
  | 'MACD'
  | 'BOLLINGER'
  | 'SUPPORT_RESISTANCE';

export type AlarmStatus = 'ACTIVE' | 'TRIGGERED' | 'DISABLED';

export type NotificationStatus =
  'NOT_NOTIFIED' | 'NOTIFIED_ONCE' | 'NOTIFIED_TWICE';

// The exchange/asset class the alarm's ticker trades on — determines the
// currency its trigger/target prices are denominated in (see markets.ts).
// Set once at creation, not user-editable afterward (same as strategyType).
export type Market = 'USA' | 'CRYPTO' | 'BYMA';

export type Role = 'ADMIN' | 'USER';

// Closed set by design — same convention as StrategyType. Currently just
// Telegram; adding a channel is a backend + worker change either way.
export type NotificationChannelType = 'TELEGRAM';

export interface NotificationChannel {
  type: NotificationChannelType;
  externalId: string;
}

export interface Alarm {
  id: string;
  userId: string;
  ticker: string;
  strategyType: StrategyType;
  market: Market;
  params: Record<string, number>;
  status: AlarmStatus;
  notificationStatus: NotificationStatus;
  // Set only for alarms created by a portfolio import.
  portfolioId: string | null;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  channels: NotificationChannel[];
}

// Row shape for GET /users (admin-only) — see backend/src/modules/users/users.service.ts's listAll().
export interface AdminUserSummary {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  // The seed-created account — no admin (including this one) can disable
  // or delete it; see backend/src/modules/users/users.service.ts.
  isDefaultAdmin: boolean;
  alarmCount: number;
}

// Mirrors backend/src/modules/portfolios — keep in sync.
export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
  alarmCount: number;
}

export type RecipeType = 'EXPLICIT_THRESHOLDS' | 'DRAWDOWN_LADDER';

export interface PlannedAlarm {
  ticker: string;
  market: Market;
  strategyType: 'MANUAL_THRESHOLD';
  params: { trigger: number; target: number };
  // 1-based ladder rung; null for recipes with no notion of one.
  rung: number | null;
}

// `row` is the 1-based index among the submitted data rows (header not
// counted); null for an error about the import as a whole.
export interface PortfolioRowError {
  row: number | null;
  message: string;
}

export interface PortfolioPlan {
  alarms: PlannedAlarm[];
  errors: PortfolioRowError[];
}
