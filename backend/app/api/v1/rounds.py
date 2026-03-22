from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.course import Hole
from app.models.round import HoleScore, Round
from app.models.user import User
from app.schemas.round import RoundCreate, RoundDetailOut, RoundOut, ScoreSubmit

router = APIRouter()


@router.post("", response_model=RoundOut, status_code=201)
async def start_round(
    data: RoundCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    round_ = Round(user_id=user.id, layout_id=data.layout_id, is_practice=data.is_practice)
    db.add(round_)
    await db.flush()
    return RoundOut.model_validate(round_)


@router.get("", response_model=list[RoundOut])
async def list_rounds(
    limit: int = Query(20, le=100),
    layout_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Round).where(Round.user_id == user.id).order_by(Round.started_at.desc()).limit(limit)
    if layout_id:
        stmt = stmt.where(Round.layout_id == layout_id)
    result = await db.execute(stmt)
    return [RoundOut.model_validate(r) for r in result.scalars().all()]


@router.get("/{round_id}", response_model=RoundDetailOut)
async def get_round(
    round_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Round).where(Round.id == round_id).options(selectinload(Round.scores))
    )
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    return RoundDetailOut.model_validate(round_)


@router.post("/{round_id}/scores", status_code=201)
async def submit_score(
    round_id: int,
    data: ScoreSubmit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    round_ = await db.get(Round, round_id)
    if not round_ or round_.user_id != user.id:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_.completed_at:
        raise HTTPException(status_code=400, detail="Round already completed")

    # Find hole by number in this layout
    result = await db.execute(
        select(Hole).where(Hole.layout_id == round_.layout_id, Hole.hole_number == data.hole_number)
    )
    hole = result.scalar_one_or_none()
    if not hole:
        raise HTTPException(status_code=400, detail=f"Hole {data.hole_number} not found in layout")

    score = HoleScore(
        round_id=round_id,
        hole_id=hole.id,
        strokes=data.strokes,
        putts=data.putts,
        ob_strokes=data.ob_strokes,
        fairway_hit=data.fairway_hit,
    )
    db.add(score)
    await db.flush()
    return {"id": score.id, "hole_number": data.hole_number, "strokes": data.strokes}


@router.put("/{round_id}/complete", response_model=RoundDetailOut)
async def complete_round(
    round_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Round).where(Round.id == round_id).options(selectinload(Round.scores))
    )
    round_ = result.scalar_one_or_none()
    if not round_ or round_.user_id != user.id:
        raise HTTPException(status_code=404, detail="Round not found")

    # Calculate totals
    total_strokes = sum(s.strokes for s in round_.scores)

    # Get layout par
    from app.models.course import Layout

    layout = await db.get(Layout, round_.layout_id)
    total_par = layout.total_par if layout else 54

    round_.total_strokes = total_strokes
    round_.total_score = total_strokes - total_par
    round_.completed_at = datetime.now(timezone.utc)

    await db.flush()
    return RoundDetailOut.model_validate(round_)
