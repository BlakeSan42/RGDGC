"""
Putting probability model for RGDGC.

Based on Gelman & Nolan (2002) — "A Probability Model for Golf Putting"
Adapted for disc golf basket dimensions and player skill levels.

P_success = P_angle * P_distance * (1 - epsilon)
"""

import math
from dataclasses import dataclass

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.putting import PuttAttempt


# Basket dimensions (meters)
BASKET_RADIUS = 0.27  # Standard PDGA basket inner radius
DISC_RADIUS = 0.108  # Standard disc radius
EFFECTIVE_RADIUS = BASKET_RADIUS - DISC_RADIUS  # 0.162m


@dataclass
class PlayerPuttingParams:
    """Fitted putting parameters for a player."""

    sigma_angle: float = 0.05  # radians (recreational default)
    sigma_distance: float = 0.8  # meters
    epsilon: float = 0.06  # random error rate


# Default parameters by skill level
SKILL_PARAMS = {
    "beginner": PlayerPuttingParams(0.08, 1.2, 0.10),
    "recreational": PlayerPuttingParams(0.05, 0.8, 0.06),
    "intermediate": PlayerPuttingParams(0.035, 0.5, 0.04),
    "advanced": PlayerPuttingParams(0.025, 0.35, 0.03),
    "pro": PlayerPuttingParams(0.018, 0.25, 0.02),
    "elite": PlayerPuttingParams(0.015, 0.20, 0.015),
}

# Tour averages by distance (meters) — 2024-2025 DGPT data
TOUR_AVERAGES = {
    3.0: 0.95,
    5.0: 0.88,
    7.0: 0.78,
    10.0: 0.65,
    12.0: 0.50,
    15.0: 0.38,
    20.0: 0.22,
}


def _normal_cdf(x: float) -> float:
    """Approximate standard normal CDF."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def calculate_make_probability(
    distance_meters: float,
    params: PlayerPuttingParams | None = None,
    wind_speed: float = 0,
    wind_direction: int = 0,
    elevation_change: float = 0,
) -> float:
    """
    Calculate probability of making a putt at given distance.

    Returns probability between 0.0 and 1.0.
    """
    if params is None:
        params = SKILL_PARAMS["recreational"]

    if distance_meters <= 0:
        return 1.0

    # Angular accuracy
    theta_0 = math.asin(min(EFFECTIVE_RADIUS / distance_meters, 1.0))
    p_angle = 2 * _normal_cdf(theta_0 / params.sigma_angle) - 1

    # Distance accuracy (how well they control speed)
    overshoot = 0.4  # typical target overshoot in meters
    p_distance = _normal_cdf(overshoot / params.sigma_distance)

    # Base probability
    p_base = p_angle * p_distance * (1 - params.epsilon)

    # Wind adjustment
    if wind_speed > 0:
        wind_factor = 1 - (wind_speed * distance_meters * 0.002)
        cross_mult = abs(math.sin(math.radians(wind_direction)))
        effective_wind = 1 - ((1 - wind_factor) * (0.5 + 0.5 * cross_mult))
        p_base *= max(effective_wind, 0.1)

    # Elevation adjustment
    if elevation_change != 0:
        grade = abs(elevation_change) / max(distance_meters, 0.1)
        elev_factor = 1 - (grade * 0.3)
        p_base *= max(elev_factor, 0.5)

    return max(min(p_base, 1.0), 0.0)


def get_tour_average(distance_meters: float) -> float:
    """Interpolate tour average make rate for a distance."""
    distances = sorted(TOUR_AVERAGES.keys())

    if distance_meters <= distances[0]:
        return TOUR_AVERAGES[distances[0]]
    if distance_meters >= distances[-1]:
        return TOUR_AVERAGES[distances[-1]]

    for i in range(len(distances) - 1):
        if distances[i] <= distance_meters <= distances[i + 1]:
            t = (distance_meters - distances[i]) / (distances[i + 1] - distances[i])
            return TOUR_AVERAGES[distances[i]] * (1 - t) + TOUR_AVERAGES[distances[i + 1]] * t

    return 0.5


def classify_zone(distance_meters: float) -> str:
    """Classify putting zone from distance."""
    if distance_meters <= 10:
        return "c1"
    elif distance_meters <= 20:
        return "c2"
    else:
        return "outside"


async def get_putting_stats(db: AsyncSession, user_id: int) -> dict:
    """Get aggregated putting statistics for a player."""
    # Overall stats
    stmt = select(
        func.count(PuttAttempt.id).label("total"),
        func.sum(case((PuttAttempt.made.is_(True), 1), else_=0)).label("makes"),
    ).where(PuttAttempt.user_id == user_id)

    result = await db.execute(stmt)
    row = result.one()
    total = row.total or 0
    makes = row.makes or 0

    # By zone
    zone_stats = {}
    for zone in ["c1", "c1x", "c2"]:
        stmt = select(
            func.count(PuttAttempt.id).label("total"),
            func.sum(case((PuttAttempt.made.is_(True), 1), else_=0)).label("makes"),
        ).where(PuttAttempt.user_id == user_id, PuttAttempt.zone == zone)

        result = await db.execute(stmt)
        zrow = result.one()
        zt = zrow.total or 0
        zm = zrow.makes or 0
        zone_stats[zone] = {
            "attempts": zt,
            "makes": zm,
            "percentage": round(zm / zt * 100, 1) if zt > 0 else 0,
        }

    return {
        "total_attempts": total,
        "total_makes": makes,
        "make_percentage": round(makes / total * 100, 1) if total > 0 else 0,
        "c1_percentage": zone_stats.get("c1", {}).get("percentage", 0),
        "c1x_percentage": zone_stats.get("c1x", {}).get("percentage", 0),
        "c2_percentage": zone_stats.get("c2", {}).get("percentage", 0),
        "by_zone": zone_stats,
    }
