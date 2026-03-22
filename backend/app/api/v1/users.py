from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.models.round import Round
from app.models.league import Result, Event
from app.schemas.user import UserOut

router = APIRouter()


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    season: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current: User = Depends(get_current_user),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Round stats
    round_stmt = select(
        func.count(Round.id).label("total_rounds"),
        func.count(Round.completed_at).label("completed_rounds"),
        func.avg(Round.total_score).label("avg_score"),
        func.min(Round.total_score).label("best_score"),
        func.max(Round.total_score).label("worst_score"),
        func.avg(Round.total_strokes).label("avg_strokes"),
    ).where(Round.user_id == user_id, Round.completed_at.is_not(None))

    round_result = await db.execute(round_stmt)
    rr = round_result.one()

    # League stats
    league_stmt = select(
        func.count(Result.id).label("events_played"),
        func.sum(Result.points_earned).label("total_points"),
        func.sum(case((Result.position == 1, 1), else_=0)).label("wins"),
        func.sum(case((Result.position <= 3, 1), else_=0)).label("podiums"),
        func.min(Result.position).label("best_finish"),
    ).where(Result.user_id == user_id)

    if season:
        league_stmt = league_stmt.join(Event).where(
            Event.status == "completed"
        )

    league_result = await db.execute(league_stmt)
    lr = league_result.one()

    return {
        "user": UserOut.model_validate(user).model_dump(),
        "rounds": {
            "total": rr.total_rounds or 0,
            "completed": rr.completed_rounds or 0,
            "avg_score": round(float(rr.avg_score), 1) if rr.avg_score else None,
            "best_score": rr.best_score,
            "worst_score": rr.worst_score,
            "avg_strokes": round(float(rr.avg_strokes), 1) if rr.avg_strokes else None,
        },
        "league": {
            "events_played": lr.events_played or 0,
            "total_points": lr.total_points or 0,
            "wins": lr.wins or 0,
            "podiums": lr.podiums or 0,
            "best_finish": lr.best_finish,
        },
        "handicap": float(user.handicap) if user.handicap else None,
    }


@router.get("", response_model=list[UserOut])
async def list_users(
    limit: int = Query(50, le=200),
    role: str | None = None,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.is_active.is_(True)).limit(limit)
    if role:
        stmt = stmt.where(User.role == role)
    result = await db.execute(stmt)
    return [UserOut.model_validate(u) for u in result.scalars().all()]
