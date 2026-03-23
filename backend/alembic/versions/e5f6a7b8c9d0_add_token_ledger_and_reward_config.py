"""add token_ledger and reward_config tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-22 14:00:00.000000

Adds token_ledger table for $RGDG loyalty token tracking and
reward_config table for admin-configurable reward amounts.
Seeds default reward configuration.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- token_ledger --
    op.create_table(
        "token_ledger",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tx_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=True),
        sa.Column("related_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("synced_to_chain", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Indexes for common query patterns
    op.create_index("ix_token_ledger_user_id", "token_ledger", ["user_id"])
    op.create_index("ix_token_ledger_tx_type", "token_ledger", ["tx_type"])
    op.create_index("ix_token_ledger_event_id", "token_ledger", ["event_id"])
    op.create_index("ix_token_ledger_created_at", "token_ledger", ["created_at"])
    op.create_index(
        "ix_token_ledger_user_latest",
        "token_ledger",
        ["user_id", "id"],
        postgresql_using="btree",
    )

    # -- reward_config --
    op.create_table(
        "reward_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reward_type", sa.String(30), unique=True, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # -- Seed default reward configs --
    reward_config = sa.table(
        "reward_config",
        sa.column("reward_type", sa.String),
        sa.column("amount", sa.Numeric),
        sa.column("description", sa.String),
    )
    op.bulk_insert(
        reward_config,
        [
            {
                "reward_type": "event_attendance",
                "amount": 10.00,
                "description": "Tokens earned for checking into a league event",
            },
            {
                "reward_type": "event_win",
                "amount": 25.00,
                "description": "Tokens earned for 1st place finish",
            },
            {
                "reward_type": "event_podium",
                "amount": 15.00,
                "description": "Tokens earned for 2nd place finish",
            },
            {
                "reward_type": "event_third",
                "amount": 10.00,
                "description": "Tokens earned for 3rd place finish",
            },
            {
                "reward_type": "disc_return",
                "amount": 50.00,
                "description": "Tokens earned for returning a found disc to its owner",
            },
            {
                "reward_type": "round_completion",
                "amount": 5.00,
                "description": "Tokens earned for completing a scored round",
            },
            {
                "reward_type": "putting_milestone",
                "amount": 20.00,
                "description": "Tokens earned for reaching putting practice milestones",
            },
            {
                "reward_type": "referral",
                "amount": 25.00,
                "description": "Tokens earned for referring a new member",
            },
            {
                "reward_type": "season_bonus",
                "amount": 100.00,
                "description": "Bonus tokens for completing a full season",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("reward_config")

    op.drop_index("ix_token_ledger_user_latest", table_name="token_ledger")
    op.drop_index("ix_token_ledger_created_at", table_name="token_ledger")
    op.drop_index("ix_token_ledger_event_id", table_name="token_ledger")
    op.drop_index("ix_token_ledger_tx_type", table_name="token_ledger")
    op.drop_index("ix_token_ledger_user_id", table_name="token_ledger")
    op.drop_table("token_ledger")
