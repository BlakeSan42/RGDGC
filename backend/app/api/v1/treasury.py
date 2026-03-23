"""Treasury endpoints — cash accounting for RGDGC league events.

All endpoints require admin role. All entries are immutable (void instead of
delete). Every action is logged in the audit trail.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.treasury import (
    BalanceOut,
    BudgetOut,
    BudgetVsActualRow,
    CategoryExpense,
    CollectBulk,
    CollectCTP,
    CollectFee,
    EventSummaryOut,
    LedgerEntryOut,
    LedgerPage,
    PayoutCTP,
    PayoutPrize,
    PlayerBalance,
    PrizeValidation,
    RecordExpense,
    SetBudget,
    UnpaidPlayer,
    VoidEntry,
)
from app.services.treasury_service import (
    export_ledger_csv,
    get_balance,
    get_event_summary,
    get_expenses_by_category,
    get_budget_vs_actual,
    get_ledger,
    get_player_balances,
    get_season_summary,
    get_unpaid_players,
    record_entry,
    set_budget,
    validate_prizes,
    void_entry,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Event Day Workflow — fast flows for the admin at the course
# ---------------------------------------------------------------------------


@router.post("/collect-fee", response_model=LedgerEntryOut, status_code=201)
async def collect_fee(
    data: CollectFee,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a single player's event fee payment."""
    try:
        entry = await record_entry(
            db,
            entry_type="fee_collected",
            amount=data.amount,
            description=f"Event fee — player {data.player_id}",
            recorded_by=admin.id,
            event_id=data.event_id,
            player_id=data.player_id,
            payment_method=data.payment_method,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


@router.post("/collect-bulk", response_model=list[LedgerEntryOut], status_code=201)
async def collect_bulk(
    data: CollectBulk,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-record event fees for multiple players at once."""
    entries = []
    ip = request.client.host if request.client else None
    for pid in data.player_ids:
        try:
            entry = await record_entry(
                db,
                entry_type="fee_collected",
                amount=data.amount_per_player,
                description=f"Event fee — player {pid}",
                recorded_by=admin.id,
                event_id=data.event_id,
                player_id=pid,
                payment_method=data.payment_method,
                admin_ip=ip,
            )
            entries.append(entry)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Player {pid}: {e}")
    return [LedgerEntryOut.from_entry(e) for e in entries]


@router.post("/collect-ctp", response_model=LedgerEntryOut, status_code=201)
async def collect_ctp(
    data: CollectCTP,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Record CTP (closest-to-pin) pot collection."""
    try:
        entry = await record_entry(
            db,
            entry_type="ctp_collected",
            amount=data.amount,
            description=data.description,
            recorded_by=admin.id,
            event_id=data.event_id,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


@router.post("/payout-prize", response_model=LedgerEntryOut, status_code=201)
async def payout_prize(
    data: PayoutPrize,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a prize payout to a player (money out)."""
    pos_str = f" ({_ordinal(data.position)})" if data.position else ""
    try:
        entry = await record_entry(
            db,
            entry_type="prize_payout",
            amount=-data.amount,  # negative = money out
            description=f"{data.description}{pos_str}",
            recorded_by=admin.id,
            event_id=data.event_id,
            player_id=data.player_id,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


@router.post("/payout-ctp", response_model=LedgerEntryOut, status_code=201)
async def payout_ctp(
    data: PayoutCTP,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a CTP payout to the winner (money out)."""
    try:
        entry = await record_entry(
            db,
            entry_type="ctp_payout",
            amount=-data.amount,  # negative = money out
            description=data.description,
            recorded_by=admin.id,
            event_id=data.event_id,
            player_id=data.player_id,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


@router.post("/record-expense", response_model=LedgerEntryOut, status_code=201)
async def expense(
    data: RecordExpense,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a club expense (baskets, tee pads, supplies, etc.)."""
    try:
        entry = await record_entry(
            db,
            entry_type="expense",
            amount=-data.amount,  # negative = money out
            description=data.description,
            recorded_by=admin.id,
            event_id=data.event_id,
            notes=data.notes,
            category=data.category,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


@router.get("/balance", response_model=BalanceOut)
async def treasury_balance(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Current treasury balance: total in minus total out."""
    bal = await get_balance(db)
    return BalanceOut(
        balance=f"${bal:.2f}",
        as_of=datetime.utcnow(),
    )


@router.get("/event/{event_id}/summary", response_model=EventSummaryOut)
async def event_summary(
    event_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Financial summary for a single event."""
    try:
        summary = await get_event_summary(db, event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return summary


@router.get("/season/{season}")
async def season_summary(
    season: str,
    league_id: int | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Season-level financial summary, optionally filtered by league."""
    return await get_season_summary(db, league_id=league_id, season=season)


@router.get("/ledger", response_model=LedgerPage)
async def ledger(
    event_id: int | None = Query(None),
    entry_type: str | None = Query(None, alias="type"),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Full ledger with filters and pagination."""
    entries, total = await get_ledger(
        db,
        event_id=event_id,
        entry_type=entry_type,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return LedgerPage(
        entries=[LedgerEntryOut.from_entry(e) for e in entries],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/unpaid/{event_id}", response_model=list[UnpaidPlayer])
async def unpaid_players(
    event_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List checked-in players who haven't paid their event fee yet."""
    try:
        return await get_unpaid_players(db, event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Expense Categories
# ---------------------------------------------------------------------------


@router.get("/expenses/by-category", response_model=list[CategoryExpense])
async def expenses_by_category(
    season: str | None = Query(None, pattern=r"^\d{4}$"),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Expenses grouped by category with totals."""
    return await get_expenses_by_category(db, season=season)


# ---------------------------------------------------------------------------
# Budget Tracking
# ---------------------------------------------------------------------------


@router.post("/budget", response_model=BudgetOut, status_code=201)
async def create_budget(
    data: SetBudget,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or update budget for a category/season. Upserts if already exists."""
    try:
        budget = await set_budget(
            db,
            league_id=data.league_id,
            season=data.season,
            category=data.category,
            budgeted_amount=data.budgeted_amount,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return BudgetOut.from_model(budget)


@router.get("/budget/vs-actual", response_model=list[BudgetVsActualRow])
async def budget_vs_actual(
    season: str = Query(pattern=r"^\d{4}$"),
    league_id: int | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Budget vs actual spending per category for a season."""
    return await get_budget_vs_actual(db, season=season, league_id=league_id)


# ---------------------------------------------------------------------------
# Player Account Balances
# ---------------------------------------------------------------------------


@router.get("/player-balances", response_model=list[PlayerBalance])
async def player_balances(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Each player's net position: fees paid minus prizes received."""
    return await get_player_balances(db)


# ---------------------------------------------------------------------------
# Financial Export
# ---------------------------------------------------------------------------


@router.get("/export")
async def export_csv(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Download ledger entries as CSV."""
    rows = await export_ledger_csv(db, start_date=start_date, end_date=end_date)

    if not rows:
        raise HTTPException(status_code=404, detail="No entries found for the given date range")

    output = io.StringIO()
    fieldnames = ["id", "date", "type", "category", "amount", "description",
                  "event_id", "player", "recorded_by", "payment_method", "notes"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=treasury_export.csv"},
    )


# ---------------------------------------------------------------------------
# Prize Validation
# ---------------------------------------------------------------------------


@router.get("/validate-prizes/{event_id}", response_model=PrizeValidation)
async def validate_event_prizes(
    event_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Cross-check prize payouts vs fees and results for an event."""
    try:
        return await validate_prizes(db, event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Corrections
# ---------------------------------------------------------------------------


@router.post("/{entry_id}/void", response_model=LedgerEntryOut)
async def void_ledger_entry(
    entry_id: int,
    data: VoidEntry,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Void an incorrect entry. Does not delete — marks as voided with reason."""
    try:
        entry = await void_entry(
            db,
            entry_id=entry_id,
            voided_by=admin.id,
            reason=data.reason,
            admin_ip=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LedgerEntryOut.from_entry(entry)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ordinal(n: int) -> str:
    """1 → '1st', 2 → '2nd', 3 → '3rd', etc."""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
