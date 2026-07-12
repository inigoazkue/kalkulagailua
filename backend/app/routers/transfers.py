from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload, aliased
from app.database import get_db
from app.models import InternalTransfer, Transaction, TransactionCategory, TransferBlocklist
from app.schemas import InternalTransferOut, ValidateBulkIn, RejectBulkIn
from app.services.transfer_matcher import match_all_transfers, auto_categorize_savings_transfers

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
    """Force-detect internal transfers and auto-categorize daily→savings ones."""
    created = await match_all_transfers(db)
    await auto_categorize_savings_transfers(db)
    await db.commit()
    return {"created": created}


@router.post("/validate")
async def validate_transfers(body: ValidateBulkIn, db: AsyncSession = Depends(get_db)):
    """Validate or unvalidate a batch of transfers. Validating also clears is_rejected."""
    values = {"is_validated": body.validated}
    if body.validated:
        values["is_rejected"] = False
    await db.execute(
        update(InternalTransfer)
        .where(InternalTransfer.id.in_(body.ids))
        .values(**values)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.post("/reject")
async def reject_transfers(body: RejectBulkIn, db: AsyncSession = Depends(get_db)):
    """Mark transfers as rejected (no validar) or clear that mark. Rejecting also clears is_validated."""
    values = {"is_rejected": body.rejected}
    if body.rejected:
        values["is_validated"] = False
    await db.execute(
        update(InternalTransfer)
        .where(InternalTransfer.id.in_(body.ids))
        .values(**values)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.post("/reset")
async def reset_transfers(body: ValidateBulkIn, db: AsyncSession = Depends(get_db)):
    """Move transfers back to pending (clears both is_validated and is_rejected)."""
    await db.execute(
        update(InternalTransfer)
        .where(InternalTransfer.id.in_(body.ids))
        .values(is_validated=False, is_rejected=False)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.delete("/{transfer_id}", status_code=204)
async def delete_transfer(transfer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InternalTransfer).where(InternalTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    db.add(TransferBlocklist(tx_out_id=transfer.tx_out_id, tx_in_id=transfer.tx_in_id))
    await db.delete(transfer)
    await db.commit()
