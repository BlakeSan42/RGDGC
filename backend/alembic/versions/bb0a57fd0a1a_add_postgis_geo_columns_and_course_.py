"""add postgis geo columns and course features

Revision ID: bb0a57fd0a1a
Revises: 34ac9bf1c5f8
Create Date: 2026-03-22 14:00:14.417393

NOTE: Geo columns and course_features table are now created in the initial
migration (474298be8931). This migration is kept as a no-op to preserve the
chain.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'bb0a57fd0a1a'
down_revision: Union[str, None] = '34ac9bf1c5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
