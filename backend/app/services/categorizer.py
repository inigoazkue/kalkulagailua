from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models import Category, CategoryKeyword


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
