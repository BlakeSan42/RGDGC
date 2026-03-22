"""Add round_groups table, share_code and group_id to rounds

Revision ID: f1a2b3c4d5e6
Revises: e9a3b5c72d1f
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "e9a3b5c72d1f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create round_groups table
    op.create_table(
        "round_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("layout_id", sa.Integer(), sa.ForeignKey("layouts.id"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Add share_code column to rounds
    op.add_column("rounds", sa.Column("share_code", sa.String(20), nullable=True))
    op.create_unique_constraint("uq_rounds_share_code", "rounds", ["share_code"])
    op.create_index("ix_rounds_share_code", "rounds", ["share_code"])

    # Add group_id column to rounds
    op.add_column("rounds", sa.Column("group_id", sa.Integer(), sa.ForeignKey("round_groups.id"), nullable=True))
    op.create_index("ix_rounds_group_id", "rounds", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_rounds_group_id", table_name="rounds")
    op.drop_column("rounds", "group_id")
    op.drop_index("ix_rounds_share_code", table_name="rounds")
    op.drop_constraint("uq_rounds_share_code", "rounds", type_="unique")
    op.drop_column("rounds", "share_code")
    op.drop_table("round_groups")
