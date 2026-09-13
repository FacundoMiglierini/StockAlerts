-- Renamed to reflect that this market covers any US-listed ticker needing
-- no yfinance suffix (NASDAQ, NYSE, S&P 500 constituents, ETFs), not just
-- NASDAQ specifically — they all resolve the same way. Postgres supports
-- renaming an enum value in place, which also updates the column's
-- @default(USA) automatically since the default references the same
-- underlying enum value, just relabeled; no data migration needed.
ALTER TYPE "Market" RENAME VALUE 'NASDAQ' TO 'USA';
