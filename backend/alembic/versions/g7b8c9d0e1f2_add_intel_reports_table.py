"""add intel_reports table

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-22 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "intel_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_date", sa.Date(), nullable=False, index=True),
        sa.Column("category", sa.String(30), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("key_findings", sa.Text(), nullable=True),
        sa.Column("sources", sa.Text(), nullable=True),
        sa.Column("search_queries", sa.Text(), nullable=True),
        sa.Column("sentiment", sa.String(20), server_default="neutral"),
        sa.Column("relevance_score", sa.Float(), server_default="0.5"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    # Composite index for common query pattern: filter by category + date range
    op.create_index(
        "ix_intel_reports_category_date",
        "intel_reports",
        ["category", "report_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_intel_reports_category_date", table_name="intel_reports")
    op.drop_table("intel_reports")
