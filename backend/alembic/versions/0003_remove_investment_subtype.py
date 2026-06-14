"""remove investment from accountsubtypeenum

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    # Convert any existing 'investment' subtype rows to 'savings'
    op.execute("UPDATE accounts SET subtype = 'savings' WHERE subtype = 'investment'")

    # Rename old enum, create new one without 'investment', migrate, drop old
    op.execute("ALTER TYPE accountsubtypeenum RENAME TO accountsubtypeenum_old")
    op.execute("CREATE TYPE accountsubtypeenum AS ENUM ('daily', 'savings', 'crypto')")
    op.execute("""
        ALTER TABLE accounts
        ALTER COLUMN subtype TYPE accountsubtypeenum
        USING subtype::text::accountsubtypeenum
    """)
    op.execute("DROP TYPE accountsubtypeenum_old")


def downgrade():
    op.execute("ALTER TYPE accountsubtypeenum RENAME TO accountsubtypeenum_old")
    op.execute("CREATE TYPE accountsubtypeenum AS ENUM ('daily', 'savings', 'investment', 'crypto')")
    op.execute("""
        ALTER TABLE accounts
        ALTER COLUMN subtype TYPE accountsubtypeenum
        USING subtype::text::accountsubtypeenum
    """)
    op.execute("DROP TYPE accountsubtypeenum_old")
