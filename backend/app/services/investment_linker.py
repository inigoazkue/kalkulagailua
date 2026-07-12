import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Transaction, TransactionCategory, Category, CategoryTypeEnum, InvestmentAsset, InvestmentKeyword, TransactionAssetLink

ISIN_RE = re.compile(r'\b([A-Z]{2}[A-Z0-9]{10})\b')

_STOPWORDS = {
    'savings', 'plan', 'execution', 'buy', 'sell', 'trade', 'quantity',
    'index', 'ishares', 'physical', 'global', 'ucits', 'dist', 'class',
    'fund', 'shares', 'corp', 'from', 'desde', 'transferencia',
}

def extract_isin(description: str) -> str | None:
    m = ISIN_RE.search(description)
    return m.group(1) if m else None

def _keywords(description: str) -> list[str]:
    words = re.findall(r'[^\W\d_]+', description.lower())
    return [w for w in words if len(w) >= 4 and w not in _STOPWORDS]

async def _unlinked_investment_tx_ids(db: AsyncSession) -> list[int]:
    linked = set((await db.execute(select(TransactionAssetLink.transaction_id))).scalars().all())
    all_inv = (await db.execute(
        select(Transaction.id)
        .join(TransactionCategory, Transaction.id == TransactionCategory.transaction_id)
        .join(Category, TransactionCategory.category_id == Category.id)
        .where(Category.category_type == CategoryTypeEnum.investment)
    )).scalars().all()
    return [i for i in all_inv if i not in linked]

async def auto_link_transactions(db: AsyncSession) -> int:
    tx_ids = await _unlinked_investment_tx_ids(db)
    if not tx_ids:
        return 0
    txs = (await db.execute(select(Transaction).where(Transaction.id.in_(tx_ids)))).scalars().all()
    assets = (await db.execute(select(InvestmentAsset))).scalars().all()
    isin_map = {a.isin: a.id for a in assets if a.isin}
    kws = (await db.execute(select(InvestmentKeyword))).scalars().all()
    kw_map: dict[str, int] = {k.keyword.lower(): k.asset_id for k in kws}

    created = 0
    for tx in txs:
        asset_id = None
        isin = extract_isin(tx.description)
        if isin and isin in isin_map:
            asset_id = isin_map[isin]
        else:
            words = set(_keywords(tx.description))
            for kw, aid in kw_map.items():
                if kw in words:
                    asset_id = aid
                    break
        if asset_id:
            db.add(TransactionAssetLink(transaction_id=tx.id, asset_id=asset_id, is_auto=True))
            created += 1
    if created:
        await db.flush()
    return created

async def learn_and_apply(db: AsyncSession, asset_id: int, description: str) -> int:
    existing = set((await db.execute(
        select(InvestmentKeyword.keyword).where(InvestmentKeyword.asset_id == asset_id)
    )).scalars().all())
    new_kws = [w for w in _keywords(description) if w not in existing]
    for w in new_kws:
        db.add(InvestmentKeyword(asset_id=asset_id, keyword=w))
    if new_kws:
        await db.flush()
    tx_ids = await _unlinked_investment_tx_ids(db)
    if not tx_ids or not new_kws:
        return 0
    txs = (await db.execute(select(Transaction).where(Transaction.id.in_(tx_ids)))).scalars().all()
    applied = 0
    for tx in txs:
        if any(kw in set(_keywords(tx.description)) for kw in new_kws):
            db.add(TransactionAssetLink(transaction_id=tx.id, asset_id=asset_id, is_auto=True))
            applied += 1
    if applied:
        await db.flush()
    return applied
