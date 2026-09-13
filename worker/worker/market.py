"""Per-market conventions: the currency an alarm's prices are denominated
in, and the ticker string yfinance actually expects for that market. The
same raw ticker can mean different securities on different markets (e.g. a
US-listed ADR vs. a same-named company or CEDEAR listed on BYMA), so
callers must resolve a symbol per (ticker, market) pair rather than
fetching by bare ticker alone.
"""

from __future__ import annotations

from .enums import Market

_CURRENCY_SYMBOLS: dict[Market, str] = {
    Market.USA: "US$",
    Market.CRYPTO: "US$",
    Market.BYMA: "AR$",
}


def currency_symbol(market: Market) -> str:
    return _CURRENCY_SYMBOLS[market]


def resolve_symbol(ticker: str, market: Market) -> str:
    """The ticker string yfinance expects for this market: unchanged for
    USA (covers any US-listed ticker needing no suffix — NASDAQ, NYSE,
    S&P 500 constituents, ETFs), a `-USD` crypto pair, or a `.BA` Buenos
    Aires (BYMA) suffix — the latter covers both CEDEARs (depositary
    receipts of foreign stocks) and local Argentine shares (e.g. Merval
    index constituents), since both trade on BYMA in ARS and resolve the
    same way.
    """
    if market == Market.CRYPTO:
        return f"{ticker}-USD"
    if market == Market.BYMA:
        return f"{ticker}.BA"
    return ticker
