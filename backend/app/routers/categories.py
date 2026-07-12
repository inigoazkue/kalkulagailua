from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Category, CategoryKeyword, TransactionCategory, Transaction
from app.schemas import CategoryOut, CategoryCreate, CategoryUpdate

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords)).order_by(Category.name)
    )
    return result.scalars().all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    category = Category(
        name=body.name,
        category_type=body.category_type,
        color=body.color,
        is_default=False,
    )
    db.add(category)
    await db.flush()
    for kw in body.keywords:
        db.add(CategoryKeyword(category_id=category.id, keyword=kw))
    await db.commit()
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords)).where(Category.id == category.id)
    )
    return result.scalar_one()


@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int, body: CategoryUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords)).where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.name is not None:
        category.name = body.name
    if body.category_type is not None:
        category.category_type = body.category_type
    if body.color is not None:
        category.color = body.color
    if body.keywords is not None:
        old_keywords = {kw.keyword.lower() for kw in category.keywords}
        new_keywords = {kw.lower() for kw in body.keywords}
        removed = old_keywords - new_keywords

        # Uncategorize auto-assigned transactions whose only matching keyword was removed
        if removed:
            removed_filter = or_(*[
                Transaction.description.ilike(f'%{kw}%') for kw in removed
            ])
            # Remaining keywords (if any) — transactions still matching these keep their category
            if new_keywords:
                still_match_filter = or_(*[
                    Transaction.description.ilike(f'%{kw}%') for kw in new_keywords
                ])
                to_remove_result = await db.execute(
                    select(TransactionCategory.id)
                    .join(Transaction, TransactionCategory.transaction_id == Transaction.id)
                    .where(
                        TransactionCategory.category_id == category_id,
                        TransactionCategory.is_manual == False,
                        removed_filter,
                        ~still_match_filter,
                    )
                )
            else:
                # All keywords removed → uncategorize all auto-assigned
                to_remove_result = await db.execute(
                    select(TransactionCategory.id)
                    .where(
                        TransactionCategory.category_id == category_id,
                        TransactionCategory.is_manual == False,
                    )
                )
            ids_to_remove = [r[0] for r in to_remove_result.all()]
            if ids_to_remove:
                await db.execute(
                    delete(TransactionCategory).where(TransactionCategory.id.in_(ids_to_remove))
                )

        for kw in category.keywords:
            await db.delete(kw)
        await db.flush()
        for kw in body.keywords:
            db.add(CategoryKeyword(category_id=category.id, keyword=kw))

    await db.commit()
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords)).where(Category.id == category_id)
    )
    return result.scalar_one()


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).options(selectinload(Category.keywords), selectinload(Category.transaction_assignments))
        .where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()
