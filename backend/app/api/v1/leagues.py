from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.league import League
from app.models.league_member import LeagueMember
from app.models.user import User
from app.schemas.league import LeaderboardEntry, LeagueMemberOut, LeagueOut
from app.services.cache_service import CacheService
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
    # Check cache first
    cache_key = f"leaderboard:{league_id}:{limit}"
    cached = await CacheService.get(cache_key)
    if cached is not None:
        return [LeaderboardEntry(**e) for e in cached]

    try:
        entries = await get_leaderboard(db, league_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Cache for 5 minutes
    await CacheService.set(cache_key, entries, ttl=300)

    return [LeaderboardEntry(**e) for e in entries]


@router.post("/{league_id}/join", status_code=status.HTTP_201_CREATED)
async def join_league(
    league_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join a league. Creates a membership record for the current user."""
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if not league.is_active:
        raise HTTPException(status_code=400, detail="League is not active")

    # Check if already a member
    existing = await db.execute(
        select(LeagueMember).where(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id == user.id,
        )
    )
    member = existing.scalar_one_or_none()
    if member:
        if member.is_active:
            raise HTTPException(status_code=409, detail="Already a member of this league")
        # Re-activate if previously left
        member.is_active = True
        await db.flush()
        return {"message": "Rejoined league", "league_id": league_id}

    new_member = LeagueMember(league_id=league_id, user_id=user.id)
    db.add(new_member)
    await db.flush()
    return {"message": "Joined league", "league_id": league_id}


@router.delete("/{league_id}/leave", status_code=status.HTTP_200_OK)
async def leave_league(
    league_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a league. Deactivates the membership record."""
    result = await db.execute(
        select(LeagueMember).where(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id == user.id,
            LeagueMember.is_active.is_(True),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this league")

    member.is_active = False
    await db.flush()
    return {"message": "Left league", "league_id": league_id}


@router.get("/{league_id}/members")
async def list_league_members(
    league_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all active members of a league."""
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    result = await db.execute(
        select(LeagueMember, User)
        .join(User, LeagueMember.user_id == User.id)
        .where(
            LeagueMember.league_id == league_id,
            LeagueMember.is_active.is_(True),
        )
        .order_by(LeagueMember.joined_at)
    )

    members = []
    for lm, u in result.all():
        member_data = LeagueMemberOut.model_validate(lm)
        member_data.username = u.username
        member_data.display_name = u.display_name
        members.append(member_data)

    return members
