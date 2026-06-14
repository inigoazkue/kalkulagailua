"""account improvements: subtype, iban, balance, color, flags

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    subtype_enum = sa.Enum('daily', 'savings', 'investment', 'crypto', name='accountsubtypeenum')
    subtype_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('accounts', sa.Column('subtype', subtype_enum, nullable=False, server_default='daily'))
    op.add_column('accounts', sa.Column('iban', sa.String(34), nullable=True))
    op.add_column('accounts', sa.Column('color', sa.String(7), nullable=False, server_default='#3b82f6'))
    op.add_column('accounts', sa.Column('include_in_savings', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('accounts', sa.Column('show_on_dashboard', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('accounts', sa.Column('current_balance', sa.Numeric(18, 4), nullable=True))
    op.add_column('accounts', sa.Column('balance_date', sa.Date(), nullable=True))
    op.drop_column('accounts', 'account_type')

    try:
        op.execute("DROP TYPE IF EXISTS accounttypeenum")
    except Exception:
        pass


def downgrade():
    account_type_enum = sa.Enum('bank', 'broker', 'crypto', name='accounttypeenum')
    account_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('accounts', sa.Column('account_type', account_type_enum, nullable=False, server_default='bank'))
    op.drop_column('accounts', 'balance_date')
    op.drop_column('accounts', 'current_balance')
    op.drop_column('accounts', 'show_on_dashboard')
    op.drop_column('accounts', 'include_in_savings')
    op.drop_column('accounts', 'color')
    op.drop_column('accounts', 'iban')
    op.drop_column('accounts', 'subtype')
    op.execute("DROP TYPE IF EXISTS accountsubtypeenum")
