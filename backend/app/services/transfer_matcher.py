from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models import Transaction, InternalTransfer


async def match_transfers(db: AsyncSession, new_tx_ids: list[int]) -> int:
    """Try to auto-detect internal transfers for newly imported transactions.
    Returns number of new transfer pairs created."""
    if not new_tx_ids:
        return 0

    # Load new transactions
    new_txs_result = await db.execute(
        select(Transaction).where(Transaction.id.in_(new_tx_ids))
    )
    new_txs = new_txs_result.scalars().all()

    # IDs already linked as transfers (to avoid double-matching)
    existing_result = await db.execute(
        select(InternalTransfer.tx_out_id, InternalTransfer.tx_in_id)
    )
    linked = set()
    for row in existing_result.all():
        linked.add(row.tx_out_id)
        linked.add(row.tx_in_id)

    created = 0
    for tx in new_txs:
        if tx.id in linked or tx.amount >= 0:
            continue

        target = abs(tx.amount)
        from_date = tx.date - timedelta(days=2)
        to_date = tx.date + timedelta(days=2)

        # Find a matching positive transaction in a different account, not yet linked
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

        if len(candidates) == 1:
            match = candidates[0]
            db.add(InternalTransfer(tx_out_id=tx.id, tx_in_id=match.id, is_manual=False))
            linked.add(tx.id)
            linked.add(match.id)
            created += 1

    if created:
        await db.flush()

    return created
