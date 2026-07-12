import re
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Transaction, TransactionCategory, Category, CategoryTypeEnum, TransactionAssetLink, InvestmentAsset, Account
from app.schemas import InvestmentLinkRow, TransactionAssetLinkOut, CreateLinkIn, LinkBulkIn, TransactionOut
from app.services.investment_linker import auto_link_transactions, learn_and_apply

router = APIRouter(prefix="/investments/links", tags=["investment-links"])

QTY_RE = re.compile(r'quantity:\s*([\d.]+)', re.IGNORECASE)
PRICE_RE = re.compile(r'@\s*([\d.]+)', re.IGNORECASE)


def _parse_quantity(description: str, amount: Decimal) -> Decimal | None:
    m = QTY_RE.search(description)
    if m:
        try:
            return Decimal(m.group(1))
        except Exception:
            pass
    m = PRICE_RE.search(description)
    if m:
        try:
            price = Decimal(m.group(1))
            if price > 0:
                return abs(amount) / price
        except Exception:
            pass
    return None


async def _get_all_link_rows(db: AsyncSession) -> list[InvestmentLinkRow]:
    # Get all investment-categorized transaction IDs
    inv_result = await db.execute(
        select(Transaction.id)
        .join(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .join(Category, TransactionCategory.category_id == Category.id)
        .where(Category.category_type == CategoryTypeEnum.investment)
    )
    inv_tx_ids = inv_result.scalars().all()
    if not inv_tx_ids:
        return []

    # Load transactions with category
    txs_result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.category_assignment)
            .selectinload(TransactionCategory.category)
        )
        .where(Transaction.id.in_(inv_tx_ids))
        .order_by(Transaction.date.desc())
    )
    txs = txs_result.scalars().all()

    # Load links with asset
    links_result = await db.execute(
        select(TransactionAssetLink)
        .options(selectinload(TransactionAssetLink.asset))
        .where(TransactionAssetLink.transaction_id.in_(inv_tx_ids))
    )
    links = {l.transaction_id: l for l in links_result.scalars().all()}

    rows = []
    for tx in txs:
        link = links.get(tx.id)
        tx_out = TransactionOut.model_validate(tx)
        rows.append(InvestmentLinkRow(transaction=tx_out, link=link))
    return rows


@router.get("", response_model=list[InvestmentLinkRow])
async def list_investment_links(db: AsyncSession = Depends(get_db)):
    return await _get_all_link_rows(db)


@router.post("/detect")
async def detect_links(db: AsyncSession = Depends(get_db)):
    created = await auto_link_transactions(db)
    await db.commit()
    return {"created": created}


@router.post("", response_model=TransactionAssetLinkOut, status_code=201)
async def create_link(body: CreateLinkIn, db: AsyncSession = Depends(get_db)):
    # Check asset exists
    asset = (await db.execute(select(InvestmentAsset).where(InvestmentAsset.id == body.asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    # Check transaction has investment category
    cat_check = (await db.execute(
        select(TransactionCategory)
        .join(Category, TransactionCategory.category_id == Category.id)
        .where(TransactionCategory.transaction_id == body.transaction_id)
        .where(Category.category_type == CategoryTypeEnum.investment)
    )).scalar_one_or_none()
    if not cat_check:
        raise HTTPException(400, "Transaction is not categorized as investment")
    # Get transaction for keyword learning and quantity parsing
    tx = (await db.execute(select(Transaction).where(Transaction.id == body.transaction_id))).scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    # Parse quantity from description
    quantity = _parse_quantity(tx.description, tx.amount)
    # Upsert link
    existing = (await db.execute(
        select(TransactionAssetLink).where(TransactionAssetLink.transaction_id == body.transaction_id)
    )).scalar_one_or_none()
    if existing:
        existing.asset_id = body.asset_id
        existing.is_auto = False
        existing.is_validated = False
        existing.is_rejected = False
        existing.quantity = quantity
        link = existing
    else:
        link = TransactionAssetLink(
            transaction_id=body.transaction_id,
            asset_id=body.asset_id,
            is_auto=False,
            quantity=quantity,
        )
        db.add(link)
    await db.flush()
    await learn_and_apply(db, body.asset_id, tx.description)
    await db.commit()
    await db.refresh(link)
    # Load asset for response
    link_with_asset = (await db.execute(
        select(TransactionAssetLink)
        .options(selectinload(TransactionAssetLink.asset))
        .where(TransactionAssetLink.id == link.id)
    )).scalar_one()
    return link_with_asset


@router.post("/validate")
async def validate_links(body: LinkBulkIn, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(TransactionAssetLink)
        .where(TransactionAssetLink.id.in_(body.ids))
        .values(is_validated=True, is_rejected=False)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.post("/reject")
async def reject_links(body: LinkBulkIn, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(TransactionAssetLink)
        .where(TransactionAssetLink.id.in_(body.ids))
        .values(is_rejected=True, is_validated=False)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.post("/reset")
async def reset_links(body: LinkBulkIn, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(TransactionAssetLink)
        .where(TransactionAssetLink.id.in_(body.ids))
        .values(is_validated=False, is_rejected=False)
    )
    await db.commit()
    return {"updated": len(body.ids)}


@router.delete("/{link_id}", status_code=204)
async def delete_link(link_id: int, db: AsyncSession = Depends(get_db)):
    link = (await db.execute(select(TransactionAssetLink).where(TransactionAssetLink.id == link_id))).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Link not found")
    await db.delete(link)
    await db.commit()
