from decimal import Decimal
from datetime import datetime

from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, Boolean, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

# Valid expense categories for the category field
EXPENSE_CATEGORIES = {
    "baskets", "tee_pads", "supplies", "permits",
    "insurance", "merch_cost", "marketing", "other",
}


class LedgerEntry(Base):
    """Every dollar in or out of the club treasury."""

    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # What happened
    entry_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Types: fee_collected, prize_payout, ctp_collected, ctp_payout,
    #        ace_fund_collected, ace_fund_payout, expense, adjustment,
    #        merch_sale, donation, other_income, other_expense

    # Money (positive = money in, negative = money out)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Context
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Expense category (nullable for backward compat)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # baskets, tee_pads, supplies, permits, insurance, merch_cost, marketing, other

    # Payment method
    payment_method: Mapped[str] = mapped_column(String(20), default="cash")
    # cash, venmo, zelle, rgdg_token, other

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text)
    is_voided: Mapped[bool] = mapped_column(Boolean, default=False)
    voided_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    voided_reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships (lazy="noload" prevents async greenlet errors)
    event = relationship("Event", foreign_keys=[event_id], lazy="noload")
    player = relationship("User", foreign_keys=[player_id], lazy="noload")
    recorder = relationship("User", foreign_keys=[recorded_by], lazy="noload")


class SeasonSummary(Base):
    """Cached season-level financial summary."""

    __tablename__ = "season_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    season: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026"

    total_collected: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_prizes: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_expenses: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_ctp: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_ace_fund: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    balance: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    events_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class Budget(Base):
    """Budget targets per category per season."""

    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("league_id", "season", "category", name="uq_budget_league_season_cat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int | None] = mapped_column(ForeignKey("leagues.id"), nullable=True)
    season: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026"
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    budgeted_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
