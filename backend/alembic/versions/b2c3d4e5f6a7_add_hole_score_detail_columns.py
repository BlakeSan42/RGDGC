"""add hole score detail columns

Revision ID: b2c3d4e5f6a7
Revises: a7b8c9d0e1f2
Create Date: 2026-03-22 22:00:00.000000

Adds disc_used, circle_hit, scramble, drive_distance to hole_scores.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hole_scores", sa.Column("disc_used", sa.String(100), nullable=True))
    op.add_column("hole_scores", sa.Column("circle_hit", sa.String(10), nullable=True))
    op.add_column("hole_scores", sa.Column("scramble", sa.Boolean(), nullable=True))
    op.add_column("hole_scores", sa.Column("drive_distance", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("hole_scores", "drive_distance")
    op.drop_column("hole_scores", "scramble")
    op.drop_column("hole_scores", "circle_hit")
    op.drop_column("hole_scores", "disc_used")
