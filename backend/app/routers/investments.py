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
    InvestmentPositionOut, IsinLookupResult, PortfolioHistoryPoint,
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
    # Check if ISIN already exists
    existing = (await db.execute(select(InvestmentAsset).where(InvestmentAsset.isin == isin))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Asset with this ISIN already exists")
    # Lookup ISIN
    lookup = await lookup_isin(isin)
    name = lookup["name"] if lookup else isin
    ticker = lookup["ticker"] if lookup else None
    asset_type_str = lookup["asset_type"] if lookup else "fund"
    asset_type = AssetTypeEnum(asset_type_str) if asset_type_str in [e.value for e in AssetTypeEnum] else AssetTypeEnum.fund
    asset = InvestmentAsset(isin=isin, ticker=ticker, name=name, asset_type=asset_type, alias=body.alias)
    db.add(asset)
    await db.flush()
    # Download price history if ticker known
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


@router.get("/investments/positions", response_model=list[InvestmentPositionOut])
async def get_positions(db: AsyncSession = Depends(get_db)):
    assets_result = await db.execute(
        select(InvestmentAsset).options(selectinload(InvestmentAsset.transactions))
    )
    assets = assets_result.scalars().all()

    positions = []
    for asset in assets:
        if not asset.transactions:
            continue

        total_qty = Decimal("0")
        cost_basis = Decimal("0")

        for tx in asset.transactions:
            if tx.transaction_type == InvestmentTransactionTypeEnum.buy:
                total_qty += tx.quantity
                cost_basis += tx.quantity * tx.price_per_unit + tx.fees
            else:
                total_qty -= tx.quantity

        if total_qty <= 0:
            continue

        current_price = await get_current_price(asset, db)
        current_value = total_qty * current_price
        pnl = current_value - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis != 0 else Decimal("0")

        positions.append(
            InvestmentPositionOut(
                asset=asset,
                total_quantity=total_qty,
                cost_basis=cost_basis,
                current_price=current_price,
                current_value=current_value,
                pnl=pnl,
                pnl_pct=pnl_pct,
            )
        )

    return positions


@router.post("/investments/transactions", response_model=InvestmentTransactionOut, status_code=201)
async def create_investment_transaction(
    body: InvestmentTransactionCreate, db: AsyncSession = Depends(get_db)
):
    asset_result = await db.execute(
        select(InvestmentAsset).where(InvestmentAsset.id == body.asset_id)
    )
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

    # Get all validated links with quantity
    links_result = await db.execute(
        select(TransactionAssetLink, Transaction.date, Transaction.amount)
        .join(Transaction, TransactionAssetLink.transaction_id == Transaction.id)
        .where(TransactionAssetLink.is_validated == True)
        .where(TransactionAssetLink.quantity.isnot(None))
        .order_by(Transaction.date)
    )
    links = links_result.all()

    # Get fund transfers
    transfers_result = await db.execute(select(FundTransfer).order_by(FundTransfer.withdrawal_date))
    transfers = transfers_result.scalars().all()

    # Get all asset IDs involved
    asset_ids = set(l.TransactionAssetLink.asset_id for l in links)
    asset_ids.update(t.from_asset_id for t in transfers)
    asset_ids.update(t.to_asset_id for t in transfers)
    if not asset_ids:
        return []

    # Get price cache for date range
    prices_result = await db.execute(
        select(PriceCache)
        .where(PriceCache.asset_id.in_(asset_ids))
        .where(PriceCache.price_date >= start - timedelta(days=7))
        .where(PriceCache.price_date <= end)
        .order_by(PriceCache.price_date)
    )
    prices_raw = prices_result.scalars().all()
    # Build price lookup: {asset_id: [(date, price), ...]}
    price_by_asset: dict[int, list] = defaultdict(list)
    for p in prices_raw:
        price_by_asset[p.asset_id].append((p.price_date, p.price))

    def get_price_on(asset_id: int, d: date) -> Decimal | None:
        prices = price_by_asset.get(asset_id, [])
        best = None
        for pd, pv in reversed(prices):
            if pd <= d:
                best = pv
                break
        return best

    # Build daily history
    result = []
    current = start
    while current <= end:
        # Cumulative quantity per asset up to current day
        qty_by_asset: dict[int, Decimal] = defaultdict(Decimal)
        contrib_by_asset: dict[int, Decimal] = defaultdict(Decimal)
        for row in links:
            link = row.TransactionAssetLink
            tx_date = row.date
            tx_amount = row.amount
            if tx_date <= current:
                qty = link.quantity if link.quantity else Decimal("0")
                if tx_amount < 0:  # buy
                    qty_by_asset[link.asset_id] += qty
                    contrib_by_asset[link.asset_id] += abs(tx_amount)
                else:  # sell
                    qty_by_asset[link.asset_id] -= qty
                    contrib_by_asset[link.asset_id] -= abs(tx_amount)
        for t in transfers:
            if t.withdrawal_date <= current:
                # Estimate qty transferred based on withdrawal amount
                from_price = get_price_on(t.from_asset_id, t.withdrawal_date)
                if from_price and from_price > 0:
                    qty_transferred = t.withdrawal_amount / from_price
                    qty_by_asset[t.from_asset_id] -= qty_transferred
            if t.arrival_date <= current:
                to_price = get_price_on(t.to_asset_id, t.arrival_date)
                if to_price and to_price > 0:
                    qty_arrived = t.arrival_amount / to_price
                    qty_by_asset[t.to_asset_id] += qty_arrived
                contrib_by_asset[t.to_asset_id] += t.arrival_amount

        # Calculate total value
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
