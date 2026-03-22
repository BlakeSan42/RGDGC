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


class VoidEntry(BaseModel):
    reason: str = Field(min_length=3)


# ── Response Bodies ──


class LedgerEntryOut(BaseModel):
    id: int
    entry_type: str
    amount: str  # formatted as string for safe JSON transport
    description: str
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
