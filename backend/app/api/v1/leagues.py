from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.league import League
from app.schemas.league import LeaderboardEntry, LeagueOut
from app.services.points_service import get_leaderboard

router = APIRouter()


@router.get("", response_model=list[LeagueOut])
async def list_leagues(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(League).where(League.is_active.is_(True)))
    return [LeagueOut.model_validate(l) for l in result.scalars().all()]


@router.get("/{league_id}", response_model=LeagueOut)
async def get_league(league_id: int, db: AsyncSession = Depends(get_db)):
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return LeagueOut.model_validate(league)


@router.get("/{league_id}/leaderboard", response_model=list[LeaderboardEntry])
async def league_leaderboard(
    league_id: int,
    limit: int = Query(10, le=100),
    db: AsyncSession = Depends(get_db),
):
    try:
        entries = await get_leaderboard(db, league_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [LeaderboardEntry(**e) for e in entries]
