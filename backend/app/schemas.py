from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models import BankEnum, AccountSubtypeEnum, CategoryTypeEnum, AssetTypeEnum, InvestmentTransactionTypeEnum


class AccountOut(BaseModel):
    id: int
    name: str
    bank: BankEnum
    subtype: AccountSubtypeEnum
    iban: Optional[str]
    color: str
    include_in_savings: bool
    show_on_dashboard: bool
    is_payroll_account: bool
    current_balance: Optional[Decimal]
    balance_date: Optional[date]
    created_at: datetime
    last_transaction_date: Optional[date] = None

    model_config = {"from_attributes": True}


class AccountCreate(BaseModel):
    name: str
    bank: BankEnum
    subtype: AccountSubtypeEnum
    iban: Optional[str] = None
    color: str = "#3b82f6"
    include_in_savings: bool = False
    show_on_dashboard: bool = True
    is_payroll_account: bool = False


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    subtype: Optional[AccountSubtypeEnum] = None
    iban: Optional[str] = None
    color: Optional[str] = None
    include_in_savings: Optional[bool] = None
    show_on_dashboard: Optional[bool] = None
    is_payroll_account: Optional[bool] = None


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
    is_internal_transfer: bool = False
    transfer_id: Optional[int] = None

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
    savings_transfer: Decimal
    savings: Decimal


class AssignCategoryIn(BaseModel):
    category_id: int


class AccountBalanceUpdate(BaseModel):
    balance: Decimal
    balance_date: date


class ImportResult(BaseModel):
    imported: int
    duplicates: int
    skipped_old: int = 0
    last_transaction_date: Optional[date] = None
    balance_updated: bool = False


class InternalTransferOut(BaseModel):
    id: int
    tx_out_id: int
    tx_in_id: int
    matched_at: datetime
    is_manual: bool
    is_validated: bool
    tx_out: TransactionOut
    tx_in: TransactionOut

    model_config = {"from_attributes": True}


class ValidateBulkIn(BaseModel):
    ids: list[int]
    validated: bool = True


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
