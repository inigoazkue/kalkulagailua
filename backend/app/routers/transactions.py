import re
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Transaction, TransactionCategory, Category, CategoryTypeEnum, Account, CategoryKeyword, InternalTransfer
from app.schemas import (
    TransactionOut, TransactionListOut, TransactionSummaryOut, AssignCategoryIn
)

_BANKING_STOPWORDS = frozenset({
    'compra', 'pago', 'cargo', 'abono', 'transferencia', 'recibo', 'ingreso',
    'orden', 'retirada', 'reintegro', 'cajero', 'bizum', 'comision', 'comision',
    'adeudo', 'concepto', 'tarjeta', 'cuenta', 'movimiento', 'operacion',
    'domiciliado', 'domiciliacion', 'para', 'desde', 'hasta', 'euro', 'euros',
    'importe', 'fecha', 'referencia', 'enviado', 'recibido', 'realizado',
    'efectuado', 'banco', 'entidad', 'oficina', 'numero', 'numero', 'ahorro',
})


def _extract_keywords(description: str) -> list[str]:
    words = re.findall(r'[^\W\d_]+', description)
    seen: set[str] = set()
    result = []
    for w in words:
        if len(w) < 4:
            continue
        lower = w.lower()
        if lower not in _BANKING_STOPWORDS and lower not in seen:
            seen.add(lower)
            result.append(lower)
    return result


async def _auto_learn(db: AsyncSession, tx_id: int, tx_description: str, category_id: int) -> None:
    kw_result = await db.execute(
        select(CategoryKeyword).where(CategoryKeyword.category_id == category_id)
    )
    existing = {kw.keyword.lower() for kw in kw_result.scalars().all()}

    new_keywords = [kw for kw in _extract_keywords(tx_description) if kw not in existing]
    for kw in new_keywords:
        db.add(CategoryKeyword(category_id=category_id, keyword=kw))
    if new_keywords:
        await db.flush()

    all_keywords = list(existing) + new_keywords
    if not all_keywords:
        return

    keyword_filter = or_(*[Transaction.description.ilike(f'%{kw}%') for kw in all_keywords])
    uncat_ids_result = await db.execute(
        select(Transaction.id)
        .outerjoin(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .where(TransactionCategory.id == None, keyword_filter, Transaction.id != tx_id)
    )
    uncat_ids = [r[0] for r in uncat_ids_result.all()]
    for tid in uncat_ids:
        db.add(TransactionCategory(transaction_id=tid, category_id=category_id, is_manual=False))
    if new_keywords or uncat_ids:
        await db.commit()

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
    savings_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if start:
        filters.append(Transaction.date >= start)
    if end:
        filters.append(Transaction.date <= end)
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if savings_only:
        filters.append(
            Transaction.account_id.in_(select(Account.id).where(Account.include_in_savings == True))
        )

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
            Category.id,
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
        {"id": r.id, "name": r.name, "color": r.color, "category_type": r.category_type.value, "total": float(r.total)}
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
        categories.append({"id": None, "name": "Sin categoría", "color": "#6b7280", "category_type": "variable_expense", "total": uncat_total})

    income = sum(d["income"] for d in daily)
    fixed_exp = sum(c["total"] for c in categories if c["category_type"] == "fixed_expense")
    var_exp = sum(c["total"] for c in categories if c["category_type"] == "variable_expense")
    invest = sum(c["total"] for c in categories if c["category_type"] == "investment")
    savings_t = sum(c["total"] for c in categories if c["category_type"] == "savings")

    return {
        "daily": daily,
        "categories": categories,
        "summary": {
            "income": income,
            "fixed_expenses": fixed_exp,
            "variable_expenses": var_exp,
            "investment": invest,
            "savings_transfer": savings_t,
            "net": income - fixed_exp - var_exp - invest - savings_t,
        },
    }


@router.get("/transactions", response_model=TransactionListOut)
async def list_transactions(
    start: Optional[date] = None,
    end: Optional[date] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    category_type: Optional[str] = None,
    metric: Optional[str] = None,
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

    if metric == 'income':
        # All positive-amount transactions
        query = query.where(Transaction.amount > 0)
    elif metric in ('fixed_expense', 'investment', 'savings'):
        ct = CategoryTypeEnum(metric)
        query = (query
            .join(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
            .join(Category, TransactionCategory.category_id == Category.id)
            .where(Category.category_type == ct))
    elif metric == 'variable_expense':
        # Negative AND (uncategorized OR categorized as variable_expense)
        query = (query
            .outerjoin(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
            .outerjoin(Category, TransactionCategory.category_id == Category.id)
            .where(Transaction.amount < 0)
            .where(or_(TransactionCategory.id == None, Category.category_type == CategoryTypeEnum.variable_expense)))
    elif metric == 'uncategorized':
        # Negative AND no category
        query = (query
            .outerjoin(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
            .where(Transaction.amount < 0, TransactionCategory.id == None))
    elif category_id is not None:
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

    if items:
        item_ids = [tx.id for tx in items]
        transfer_result = await db.execute(
            select(InternalTransfer.id, InternalTransfer.tx_out_id, InternalTransfer.tx_in_id)
            .where(or_(
                InternalTransfer.tx_out_id.in_(item_ids),
                InternalTransfer.tx_in_id.in_(item_ids),
            ))
        )
        tx_to_transfer: dict[int, int] = {}
        for row in transfer_result.all():
            tx_to_transfer[row.tx_out_id] = row.id
            tx_to_transfer[row.tx_in_id] = row.id
        for tx in items:
            tx.is_internal_transfer = tx.id in tx_to_transfer
            tx.transfer_id = tx_to_transfer.get(tx.id)

    return TransactionListOut(items=items, total=total, page=page, limit=limit)


@router.get("/transactions/summary", response_model=TransactionSummaryOut)
async def get_summary(
    start: Optional[date] = None,
    end: Optional[date] = None,
    account_id: Optional[int] = None,
    savings_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if start:
        filters.append(Transaction.date >= start)
    if end:
        filters.append(Transaction.date <= end)
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if savings_only:
        filters.append(
            Transaction.account_id.in_(select(Account.id).where(Account.include_in_savings == True))
        )

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
    savings_transfer = Decimal("0")

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
        elif cat_type == CategoryTypeEnum.savings:
            savings_transfer += abs(amount)

    savings = income - fixed_expenses - variable_expenses - investment - savings_transfer
    return TransactionSummaryOut(
        income=income,
        fixed_expenses=fixed_expenses,
        variable_expenses=variable_expenses,
        investment=investment,
        savings_transfer=savings_transfer,
        savings=savings,
    )


@router.put("/transactions/{transaction_id}/category", response_model=TransactionOut)
async def assign_category(
    transaction_id: int,
    body: AssignCategoryIn,
    learn: bool = Query(True),
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

    if learn:
        await _auto_learn(db, transaction_id, tx.description, body.category_id)

    tx_result2 = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment).selectinload(TransactionCategory.category)
        )
        .where(Transaction.id == transaction_id)
    )
    return tx_result2.scalar_one()
