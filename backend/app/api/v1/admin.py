from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.models.round import Round
from app.models.league import Event, League, Result
from app.models.admin import AuditLog, Announcement
from app.schemas.admin import (
    AuditLogResponse,
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
    PlayerAnalytics,
    RoundAnalytics,
)
from app.schemas.league import EventOut
from app.services.audit_service import log_action
from app.services.cache_service import CacheService
from app.services.push_service import send_push_to_all, send_push_to_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(
    league_id: int,
    layout_id: int,
    event_date: date,
    request: Request,
    name: str | None = None,
    entry_fee: float | None = None,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    event = Event(
        league_id=league_id,
        layout_id=layout_id,
        event_date=event_date,
        name=name or f"{league.name} — {event_date.strftime('%b %d')}",
        entry_fee=entry_fee,
        status="upcoming",
    )
    db.add(event)
    await db.flush()

    await log_action(
        db,
        admin_id=admin.id,
        action="event_create",
        target_type="event",
        target_id=str(event.id),
        details={"league_id": league_id, "event_date": str(event_date)},
        ip_address=request.client.host if request.client else None,
    )

    return EventOut.model_validate(event)


@router.get("/analytics/dashboard")
async def admin_dashboard(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    one_month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)

    # Active players (played a round in last 30 days)
    active_q = await db.execute(
        select(func.count(func.distinct(Round.user_id))).where(Round.started_at >= one_month_ago)
    )
    active_players = active_q.scalar() or 0

    # Active players previous month (for growth calc)
    prev_active_q = await db.execute(
        select(func.count(func.distinct(Round.user_id))).where(
            and_(Round.started_at >= two_months_ago, Round.started_at < one_month_ago)
        )
    )
    prev_active = prev_active_q.scalar() or 0

    # Upcoming events
    event_q = await db.execute(
        select(func.count(Event.id)).where(Event.status == "upcoming")
    )
    upcoming_events = event_q.scalar() or 0

    # Rounds this week
    week_rounds_q = await db.execute(
        select(func.count(Round.id)).where(Round.started_at >= one_week_ago)
    )
    rounds_this_week = week_rounds_q.scalar() or 0

    # Rounds previous week
    two_weeks_ago = now - timedelta(days=14)
    prev_week_q = await db.execute(
        select(func.count(Round.id)).where(
            and_(Round.started_at >= two_weeks_ago, Round.started_at < one_week_ago)
        )
    )
    prev_week_rounds = prev_week_q.scalar() or 0

    # Revenue this month (sum of event fees from results)
    revenue_q = await db.execute(
        select(func.coalesce(func.sum(Event.entry_fee), 0)).where(
            and_(Event.event_date >= one_month_ago.date(), Event.status == "completed")
        )
    )
    revenue_this_month = float(revenue_q.scalar() or 0)

    def growth_pct(current: int, previous: int) -> int:
        if previous == 0:
            return 100 if current > 0 else 0
        return round((current - previous) / previous * 100)

    return {
        "active_players": active_players,
        "upcoming_events": upcoming_events,
        "rounds_this_week": rounds_this_week,
        "revenue_this_month": revenue_this_month,
        "player_growth": growth_pct(active_players, prev_active),
        "event_growth": 0,
        "round_growth": growth_pct(rounds_this_week, prev_week_rounds),
        "revenue_growth": 0,
    }


@router.get("/activity")
async def get_recent_activity(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    """Recent activity feed combining audit logs, rounds, and events."""
    items: list[dict] = []

    # Recent audit log entries
    audit_q = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    for log in audit_q.scalars().all():
        action_messages = {
            "event_create": "New event created",
            "role_change": "Player role updated",
            "announcement_create": "New announcement posted",
            "results_finalize": "Event results finalized",
            "cache_clear": "Cache cleared",
        }
        msg = action_messages.get(log.action, f"Admin action: {log.action}")
        if log.details:
            if "title" in log.details:
                msg = f"{msg}: {log.details['title']}"
        type_map = {
            "event_create": "event_created",
            "results_finalize": "results_finalized",
            "role_change": "player_joined",
        }
        items.append({
            "id": f"audit-{log.id}",
            "type": type_map.get(log.action, "round_completed"),
            "message": msg,
            "timestamp": log.created_at.isoformat(),
        })

    # Recent completed rounds
    round_q = await db.execute(
        select(Round).where(Round.completed_at.isnot(None))
        .order_by(Round.completed_at.desc()).limit(limit)
    )
    for rnd in round_q.scalars().all():
        score_str = ""
        if rnd.total_score is not None:
            score_str = f" ({'+' if rnd.total_score > 0 else ''}{rnd.total_score})" if rnd.total_score != 0 else " (E)"
        items.append({
            "id": f"round-{rnd.id}",
            "type": "round_completed",
            "message": f"Round completed{score_str}",
            "timestamp": rnd.completed_at.isoformat(),
        })

    # Sort by timestamp descending and trim
    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return items[:limit]


@router.get("/analytics/weekly-rounds")
async def weekly_rounds(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    weeks: int = Query(6, ge=1, le=12),
):
    """Rounds per week for the last N weeks."""
    now = datetime.utcnow()
    result = []
    for i in range(weeks - 1, -1, -1):
        week_end = now - timedelta(weeks=i)
        week_start = week_end - timedelta(weeks=1)
        count_q = await db.execute(
            select(func.count(Round.id)).where(
                and_(Round.started_at >= week_start, Round.started_at < week_end)
            )
        )
        count = count_q.scalar() or 0
        result.append({
            "week": week_start.strftime("%b %d"),
            "rounds": count,
        })
    return result


@router.post("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    role: str,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if role not in ("admin", "super_admin", "player", "guest"):
        raise HTTPException(status_code=400, detail="Invalid role")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # --- PERMISSION CHECKS ---
    # Only super_admin can promote to super_admin
    if role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Only super_admin can demote another admin or super_admin
    if user.role in ("admin", "super_admin") and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Admins cannot change their own role (prevents self-escalation)
    if user.id == admin.id and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot change your own role")

    old_role = user.role
    user.role = role
    await db.flush()

    await log_action(
        db,
        admin_id=admin.id,
        action="role_change",
        target_type="user",
        target_id=str(user_id),
        details={"old_role": old_role, "new_role": role},
        ip_address=request.client.host if request.client else None,
    )

    return {"user_id": user_id, "role": role}


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------


@router.get("/audit-log", response_model=list[AuditLogResponse])
async def get_audit_log(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    action: str | None = Query(None, description="Filter by action type"),
    target_type: str | None = Query(None, description="Filter by target type"),
    admin_id: int | None = Query(None, description="Filter by admin who performed action"),
    date_from: datetime | None = Query(None, description="Start date (inclusive)"),
    date_to: datetime | None = Query(None, description="End date (inclusive)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if admin_id:
        query = query.where(AuditLog.admin_id == admin_id)
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return [AuditLogResponse.model_validate(row) for row in result.scalars().all()]


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------


@router.post("/announcements", response_model=AnnouncementResponse, status_code=201)
async def create_announcement(
    payload: AnnouncementCreate,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.priority not in ("normal", "important", "urgent"):
        raise HTTPException(status_code=400, detail="Invalid priority. Must be normal, important, or urgent.")

    announcement = Announcement(
        author_id=admin.id,
        title=payload.title,
        body=payload.body,
        priority=payload.priority,
        expires_at=payload.expires_at,
    )
    db.add(announcement)
    await db.flush()

    await log_action(
        db,
        admin_id=admin.id,
        action="announcement_create",
        target_type="announcement",
        target_id=str(announcement.id),
        details={"title": payload.title, "priority": payload.priority},
        ip_address=request.client.host if request.client else None,
    )

    # Push notification for important/urgent announcements
    if payload.priority in ("important", "urgent"):
        try:
            await send_push_to_all(
                db,
                payload.title,
                payload.body[:100],
                {"type": "announcement", "id": announcement.id},
            )
        except Exception:
            pass  # Push failure must never break announcement creation

    return AnnouncementResponse.model_validate(announcement)


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def list_announcements(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    active_only: bool = Query(False, description="If true, only return active announcements"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = select(Announcement).order_by(Announcement.created_at.desc())

    if active_only:
        query = query.where(Announcement.is_active.is_(True))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return [AnnouncementResponse.model_validate(row) for row in result.scalars().all()]


@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    announcement = await db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if payload.priority is not None and payload.priority not in ("normal", "important", "urgent"):
        raise HTTPException(status_code=400, detail="Invalid priority. Must be normal, important, or urgent.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(announcement, field, value)

    await db.flush()

    await log_action(
        db,
        admin_id=admin.id,
        action="announcement_update",
        target_type="announcement",
        target_id=str(announcement_id),
        details=update_data,
        ip_address=request.client.host if request.client else None,
    )

    return AnnouncementResponse.model_validate(announcement)


@router.delete("/announcements/{announcement_id}")
async def deactivate_announcement(
    announcement_id: int,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    announcement = await db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    announcement.is_active = False
    await db.flush()

    await log_action(
        db,
        admin_id=admin.id,
        action="announcement_deactivate",
        target_type="announcement",
        target_id=str(announcement_id),
        ip_address=request.client.host if request.client else None,
    )

    return {"detail": "Announcement deactivated", "id": announcement_id}


# ---------------------------------------------------------------------------
# Cache Management
# ---------------------------------------------------------------------------


@router.post("/cache/clear")
async def clear_cache(
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await CacheService.flush()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Redis unavailable: {exc}")

    await log_action(
        db,
        admin_id=admin.id,
        action="cache_clear",
        target_type="system",
        target_id="redis",
        ip_address=request.client.host if request.client else None,
    )

    return {"detail": "Cache cleared successfully"}


# ---------------------------------------------------------------------------
# Analytics — Players
# ---------------------------------------------------------------------------


@router.get("/analytics/players", response_model=PlayerAnalytics)
async def player_analytics(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    one_month_ago = now - timedelta(days=30)

    # Total active players
    total_q = await db.execute(
        select(func.count(User.id)).where(User.is_active.is_(True))
    )
    total_players = total_q.scalar() or 0

    # Active this week — players who completed a round in the last 7 days
    active_week_q = await db.execute(
        select(func.count(func.distinct(Round.user_id))).where(
            Round.started_at >= one_week_ago
        )
    )
    active_this_week = active_week_q.scalar() or 0

    # New players this month
    new_month_q = await db.execute(
        select(func.count(User.id)).where(
            User.created_at >= one_month_ago,
            User.is_active.is_(True),
        )
    )
    new_this_month = new_month_q.scalar() or 0

    # Retention: players active in last 30 days vs total
    active_month_q = await db.execute(
        select(func.count(func.distinct(Round.user_id))).where(
            Round.started_at >= one_month_ago
        )
    )
    active_last_month = active_month_q.scalar() or 0

    retention_rate = (active_last_month / total_players * 100) if total_players > 0 else 0.0

    return PlayerAnalytics(
        total_players=total_players,
        active_this_week=active_this_week,
        new_this_month=new_this_month,
        retention_rate=round(retention_rate, 1),
    )


# ---------------------------------------------------------------------------
# Analytics — Rounds
# ---------------------------------------------------------------------------


@router.get("/analytics/rounds", response_model=RoundAnalytics)
async def round_analytics(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # Total rounds
    total_q = await db.execute(select(func.count(Round.id)))
    total_rounds = total_q.scalar() or 0

    # Rounds in last 30 days for per-day average
    recent_q = await db.execute(
        select(func.count(Round.id)).where(Round.started_at >= thirty_days_ago)
    )
    recent_rounds = recent_q.scalar() or 0
    rounds_per_day = round(recent_rounds / 30, 2)

    # Average score (relative to par) for completed rounds
    avg_q = await db.execute(
        select(func.avg(Round.total_score)).where(Round.completed_at.isnot(None))
    )
    avg_score_raw = avg_q.scalar()
    avg_score = round(float(avg_score_raw), 1) if avg_score_raw is not None else None

    # Completion rate
    completed_q = await db.execute(
        select(func.count(Round.id)).where(Round.completed_at.isnot(None))
    )
    completed_rounds = completed_q.scalar() or 0
    completion_rate = round((completed_rounds / total_rounds * 100), 1) if total_rounds > 0 else 0.0

    return RoundAnalytics(
        total_rounds=total_rounds,
        rounds_per_day=rounds_per_day,
        avg_score=avg_score,
        completion_rate=completion_rate,
    )


# ---------------------------------------------------------------------------
# Test Push Notification
# ---------------------------------------------------------------------------


@router.post("/test-push")
async def send_test_push(
    user_id: int,
    message: str,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test push notification to a specific user (admin only)."""
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not target.push_token:
        raise HTTPException(status_code=400, detail="User has no push token registered")

    success = await send_push_to_user(
        db, user_id, "RGDGC Test", message, {"type": "test"}
    )

    await log_action(
        db,
        admin_id=admin.id,
        action="test_push",
        target_type="user",
        target_id=str(user_id),
        details={"message": message, "success": success},
        ip_address=request.client.host if request.client else None,
    )

    return {"success": success, "user_id": user_id}
