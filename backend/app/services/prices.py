from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from typing import Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models import InvestmentAsset, PriceCache, AssetTypeEnum


CACHE_TTL_HOURS = 1


async def get_current_price(asset: InvestmentAsset, db: AsyncSession) -> Decimal:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=CACHE_TTL_HOURS)

    result = await db.execute(
        select(PriceCache)
        .where(
            PriceCache.asset_id == asset.id,
            PriceCache.price_date == date.today(),
            PriceCache.cached_at >= cutoff,
        )
        .order_by(PriceCache.cached_at.desc())
        .limit(1)
    )
    cached = result.scalar_one_or_none()
    if cached:
        return cached.price

    price = await _fetch_price(asset)

    await db.execute(
        delete(PriceCache).where(
            PriceCache.asset_id == asset.id,
            PriceCache.price_date == date.today(),
        )
    )
    db.add(PriceCache(
        asset_id=asset.id,
        price_date=date.today(),
        price=price,
        cached_at=now,
    ))
    await db.flush()
    return price


async def _fetch_price(asset: InvestmentAsset) -> Decimal:
    if asset.asset_type == AssetTypeEnum.crypto:
        return await _fetch_crypto_price(asset.ticker)
    # Try stored ticker first
    if asset.ticker:
        try:
            return await _fetch_yfinance_price(asset.ticker)
        except Exception:
            pass
    # Fall back to ISIN search
    if asset.isin:
        discovered = await _yahoo_search_ticker(asset.isin)
        if discovered and discovered != asset.ticker:
            try:
                return await _fetch_yfinance_price(discovered)
            except Exception:
                pass
    raise ValueError(f"Could not fetch price for asset {asset.id}")


async def _fetch_crypto_price(ticker: str) -> Decimal:
    coin_id_map = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "ADA": "cardano",
        "DOT": "polkadot",
    }
    coin_id = coin_id_map.get(ticker.upper(), ticker.lower())
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": coin_id, "vs_currencies": "eur"},
        )
        resp.raise_for_status()
        data = resp.json()
    if coin_id not in data or "eur" not in data[coin_id]:
        raise ValueError(f"Could not fetch price for {ticker}")
    return Decimal(str(data[coin_id]["eur"]))


async def _fetch_yfinance_price(ticker: str) -> Decimal:
    import yfinance as yf
    import asyncio

    def _sync_fetch():
        t = yf.Ticker(ticker)
        hist = t.history(period="2d")
        if hist.empty:
            info = t.info
            price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("navPrice")
            if price is None:
                raise ValueError(f"Could not fetch price for {ticker}")
            return float(price)
        return float(hist["Close"].iloc[-1])

    loop = asyncio.get_event_loop()
    price_float = await loop.run_in_executor(None, _sync_fetch)
    return Decimal(str(round(price_float, 4)))


async def _yahoo_search_ticker(isin: str) -> Optional[str]:
    """Search Yahoo Finance for the best ticker for a given ISIN.
    Priority: real exchange symbols (e.g. 1810.HK) > Yahoo fund codes (0P...) > ISIN.XX
    """
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://query2.finance.yahoo.com/v1/finance/search",
                params={"q": isin, "quotesCount": 5, "newsCount": 0},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()
            quotes = resp.json().get("quotes", [])
        if not quotes:
            return None
        symbols = [q.get("symbol", "") for q in quotes if q.get("symbol")]
        # 1st priority: real exchange ticker (not 0P..., not ISIN variant)
        for sym in symbols:
            if not sym.startswith("0P") and sym != isin and not sym.startswith(isin):
                return sym
        # 2nd priority: Yahoo internal fund code (0P...)
        for sym in symbols:
            if sym.startswith("0P"):
                return sym
        # Last resort
        return symbols[0] if symbols else None
    except Exception:
        return None


async def fetch_asset_name(ticker: str, asset_type) -> str:
    from app.models import AssetTypeEnum

    if asset_type == AssetTypeEnum.crypto:
        coin_id_map = {
            "BTC": "Bitcoin",
            "ETH": "Ethereum",
            "SOL": "Solana",
            "ADA": "Cardano",
            "DOT": "Polkadot",
        }
        return coin_id_map.get(ticker.upper(), ticker.upper())

    try:
        import yfinance as yf
        import asyncio

        def _sync_name():
            t = yf.Ticker(ticker)
            info = t.info
            return info.get("longName") or info.get("shortName") or ticker

        loop = asyncio.get_event_loop()
        name = await loop.run_in_executor(None, _sync_name)
        return name
    except Exception:
        return ticker


async def fetch_and_store_history(asset: InvestmentAsset, db: AsyncSession) -> int:
    """Download full price history via Yahoo Finance (with ISIN fallback search).
    If the stored ticker fails or is absent, searches Yahoo Finance by ISIN.
    For real exchange tickers discovered this way (e.g. 1810.HK), updates asset.ticker.
    Returns number of new price points stored.
    """
    ticker = asset.ticker

    # Try with the stored ticker first
    if ticker:
        count = await _fetch_yfinance_history(ticker, asset, db)
        if count > 0:
            return count

    # Stored ticker failed or missing — discover via ISIN search
    if asset.isin:
        discovered = await _yahoo_search_ticker(asset.isin)
        if discovered and discovered != ticker:
            count = await _fetch_yfinance_history(discovered, asset, db)
            if count > 0:
                # Persist real exchange tickers (e.g. 1810 → 1810.HK).
                # Don't overwrite with Yahoo internal 0P... codes.
                if not discovered.startswith("0P") and not discovered.startswith(asset.isin or ""):
                    asset.ticker = discovered
                    await db.flush()
                return count

    return 0


async def _fetch_yfinance_history(ticker: str, asset: InvestmentAsset, db: AsyncSession) -> int:
    try:
        import yfinance as yf
        import asyncio

        def _sync_hist():
            t = yf.Ticker(ticker)
            return t.history(period="max")

        loop = asyncio.get_event_loop()
        hist = await loop.run_in_executor(None, _sync_hist)
        if hist.empty:
            return 0

        existing = set(
            (await db.execute(
                select(PriceCache.price_date).where(PriceCache.asset_id == asset.id)
            )).scalars().all()
        )
        count = 0
        for idx, row in hist.iterrows():
            price_date = idx.date() if hasattr(idx, "date") else idx
            if price_date not in existing:
                db.add(PriceCache(
                    asset_id=asset.id,
                    price_date=price_date,
                    price=Decimal(str(row["Close"])),
                ))
                existing.add(price_date)
                count += 1
        if count:
            await db.flush()
        return count
    except Exception:
        return 0
