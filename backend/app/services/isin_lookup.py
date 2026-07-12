import httpx
from typing import Optional

OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"

EXCH_SUFFIX = {
    "LN": ".L", "GY": ".DE", "SW": ".SW", "FP": ".PA",
    "NA": ".AS", "IM": ".MI", "SM": ".MC", "US": "",
    "AU": ".AX", "AV": ".VI",
}

SECURITY_TYPE_MAP = {
    "Common Stock": "stock", "ETP": "etf", "ETF": "etf",
    "Mutual Fund": "fund", "Cryptocurrency": "crypto",
    "Preference": "stock", "Closed-End Fund": "fund",
}


async def lookup_isin(isin: str) -> Optional[dict]:
    """
    Query OpenFIGI for ISIN. Returns {ticker, name, asset_type} or None.
    ticker may be None if no Yahoo Finance ticker found.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                OPENFIGI_URL,
                json=[{"idType": "ID_ISIN", "idValue": isin}],
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data or "data" not in data[0] or not data[0]["data"]:
                return None
            results = data[0]["data"]
            # Prefer equity results, then any
            result = next(
                (r for r in results if r.get("marketSector") == "Equity"),
                results[0]
            )
            sec_type = result.get("securityType2") or result.get("securityType", "")
            asset_type = SECURITY_TYPE_MAP.get(sec_type, "stock")
            raw_ticker = result.get("ticker", "")
            exch = result.get("exchCode", "")
            suffix = EXCH_SUFFIX.get(exch, "")
            ticker = f"{raw_ticker}{suffix}" if raw_ticker else None
            name = result.get("name", isin)
            return {"ticker": ticker, "name": name, "asset_type": asset_type}
        except Exception:
            return None
