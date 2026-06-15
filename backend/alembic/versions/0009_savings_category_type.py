"""add savings to categorytypeenum

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-15
"""
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE categorytypeenum ADD VALUE IF NOT EXISTS 'savings'")


def downgrade():
    pass  # PostgreSQL cannot remove enum values without recreating the type
