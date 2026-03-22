from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.putting import PuttAttempt
from app.models.user import User
from app.schemas.putting import PuttAttemptCreate, PuttBatchCreate, PuttProbability, PuttingStats
from app.services.putting_service import (
    calculate_make_probability,
    get_putting_stats,
    get_tour_average,
    classify_zone,
    SKILL_PARAMS,
)

router = APIRouter()

METERS_TO_FEET = 3.28084


@router.post("/attempt", status_code=201)
async def log_attempt(
    data: PuttAttemptCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = PuttAttempt(
        user_id=user.id,
        round_id=data.round_id,
        distance_meters=data.distance_meters,
        zone=data.zone,
        made=data.made,
        elevation_change=data.elevation_change,
        wind_speed=data.wind_speed,
        wind_direction=data.wind_direction,
        chain_hit=data.chain_hit,
        result_type=data.result_type,
        putt_style=data.putt_style,
        disc_used=data.disc_used,
        pressure=data.pressure,
    )
    db.add(attempt)
    await db.flush()
    return {"id": attempt.id}


@router.post("/batch", status_code=201)
async def batch_sync(
    data: PuttBatchCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = 0
    for a in data.attempts:
        attempt = PuttAttempt(
            user_id=user.id,
            round_id=a.round_id,
            distance_meters=a.distance_meters,
            zone=a.zone,
            made=a.made,
            elevation_change=a.elevation_change,
            wind_speed=a.wind_speed,
            wind_direction=a.wind_direction,
            chain_hit=a.chain_hit,
            result_type=a.result_type,
            putt_style=a.putt_style,
            disc_used=a.disc_used,
            pressure=a.pressure,
        )
        db.add(attempt)
        created += 1

    await db.flush()
    return {"synced": created}


@router.get("/stats", response_model=PuttingStats)
async def putting_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_putting_stats(db, user.id)
    return PuttingStats(**stats)


@router.get("/probability", response_model=PuttProbability)
async def putt_probability(
    distance_meters: float = Query(..., gt=0, le=50),
    wind_speed: float = Query(0, ge=0),
    wind_direction: int = Query(0, ge=0, le=360),
    elevation_change: float = Query(0),
    skill_level: str = Query("recreational"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    params = SKILL_PARAMS.get(skill_level)
    prob = calculate_make_probability(
        distance_meters, params, wind_speed, wind_direction, elevation_change
    )
    tour_avg = get_tour_average(distance_meters)

    # Get personal average at this distance (approximate zone)
    stats = await get_putting_stats(db, user.id)
    zone = classify_zone(distance_meters)
    personal = stats.get("by_zone", {}).get(zone, {}).get("percentage")
    personal_avg = personal / 100 if personal else None

    return PuttProbability(
        distance_meters=distance_meters,
        distance_feet=round(distance_meters * METERS_TO_FEET, 1),
        zone=zone,
        make_probability=round(prob, 3),
        tour_average=round(tour_avg, 3),
        personal_average=round(personal_avg, 3) if personal_avg is not None else None,
        wind_adjustment=round(wind_speed * distance_meters * 0.002, 3) if wind_speed > 0 else None,
        elevation_adjustment=round(abs(elevation_change) / max(distance_meters, 0.1) * 0.3, 3) if elevation_change != 0 else None,
    )
