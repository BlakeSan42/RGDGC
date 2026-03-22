from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_admin_user, get_current_user
from app.db.database import get_db
from app.models.course import Layout
from app.models.league import Event, Result
from app.models.user import User
from app.schemas.league import EventOut, ResultOut, ResultSubmit
from app.services.points_service import finalize_event

router = APIRouter()


@router.get("", response_model=list[EventOut])
async def list_events(
    status: str | None = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Event).order_by(Event.event_date.desc()).limit(limit)
    if status:
        stmt = stmt.where(Event.status == status)
    result = await db.execute(stmt)
    return [EventOut.model_validate(e) for e in result.scalars().all()]


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventOut.model_validate(event)


@router.get("/{event_id}/results", response_model=list[ResultOut])
async def get_event_results(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Result).where(Result.event_id == event_id).order_by(Result.position)
    )
    return [ResultOut.model_validate(r) for r in result.scalars().all()]


@router.post("/{event_id}/checkin", status_code=201)
async def checkin(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != "upcoming":
        raise HTTPException(status_code=400, detail="Event is not open for check-in")

    # Check if already checked in (result exists)
    existing = await db.execute(
        select(Result).where(Result.event_id == event_id, Result.user_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already checked in")

    # Create placeholder result (scores filled in later)
    result = Result(
        event_id=event_id,
        user_id=user.id,
        total_strokes=0,
        total_score=0,
    )
    db.add(result)

    # Update player count
    count_result = await db.execute(
        select(Result).where(Result.event_id == event_id)
    )
    event.num_players = len(list(count_result.scalars().all())) + 1

    await db.flush()
    return {"message": "Checked in", "event_id": event_id, "players": event.num_players}


@router.post("/{event_id}/results", response_model=list[ResultOut])
async def submit_results(
    event_id: int,
    results: list[ResultSubmit],
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get layout par
    layout = await db.get(Layout, event.layout_id) if event.layout_id else None
    total_par = layout.total_par if layout else 54

    created = []
    for r in results:
        # Check if result exists (from check-in)
        existing_result = await db.execute(
            select(Result).where(Result.event_id == event_id, Result.user_id == r.user_id)
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.total_strokes = r.total_strokes
            existing.total_score = r.total_strokes - total_par
            existing.dnf = r.dnf
            existing.dq = r.dq
            created.append(existing)
        else:
            result = Result(
                event_id=event_id,
                user_id=r.user_id,
                total_strokes=r.total_strokes,
                total_score=r.total_strokes - total_par,
                dnf=r.dnf,
                dq=r.dq,
            )
            db.add(result)
            created.append(result)

    await db.flush()
    return [ResultOut.model_validate(r) for r in created]


@router.put("/{event_id}/finalize", response_model=list[ResultOut])
async def finalize(
    event_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        results = await finalize_event(db, event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [ResultOut.model_validate(r) for r in results]
