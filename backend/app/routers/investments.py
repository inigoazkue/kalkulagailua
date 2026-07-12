from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import InvestmentAsset, InvestmentTransaction, InvestmentTransactionTypeEnum, AssetTypeEnum
from app.schemas import (
    InvestmentAssetOut, InvestmentAssetCreate, InvestmentAssetUpdate,
    InvestmentAssetCreateByIsin,
    InvestmentTransactionOut, InvestmentTransactionCreate,
    InvestmentPositionOut, AssetPositionOut, PricePoint,
    IsinLookupResult, PortfolioHistoryPoint,
)
from app.services.prices import get_current_price, fetch_asset_name, fetch_and_store_history
from app.services.isin_lookup import lookup_isin

router = APIRouter()


@router.get("/investments/assets", response_model=list[InvestmentAssetOut])
async def list_assets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InvestmentAsset).order_by(InvestmentAsset.name))
    return result.scalars().all()


@router.post("/investments/lookup-isin", response_model=IsinLookupResult)
async def lookup_isin_endpoint(body: dict, db: AsyncSession = Depends(get_db)):
    isin = body.get("isin", "").strip().upper()
    if not isin:
        raise HTTPException(400, "ISIN required")
    result = await lookup_isin(isin)
    if result:
        return IsinLookupResult(isin=isin, found=True, **result)
    return IsinLookupResult(isin=isin, name=isin, ticker=None, asset_type="fund", found=False)


