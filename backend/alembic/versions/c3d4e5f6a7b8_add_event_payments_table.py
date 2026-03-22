"""add event_payments table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-22 23:00:00.000000

Adds event_payments table for Stripe payment tracking.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="usd", nullable=False),
        sa.Column("stripe_session_id", sa.String(255), unique=True, nullable=True),
        sa.Column("stripe_payment_intent", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_payment_user"),
    )
    op.create_index("ix_event_payments_user_id", "event_payments", ["user_id"])
    op.create_index("ix_event_payments_event_id", "event_payments", ["event_id"])
    op.create_index("ix_event_payments_status", "event_payments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_event_payments_status", table_name="event_payments")
    op.drop_index("ix_event_payments_event_id", table_name="event_payments")
    op.drop_index("ix_event_payments_user_id", table_name="event_payments")
    op.drop_table("event_payments")
