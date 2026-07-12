"""add isin to investment_assets and create investment_keywords, transaction_asset_links

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'investment_assets',
        sa.Column('isin', sa.String(12), nullable=True, unique=True),
    )

    op.create_table(
        'investment_keywords',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('asset_id', sa.Integer(), sa.ForeignKey('investment_assets.id'), nullable=False),
        sa.Column('keyword', sa.String(255), nullable=False),
    )

    op.create_table(
        'transaction_asset_links',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False, unique=True),
        sa.Column('asset_id', sa.Integer(), sa.ForeignKey('investment_assets.id'), nullable=False),
        sa.Column('is_auto', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_validated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_rejected', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('linked_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('transaction_asset_links')
    op.drop_table('investment_keywords')
    op.drop_column('investment_assets', 'isin')
