"""add disc NFT columns (token_id, tx_hash, is_nft)

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-03-22 18:00:00.000000

Adds NFT-related columns to registered_discs table for on-chain
DiscRegistry integration. All columns are optional/defaulted so
existing discs are unaffected.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "registered_discs",
        sa.Column("token_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registered_discs",
        sa.Column("tx_hash", sa.String(66), nullable=True),
    )
    op.add_column(
        "registered_discs",
        sa.Column("is_nft", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("registered_discs", "is_nft")
    op.drop_column("registered_discs", "tx_hash")
    op.drop_column("registered_discs", "token_id")
