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
    last_transaction_date: Optional[date] = None
    balance_updated: bool = False


class InternalTransferOut(BaseModel):
    id: int
    tx_out_id: int
    tx_in_id: int
    matched_at: datetime
    is_manual: bool
    is_validated: bool
    is_rejected: bool
    tx_out: TransactionOut
    tx_in: TransactionOut

    model_config = {"from_attributes": True}


class ValidateBulkIn(BaseModel):
    ids: list[int]
    validated: bool = True


class RejectBulkIn(BaseModel):
    ids: list[int]
    rejected: bool = True


class InvestmentAssetOut(BaseModel):
    id: int
    ticker: Optional[str] = None
    name: str
    asset_type: AssetTypeEnum
    isin: Optional[str] = None
    alias: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InvestmentAssetCreate(BaseModel):
    ticker: str
    asset_type: AssetTypeEnum
    isin: Optional[str] = None


class InvestmentAssetCreateByIsin(BaseModel):
    isin: str
    alias: Optional[str] = None


class InvestmentAssetUpdate(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    asset_type: Optional[AssetTypeEnum] = None
    isin: Optional[str] = None
    alias: Optional[str] = None


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


class AssetSlimOut(BaseModel):
    id: int
    ticker: Optional[str] = None
    name: str
    isin: Optional[str] = None
    alias: Optional[str] = None

    model_config = {"from_attributes": True}


class TransactionAssetLinkOut(BaseModel):
    id: int
    transaction_id: int
    asset: AssetSlimOut
    is_auto: bool
    is_validated: bool
    is_rejected: bool
    linked_at: datetime

    model_config = {"from_attributes": True}


class InvestmentLinkRow(BaseModel):
    transaction: TransactionOut
    link: Optional[TransactionAssetLinkOut]

    model_config = {"from_attributes": True}


class CreateLinkIn(BaseModel):
    transaction_id: int
    asset_id: int


class LinkBulkIn(BaseModel):
    ids: list[int]  # link IDs (TransactionAssetLink.id)


class FundTransferOut(BaseModel):
    id: int
    from_asset: AssetSlimOut
    to_asset: AssetSlimOut
    withdrawal_date: date
    withdrawal_amount: Decimal
    exit_fee: Decimal
    arrival_date: date
    arrival_amount: Decimal
    entry_fee: Decimal
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class FundTransferCreate(BaseModel):
    from_asset_id: int
    to_asset_id: int
    withdrawal_date: date
    withdrawal_amount: Decimal
    exit_fee: Decimal = Decimal("0")
    arrival_date: date
    arrival_amount: Decimal
    entry_fee: Decimal = Decimal("0")
    notes: Optional[str] = None


class PortfolioHistoryPoint(BaseModel):
    date: date
    value: Decimal
    contributions: Decimal


class IsinLookupResult(BaseModel):
    isin: str
    name: str
    ticker: Optional[str]
    asset_type: str
    found: bool


class PricePoint(BaseModel):
    date: date
    price: Decimal


class AssetPositionOut(BaseModel):
    asset: InvestmentAssetOut
    net_invested: Decimal
    current_price: Optional[Decimal] = None
    current_price_date: Optional[date] = None
    current_value: Optional[Decimal] = None
    pnl: Optional[Decimal] = None
    pnl_pct: Optional[Decimal] = None
    has_prices: bool
    sparkline: list[PricePoint] = []

    model_config = {"from_attributes": True}
