"""
Club Leader Analytics & Metrics API

Comprehensive analytics for managing a disc golf club:
- Financial: P&L, cash flow, event revenue, unpaid fees, expense tracking
- Membership: retention, churn risk, cohorts, segments, growth
- Operations: event capacity, course usage, equipment, weather
- Performance: scoring trends, putting analytics, skill progression
- Strategic: forecasting, ROI, community health

All endpoints require admin role.
"""

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, extract, and_, or_, desc, asc, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.core.security import get_admin_user
from app.models.user import User
from app.models.round import Round, HoleScore
from app.models.league import League, Event, Result
from app.models.putting import PuttAttempt
from app.models.ledger import LedgerEntry, SeasonSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ═══════════════════════════════════════════════════════════════════════════
# FINANCIAL ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/financial/summary")
async def financial_summary(
    months: int = Query(default=12, le=36),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    P&L summary: total income, expenses, net, broken down by type.
    The single most important view for a club treasurer.
    """
    since = datetime.utcnow() - timedelta(days=months * 30)

    # Income by type
    income_q = await db.execute(
        select(
            LedgerEntry.entry_type,
            func.sum(LedgerEntry.amount).label("total"),
            func.count(LedgerEntry.id).label("count"),
        )
        .where(
            LedgerEntry.amount > 0,
            LedgerEntry.is_voided == False,
            LedgerEntry.created_at >= since,
        )
        .group_by(LedgerEntry.entry_type)
    )
    income_rows = income_q.all()

    # Expenses by type
    expense_q = await db.execute(
        select(
            LedgerEntry.entry_type,
            func.sum(func.abs(LedgerEntry.amount)).label("total"),
            func.count(LedgerEntry.id).label("count"),
        )
        .where(
            LedgerEntry.amount < 0,
            LedgerEntry.is_voided == False,
            LedgerEntry.created_at >= since,
        )
        .group_by(LedgerEntry.entry_type)
    )
    expense_rows = expense_q.all()

    total_income = sum(float(r.total) for r in income_rows)
    total_expenses = sum(float(r.total) for r in expense_rows)

    return {
        "period_months": months,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_income": round(total_income - total_expenses, 2),
        "income_by_type": [
            {"type": r.entry_type, "amount": float(r.total), "count": r.count}
            for r in income_rows
        ],
        "expenses_by_type": [
            {"type": r.entry_type, "amount": float(r.total), "count": r.count}
            for r in expense_rows
        ],
    }


@router.get("/financial/cashflow")
async def cash_flow_trend(
    months: int = Query(default=12, le=24),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Monthly cash flow chart data — income, expenses, net by month."""
    results = []
    now = datetime.utcnow()

    for i in range(months - 1, -1, -1):
        month_start = (now - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        if i > 0:
            month_end = (now - timedelta(days=(i - 1) * 30)).replace(day=1, hour=0, minute=0, second=0)
        else:
            month_end = now

        income_q = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0))
            .where(
                LedgerEntry.amount > 0,
                LedgerEntry.is_voided == False,
                LedgerEntry.created_at >= month_start,
                LedgerEntry.created_at < month_end,
            )
        )
        expense_q = await db.execute(
            select(func.coalesce(func.sum(func.abs(LedgerEntry.amount)), 0))
            .where(
                LedgerEntry.amount < 0,
                LedgerEntry.is_voided == False,
                LedgerEntry.created_at >= month_start,
                LedgerEntry.created_at < month_end,
            )
        )
        income = float(income_q.scalar())
        expenses = float(expense_q.scalar())

        results.append({
            "month": month_start.strftime("%Y-%m"),
            "label": month_start.strftime("%b %Y"),
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "net": round(income - expenses, 2),
        })

    return results


