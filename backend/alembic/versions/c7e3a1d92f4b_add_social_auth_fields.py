"""add social auth fields

Revision ID: c7e3a1d92f4b
Revises: bb0a57fd0a1a
Create Date: 2026-03-22 16:00:00.000000

NOTE: Social auth fields (auth_provider, google_id, apple_id) are now created
in the initial migration (474298be8931). This migration is kept as a no-op to
preserve the chain.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c7e3a1d92f4b'
down_revision: Union[str, None] = 'bb0a57fd0a1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
