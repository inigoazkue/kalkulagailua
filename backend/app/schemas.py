from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models import BankEnum, AccountTypeEnum, CategoryTypeEnum, AssetTypeEnum, InvestmentTransactionTypeEnum


class AccountOut(BaseModel):
    id: int
    name: str
    bank: BankEnum
    account_type: AccountTypeEnum
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryKeywordOut(BaseModel):
    id: int
    keyword: str

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: int
    name: str
    category_type: CategoryTypeEnum
    color: str
    is_default: bool
    keywords: list[CategoryKeywordOut] = []

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    category_type: CategoryTypeEnum
    color: str = "#6b7280"
    keywords: list[str] = []


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    category_type: Optional[CategoryTypeEnum] = None
    color: Optional[str] = None
    keywords: Optional[list[str]] = None


class CategorySlimOut(BaseModel):
    id: int
    name: str
    category_type: CategoryTypeEnum
    color: str

    model_config = {"from_attributes": True}


class TransactionCategoryOut(BaseModel):
    id: int
    category_id: int
    is_manual: bool
    category: CategorySlimOut

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: int
    account_id: int
    date: date
    description: str
    amount: Decimal
    balance: Optional[Decimal]
    imported_at: datetime
    category_assignment: Optional[TransactionCategoryOut] = None

    model_config = {"from_attributes": True}


class TransactionListOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    limit: int


class TransactionSummaryOut(BaseModel):
    income: Decimal
    fixed_expenses: Decimal
    variable_expenses: Decimal
    investment: Decimal
    savings: Decimal


class AssignCategoryIn(BaseModel):
    category_id: int


class ImportResult(BaseModel):
    imported: int
    duplicates: int


class InvestmentAssetOut(BaseModel):
    id: int
    ticker: str
    name: str
    asset_type: AssetTypeEnum
    created_at: datetime

    model_config = {"from_attributes": True}


class InvestmentAssetCreate(BaseModel):
    ticker: str
    asset_type: AssetTypeEnum


class InvestmentTransactionOut(BaseModel):
    id: int
    asset_id: int
    account_id: int
    transaction_date: date
    quantity: Decimal
    price_per_unit: Decimal
    fees: Decimal
    transaction_type: InvestmentTransactionTypeEnum

    model_config = {"from_attributes": True}


class InvestmentTransactionCreate(BaseModel):
    asset_id: int
    account_id: int
    transaction_date: date
    quantity: Decimal
    price_per_unit: Decimal
    fees: Decimal = Decimal("0")
    transaction_type: InvestmentTransactionTypeEnum


class InvestmentPositionOut(BaseModel):
    asset: InvestmentAssetOut
    total_quantity: Decimal
    cost_basis: Decimal
    current_price: Decimal
    current_value: Decimal
    pnl: Decimal
    pnl_pct: Decimal
