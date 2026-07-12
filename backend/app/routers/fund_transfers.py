from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import FundTransfer, InvestmentAsset
from app.schemas import FundTransferOut, FundTransferCreate

router = APIRouter(prefix="/investments/fund-transfers", tags=["fund-transfers"])


@router.get("", response_model=list[FundTransferOut])
async def list_fund_transfers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FundTransfer)
        .options(selectinload(FundTransfer.from_asset), selectinload(FundTransfer.to_asset))
        .order_by(FundTransfer.withdrawal_date.desc())
    )
    return result.scalars().all()


@router.post("", response_model=FundTransferOut, status_code=201)
async def create_fund_transfer(body: FundTransferCreate, db: AsyncSession = Depends(get_db)):
    for asset_id in [body.from_asset_id, body.to_asset_id]:
        if not (await db.execute(select(InvestmentAsset).where(InvestmentAsset.id == asset_id))).scalar_one_or_none():
            raise HTTPException(404, f"Asset {asset_id} not found")
    ft = FundTransfer(**body.model_dump())
    db.add(ft)
    await db.commit()
    await db.refresh(ft)
    result = await db.execute(
        select(FundTransfer)
        .options(selectinload(FundTransfer.from_asset), selectinload(FundTransfer.to_asset))
        .where(FundTransfer.id == ft.id)
    )
    return result.scalar_one()


@router.put("/{ft_id}", response_model=FundTransferOut)
async def update_fund_transfer(ft_id: int, body: FundTransferCreate, db: AsyncSession = Depends(get_db)):
    ft = (await db.execute(select(FundTransfer).where(FundTransfer.id == ft_id))).scalar_one_or_none()
    if not ft:
        raise HTTPException(404, "Fund transfer not found")
    for field, value in body.model_dump().items():
        setattr(ft, field, value)
    await db.commit()
    result = await db.execute(
        select(FundTransfer)
        .options(selectinload(FundTransfer.from_asset), selectinload(FundTransfer.to_asset))
        .where(FundTransfer.id == ft_id)
    )
    return result.scalar_one()


@router.delete("/{ft_id}", status_code=204)
async def delete_fund_transfer(ft_id: int, db: AsyncSession = Depends(get_db)):
    ft = (await db.execute(select(FundTransfer).where(FundTransfer.id == ft_id))).scalar_one_or_none()
    if not ft:
        raise HTTPException(404, "Fund transfer not found")
    await db.delete(ft)
    await db.commit()
