"""add social auth fields

Revision ID: c7e3a1d92f4b
Revises: bb0a57fd0a1a
Create Date: 2026-03-22 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c7e3a1d92f4b'
down_revision: Union[str, None] = 'bb0a57fd0a1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('auth_provider', sa.String(20), nullable=False, server_default='email'),
    )
    op.add_column(
        'users',
        sa.Column('google_id', sa.String(255), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('apple_id', sa.String(255), nullable=True),
    )
    op.create_unique_constraint('uq_users_google_id', 'users', ['google_id'])
    op.create_unique_constraint('uq_users_apple_id', 'users', ['apple_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_apple_id', 'users', type_='unique')
    op.drop_constraint('uq_users_google_id', 'users', type_='unique')
    op.drop_column('users', 'apple_id')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'auth_provider')
