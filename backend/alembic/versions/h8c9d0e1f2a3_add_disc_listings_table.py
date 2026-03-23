"""add disc_listings table for marketplace

Revision ID: h8c9d0e1f2a3
Revises: a1b2c3d4e5f6
Create Date: 2026-03-22 20:00:00.000000

Creates the disc_listings table for the Level 3 disc marketplace feature.
Supports USD cash, $RGDG token, and trade payment methods.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "h8c9d0e1f2a3"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "disc_listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("disc_id", sa.Integer(), sa.ForeignKey("registered_discs.id"), nullable=False),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        # Pricing
        sa.Column("price_usd", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_rgdg", sa.Numeric(12, 2), nullable=True),
        sa.Column("accepts_cash", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("accepts_rgdg", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("accepts_trade", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        # Details
        sa.Column("condition", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("photos", sa.JSON(), nullable=True),
        # Status
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        # Sale details
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sold_at", sa.DateTime(), nullable=True),
        sa.Column("sold_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("sold_currency", sa.String(10), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Indexes for common queries
    op.create_index("ix_disc_listings_status", "disc_listings", ["status"])
    op.create_index("ix_disc_listings_seller_id", "disc_listings", ["seller_id"])
    op.create_index("ix_disc_listings_disc_id", "disc_listings", ["disc_id"])
    op.create_index("ix_disc_listings_buyer_id", "disc_listings", ["buyer_id"])
    op.create_index("ix_disc_listings_created_at", "disc_listings", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_disc_listings_created_at")
    op.drop_index("ix_disc_listings_buyer_id")
    op.drop_index("ix_disc_listings_disc_id")
    op.drop_index("ix_disc_listings_seller_id")
    op.drop_index("ix_disc_listings_status")
    op.drop_table("disc_listings")
