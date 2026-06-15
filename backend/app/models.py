import enum
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey,
    Enum as SAEnum, UniqueConstraint, func
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class BankEnum(str, enum.Enum):
    caixabank = "caixabank"
    myinvestor = "myinvestor"
    trade_republic = "trade_republic"
    bit2me = "bit2me"


class AccountSubtypeEnum(str, enum.Enum):
    daily = "daily"
    savings = "savings"


class CategoryTypeEnum(str, enum.Enum):
    income = "income"
    fixed_expense = "fixed_expense"
    variable_expense = "variable_expense"
    investment = "investment"


class AssetTypeEnum(str, enum.Enum):
    stock = "stock"
    etf = "etf"
    fund = "fund"
    crypto = "crypto"


class InvestmentTransactionTypeEnum(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank: Mapped[BankEnum] = mapped_column(SAEnum(BankEnum), nullable=False)
    subtype: Mapped[AccountSubtypeEnum] = mapped_column(SAEnum(AccountSubtypeEnum), nullable=False, default=AccountSubtypeEnum.daily)
    iban: Mapped[str | None] = mapped_column(String(34), nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#3b82f6")
    include_in_savings: Mapped[bool] = mapped_column(Boolean, default=False)
    show_on_dashboard: Mapped[bool] = mapped_column(Boolean, default=True)
    is_payroll_account: Mapped[bool] = mapped_column(Boolean, default=False)
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    balance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="account")
    investment_transactions: Mapped[list["InvestmentTransaction"]] = relationship(
        "InvestmentTransaction", back_populates="account"
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    balance: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    raw_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    account: Mapped["Account"] = relationship("Account", back_populates="transactions")
    category_assignment: Mapped["TransactionCategory | None"] = relationship(
        "TransactionCategory", back_populates="transaction", uselist=False
    )

    __table_args__ = (UniqueConstraint("account_id", "raw_hash", name="uq_account_hash"),)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_type: Mapped[CategoryTypeEnum] = mapped_column(SAEnum(CategoryTypeEnum), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#6b7280")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    keywords: Mapped[list["CategoryKeyword"]] = relationship(
        "CategoryKeyword", back_populates="category", cascade="all, delete-orphan"
    )
    transaction_assignments: Mapped[list["TransactionCategory"]] = relationship(
        "TransactionCategory", back_populates="category"
    )


class CategoryKeyword(Base):
    __tablename__ = "category_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(255), nullable=False)

    category: Mapped["Category"] = relationship("Category", back_populates="keywords")


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id"), nullable=False, unique=True
    )
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)

    transaction: Mapped["Transaction"] = relationship("Transaction", back_populates="category_assignment")
    category: Mapped["Category"] = relationship("Category", back_populates="transaction_assignments")


class InvestmentAsset(Base):
    __tablename__ = "investment_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticker: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    asset_type: Mapped[AssetTypeEnum] = mapped_column(SAEnum(AssetTypeEnum), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    transactions: Mapped[list["InvestmentTransaction"]] = relationship(
        "InvestmentTransaction", back_populates="asset"
    )
    price_cache: Mapped[list["PriceCache"]] = relationship(
        "PriceCache", back_populates="asset", cascade="all, delete-orphan"
    )


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("investment_assets.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    fees: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    transaction_type: Mapped[InvestmentTransactionTypeEnum] = mapped_column(
        SAEnum(InvestmentTransactionTypeEnum), nullable=False
    )

    asset: Mapped["InvestmentAsset"] = relationship("InvestmentAsset", back_populates="transactions")
    account: Mapped["Account"] = relationship("Account", back_populates="investment_transactions")


class InternalTransfer(Base):
    __tablename__ = "internal_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tx_out_id: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False, unique=True)
    tx_in_id: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False, unique=True)
    matched_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)

    tx_out: Mapped["Transaction"] = relationship("Transaction", foreign_keys=[tx_out_id])
    tx_in: Mapped["Transaction"] = relationship("Transaction", foreign_keys=[tx_in_id])


class PriceCache(Base):
    __tablename__ = "price_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("investment_assets.id"), nullable=False)
    price_date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    asset: Mapped["InvestmentAsset"] = relationship("InvestmentAsset", back_populates="price_cache")

    __table_args__ = (UniqueConstraint("asset_id", "price_date", name="uq_asset_price_date"),)
