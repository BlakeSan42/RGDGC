"""add ledger_entries and season_summaries tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-22 23:30:00.000000

Adds ledger_entries table for double-entry cash accounting and
season_summaries table for cached season-level financial summaries.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entry_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=True),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("recorded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("payment_method", sa.String(20), server_default="cash"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_voided", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("voided_by", sa.Integer(), nullable=True),
        sa.Column("voided_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Indexes for common query patterns
    op.create_index("ix_ledger_entries_event_id", "ledger_entries", ["event_id"])
    op.create_index("ix_ledger_entries_player_id", "ledger_entries", ["player_id"])
    op.create_index("ix_ledger_entries_entry_type", "ledger_entries", ["entry_type"])
    op.create_index("ix_ledger_entries_created_at", "ledger_entries", ["created_at"])
    op.create_index(
        "ix_ledger_entries_not_voided",
        "ledger_entries",
        ["is_voided"],
        postgresql_where=sa.text("is_voided = false"),
    )

    op.create_table(
        "season_summaries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("league_id", sa.Integer(), sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("season", sa.String(10), nullable=False),
        sa.Column("total_collected", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total_prizes", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total_expenses", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total_ctp", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total_ace_fund", sa.Numeric(10, 2), server_default="0"),
        sa.Column("balance", sa.Numeric(10, 2), server_default="0"),
        sa.Column("events_count", sa.Integer(), server_default="0"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index(
        "ix_season_summaries_league_season",
        "season_summaries",
        ["league_id", "season"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_season_summaries_league_season", table_name="season_summaries")
    op.drop_table("season_summaries")

    op.drop_index("ix_ledger_entries_not_voided", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_created_at", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_entry_type", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_player_id", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_event_id", table_name="ledger_entries")
    op.drop_table("ledger_entries")
