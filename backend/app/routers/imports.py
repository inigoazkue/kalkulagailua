from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Account, Transaction, TransactionCategory, BankEnum, AccountTypeEnum
from app.schemas import ImportResult
from app.parsers.caixabank import CaixaBankParser
from app.parsers.myinvestor import MyInvestorParser
from app.parsers.trade_republic import TradeRepublicParser
from app.parsers.bit2me import Bit2meParser
from app.services.categorizer import auto_categorize

router = APIRouter()


async def _get_or_create_account(db: AsyncSession, bank: BankEnum, account_type: AccountTypeEnum) -> Account:
    result = await db.execute(
        select(Account).where(Account.bank == bank, Account.account_type == account_type)
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(
            name=bank.value.replace("_", " ").title(),
            bank=bank,
            account_type=account_type,
        )
        db.add(account)
        await db.flush()
    return account


async def _import_transactions(
    db: AsyncSession,
    bank: BankEnum,
    account_type: AccountTypeEnum,
    file_bytes: bytes,
    parser_class,
) -> ImportResult:
    account = await _get_or_create_account(db, bank, account_type)

    parser = parser_class()
    try:
        parsed = parser.parse(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parse error: {str(e)}")

    existing_hashes_result = await db.execute(
        select(Transaction.raw_hash).where(Transaction.account_id == account.id)
    )
    existing_hashes = set(existing_hashes_result.scalars().all())

    imported = 0
    duplicates = 0

    for pt in parsed:
        h = pt.to_hash()
        if h in existing_hashes:
            duplicates += 1
            continue

        tx = Transaction(
            account_id=account.id,
            date=pt.date,
            description=pt.description,
            amount=pt.amount,
            balance=pt.balance,
            raw_hash=h,
        )
        db.add(tx)
        await db.flush()

        category_id = await auto_categorize(db, pt.description)
        if category_id:
            db.add(TransactionCategory(
                transaction_id=tx.id,
                category_id=category_id,
                is_manual=False,
            ))

        existing_hashes.add(h)
        imported += 1

    await db.commit()
    return ImportResult(imported=imported, duplicates=duplicates)


@router.post("/imports/caixabank", response_model=ImportResult)
async def import_caixabank(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    return await _import_transactions(db, BankEnum.caixabank, AccountTypeEnum.bank, content, CaixaBankParser)


@router.post("/imports/myinvestor", response_model=ImportResult)
async def import_myinvestor(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    return await _import_transactions(db, BankEnum.myinvestor, AccountTypeEnum.broker, content, MyInvestorParser)


@router.post("/imports/trade_republic", response_model=ImportResult)
async def import_trade_republic(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    return await _import_transactions(db, BankEnum.trade_republic, AccountTypeEnum.broker, content, TradeRepublicParser)


@router.post("/imports/bit2me", response_model=ImportResult)
async def import_bit2me(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    return await _import_transactions(db, BankEnum.bit2me, AccountTypeEnum.crypto, content, Bit2meParser)
