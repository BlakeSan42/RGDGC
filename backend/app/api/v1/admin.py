from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.models.round import Round
from app.models.league import Event, League, Result
from app.schemas.league import EventOut

router = APIRouter()


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(
    league_id: int,
    layout_id: int,
    event_date: date,
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
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if role not in ("admin", "player", "guest"):
        raise HTTPException(status_code=400, detail="Invalid role")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = role
    await db.flush()
    return {"user_id": user_id, "role": role}
