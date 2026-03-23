"""add budget table and category column to ledger_entries

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-22 16:00:00.000000

Adds:
- category column to ledger_entries (nullable, for expense categorization)
- budgets table for season budget tracking per category
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add category column to ledger_entries
    op.add_column(
        "ledger_entries",
        sa.Column("category", sa.String(30), nullable=True),
    )

    # Create budgets table
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("league_id", sa.Integer(), sa.ForeignKey("leagues.id"), nullable=True),
        sa.Column("season", sa.String(10), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("budgeted_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("league_id", "season", "category", name="uq_budget_league_season_cat"),
    )


def downgrade() -> None:
    op.drop_table("budgets")
    op.drop_column("ledger_entries", "category")
