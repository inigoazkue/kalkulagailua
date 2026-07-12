"""investments v2: ticker nullable, alias, data migration ISIN, quantity on links, fund_transfers

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    # Make ticker nullable
    op.alter_column('investment_assets', 'ticker', nullable=True)

    # Add alias column
    op.add_column(
        'investment_assets',
        sa.Column('alias', sa.String(255), nullable=True),
    )

    # Data migration: move ISINs from ticker field to isin field
    op.execute(
        "UPDATE investment_assets SET isin = ticker "
        "WHERE ticker ~ '^[A-Z]{2}[A-Z0-9]{10}$' AND isin IS NULL"
    )
    op.execute(
        "UPDATE investment_assets SET ticker = NULL "
        "WHERE isin IS NOT NULL AND ticker = isin"
    )

    # Add quantity to transaction_asset_links
    op.add_column(
        'transaction_asset_links',
        sa.Column('quantity', sa.Numeric(24, 8), nullable=True),
    )

    # Create fund_transfers table
    op.create_table(
        'fund_transfers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('from_asset_id', sa.Integer(), sa.ForeignKey('investment_assets.id'), nullable=False),
        sa.Column('to_asset_id', sa.Integer(), sa.ForeignKey('investment_assets.id'), nullable=False),
        sa.Column('withdrawal_date', sa.Date(), nullable=False),
        sa.Column('withdrawal_amount', sa.Numeric(18, 4), nullable=False),
        sa.Column('exit_fee', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('arrival_date', sa.Date(), nullable=False),
        sa.Column('arrival_amount', sa.Numeric(18, 4), nullable=False),
        sa.Column('entry_fee', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('fund_transfers')
    op.drop_column('transaction_asset_links', 'quantity')
    op.drop_column('investment_assets', 'alias')
    op.alter_column('investment_assets', 'ticker', nullable=False)
