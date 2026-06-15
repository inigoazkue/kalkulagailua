from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, aliased
from app.database import get_db
from app.models import InternalTransfer, Transaction, TransactionCategory, TransferBlocklist
from app.schemas import InternalTransferOut
from app.services.transfer_matcher import match_all_transfers

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[InternalTransferOut])
async def list_transfers(db: AsyncSession = Depends(get_db)):
    TxOut = aliased(Transaction)
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
        .join(TxOut, InternalTransfer.tx_out_id == TxOut.id)
        .order_by(TxOut.date.desc())
    )
    transfers = result.scalars().all()
    for t in transfers:
        t.tx_out.is_internal_transfer = True
        t.tx_in.is_internal_transfer = True
        t.tx_out.transfer_id = t.id
        t.tx_in.transfer_id = t.id
    return transfers


@router.post("/detect")
async def detect_transfers(db: AsyncSession = Depends(get_db)):
    """Force-detect internal transfers across all unlinked transactions."""
    created = await match_all_transfers(db)
    await db.commit()
    return {"created": created}


@router.delete("/{transfer_id}", status_code=204)
async def delete_transfer(transfer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InternalTransfer).where(InternalTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    # Block the pair so force-detect won't re-link them
    db.add(TransferBlocklist(tx_out_id=transfer.tx_out_id, tx_in_id=transfer.tx_in_id))
    await db.delete(transfer)
    await db.commit()
