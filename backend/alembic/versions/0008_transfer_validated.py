"""add is_validated to internal_transfers

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'internal_transfers',
        sa.Column('is_validated', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('internal_transfers', 'is_validated')
