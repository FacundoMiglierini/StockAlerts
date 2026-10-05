from __future__ import annotations

import time

import pandas as pd
import requests

from .. import config
from .base import validate_daily_history

_PERIOD_TO_DAYS = {
    "1mo": 31,
    "3mo": 93,
    "6mo": 186,
    "1y": 366,
    "2y": 732,
}


class FinnhubProvider:
    """Primary provider — free tier covers 60 req/min, comfortably enough
    for 20-50 tickers checked a few times a day. Not verified against a
    live API key in this environment; falls back to YFinanceProvider on
    any error (see price_provider/__init__.py)."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _get(self, path: str, params: dict) -> dict:
        response = requests.get(
            f"{config.FINNHUB_BASE_URL}{path}",
            params={**params, "token": self._api_key},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def get_daily_history(self, ticker: str, period: str) -> pd.DataFrame:
        days = _PERIOD_TO_DAYS.get(period, 366)
        now = int(time.time())
        data = self._get(
            "/stock/candle",
            {
                "symbol": ticker,
                "resolution": "D",
                "from": now - days * 86400,
                "to": now,
            },
        )
        if data.get("s") != "ok":
            raise ValueError(f"Finnhub candle request failed for {ticker}: {data}")

        frame = pd.DataFrame(
            {
                "Open": data["o"],
                "High": data["h"],
                "Low": data["l"],
                "Close": data["c"],
            },
            index=pd.to_datetime(data["t"], unit="s"),
        )
        validate_daily_history(ticker, frame)
        return frame
