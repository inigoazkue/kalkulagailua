from collections import Counter
from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Account, Transaction, TransactionCategory, BankEnum
from app.schemas import ImportResult
from app.parsers.caixabank import CaixaBankParser
from app.parsers.myinvestor import MyInvestorParser
from app.parsers.trade_republic import TradeRepublicParser
from app.parsers.bit2me import Bit2meParser
from app.services.categorizer import auto_categorize

router = APIRouter(prefix="/imports", tags=["imports"])

PARSER_MAP = {
    BankEnum.caixabank: CaixaBankParser,
    BankEnum.myinvestor: MyInvestorParser,
    BankEnum.trade_republic: TradeRepublicParser,
    BankEnum.bit2me: Bit2meParser,
}


@router.post("/{account_id}", response_model=ImportResult)
async def import_file(
    account_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    parser_class = PARSER_MAP.get(account.bank)
    if not parser_class:
        raise HTTPException(status_code=400, detail=f"Sin parser para {account.bank}")

    content = await file.read()
    parser = parser_class()

    metadata = parser.parse_metadata(content)
    if metadata.current_balance is not None:
        account.current_balance = metadata.current_balance
        account.balance_date = date.today()
    if metadata.iban and not account.iban:
        account.iban = metadata.iban

    try:
        parsed = parser.parse(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error de parseo: {str(e)}")

    existing_result = await db.execute(
        select(Transaction.raw_hash).where(Transaction.account_id == account.id)
    )
    existing_hashes = set(existing_result.scalars().all())

    imported = 0
    duplicates = 0
    occurrence_counter: Counter = Counter()

    for pt in parsed:
        key = (str(pt.date), pt.description, str(pt.amount))
        occurrence_counter[key] += 1
        h = pt.to_hash(occurrence_counter[key])
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

    last_date = max((pt.date for pt in parsed), default=None) if parsed else None
    return ImportResult(
        imported=imported,
        duplicates=duplicates,
        last_transaction_date=last_date,
        balance_updated=metadata.current_balance is not None,
    )
