from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Account, Transaction
from app.schemas import AccountOut, AccountCreate, AccountUpdate, AccountBalanceUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).order_by(Account.bank, Account.name))
    accounts = result.scalars().all()

    dates_result = await db.execute(
        select(Transaction.account_id, func.max(Transaction.date).label('last_date'))
        .group_by(Transaction.account_id)
    )
    dates_map = {row.account_id: row.last_date for row in dates_result.all()}

    out = []
    for acc in accounts:
        d = AccountOut.model_validate(acc).model_dump()
        d['last_transaction_date'] = dates_map.get(acc.id)
        out.append(AccountOut.model_validate(d))
    return out


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


@router.put("/{account_id}/balance", response_model=AccountOut)
async def update_balance(account_id: int, body: AccountBalanceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    account.current_balance = body.balance
    account.balance_date = body.balance_date
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
