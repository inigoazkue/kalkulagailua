from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Transaction, TransactionCategory, Category, CategoryTypeEnum, Account
from app.schemas import (
    TransactionOut, TransactionListOut, TransactionSummaryOut, AssignCategoryIn
)

router = APIRouter()


_PAYROLL_KEYWORDS = ['%nomina%', '%nómina%', '%salario%', '%sueldo%', '%paga extra%']

@router.get("/transactions/payroll-dates")
async def get_payroll_dates(db: AsyncSession = Depends(get_db)):
    acc = (await db.execute(select(Account).where(Account.is_payroll_account == True))).scalar_one_or_none()
    if not acc:
        return {"dates": []}
    keyword_filter = or_(*[Transaction.description.ilike(kw) for kw in _PAYROLL_KEYWORDS])
    rows = (await db.execute(
        select(Transaction.date)
        .where(Transaction.account_id == acc.id, Transaction.amount > 2000, keyword_filter)
        .order_by(Transaction.date)
    )).scalars().all()
    return {"dates": [d.isoformat() for d in rows]}


@router.get("/transactions/analytics-data")
async def get_analytics_data(
    start: Optional[date] = None,
    end: Optional[date] = None,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if start:
        filters.append(Transaction.date >= start)
    if end:
        filters.append(Transaction.date <= end)
    if account_id:
        filters.append(Transaction.account_id == account_id)

    # Daily income / expenses using GREATEST to split positive/negative
    daily_q = (
        select(
            Transaction.date,
            func.sum(func.greatest(Transaction.amount, Decimal("0"))).label("income"),
            func.sum(func.greatest(-Transaction.amount, Decimal("0"))).label("expenses"),
        )
        .where(and_(*filters))
        .group_by(Transaction.date)
        .order_by(Transaction.date)
    )
    daily_rows = (await db.execute(daily_q)).all()
    daily = [{"date": str(r.date), "income": float(r.income), "expenses": float(r.expenses)} for r in daily_rows]

    # Categorized expenses grouped by category
    cat_q = (
        select(
            Category.name,
            Category.color,
            Category.category_type,
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .join(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .join(Category, TransactionCategory.category_id == Category.id)
        .where(and_(*filters, Transaction.amount < 0))
        .group_by(Category.id, Category.name, Category.color, Category.category_type)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
    )
    cat_rows = (await db.execute(cat_q)).all()
    categories = [
        {"name": r.name, "color": r.color, "category_type": r.category_type.value, "total": float(r.total)}
        for r in cat_rows
    ]

    # Uncategorized expenses
    uncat_q = (
        select(func.sum(func.abs(Transaction.amount)).label("total"))
        .outerjoin(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .where(and_(*filters, Transaction.amount < 0, TransactionCategory.id == None))
    )
    uncat_total = float((await db.execute(uncat_q)).scalar() or 0)
    if uncat_total > 0:
        categories.append({"name": "Sin categoría", "color": "#6b7280", "category_type": "variable_expense", "total": uncat_total})

    income = sum(d["income"] for d in daily)
    fixed_exp = sum(c["total"] for c in categories if c["category_type"] == "fixed_expense")
    var_exp = sum(c["total"] for c in categories if c["category_type"] == "variable_expense")
    invest = sum(c["total"] for c in categories if c["category_type"] == "investment")

    return {
        "daily": daily,
        "categories": categories,
        "summary": {
            "income": income,
            "fixed_expenses": fixed_exp,
            "variable_expenses": var_exp,
            "investment": invest,
            "net": income - fixed_exp - var_exp - invest,
        },
    }


@router.get("/transactions", response_model=TransactionListOut)
async def list_transactions(
    start: Optional[date] = None,
    end: Optional[date] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    category_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if start:
        filters.append(Transaction.date >= start)
    if end:
        filters.append(Transaction.date <= end)
    if account_id:
        filters.append(Transaction.account_id == account_id)

    query = (
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment).selectinload(TransactionCategory.category)
        )
        .where(and_(*filters))
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    )

    if category_id is not None:
        query = query.join(
            TransactionCategory,
            Transaction.id == TransactionCategory.transaction_id,
            isouter=True,
        ).where(TransactionCategory.category_id == category_id)
    elif category_type is not None:
        try:
            ct = CategoryTypeEnum(category_type)
            query = (query
                .join(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
                .join(Category, TransactionCategory.category_id == Category.id)
                .where(Category.category_type == ct))
        except ValueError:
            pass

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    paginated = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(paginated)
    items = result.scalars().all()

    return TransactionListOut(items=items, total=total, page=page, limit=limit)


@router.get("/transactions/summary", response_model=TransactionSummaryOut)
async def get_summary(
    start: Optional[date] = None,
    end: Optional[date] = None,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if start:
        filters.append(Transaction.date >= start)
    if end:
        filters.append(Transaction.date <= end)
    if account_id:
        filters.append(Transaction.account_id == account_id)

    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment).selectinload(TransactionCategory.category)
        )
        .where(and_(*filters))
    )
    transactions = result.scalars().all()

    income = Decimal("0")
    fixed_expenses = Decimal("0")
    variable_expenses = Decimal("0")
    investment = Decimal("0")

    for tx in transactions:
        if tx.category_assignment is None:
            if tx.amount > 0:
                income += tx.amount
            else:
                variable_expenses += abs(tx.amount)
            continue

        cat_type = tx.category_assignment.category.category_type
        amount = tx.amount

        if cat_type == CategoryTypeEnum.income:
            income += abs(amount)
        elif cat_type == CategoryTypeEnum.fixed_expense:
            fixed_expenses += abs(amount)
        elif cat_type == CategoryTypeEnum.variable_expense:
            variable_expenses += abs(amount)
        elif cat_type == CategoryTypeEnum.investment:
            investment += abs(amount)

    savings = income - fixed_expenses - variable_expenses - investment
    return TransactionSummaryOut(
        income=income,
        fixed_expenses=fixed_expenses,
        variable_expenses=variable_expenses,
        investment=investment,
        savings=savings,
    )


@router.put("/transactions/{transaction_id}/category", response_model=TransactionOut)
async def assign_category(
    transaction_id: int,
    body: AssignCategoryIn,
    db: AsyncSession = Depends(get_db),
):
    tx_result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment).selectinload(TransactionCategory.category)
        )
        .where(Transaction.id == transaction_id)
    )
    tx = tx_result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    cat_result = await db.execute(select(Category).where(Category.id == body.category_id))
    category = cat_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    if tx.category_assignment:
        tx.category_assignment.category_id = body.category_id
        tx.category_assignment.is_manual = True
    else:
        assignment = TransactionCategory(
            transaction_id=transaction_id,
            category_id=body.category_id,
            is_manual=True,
        )
        db.add(assignment)

    await db.commit()
    await db.refresh(tx)

    tx_result2 = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment).selectinload(TransactionCategory.category)
        )
        .where(Transaction.id == transaction_id)
    )
    return tx_result2.scalar_one()
