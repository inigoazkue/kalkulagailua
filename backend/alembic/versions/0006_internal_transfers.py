"""add internal_transfers table

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'internal_transfers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tx_out_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False, unique=True),
        sa.Column('tx_in_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False, unique=True),
        sa.Column('matched_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('is_manual', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_table('internal_transfers')
