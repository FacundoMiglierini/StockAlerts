import type { Market } from './types'

// Mirrors worker/worker/market.py's per-market conventions — keep in sync.
// USA covers any US-listed ticker (NASDAQ, NYSE, S&P 500 constituents,
// ETFs) — they all resolve the same way, so one market value covers them.
// BYMA covers both CEDEARs (depositary receipts of foreign stocks) and
// local Argentine shares (e.g. Merval index constituents): both trade on
// BYMA in ARS and resolve the same way, so one market value covers both.
export const MARKET_LABELS: Record<Market, string> = {
  USA: 'USA',
  CRYPTO: 'Crypto',
  BYMA: 'BYMA',
}

export const CURRENCY_SYMBOLS: Record<Market, string> = {
  USA: 'US$',
  CRYPTO: 'US$',
  BYMA: 'AR$',
}

export const CURRENCY_CODES: Record<Market, string> = {
  USA: 'USD',
  CRYPTO: 'USD',
  BYMA: 'ARS',
}
