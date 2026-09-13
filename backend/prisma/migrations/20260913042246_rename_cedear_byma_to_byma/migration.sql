-- Renamed to reflect that this market covers both CEDEARs (depositary
-- receipts of foreign stocks) and local Argentine shares (e.g. Merval
-- index constituents) trading on BYMA — both resolve the same way
-- (".BA" suffix, ARS), so one market value covers both instead of two.
-- Postgres supports renaming an enum value in place; no data migration
-- needed since the value's meaning (BYMA, ARS) is unchanged.
ALTER TYPE "Market" RENAME VALUE 'CEDEAR_BYMA' TO 'BYMA';
