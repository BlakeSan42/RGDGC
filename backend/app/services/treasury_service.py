"""Treasury service — business logic for the club's cash ledger.

All money values use Python's Decimal type (never float).
Entries are immutable — mistakes are corrected by voiding, not deleting.
"""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import LedgerEntry, SeasonSummary
from app.models.league import Event, Result
from app.models.user import User
from app.services.audit_service import log_action


# -- Entry types that represent money coming IN --
INCOME_TYPES = {
    "fee_collected",
    "ctp_collected",
    "ace_fund_collected",
    "merch_sale",
    "donation",
    "other_income",
    "adjustment",  # adjustment can be positive or negative
}

# -- Entry types that represent money going OUT --
EXPENSE_TYPES = {
    "prize_payout",
    "ctp_payout",
    "ace_fund_payout",
    "expense",
    "other_expense",
}

VALID_ENTRY_TYPES = INCOME_TYPES | EXPENSE_TYPES

VALID_PAYMENT_METHODS = {"cash", "venmo", "zelle", "rgdg_token", "other"}


async def record_entry(
    db: AsyncSession,
    *,
    entry_type: str,
    amount: Decimal,
    description: str,
    recorded_by: int,
    event_id: int | None = None,
    player_id: int | None = None,
    payment_method: str = "cash",
    notes: str | None = None,
    admin_ip: str | None = None,
) -> LedgerEntry:
    """Create an immutable ledger entry and log the action."""
    if entry_type not in VALID_ENTRY_TYPES:
        raise ValueError(f"Invalid entry type: {entry_type}")
    if payment_method not in VALID_PAYMENT_METHODS:
        raise ValueError(f"Invalid payment method: {payment_method}")
    if amount == Decimal("0"):
        raise ValueError("Amount cannot be zero")

    entry = LedgerEntry(
        entry_type=entry_type,
        amount=amount,
        description=description,
        event_id=event_id,
        player_id=player_id,
        recorded_by=recorded_by,
        payment_method=payment_method,
        notes=notes,
    )
    db.add(entry)
    await db.flush()

    await log_action(
        db,
        admin_id=recorded_by,
        action="treasury_entry",
        target_type="ledger_entry",
        target_id=str(entry.id),
        details={
            "type": entry_type,
            "amount": str(amount),
            "event_id": event_id,
            "player_id": player_id,
            "payment_method": payment_method,
        },
        ip_address=admin_ip,
    )

    return entry


async def void_entry(
    db: AsyncSession,
    *,
    entry_id: int,
    voided_by: int,
    reason: str,
    admin_ip: str | None = None,
) -> LedgerEntry:
    """Void a ledger entry. Does not delete — marks as voided with reason."""
    entry = await db.get(LedgerEntry, entry_id)
    if not entry:
        raise ValueError("Ledger entry not found")
    if entry.is_voided:
        raise ValueError("Entry is already voided")

    entry.is_voided = True
    entry.voided_by = voided_by
    entry.voided_reason = reason
    await db.flush()

    await log_action(
        db,
        admin_id=voided_by,
        action="treasury_void",
        target_type="ledger_entry",
        target_id=str(entry_id),
        details={"reason": reason, "original_amount": str(entry.amount)},
        ip_address=admin_ip,
    )

    return entry


async def get_balance(db: AsyncSession) -> Decimal:
    """Current treasury balance: sum of all non-voided entries."""
    result = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.is_voided.is_(False)
        )
    )
    return Decimal(str(result.scalar()))


async def get_event_summary(db: AsyncSession, event_id: int) -> dict:
    """Financial summary for a single event."""
    # Verify event exists
    event = await db.get(Event, event_id)
    if not event:
        raise ValueError("Event not found")

    # Aggregate by entry type for this event
    result = await db.execute(
        select(
            LedgerEntry.entry_type,
            func.coalesce(func.sum(LedgerEntry.amount), 0),
            func.count(LedgerEntry.id),
        )
        .where(
            and_(
                LedgerEntry.event_id == event_id,
                LedgerEntry.is_voided.is_(False),
            )
        )
        .group_by(LedgerEntry.entry_type)
    )
    rows = result.all()

    totals = {row[0]: {"amount": Decimal(str(row[1])), "count": row[2]} for row in rows}

    fees = totals.get("fee_collected", {"amount": Decimal("0"), "count": 0})
    prizes = totals.get("prize_payout", {"amount": Decimal("0"), "count": 0})
    ctp_in = totals.get("ctp_collected", {"amount": Decimal("0"), "count": 0})
    ctp_out = totals.get("ctp_payout", {"amount": Decimal("0"), "count": 0})
    ace_in = totals.get("ace_fund_collected", {"amount": Decimal("0"), "count": 0})

    total_in = sum(
        t["amount"] for k, t in totals.items() if t["amount"] > 0
    )
    total_out = sum(
        t["amount"] for k, t in totals.items() if t["amount"] < 0
    )

    # Who paid (list of player IDs with fee_collected entries)
    paid_q = await db.execute(
        select(LedgerEntry.player_id).where(
            and_(
                LedgerEntry.event_id == event_id,
                LedgerEntry.entry_type == "fee_collected",
                LedgerEntry.is_voided.is_(False),
                LedgerEntry.player_id.isnot(None),
            )
        )
    )
    paid_player_ids = [row[0] for row in paid_q.all()]

    return {
        "event_id": event_id,
        "event_name": event.name,
        "event_date": str(event.event_date),
        "fees_collected": str(fees["amount"]),
        "players_paid": fees["count"],
        "prizes_paid": str(abs(prizes["amount"])),
        "ctp_collected": str(ctp_in["amount"]),
        "ctp_paid": str(abs(ctp_out["amount"])),
        "ace_fund_collected": str(ace_in["amount"]),
        "total_in": str(total_in),
        "total_out": str(abs(total_out)),
        "net": str(total_in + total_out),
        "paid_player_ids": paid_player_ids,
    }


