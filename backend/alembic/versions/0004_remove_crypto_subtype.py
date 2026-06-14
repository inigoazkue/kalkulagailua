"""remove crypto from accountsubtypeenum

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE accounts ALTER COLUMN subtype DROP DEFAULT")
    op.execute("UPDATE accounts SET subtype = 'savings' WHERE subtype = 'crypto'")
    op.execute("ALTER TYPE accountsubtypeenum RENAME TO accountsubtypeenum_old")
    op.execute("CREATE TYPE accountsubtypeenum AS ENUM ('daily', 'savings')")
    op.execute("""
        ALTER TABLE accounts
        ALTER COLUMN subtype TYPE accountsubtypeenum
        USING subtype::text::accountsubtypeenum
    """)
    op.execute("ALTER TABLE accounts ALTER COLUMN subtype SET DEFAULT 'daily'::accountsubtypeenum")
    op.execute("DROP TYPE accountsubtypeenum_old")


def downgrade():
    op.execute("ALTER TABLE accounts ALTER COLUMN subtype DROP DEFAULT")
    op.execute("ALTER TYPE accountsubtypeenum RENAME TO accountsubtypeenum_old")
    op.execute("CREATE TYPE accountsubtypeenum AS ENUM ('daily', 'savings', 'crypto')")
    op.execute("""
        ALTER TABLE accounts
        ALTER COLUMN subtype TYPE accountsubtypeenum
        USING subtype::text::accountsubtypeenum
    """)
    op.execute("ALTER TABLE accounts ALTER COLUMN subtype SET DEFAULT 'daily'::accountsubtypeenum")
    op.execute("DROP TYPE accountsubtypeenum_old")
