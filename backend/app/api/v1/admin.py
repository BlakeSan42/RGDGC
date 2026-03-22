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
    user_count = await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    round_count = await db.execute(select(func.count(Round.id)))
    event_count = await db.execute(
        select(func.count(Event.id)).where(Event.status == "upcoming")
    )

    return {
        "total_members": user_count.scalar() or 0,
        "total_rounds": round_count.scalar() or 0,
        "upcoming_events": event_count.scalar() or 0,
    }


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
    now = datetime.now(timezone.utc)
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
    now = datetime.now(timezone.utc)
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
