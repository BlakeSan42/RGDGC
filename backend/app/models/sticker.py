"""SQLAlchemy models for sticker batch generation and inventory tracking."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class StickerOrderStatus(str, Enum):
    GENERATING = "generating"
    PENDING = "pending"
    PRINTED = "printed"
    DISTRIBUTED = "distributed"


class StickerInventoryStatus(str, Enum):
    AVAILABLE = "available"
    DISTRIBUTED = "distributed"
    CLAIMED = "claimed"
    VOID = "void"


class StickerOrder(Base):
    """A batch order of sticker codes for printing."""

    __tablename__ = "sticker_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    batch_name: Mapped[str] = mapped_column(String(100), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), default="bulk")  # bulk, single
    status: Mapped[str] = mapped_column(String(20), default=StickerOrderStatus.PENDING.value)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    start_code: Mapped[str | None] = mapped_column(String(20))
    end_code: Mapped[str | None] = mapped_column(String(20))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    created_by = relationship("User", backref="sticker_orders")
    stickers = relationship("StickerInventory", back_populates="order", order_by="StickerInventory.disc_code")


class StickerInventory(Base):
    """Individual sticker code in inventory — tracks lifecycle from generation to claim."""

    __tablename__ = "sticker_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sticker_orders.id"), nullable=False)
    disc_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    qr_url: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=StickerInventoryStatus.AVAILABLE.value)
    claimed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    order = relationship("StickerOrder", back_populates="stickers")
    claimed_by = relationship("User", backref="claimed_stickers")
