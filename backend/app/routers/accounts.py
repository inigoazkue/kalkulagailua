from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Account
from app.schemas import AccountOut

router = APIRouter()


@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).order_by(Account.name))
    return result.scalars().all()
