"""Pydantic schemas for $RGDG token endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Request Bodies ──


class PayEventFee(BaseModel):
    event_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)


class GiftTokens(BaseModel):
    to_user_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    message: str = ""


class AdminGrant(BaseModel):
    user_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    reason: str = Field(min_length=3)


class AdminDeduct(BaseModel):
    user_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)
    reason: str = Field(min_length=3)


class UpdateRewardConfig(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    description: str | None = None


# ── Response Bodies ──


class TokenBalanceOut(BaseModel):
    balance: str
    currency: str = "RGDG"


class TokenEntryOut(BaseModel):
    id: int
    tx_type: str
    amount: str
    balance_after: str
    description: str
    event_id: int | None
    related_user_id: int | None
    tx_hash: str | None
    synced_to_chain: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_entry(cls, entry) -> "TokenEntryOut":
        amt = entry.amount
        return cls(
            id=entry.id,
            tx_type=entry.tx_type,
            amount=f"+{amt}" if amt > 0 else str(amt),
            balance_after=str(entry.balance_after),
            description=entry.description,
            event_id=entry.event_id,
            related_user_id=entry.related_user_id,
            tx_hash=entry.tx_hash,
            synced_to_chain=entry.synced_to_chain,
            created_at=entry.created_at,
        )


class TokenHistoryPage(BaseModel):
    entries: list[TokenEntryOut]
    total: int
    limit: int
    offset: int


class TokenLeaderboardEntry(BaseModel):
    user_id: int
    username: str
    balance: str


class RewardConfigOut(BaseModel):
    reward_type: str
    amount: str
    description: str | None
    is_active: bool
    updated_at: str | None
    source: str  # "database" or "default"


class TokenStatsOut(BaseModel):
    total_minted: str
    total_spent: str
    total_in_circulation: str
    unique_holders: int
    top_earners: list[dict]
