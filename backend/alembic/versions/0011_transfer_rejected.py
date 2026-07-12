"""add is_rejected to internal_transfers

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'internal_transfers',
        sa.Column('is_rejected', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('internal_transfers', 'is_rejected')
