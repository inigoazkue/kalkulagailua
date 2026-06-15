"""add transfer_blocklist table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'transfer_blocklist',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tx_out_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False),
        sa.Column('tx_in_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=False),
        sa.Column('blocked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tx_out_id', 'tx_in_id', name='uq_blocklist_pair'),
    )


def downgrade():
    op.drop_table('transfer_blocklist')