async def get_unpaid_players(db: AsyncSession, event_id: int) -> list[dict]:
    """Players checked into an event who have no fee_collected entry."""
    event = await db.get(Event, event_id)
    if not event:
        raise ValueError("Event not found")

    # Players checked in = those with a Result row for this event
    checked_in_q = await db.execute(
        select(Result.user_id).where(Result.event_id == event_id)
    )
    checked_in_ids = {row[0] for row in checked_in_q.all()}

    if not checked_in_ids:
        return []

    # Players who have paid
    paid_q = await db.execute(
        select(LedgerEntry.player_id).where(
            and_(
                LedgerEntry.event_id == event_id,
                LedgerEntry.entry_type == "fee_collected",
                LedgerEntry.is_voided.is_(False),
                LedgerEntry.player_id.isnot(None),
            )
        )
    )
    paid_ids = {row[0] for row in paid_q.all()}

    unpaid_ids = checked_in_ids - paid_ids
    if not unpaid_ids:
        return []

    # Fetch user details for unpaid players
    users_q = await db.execute(
        select(User).where(User.id.in_(unpaid_ids))
    )
    users = users_q.scalars().all()

    return [
        {
            "user_id": u.id,
            "username": u.username,
            "display_name": u.display_name if hasattr(u, "display_name") else u.username,
        }
        for u in users
    ]


async def get_season_summary(
    db: AsyncSession, league_id: int | None = None, season: str | None = None
) -> dict:
    """Aggregate financials for a season, optionally filtered by league."""
    base_filter = [LedgerEntry.is_voided.is_(False)]

    if season:
        # Filter entries by year of creation
        base_filter.append(
            func.extract("year", LedgerEntry.created_at) == int(season)
        )

    if league_id:
        # Only entries linked to events in this league
        base_filter.append(
            LedgerEntry.event_id.in_(
                select(Event.id).where(Event.league_id == league_id)
            )
        )

    result = await db.execute(
        select(
            LedgerEntry.entry_type,
            func.coalesce(func.sum(LedgerEntry.amount), 0),
            func.count(LedgerEntry.id),
        )
        .where(and_(*base_filter))
        .group_by(LedgerEntry.entry_type)
    )
    rows = result.all()

    totals = {row[0]: Decimal(str(row[1])) for row in rows}

    total_collected = sum(v for k, v in totals.items() if v > 0)
    total_out = sum(v for k, v in totals.items() if v < 0)

    # Count distinct events
    event_count_q = await db.execute(
        select(func.count(func.distinct(LedgerEntry.event_id))).where(
            and_(*base_filter, LedgerEntry.event_id.isnot(None))
        )
    )
    events_count = event_count_q.scalar() or 0

    return {
        "season": season,
        "league_id": league_id,
        "total_collected": str(total_collected),
        "total_prizes": str(abs(totals.get("prize_payout", Decimal("0")))),
        "total_ctp": str(totals.get("ctp_collected", Decimal("0"))),
        "total_ace_fund": str(totals.get("ace_fund_collected", Decimal("0"))),
        "total_expenses": str(abs(totals.get("expense", Decimal("0")))),
        "total_out": str(abs(total_out)),
        "balance": str(total_collected + total_out),
        "events_count": events_count,
        "breakdown": {k: str(v) for k, v in totals.items()},
    }


async def get_ledger(
    db: AsyncSession,
    *,
    event_id: int | None = None,
    entry_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[LedgerEntry], int]:
    """Paginated ledger with filters. Returns (entries, total_count)."""
    filters = [LedgerEntry.is_voided.is_(False)]

    if event_id is not None:
        filters.append(LedgerEntry.event_id == event_id)
    if entry_type is not None:
        filters.append(LedgerEntry.entry_type == entry_type)
    if from_date is not None:
        filters.append(LedgerEntry.created_at >= from_date)
    if to_date is not None:
        filters.append(LedgerEntry.created_at <= to_date)

    # Count
    count_q = await db.execute(
        select(func.count(LedgerEntry.id)).where(and_(*filters))
    )
    total = count_q.scalar() or 0

    # Fetch
    entries_q = await db.execute(
        select(LedgerEntry)
        .where(and_(*filters))
        .order_by(LedgerEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = list(entries_q.scalars().all())

    return entries, total
