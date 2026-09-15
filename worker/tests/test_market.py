from worker.enums import Market
from worker.market import resolve_symbol


def test_usa_ticker_is_unchanged():
    assert resolve_symbol("AAPL", Market.USA) == "AAPL"


def test_crypto_ticker_gets_usd_suffix():
    # The frontend's curated crypto shortlist (frontend/src/tickers.ts)
    # stores bare tickers ("BTC") specifically so this is the only place
    # "-USD" gets appended — baking it into the stored ticker as well
    # double-suffixes ("BTC-USD-USD") and yfinance 404s.
    assert resolve_symbol("BTC", Market.CRYPTO) == "BTC-USD"


def test_byma_ticker_gets_ba_suffix():
    assert resolve_symbol("GGAL", Market.BYMA) == "GGAL.BA"
