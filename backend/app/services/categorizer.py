from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models import Category, CategoryKeyword, Transaction, TransactionCategory


async def auto_categorize(db: AsyncSession, description: str) -> Optional[int]:
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords))
    )
    categories = result.scalars().all()

    desc_lower = description.lower()
    for category in categories:
        for kw in category.keywords:
            if kw.keyword.lower() in desc_lower:
                return category.id

    return None


async def auto_categorize_all(db: AsyncSession) -> int:
    """Categorize all unblocked transactions that currently have no category."""
    cats_result = await db.execute(
        select(Category).options(selectinload(Category.keywords))
    )
    categories = [c for c in cats_result.scalars().all() if c.keywords]

    uncat_result = await db.execute(
        select(Transaction)
        .outerjoin(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .where(
            TransactionCategory.id == None,
            Transaction.blocked_from_auto_categorize == False,
        )
    )
    uncat_txs = uncat_result.scalars().all()

    count = 0
    for tx in uncat_txs:
        desc_lower = tx.description.lower()
        matched_id: Optional[int] = None
        for category in categories:
            for kw in category.keywords:
                if kw.keyword.lower() in desc_lower:
                    matched_id = category.id
                    break
            if matched_id is not None:
                break
        if matched_id is not None:
            db.add(TransactionCategory(transaction_id=tx.id, category_id=matched_id, is_manual=False))
            count += 1

    if count:
        await db.commit()

    return count
