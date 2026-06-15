from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import InternalTransfer, Transaction, TransactionCategory
from app.schemas import InternalTransferOut

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[InternalTransferOut])
async def list_transfers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InternalTransfer)
        .options(
            selectinload(InternalTransfer.tx_out)
            .selectinload(Transaction.category_assignment)
            .selectinload(TransactionCategory.category),
            selectinload(InternalTransfer.tx_in)
            .selectinload(Transaction.category_assignment)
            .selectinload(TransactionCategory.category),
        )
        .order_by(InternalTransfer.matched_at.desc())
    )
    transfers = result.scalars().all()
    for t in transfers:
        t.tx_out.is_internal_transfer = True
        t.tx_in.is_internal_transfer = True
    return transfers


@router.delete("/{transfer_id}", status_code=204)
async def delete_transfer(transfer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InternalTransfer).where(InternalTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    await db.delete(transfer)
    await db.commit()
