"""add blocked_from_auto_categorize to transactions

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'transactions',
        sa.Column('blocked_from_auto_categorize', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('transactions', 'blocked_from_auto_categorize')
