"""add event_id to rounds

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-03-22 22:00:00.000000

Links rounds directly to events for automatic result creation on round completion.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("rounds", sa.Column("event_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_rounds_event_id",
        "rounds",
        "events",
        ["event_id"],
        ["id"],
    )
    op.create_index("ix_rounds_event_id", "rounds", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_rounds_event_id", table_name="rounds")
    op.drop_constraint("fk_rounds_event_id", "rounds", type_="foreignkey")
    op.drop_column("rounds", "event_id")
