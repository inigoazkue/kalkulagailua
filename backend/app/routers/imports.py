from calendar import monthrange
from collections import Counter
from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Account, Transaction, TransactionCategory, BankEnum
from app.schemas import ImportResult
from app.parsers.caixabank import CaixaBankParser
from app.parsers.myinvestor import MyInvestorParser
from app.parsers.trade_republic import TradeRepublicParser
from app.parsers.bit2me import Bit2meParser
from app.services.categorizer import auto_categorize
from app.services.transfer_matcher import match_transfers, auto_categorize_savings_transfers


def _subtract_months(d: date, months: int) -> date:
    total_months = d.year * 12 + d.month - months
    year = (total_months - 1) // 12
    month = (total_months - 1) % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)

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

    # Smart cutoff: skip rows older than 2 months before the last recorded date
    last_recorded_result = await db.execute(
        select(func.max(Transaction.date)).where(Transaction.account_id == account.id)
    )
    last_recorded = last_recorded_result.scalar()

    skipped_old = 0
    if last_recorded is not None and parsed:
        cutoff = _subtract_months(last_recorded, 2)
        original_count = len(parsed)
        parsed = [pt for pt in parsed if pt.date >= cutoff]
        skipped_old = original_count - len(parsed)

    existing_result = await db.execute(
        select(Transaction.raw_hash).where(Transaction.account_id == account.id)
    )
    existing_hashes = set(existing_result.scalars().all())

    imported = 0
    duplicates = 0
    new_tx_ids: list[int] = []
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
        new_tx_ids.append(tx.id)
        imported += 1

    await match_transfers(db, new_tx_ids)
    await auto_categorize_savings_transfers(db)
    await db.commit()

    last_date = max((pt.date for pt in parsed), default=None) if parsed else None
    return ImportResult(
        imported=imported,
        duplicates=duplicates,
        skipped_old=skipped_old,
        last_transaction_date=last_date,
        balance_updated=metadata.current_balance is not None,
    )
