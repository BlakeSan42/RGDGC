"""SQLAlchemy model for the disc marketplace (Level 3)."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class DiscListing(Base):
    """A disc listed for sale on the RGDGC marketplace.

    Supports three payment methods:
    - USD cash (arranged offline between buyer and seller)
    - $RGDG tokens (deducted/credited through the token ledger)
    - Trade (in-person disc swap, arranged offline)

    If the disc is an NFT, on-chain transfer happens automatically on purchase.
    """

    __tablename__ = "disc_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disc_id: Mapped[int] = mapped_column(ForeignKey("registered_discs.id"), nullable=False)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Pricing
    price_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_rgdg: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    accepts_cash: Mapped[bool] = mapped_column(Boolean, default=True)
    accepts_rgdg: Mapped[bool] = mapped_column(Boolean, default=True)
    accepts_trade: Mapped[bool] = mapped_column(Boolean, default=False)

    # Listing details
    condition: Mapped[str] = mapped_column(String(20))  # new, like_new, good, fair, beat
    description: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[list | None] = mapped_column(JSON)  # list of photo URLs

    # Status: active, sold, cancelled, expired
    status: Mapped[str] = mapped_column(String(20), default="active")

    # Sale details (populated when sold)
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sold_at: Mapped[datetime | None] = mapped_column(DateTime)
    sold_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    sold_currency: Mapped[str | None] = mapped_column(String(10))  # usd, rgdg, trade

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships (lazy="noload" for async compatibility)
    disc = relationship("RegisteredDisc", lazy="noload")
    seller = relationship("User", foreign_keys=[seller_id], lazy="noload")
    buyer = relationship("User", foreign_keys=[buyer_id], lazy="noload")
