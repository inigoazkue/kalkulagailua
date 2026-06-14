from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import InvestmentAsset, InvestmentTransaction, InvestmentTransactionTypeEnum
from app.schemas import (
    InvestmentAssetOut, InvestmentAssetCreate,
    InvestmentTransactionOut, InvestmentTransactionCreate,
    InvestmentPositionOut,
)
from app.services.prices import get_current_price, fetch_asset_name

router = APIRouter()


@router.get("/investments/assets", response_model=list[InvestmentAssetOut])
async def list_assets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InvestmentAsset).order_by(InvestmentAsset.ticker))
    return result.scalars().all()


@router.post("/investments/assets", response_model=InvestmentAssetOut, status_code=201)
async def create_asset(body: InvestmentAssetCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(InvestmentAsset).where(InvestmentAsset.ticker == body.ticker.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Asset already exists")

    name = await fetch_asset_name(body.ticker, body.asset_type)
    asset = InvestmentAsset(
        ticker=body.ticker.upper(),
        name=name,
        asset_type=body.asset_type,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


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