@router.post("/investments/assets", response_model=InvestmentAssetOut, status_code=201)
async def create_asset(body: InvestmentAssetCreateByIsin, db: AsyncSession = Depends(get_db)):
    isin = body.isin.strip().upper()
    existing = (await db.execute(select(InvestmentAsset).where(InvestmentAsset.isin == isin))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Asset with this ISIN already exists")
    lookup = await lookup_isin(isin)
    name = lookup["name"] if lookup else isin
    ticker = lookup["ticker"] if lookup else None
    asset_type_str = lookup["asset_type"] if lookup else "fund"
    asset_type = AssetTypeEnum(asset_type_str) if asset_type_str in [e.value for e in AssetTypeEnum] else AssetTypeEnum.fund
    asset = InvestmentAsset(isin=isin, ticker=ticker, name=name, asset_type=asset_type, alias=body.alias)
    db.add(asset)
    await db.flush()
    if ticker:
        await fetch_and_store_history(asset, db)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.put("/investments/assets/{asset_id}", response_model=InvestmentAssetOut)
async def update_asset(asset_id: int, body: InvestmentAssetUpdate, db: AsyncSession = Depends(get_db)):
    asset = (await db.execute(select(InvestmentAsset).where(InvestmentAsset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(asset, field, value)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.post("/investments/assets/{asset_id}/sync-prices")
async def sync_prices(asset_id: int, db: AsyncSession = Depends(get_db)):
    asset = (await db.execute(select(InvestmentAsset).where(InvestmentAsset.id == asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    count = await fetch_and_store_history(asset, db)
    await db.commit()
    return {"synced": count}


@router.get("/investments/positions", response_model=list[AssetPositionOut])
async def get_positions(db: AsyncSession = Depends(get_db)):
    from app.models import TransactionAssetLink, Transaction, FundTransfer, PriceCache

    assets = (await db.execute(select(InvestmentAsset).order_by(InvestmentAsset.name))).scalars().all()
    if not assets:
        return []
    asset_ids = [a.id for a in assets]

    # All transaction links with amounts and dates
    links_rows = (await db.execute(
        select(TransactionAssetLink, Transaction.date, Transaction.amount)
        .join(Transaction, TransactionAssetLink.transaction_id == Transaction.id)
        .where(TransactionAssetLink.asset_id.in_(asset_ids))
        .order_by(Transaction.date)
    )).all()
    links_by_asset: dict[int, list] = defaultdict(list)
    for row in links_rows:
        links_by_asset[row.TransactionAssetLink.asset_id].append(row)

    # Fund transfers
    fund_transfers = (await db.execute(select(FundTransfer))).scalars().all()

    # Full price history for all assets
    price_rows = (await db.execute(
        select(PriceCache)
        .where(PriceCache.asset_id.in_(asset_ids))
        .order_by(PriceCache.price_date)
    )).scalars().all()
    price_by_asset: dict[int, list[tuple]] = defaultdict(list)
    for p in price_rows:
        price_by_asset[p.asset_id].append((p.price_date, p.price))

    def get_price_on(asset_id: int, d: date) -> Decimal | None:
        for pd, pv in reversed(price_by_asset.get(asset_id, [])):
            if pd <= d:
                return pv
        return None

    today = date.today()
    sparkline_cutoff = today - timedelta(days=90)

    positions = []
    for asset in assets:
        rows = links_by_asset.get(asset.id, [])
        has_prices = bool(price_by_asset.get(asset.id))

        total_invested = Decimal("0")
        total_received = Decimal("0")
        qty_held = Decimal("0")

        for row in rows:
            amount = row.amount
            tx_date = row.date
            if amount < 0:
                total_invested += abs(amount)
                if has_prices:
                    p = get_price_on(asset.id, tx_date)
                    if p and p > 0:
                        qty_held += abs(amount) / p
            else:
                total_received += amount
                if has_prices:
                    p = get_price_on(asset.id, tx_date)
                    if p and p > 0:
                        qty_held -= amount / p

        fund_transfer_in = Decimal("0")
        fund_transfer_out = Decimal("0")
        for ft in fund_transfers:
            if ft.from_asset_id == asset.id:
                fund_transfer_out += ft.withdrawal_amount
                if has_prices:
                    p = get_price_on(asset.id, ft.withdrawal_date)
                    if p and p > 0:
                        qty_held -= ft.withdrawal_amount / p
            if ft.to_asset_id == asset.id:
                fund_transfer_in += ft.arrival_amount
                if has_prices:
                    p = get_price_on(asset.id, ft.arrival_date)
                    if p and p > 0:
                        qty_held += ft.arrival_amount / p

        net_invested = total_invested - total_received + fund_transfer_in - fund_transfer_out

        current_price = None
        current_price_date = None
        current_value = None
        pnl = None
        pnl_pct = None

        if has_prices:
            prices = price_by_asset[asset.id]
            if prices:
                current_price_date, current_price = prices[-1]
                if qty_held > 0 and current_price:
                    current_value = qty_held * current_price
                    pnl = current_value - net_invested
                    pnl_pct = (pnl / net_invested * 100) if net_invested > 0 else Decimal("0")

        sparkline = [
            PricePoint(date=pd, price=pv)
            for pd, pv in price_by_asset.get(asset.id, [])
            if pd >= sparkline_cutoff
        ]

        positions.append(AssetPositionOut(
            asset=asset,
            net_invested=net_invested,
            current_price=current_price,
            current_price_date=current_price_date,
            current_value=current_value,
            pnl=pnl,
            pnl_pct=pnl_pct,
            has_prices=has_prices,
            sparkline=sparkline,
        ))

    return positions


@router.post("/investments/transactions", response_model=InvestmentTransactionOut, status_code=201)
async def create_investment_transaction(
    body: InvestmentTransactionCreate, db: AsyncSession = Depends(get_db)
):
    asset_result = await db.execute(select(InvestmentAsset).where(InvestmentAsset.id == body.asset_id))
    if asset_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    tx = InvestmentTransaction(**body.model_dump())
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.get("/investments/portfolio/history", response_model=list[PortfolioHistoryPoint])
async def portfolio_history(
    start: date = None,
    end: date = None,
    db: AsyncSession = Depends(get_db)
):
    from app.models import TransactionAssetLink, Transaction, FundTransfer, PriceCache
    if end is None:
        end = date.today()
    if start is None:
        start = end - timedelta(days=365)

    links_result = await db.execute(
        select(TransactionAssetLink, Transaction.date, Transaction.amount)
        .join(Transaction, TransactionAssetLink.transaction_id == Transaction.id)
        .where(TransactionAssetLink.is_validated == True)
        .order_by(Transaction.date)
    )
    links = links_result.all()

    transfers_result = await db.execute(select(FundTransfer).order_by(FundTransfer.withdrawal_date))
    transfers = transfers_result.scalars().all()

    asset_ids = set(l.TransactionAssetLink.asset_id for l in links)
    asset_ids.update(t.from_asset_id for t in transfers)
    asset_ids.update(t.to_asset_id for t in transfers)
    if not asset_ids:
        return []

    prices_result = await db.execute(
        select(PriceCache)
        .where(PriceCache.asset_id.in_(asset_ids))
        .where(PriceCache.price_date >= start - timedelta(days=7))
        .where(PriceCache.price_date <= end)
        .order_by(PriceCache.price_date)
    )
    price_by_asset: dict[int, list] = defaultdict(list)
    for p in prices_result.scalars().all():
        price_by_asset[p.asset_id].append((p.price_date, p.price))

    def get_price_on(asset_id: int, d: date) -> Decimal | None:
        for pd, pv in reversed(price_by_asset.get(asset_id, [])):
            if pd <= d:
                return pv
        return None

    result = []
    current = start
    while current <= end:
        qty_by_asset: dict[int, Decimal] = defaultdict(Decimal)
        contrib_by_asset: dict[int, Decimal] = defaultdict(Decimal)
        for row in links:
            link = row.TransactionAssetLink
            tx_date = row.date
            tx_amount = row.amount
            if tx_date <= current:
                qty = link.quantity
                if qty is None:
                    p = get_price_on(link.asset_id, tx_date)
                    qty = abs(tx_amount) / p if (p and p > 0) else Decimal("0")
                if tx_amount < 0:
                    qty_by_asset[link.asset_id] += qty
                    contrib_by_asset[link.asset_id] += abs(tx_amount)
                else:
                    qty_by_asset[link.asset_id] -= qty
                    contrib_by_asset[link.asset_id] -= abs(tx_amount)
        for t in transfers:
            if t.withdrawal_date <= current:
                p = get_price_on(t.from_asset_id, t.withdrawal_date)
                if p and p > 0:
                    qty_by_asset[t.from_asset_id] -= t.withdrawal_amount / p
            if t.arrival_date <= current:
                p = get_price_on(t.to_asset_id, t.arrival_date)
                if p and p > 0:
                    qty_by_asset[t.to_asset_id] += t.arrival_amount / p
                contrib_by_asset[t.to_asset_id] += t.arrival_amount

        total_value = Decimal("0")
        total_contrib = sum(contrib_by_asset.values())
        for asset_id, qty in qty_by_asset.items():
            if qty <= 0:
                continue
            price = get_price_on(asset_id, current)
            if price:
                total_value += qty * price

        result.append(PortfolioHistoryPoint(date=current, value=total_value, contributions=total_contrib))
        current += timedelta(days=1)

    return result
