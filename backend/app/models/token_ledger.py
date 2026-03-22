"""$RGDG token ledger — every token movement is an immutable entry.

Token balances are tracked in the database (not on-chain). The tx_hash and
synced_to_chain fields are reserved for Phase 2 blockchain bridge.
"""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class TokenLedger(Base):
    """Every $RGDG token movement."""

    __tablename__ = "token_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # What happened
    tx_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # EARNING: event_attendance, event_win, event_podium, disc_return,
    #          putting_milestone, round_completion, referral, season_bonus, admin_grant
    # SPENDING: event_fee, merch_purchase, side_pot, gift_sent, admin_deduct
    # RECEIVING: gift_received

    # Positive = tokens in, Negative = tokens out
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Running balance after this transaction
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    description: Mapped[str] = mapped_column(String(255), nullable=False)

    # Context (optional)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)
    related_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # For gifts: who sent/received. For disc return: whose disc.

    # Future blockchain bridge
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    synced_to_chain: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    related_user = relationship("User", foreign_keys=[related_user_id])
    event = relationship("Event", foreign_keys=[event_id])


class RewardConfig(Base):
    """Admin-configurable reward amounts."""

    __tablename__ = "reward_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reward_type: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
