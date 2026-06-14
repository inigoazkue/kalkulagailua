from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Account
from app.schemas import AccountOut, AccountCreate, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).order_by(Account.bank, Account.name))
    return result.scalars().all()


@router.post("", response_model=AccountOut, status_code=201)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.put("/{account_id}", response_model=AccountOut)
async def update_account(account_id: int, body: AccountUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(account, k, v)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    await db.delete(account)
    await db.commit()