@router.get("/financial/event-breakdown")
async def event_financial_breakdown(
    league_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Per-event financial breakdown: fees collected, prizes paid, net per event."""
    query = (
        select(
            Event.id, Event.name, Event.event_date, Event.status, Event.num_players,
            func.coalesce(
                func.sum(case((LedgerEntry.amount > 0, LedgerEntry.amount), else_=0)), 0
            ).label("collected"),
            func.coalesce(
                func.sum(case((LedgerEntry.amount < 0, func.abs(LedgerEntry.amount)), else_=0)), 0
            ).label("paid_out"),
        )
        .outerjoin(LedgerEntry, and_(
            LedgerEntry.event_id == Event.id,
            LedgerEntry.is_voided == False,
        ))
        .group_by(Event.id)
        .order_by(desc(Event.event_date))
    )
    if league_id:
        query = query.where(Event.league_id == league_id)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "event_id": r.id,
            "name": r.name,
            "date": r.event_date.isoformat() if r.event_date else None,
            "status": r.status,
            "players": r.num_players or 0,
            "collected": float(r.collected),
            "paid_out": float(r.paid_out),
            "net": float(r.collected) - float(r.paid_out),
            "per_player": round(float(r.collected) / max(r.num_players or 1, 1), 2),
        }
        for r in rows
    ]


@router.get("/financial/unpaid")
async def unpaid_fees(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Players who checked into events but have no corresponding fee_collected ledger entry."""
    # Find check-ins (results) where no matching ledger entry exists
    result = await db.execute(
        select(
            User.id, User.username, User.display_name, User.email,
            Event.id.label("event_id"), Event.name.label("event_name"),
            Event.event_date, Event.entry_fee,
        )
        .join(Result, Result.user_id == User.id)
        .join(Event, Event.id == Result.event_id)
        .outerjoin(
            LedgerEntry,
            and_(
                LedgerEntry.event_id == Event.id,
                LedgerEntry.player_id == User.id,
                LedgerEntry.entry_type == "fee_collected",
                LedgerEntry.is_voided == False,
            ),
        )
        .where(
            LedgerEntry.id.is_(None),
            Event.entry_fee > 0,
            Event.status == "completed",
        )
        .order_by(desc(Event.event_date))
    )
    return [
        {
            "player_id": r.id, "username": r.username, "display_name": r.display_name,
            "email": r.email, "event_id": r.event_id, "event_name": r.event_name,
            "event_date": r.event_date.isoformat() if r.event_date else None,
            "amount_owed": float(r.entry_fee) if r.entry_fee else 0,
        }
        for r in result.all()
    ]


# ═══════════════════════════════════════════════════════════════════════════
# MEMBERSHIP ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/membership/segments")
async def player_segments(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Segment players by activity level:
    - Core (4+ rounds/month)
    - Regular (1-3 rounds/month)
    - Casual (<1 round/month but active in 90 days)
    - Lapsed (no activity in 90 days)
    - Dormant (no activity in 180 days)
    """
    now = datetime.utcnow()
    d30 = now - timedelta(days=30)
    d90 = now - timedelta(days=90)
    d180 = now - timedelta(days=180)

    # Get all players with round counts
    players_q = await db.execute(
        select(
            User.id, User.username, User.display_name, User.created_at,
            func.count(Round.id).label("rounds_30d"),
            func.max(Round.started_at).label("last_round"),
        )
        .outerjoin(Round, and_(Round.user_id == User.id, Round.started_at >= d30))
        .where(User.role.in_(["player", "admin", "super_admin"]), User.is_active == True)
        .group_by(User.id)
    )
    players = players_q.all()

    segments = {"core": [], "regular": [], "casual": [], "lapsed": [], "dormant": []}
    for p in players:
        last = p.last_round
        r30 = p.rounds_30d or 0
        player_info = {
            "id": p.id, "username": p.username, "display_name": p.display_name,
            "rounds_30d": r30, "last_round": last.isoformat() if last else None,
            "member_since": p.created_at.isoformat() if p.created_at else None,
        }
        if r30 >= 4:
            segments["core"].append(player_info)
        elif r30 >= 1:
            segments["regular"].append(player_info)
        elif last and last >= d90:
            segments["casual"].append(player_info)
        elif last and last >= d180:
            segments["lapsed"].append(player_info)
        else:
            segments["dormant"].append(player_info)

    return {
        "total_players": len(players),
        "segments": {k: {"count": len(v), "players": v} for k, v in segments.items()},
        "summary": {
            "core": len(segments["core"]),
            "regular": len(segments["regular"]),
            "casual": len(segments["casual"]),
            "lapsed": len(segments["lapsed"]),
            "dormant": len(segments["dormant"]),
        },
    }


@router.get("/membership/retention")
async def retention_curve(
    cohort_months: int = Query(default=6, le=12),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Cohort retention analysis: for players who joined in each month,
    what % are still active 1, 2, 3... months later?
    """
    now = datetime.utcnow()
    cohorts = []

    for m in range(cohort_months - 1, -1, -1):
        cohort_start = (now - timedelta(days=m * 30)).replace(day=1)
        cohort_end = (cohort_start + timedelta(days=32)).replace(day=1)

        # Players who joined this month
        joined_q = await db.execute(
            select(User.id).where(
                User.created_at >= cohort_start,
                User.created_at < cohort_end,
                User.role.in_(["player", "admin", "super_admin"]),
            )
        )
        joined_ids = [r.id for r in joined_q.all()]
        if not joined_ids:
            continue

        # For each subsequent month, how many were active?
        retention = []
        months_since = int((now - cohort_start).days / 30)
        for month_offset in range(min(months_since + 1, 6)):
            check_start = (cohort_start + timedelta(days=month_offset * 30))
            check_end = check_start + timedelta(days=30)
            active_q = await db.execute(
                select(func.count(distinct(Round.user_id))).where(
                    Round.user_id.in_(joined_ids),
                    Round.started_at >= check_start,
                    Round.started_at < check_end,
                )
            )
            active = active_q.scalar() or 0
            retention.append({
                "month": month_offset,
                "active": active,
                "rate": round(active / len(joined_ids) * 100, 1) if joined_ids else 0,
            })

        cohorts.append({
            "cohort": cohort_start.strftime("%b %Y"),
            "joined": len(joined_ids),
            "retention": retention,
        })

    return cohorts


@router.get("/membership/churn-risk")
async def churn_risk(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Players at risk of churning: declining activity over past 3 months.
    Flags players whose play frequency dropped >50% month-over-month.
    """
    now = datetime.utcnow()
    m1_start = now - timedelta(days=30)
    m2_start = now - timedelta(days=60)
    m3_start = now - timedelta(days=90)

    # Get 3-month activity for each player
    result = await db.execute(
        select(
            User.id, User.username, User.display_name, User.email,
            func.sum(case((Round.started_at >= m1_start, 1), else_=0)).label("m1"),
            func.sum(case((and_(Round.started_at >= m2_start, Round.started_at < m1_start), 1), else_=0)).label("m2"),
            func.sum(case((and_(Round.started_at >= m3_start, Round.started_at < m2_start), 1), else_=0)).label("m3"),
        )
        .join(Round, Round.user_id == User.id)
        .where(Round.started_at >= m3_start)
        .group_by(User.id)
        .having(
            # Had activity in month 2 or 3 but declining
            func.sum(case((and_(Round.started_at >= m2_start, Round.started_at < m1_start), 1), else_=0)) > 0
        )
    )

    at_risk = []
    for r in result.all():
        m1, m2, m3 = r.m1 or 0, r.m2 or 0, r.m3 or 0
        # Flag if current month is <50% of previous month
        if m2 > 0 and m1 < m2 * 0.5:
            trend = "declining"
            risk = "high" if m1 == 0 else "medium"
        elif m3 > 0 and m2 < m3 * 0.5 and m1 <= m2:
            trend = "declining"
            risk = "medium"
        else:
            continue

        at_risk.append({
            "id": r.id, "username": r.username, "display_name": r.display_name,
            "email": r.email,
            "rounds_this_month": m1, "rounds_last_month": m2, "rounds_2_months_ago": m3,
            "trend": trend, "risk": risk,
        })

    return sorted(at_risk, key=lambda x: x["risk"] == "high", reverse=True)


# ═══════════════════════════════════════════════════════════════════════════
# PERFORMANCE ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/performance/course-difficulty")
async def course_difficulty(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Average score relative to par by layout — which layouts are hardest?"""
    result = await db.execute(
        select(
            Round.layout_id,
            func.count(Round.id).label("rounds_played"),
            func.avg(Round.total_score).label("avg_relative"),
            func.min(Round.total_score).label("best_score"),
            func.max(Round.total_score).label("worst_score"),
            func.stddev(Round.total_score).label("score_stddev"),
        )
        .where(Round.completed_at.isnot(None))
        .group_by(Round.layout_id)
        .having(func.count(Round.id) >= 5)
    )
    return [
        {
            "layout_id": r.layout_id,
            "rounds_played": r.rounds_played,
            "avg_score_vs_par": round(float(r.avg_relative or 0), 1),
            "best_score": r.best_score,
            "worst_score": r.worst_score,
            "score_spread": round(float(r.score_stddev or 0), 1),
        }
        for r in result.all()
    ]


@router.get("/performance/putting-summary")
async def putting_summary(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Club-wide putting statistics by zone — C1X, C2, overall."""
    zones = ["c1", "c1x", "c2"]
    results = {}

    for zone in zones:
        q = await db.execute(
            select(
                func.count(PuttAttempt.id).label("attempts"),
                func.sum(case((PuttAttempt.made == True, 1), else_=0)).label("makes"),
            )
            .where(PuttAttempt.zone == zone)
        )
        row = q.one()
        attempts = row.attempts or 0
        makes = row.makes or 0
        results[zone] = {
            "attempts": attempts,
            "makes": makes,
            "make_pct": round(makes / max(attempts, 1) * 100, 1),
        }

    return results


@router.get("/performance/scoring-trends")
async def scoring_trends(
    weeks: int = Query(default=12, le=52),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Club-wide scoring trends by week — are players improving?"""
    now = datetime.utcnow()
    data = []

    for i in range(weeks - 1, -1, -1):
        week_start = now - timedelta(weeks=i)
        week_end = week_start + timedelta(weeks=1)

        q = await db.execute(
            select(
                func.count(Round.id).label("rounds"),
                func.avg(Round.total_score).label("avg_score"),
            )
            .where(
                Round.completed_at.isnot(None),
                Round.started_at >= week_start,
                Round.started_at < week_end,
            )
        )
        row = q.one()
        data.append({
            "week": week_start.strftime("%b %d"),
            "rounds": row.rounds or 0,
            "avg_score": round(float(row.avg_score or 0), 1),
        })

    return data


# ═══════════════════════════════════════════════════════════════════════════
# OPERATIONS ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/operations/event-calendar")
async def event_calendar(
    months_ahead: int = Query(default=3, le=6),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Upcoming events with capacity, registration, and logistics info."""
    now = datetime.utcnow()
    future = now + timedelta(days=months_ahead * 30)

    result = await db.execute(
        select(Event)
        .where(Event.event_date >= now, Event.event_date <= future)
        .order_by(Event.event_date)
    )
    events = result.scalars().all()

    calendar = []
    for e in events:
        # Count check-ins
        checkin_q = await db.execute(
            select(func.count(Result.id)).where(Result.event_id == e.id)
        )
        checkins = checkin_q.scalar() or 0

        calendar.append({
            "id": e.id, "name": e.name,
            "date": e.event_date.isoformat() if e.event_date else None,
            "status": e.status,
            "league_id": e.league_id,
            "registered": checkins,
            "entry_fee": float(e.entry_fee) if e.entry_fee else 0,
            "projected_revenue": float(e.entry_fee or 0) * checkins,
        })

    return calendar


@router.get("/operations/usage-heatmap")
async def usage_heatmap(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """When do people play? Rounds by day-of-week and hour — helps with event scheduling."""
    result = await db.execute(
        select(
            extract("dow", Round.started_at).label("day_of_week"),
            extract("hour", Round.started_at).label("hour"),
            func.count(Round.id).label("rounds"),
        )
        .where(Round.started_at.isnot(None))
        .group_by("day_of_week", "hour")
    )

    heatmap = {}
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for r in result.all():
        dow = int(r.day_of_week)
        hour = int(r.hour)
        day_name = days[dow]
        if day_name not in heatmap:
            heatmap[day_name] = {}
        heatmap[day_name][hour] = r.rounds

    return heatmap


# ═══════════════════════════════════════════════════════════════════════════
# STRATEGIC ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/strategic/growth-drivers")
async def growth_drivers(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """What drives new signups? Correlate registration dates with events and seasons."""
    now = datetime.utcnow()
    months = 12
    data = []

    for i in range(months - 1, -1, -1):
        m_start = (now - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)

        new_q = await db.execute(
            select(func.count(User.id)).where(
                User.created_at >= m_start,
                User.created_at < m_end,
            )
        )
        events_q = await db.execute(
            select(func.count(Event.id)).where(
                Event.event_date >= m_start,
                Event.event_date < m_end,
                Event.status == "completed",
            )
        )
        rounds_q = await db.execute(
            select(func.count(Round.id)).where(
                Round.started_at >= m_start,
                Round.started_at < m_end,
            )
        )

        data.append({
            "month": m_start.strftime("%b %Y"),
            "new_signups": new_q.scalar() or 0,
            "events_held": events_q.scalar() or 0,
            "rounds_played": rounds_q.scalar() or 0,
        })

    return data


@router.get("/strategic/revenue-forecast")
async def revenue_forecast(
    months_ahead: int = Query(default=6, le=12),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Simple revenue forecast based on trailing 3-month average.
    Shows projected income vs. expenses for the next N months.
    """
    now = datetime.utcnow()

    # Get last 3 months of actuals
    trailing = []
    for i in range(3, 0, -1):
        m_start = (now - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)

        inc_q = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
                LedgerEntry.amount > 0, LedgerEntry.is_voided == False,
                LedgerEntry.created_at >= m_start, LedgerEntry.created_at < m_end,
            )
        )
        exp_q = await db.execute(
            select(func.coalesce(func.sum(func.abs(LedgerEntry.amount)), 0)).where(
                LedgerEntry.amount < 0, LedgerEntry.is_voided == False,
                LedgerEntry.created_at >= m_start, LedgerEntry.created_at < m_end,
            )
        )
        trailing.append({
            "income": float(inc_q.scalar()),
            "expenses": float(exp_q.scalar()),
        })

    avg_income = sum(t["income"] for t in trailing) / max(len(trailing), 1)
    avg_expenses = sum(t["expenses"] for t in trailing) / max(len(trailing), 1)

    forecast = []
    cumulative_net = 0
    for i in range(1, months_ahead + 1):
        month = (now + timedelta(days=i * 30))
        projected_income = avg_income * (1 + 0.02 * i)  # 2% monthly growth assumption
        projected_expenses = avg_expenses * (1 + 0.01 * i)  # 1% cost increase
        net = projected_income - projected_expenses
        cumulative_net += net

        forecast.append({
            "month": month.strftime("%b %Y"),
            "projected_income": round(projected_income, 2),
            "projected_expenses": round(projected_expenses, 2),
            "projected_net": round(net, 2),
            "cumulative_net": round(cumulative_net, 2),
        })

    return {
        "trailing_avg_income": round(avg_income, 2),
        "trailing_avg_expenses": round(avg_expenses, 2),
        "trailing_avg_net": round(avg_income - avg_expenses, 2),
        "forecast": forecast,
    }


@router.get("/strategic/community-health")
async def community_health(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Community health score: composite of engagement, retention, growth, and financial health.
    Designed to give a club leader one number to watch.
    """
    now = datetime.utcnow()
    d30 = now - timedelta(days=30)
    d60 = now - timedelta(days=60)

    # Active players this month vs last month
    active_now = await db.execute(
        select(func.count(distinct(Round.user_id))).where(Round.started_at >= d30)
    )
    active_prev = await db.execute(
        select(func.count(distinct(Round.user_id))).where(
            Round.started_at >= d60, Round.started_at < d30
        )
    )
    active_n = active_now.scalar() or 0
    active_p = active_prev.scalar() or 1

    # New signups this month
    new_now = await db.execute(
        select(func.count(User.id)).where(User.created_at >= d30)
    )
    new_n = new_now.scalar() or 0

    # Rounds this month vs last
    rounds_now = await db.execute(
        select(func.count(Round.id)).where(Round.started_at >= d30)
    )
    rounds_prev = await db.execute(
        select(func.count(Round.id)).where(Round.started_at >= d60, Round.started_at < d30)
    )
    rounds_n = rounds_now.scalar() or 0
    rounds_p = rounds_prev.scalar() or 1

    # Events this month
    events_now = await db.execute(
        select(func.count(Event.id)).where(
            Event.event_date >= d30, Event.status == "completed"
        )
    )
    events_n = events_now.scalar() or 0

    # Financial health
    income_q = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.amount > 0, LedgerEntry.is_voided == False, LedgerEntry.created_at >= d30,
        )
    )
    expense_q = await db.execute(
        select(func.coalesce(func.sum(func.abs(LedgerEntry.amount)), 0)).where(
            LedgerEntry.amount < 0, LedgerEntry.is_voided == False, LedgerEntry.created_at >= d30,
        )
    )
    income = float(income_q.scalar())
    expenses = float(expense_q.scalar())

    # Calculate scores (0-100)
    engagement_score = min(100, (active_n / max(active_p, 1)) * 50 + (rounds_n / max(rounds_p, 1)) * 50)
    growth_score = min(100, new_n * 10 + (active_n / max(active_p, 1) - 1) * 100)
    event_score = min(100, events_n * 25)
    financial_score = min(100, 50 + (income - expenses) / max(income, 1) * 50) if income > 0 else 25

    overall = (engagement_score * 0.30 + growth_score * 0.25 +
               event_score * 0.20 + financial_score * 0.25)

    return {
        "overall_score": round(min(100, max(0, overall)), 1),
        "components": {
            "engagement": {"score": round(engagement_score, 1),
                           "active_players": active_n, "active_change": round((active_n / max(active_p, 1) - 1) * 100, 1)},
            "growth": {"score": round(growth_score, 1),
                       "new_signups": new_n, "rounds_change": round((rounds_n / max(rounds_p, 1) - 1) * 100, 1)},
            "events": {"score": round(event_score, 1),
                       "events_held": events_n},
            "financial": {"score": round(financial_score, 1),
                          "income": income, "expenses": expenses, "net": round(income - expenses, 2)},
        },
        "trend": "improving" if overall > 60 else ("stable" if overall > 40 else "declining"),
    }
