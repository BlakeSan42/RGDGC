"""Pydantic schemas for treasury / cash ledger endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Request Bodies ──


class CollectFee(BaseModel):
    event_id: int
    player_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    payment_method: str = "cash"


class CollectBulk(BaseModel):
    event_id: int
    player_ids: list[int] = Field(min_length=1)
    amount_per_player: Decimal = Field(gt=0, decimal_places=2)
    payment_method: str = "cash"


class CollectCTP(BaseModel):
    event_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    description: str = "CTP pot"


class PayoutPrize(BaseModel):
    event_id: int
    player_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    position: int | None = None
    description: str = "Prize payout"


class PayoutCTP(BaseModel):
    event_id: int
    player_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    description: str = "CTP winner"


class RecordExpense(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    description: str
    notes: str | None = None
    event_id: int | None = None
    category: str | None = None  # baskets, tee_pads, supplies, permits, insurance, merch_cost, marketing, other


class VoidEntry(BaseModel):
    reason: str = Field(min_length=3)


# ── Response Bodies ──


class LedgerEntryOut(BaseModel):
    id: int
    entry_type: str
    amount: str  # formatted as string for safe JSON transport
    description: str
    category: str | None
    event_id: int | None
    player_id: int | None
    recorded_by: int
    payment_method: str
    notes: str | None
    is_voided: bool
    voided_by: int | None
    voided_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_entry(cls, entry) -> "LedgerEntryOut":
        return cls(
            id=entry.id,
            entry_type=entry.entry_type,
            amount=f"${abs(entry.amount):.2f}" if entry.amount >= 0 else f"-${abs(entry.amount):.2f}",
            description=entry.description,
            category=entry.category,
            event_id=entry.event_id,
            player_id=entry.player_id,
            recorded_by=entry.recorded_by,
            payment_method=entry.payment_method,
            notes=entry.notes,
            is_voided=entry.is_voided,
            voided_by=entry.voided_by,
            voided_reason=entry.voided_reason,
            created_at=entry.created_at,
        )


class BalanceOut(BaseModel):
    balance: str
    as_of: datetime


class EventSummaryOut(BaseModel):
    event_id: int
    event_name: str | None
    event_date: str
    fees_collected: str
    players_paid: int
    prizes_paid: str
    ctp_collected: str
    ctp_paid: str
    ace_fund_collected: str
    total_in: str
    total_out: str
    net: str
    paid_player_ids: list[int]


class UnpaidPlayer(BaseModel):
    user_id: int
    username: str
    display_name: str | None


class LedgerPage(BaseModel):
    entries: list[LedgerEntryOut]
    total: int
    limit: int
    offset: int


# ── Budget ──


class SetBudget(BaseModel):
    league_id: int | None = None
    season: str = Field(pattern=r"^\d{4}$")
    category: str
    budgeted_amount: Decimal = Field(gt=0, decimal_places=2)
    notes: str | None = None


class BudgetOut(BaseModel):
    id: int
    league_id: int | None
    season: str
    category: str
    budgeted_amount: str
    notes: str | None

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, b) -> "BudgetOut":
        return cls(
            id=b.id,
            league_id=b.league_id,
            season=b.season,
            category=b.category,
            budgeted_amount=str(b.budgeted_amount),
            notes=b.notes,
        )


class BudgetVsActualRow(BaseModel):
    category: str
    budgeted: str
    actual: str
    remaining: str
    pct_used: float | None
    notes: str | None


class CategoryExpense(BaseModel):
    category: str
    total: str
    count: int


class PlayerBalance(BaseModel):
    player_id: int
    username: str | None
    total_paid_in: str
    total_received: str
    net: str


class PrizeValidation(BaseModel):
    event_id: int
    event_name: str | None
    total_fees_collected: str
    total_prizes_paid: str
    surplus: str
    prizes_exceed_fees: bool
    prize_count: int
    results_count: int
    issues: list[str]
    valid: bool
