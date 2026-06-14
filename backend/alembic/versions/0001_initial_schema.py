"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('bank', sa.Enum('caixabank', 'myinvestor', 'trade_republic', 'bit2me', name='bankenum'), nullable=False),
        sa.Column('account_type', sa.Enum('bank', 'broker', 'crypto', name='accounttypeenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_accounts_id', 'accounts', ['id'])

    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category_type', sa.Enum('income', 'fixed_expense', 'variable_expense', 'investment', name='categorytypeenum'), nullable=False),
        sa.Column('color', sa.String(7), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_categories_id', 'categories', ['id'])

    op.create_table(
        'investment_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticker', sa.String(50), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('asset_type', sa.Enum('stock', 'etf', 'fund', 'crypto', name='assettypeenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticker'),
    )
    op.create_index('ix_investment_assets_id', 'investment_assets', ['id'])

    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(1000), nullable=False),
        sa.Column('amount', sa.Numeric(18, 4), nullable=False),
        sa.Column('balance', sa.Numeric(18, 4), nullable=True),
        sa.Column('raw_hash', sa.String(64), nullable=False),
        sa.Column('imported_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'raw_hash', name='uq_account_hash'),
    )
    op.create_index('ix_transactions_id', 'transactions', ['id'])
    op.create_index('ix_transactions_raw_hash', 'transactions', ['raw_hash'])

    op.create_table(
        'category_keywords',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('keyword', sa.String(255), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_category_keywords_id', 'category_keywords', ['id'])

    op.create_table(
        'transaction_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('is_manual', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id'),
    )
    op.create_index('ix_transaction_categories_id', 'transaction_categories', ['id'])

    op.create_table(
        'investment_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('quantity', sa.Numeric(24, 8), nullable=False),
        sa.Column('price_per_unit', sa.Numeric(18, 4), nullable=False),
        sa.Column('fees', sa.Numeric(18, 4), nullable=False),
        sa.Column('transaction_type', sa.Enum('buy', 'sell', name='investmenttransactiontypeenum'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['asset_id'], ['investment_assets.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_investment_transactions_id', 'investment_transactions', ['id'])

    op.create_table(
        'price_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('price_date', sa.Date(), nullable=False),
        sa.Column('price', sa.Numeric(18, 4), nullable=False),
        sa.Column('cached_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['investment_assets.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_id', 'price_date', name='uq_asset_price_date'),
    )
    op.create_index('ix_price_cache_id', 'price_cache', ['id'])


def downgrade() -> None:
    op.drop_table('price_cache')
    op.drop_table('investment_transactions')
    op.drop_table('transaction_categories')
    op.drop_table('category_keywords')
    op.drop_table('transactions')
    op.drop_table('investment_assets')
    op.drop_table('categories')
    op.drop_table('accounts')
    op.execute("DROP TYPE IF EXISTS bankenum")
    op.execute("DROP TYPE IF EXISTS accounttypeenum")
    op.execute("DROP TYPE IF EXISTS categorytypeenum")
    op.execute("DROP TYPE IF EXISTS assettypeenum")
    op.execute("DROP TYPE IF EXISTS investmenttransactiontypeenum")
