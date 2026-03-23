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
    category: str | None = None,
    admin_ip: str | None = None,
) -> LedgerEntry:
    """Create an immutable ledger entry and log the action."""
    if entry_type not in VALID_ENTRY_TYPES:
        raise ValueError(f"Invalid entry type: {entry_type}")
    if payment_method not in VALID_PAYMENT_METHODS:
        raise ValueError(f"Invalid payment method: {payment_method}")
    if amount == Decimal("0"):
        raise ValueError("Amount cannot be zero")
    if category is not None:
        from app.models.ledger import EXPENSE_CATEGORIES
        if category not in EXPENSE_CATEGORIES:
            raise ValueError(f"Invalid category: {category}")

    entry = LedgerEntry(
        entry_type=entry_type,
        amount=amount,
        description=description,
        event_id=event_id,
        player_id=player_id,
        recorded_by=recorded_by,
        payment_method=payment_method,
        notes=notes,
        category=category,
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


# ---------------------------------------------------------------------------
# Expenses by Category
# ---------------------------------------------------------------------------


async def get_expenses_by_category(
    db: AsyncSession,
    season: str | None = None,
) -> list[dict]:
    """Group expense entries by category with totals."""
    filters = [
        LedgerEntry.is_voided.is_(False),
        LedgerEntry.amount < 0,  # expenses are negative
    ]

    if season:
        filters.append(
            func.extract("year", LedgerEntry.created_at) == int(season)
        )

    cat_col = func.coalesce(LedgerEntry.category, "uncategorized").label("cat")
    result = await db.execute(
        select(
            cat_col,
            func.sum(LedgerEntry.amount),
            func.count(LedgerEntry.id),
        )
        .where(and_(*filters))
        .group_by(cat_col)
        .order_by(func.sum(LedgerEntry.amount))
    )
    rows = result.all()

    return [
        {
            "category": row[0],
            "total": str(abs(Decimal(str(row[1])))),
            "count": row[2],
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Budget Tracking
# ---------------------------------------------------------------------------


async def set_budget(
    db: AsyncSession,
    *,
    league_id: int | None,
    season: str,
    category: str,
    budgeted_amount: Decimal,
    notes: str | None = None,
) -> "Budget":
    """Create or update a budget line for a category/season."""
    from app.models.ledger import Budget, EXPENSE_CATEGORIES

    if category not in EXPENSE_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")

    # Upsert: check if exists
    existing = await db.execute(
        select(Budget).where(
            and_(
                Budget.league_id == league_id if league_id else Budget.league_id.is_(None),
                Budget.season == season,
                Budget.category == category,
            )
        )
    )
    budget = existing.scalar_one_or_none()

    if budget:
        budget.budgeted_amount = budgeted_amount
        budget.notes = notes
    else:
        budget = Budget(
            league_id=league_id,
            season=season,
            category=category,
            budgeted_amount=budgeted_amount,
            notes=notes,
        )
        db.add(budget)

    await db.flush()
    return budget


async def get_budget_vs_actual(
    db: AsyncSession,
    season: str,
    league_id: int | None = None,
) -> list[dict]:
    """Compare budgeted amounts vs actual spending per category."""
    from app.models.ledger import Budget, EXPENSE_CATEGORIES

    # Get budgets for this season
    budget_filters = [Budget.season == season]
    if league_id:
        budget_filters.append(Budget.league_id == league_id)
    else:
        budget_filters.append(Budget.league_id.is_(None))

    budget_q = await db.execute(
        select(Budget).where(and_(*budget_filters))
    )
    budgets = {b.category: b for b in budget_q.scalars().all()}

    # Get actual expenses grouped by category for this season
    expense_filters = [
        LedgerEntry.is_voided.is_(False),
        LedgerEntry.amount < 0,
        func.extract("year", LedgerEntry.created_at) == int(season),
    ]

    cat_col2 = func.coalesce(LedgerEntry.category, "uncategorized").label("cat")
    actual_q = await db.execute(
        select(
            cat_col2,
            func.sum(LedgerEntry.amount),
        )
        .where(and_(*expense_filters))
        .group_by(cat_col2)
    )
    actuals = {row[0]: abs(Decimal(str(row[1]))) for row in actual_q.all()}

    # Merge: all categories that have either a budget or actual spending
    all_cats = set(budgets.keys()) | set(actuals.keys())
    rows = []
    for cat in sorted(all_cats):
        budgeted = budgets.get(cat)
        budgeted_amt = budgeted.budgeted_amount if budgeted else Decimal("0")
        actual_amt = actuals.get(cat, Decimal("0"))
        remaining = budgeted_amt - actual_amt

        rows.append({
            "category": cat,
            "budgeted": str(budgeted_amt),
            "actual": str(actual_amt),
            "remaining": str(remaining),
            "pct_used": round(float(actual_amt / budgeted_amt * 100), 1) if budgeted_amt > 0 else None,
            "notes": budgeted.notes if budgeted else None,
        })

    return rows


# ---------------------------------------------------------------------------
# Player Account Balances
# ---------------------------------------------------------------------------


async def get_player_balances(db: AsyncSession) -> list[dict]:
    """Net position per player: fees paid minus prizes received.

    Positive = player has paid more than received (club owes nothing).
    Negative = club owes the player.
    """
    # Sum all non-voided entries grouped by player_id
    result = await db.execute(
        select(
            LedgerEntry.player_id,
            func.sum(LedgerEntry.amount),
            func.sum(case(
                (LedgerEntry.amount > 0, LedgerEntry.amount),
                else_=Decimal("0"),
            )),
            func.sum(case(
                (LedgerEntry.amount < 0, LedgerEntry.amount),
                else_=Decimal("0"),
            )),
        )
        .where(
            and_(
                LedgerEntry.is_voided.is_(False),
                LedgerEntry.player_id.isnot(None),
            )
        )
        .group_by(LedgerEntry.player_id)
        .order_by(func.sum(LedgerEntry.amount).desc())
    )
    rows = result.all()

    if not rows:
        return []

    # Fetch usernames
    player_ids = [row[0] for row in rows]
    users_q = await db.execute(select(User).where(User.id.in_(player_ids)))
    users_map = {u.id: u for u in users_q.scalars().all()}

    return [
        {
            "player_id": row[0],
            "username": users_map[row[0]].username if row[0] in users_map else None,
            "total_paid_in": str(Decimal(str(row[2]))),
            "total_received": str(abs(Decimal(str(row[3])))),
            "net": str(Decimal(str(row[1]))),
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Financial Export (CSV data)
# ---------------------------------------------------------------------------


async def export_ledger_csv(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[dict]:
    """Return all ledger entries in a date range as flat dicts for CSV export."""
    filters = [LedgerEntry.is_voided.is_(False)]
    if start_date:
        filters.append(LedgerEntry.created_at >= start_date)
    if end_date:
        filters.append(LedgerEntry.created_at <= end_date)

    result = await db.execute(
        select(LedgerEntry)
        .where(and_(*filters))
        .order_by(LedgerEntry.created_at.asc())
    )
    entries = result.scalars().all()

    # Fetch player/recorder names in bulk
    user_ids = set()
    for e in entries:
        if e.player_id:
            user_ids.add(e.player_id)
        user_ids.add(e.recorded_by)
    users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u.username for u in users_q.scalars().all()}

    return [
        {
            "id": e.id,
            "date": e.created_at.strftime("%Y-%m-%d %H:%M"),
            "type": e.entry_type,
            "category": e.category or "",
            "amount": str(e.amount),
            "description": e.description,
            "event_id": e.event_id or "",
            "player": users_map.get(e.player_id, "") if e.player_id else "",
            "recorded_by": users_map.get(e.recorded_by, ""),
            "payment_method": e.payment_method,
            "notes": e.notes or "",
        }
        for e in entries
    ]


# ---------------------------------------------------------------------------
# Prize Validation
# ---------------------------------------------------------------------------


async def validate_prizes(db: AsyncSession, event_id: int) -> dict:
    """Cross-check prize payouts vs fees collected and event results."""
    event = await db.get(Event, event_id)
    if not event:
        raise ValueError("Event not found")

    # Fees collected for this event
    fees_q = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            and_(
                LedgerEntry.event_id == event_id,
                LedgerEntry.entry_type == "fee_collected",
                LedgerEntry.is_voided.is_(False),
            )
        )
    )
    total_fees = Decimal(str(fees_q.scalar()))

    # Prize payouts for this event (stored as negative)
    prizes_q = await db.execute(
        select(
            LedgerEntry.player_id,
            LedgerEntry.amount,
            LedgerEntry.description,
        ).where(
            and_(
                LedgerEntry.event_id == event_id,
                LedgerEntry.entry_type == "prize_payout",
                LedgerEntry.is_voided.is_(False),
            )
        )
    )
    prize_rows = prizes_q.all()
    total_prizes = sum(abs(Decimal(str(r[1]))) for r in prize_rows)

    # Event results (who finished where)
    results_q = await db.execute(
        select(Result).where(Result.event_id == event_id).order_by(Result.position)
    )
    results = results_q.scalars().all()

    # Build a map of player_id -> position from results
    result_positions = {r.user_id: r.position for r in results}

    # Check each prize payout: is the player in the results?
    issues = []
    for row in prize_rows:
        pid, amt, desc = row
        if pid and pid not in result_positions:
            issues.append(f"Player {pid} received prize but has no result for event {event_id}")

    # Check if prizes exceed fees
    prizes_exceed_fees = total_prizes > total_fees

    return {
        "event_id": event_id,
        "event_name": event.name,
        "total_fees_collected": str(total_fees),
        "total_prizes_paid": str(total_prizes),
        "surplus": str(total_fees - total_prizes),
        "prizes_exceed_fees": prizes_exceed_fees,
        "prize_count": len(prize_rows),
        "results_count": len(results),
        "issues": issues,
        "valid": len(issues) == 0 and not prizes_exceed_fees,
    }
