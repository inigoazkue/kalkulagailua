from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models import Transaction, InternalTransfer, TransferBlocklist, TransactionCategory, Account, AccountSubtypeEnum, Category, CategoryTypeEnum


async def _load_state(db: AsyncSession) -> tuple[set[int], set[tuple[int, int]]]:
    """Return (linked_ids, blocklist_pairs)."""
    existing_result = await db.execute(
        select(InternalTransfer.tx_out_id, InternalTransfer.tx_in_id)
    )
    linked: set[int] = set()
    for row in existing_result.all():
        linked.add(row.tx_out_id)
        linked.add(row.tx_in_id)

    blocklist_result = await db.execute(
        select(TransferBlocklist.tx_out_id, TransferBlocklist.tx_in_id)
    )
    blocklist: set[tuple[int, int]] = {
        (row.tx_out_id, row.tx_in_id) for row in blocklist_result.all()
    }
    return linked, blocklist


async def _match_txs(
    db: AsyncSession,
    txs: list[Transaction],
    linked: set[int],
    blocklist: set[tuple[int, int]],
) -> int:
    from decimal import Decimal
    created = 0
    for tx in txs:
        if tx.id in linked or tx.amount >= 0:
            continue

        target = abs(tx.amount)
        from_date = tx.date - timedelta(days=4)
        to_date = tx.date + timedelta(days=4)

        candidates_result = await db.execute(
            select(Transaction)
            .where(
                Transaction.account_id != tx.account_id,
                Transaction.amount == target,
                Transaction.date >= from_date,
                Transaction.date <= to_date,
                Transaction.id.not_in(linked),
            )
        )
        candidates = candidates_result.scalars().all()

        # Filter out blocklisted pairs
        candidates = [c for c in candidates if (tx.id, c.id) not in blocklist]

        if len(candidates) == 1:
            match = candidates[0]
            db.add(InternalTransfer(tx_out_id=tx.id, tx_in_id=match.id, is_manual=False))
            linked.add(tx.id)
            linked.add(match.id)
            created += 1

    if created:
        await db.flush()

    return created


async def match_transfers(db: AsyncSession, new_tx_ids: list[int]) -> int:
    """Auto-detect internal transfers for newly imported transactions.
    Returns number of new transfer pairs created."""
    if not new_tx_ids:
        return 0

    new_txs_result = await db.execute(
        select(Transaction).where(Transaction.id.in_(new_tx_ids))
    )
    new_txs = new_txs_result.scalars().all()

    linked, blocklist = await _load_state(db)
    return await _match_txs(db, new_txs, linked, blocklist)


async def auto_categorize_savings_transfers(db: AsyncSession) -> int:
    """Assign 'Ahorro' category to uncategorized tx_out transactions
    that flow from a daily account to a savings account.
    Returns number of new assignments made."""
    cat_result = await db.execute(
        select(Category.id).where(Category.category_type == CategoryTypeEnum.savings)
    )
    ahorro_id = cat_result.scalar_one_or_none()
    if not ahorro_id:
        return 0

    # Load all internal transfers with account info
    transfers_result = await db.execute(
        select(InternalTransfer.tx_out_id, InternalTransfer.tx_in_id,
               Transaction.account_id.label("out_account_id"))
        .join(Transaction, InternalTransfer.tx_out_id == Transaction.id)
    )
    transfers = transfers_result.all()
    if not transfers:
        return 0

    all_account_ids = set()
    for row in transfers:
        all_account_ids.add(row.out_account_id)
    # Also need tx_in account ids
    tx_in_ids = [row.tx_in_id for row in transfers]
    tx_in_accounts_result = await db.execute(
        select(Transaction.id, Transaction.account_id).where(Transaction.id.in_(tx_in_ids))
    )
    tx_in_account = {row.id: row.account_id for row in tx_in_accounts_result.all()}
    for acc_id in tx_in_account.values():
        all_account_ids.add(acc_id)

    accounts_result = await db.execute(
        select(Account.id, Account.subtype).where(Account.id.in_(all_account_ids))
    )
    subtypes = {row.id: row.subtype for row in accounts_result.all()}

    # Already categorized tx_out IDs
    tx_out_ids = [row.tx_out_id for row in transfers]
    cats_result = await db.execute(
        select(TransactionCategory.transaction_id).where(
            TransactionCategory.transaction_id.in_(tx_out_ids)
        )
    )
    already_categorized = set(cats_result.scalars().all())

    assigned = 0
    for row in transfers:
        if row.tx_out_id in already_categorized:
            continue
        in_account_id = tx_in_account.get(row.tx_in_id)
        if (subtypes.get(row.out_account_id) == AccountSubtypeEnum.daily
                and subtypes.get(in_account_id) == AccountSubtypeEnum.savings):
            db.add(TransactionCategory(
                transaction_id=row.tx_out_id,
                category_id=ahorro_id,
                is_manual=False,
            ))
            already_categorized.add(row.tx_out_id)
            assigned += 1

    if assigned:
        await db.flush()
    return assigned


async def match_all_transfers(db: AsyncSession) -> int:
    """Force-detect internal transfers across all unlinked transactions,
    respecting the blocklist of previously unlinked pairs.
    Returns number of new transfer pairs created."""
    linked, blocklist = await _load_state(db)

    # All negative transactions not currently linked
    all_txs_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.amount < 0,
            Transaction.id.not_in(linked),
        )
        .order_by(Transaction.date)
    )
    all_txs = all_txs_result.scalars().all()

    return await _match_txs(db, all_txs, linked, blocklist)
