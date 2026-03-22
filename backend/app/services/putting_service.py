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


def _expected_putts_tour(distance_meters: float) -> float:
    """
    Expected number of putts from a given distance using tour average data.

    For a single putt attempt: expected_putts ~= 1 + (1 - P_make).
    If you miss, you typically need one more putt from a close-in distance.
    """
    p_make = get_tour_average(distance_meters)
    # If you make it, 1 putt. If you miss, assume ~1.05 putts remaining (tap-in).
    return 1 * p_make + (1 + 1.05) * (1 - p_make)


async def calculate_strokes_gained(
    db: AsyncSession,
    user_id: int,
    player_level: str = "intermediate",
) -> dict:
    """
    Calculate strokes gained putting for a player.

    For each putt: SG = expected_putts_tour_avg(distance) - actual_putts
    A positive SG means the player is gaining strokes vs tour average.

    Returns:
        Dict with total_sg, sg_per_round, sg_c1, sg_c1x, sg_c2,
        total_putts, total_rounds_with_putts, and comparison_to_tour.
    """
    # Fetch all putt attempts for the user
    stmt = select(PuttAttempt).where(PuttAttempt.user_id == user_id)
    result = await db.execute(stmt)
    putts = result.scalars().all()

    if not putts:
        return {
            "total_sg": 0.0,
            "sg_per_round": 0.0,
            "sg_c1": 0.0,
            "sg_c1x": 0.0,
            "sg_c2": 0.0,
            "total_putts": 0,
            "total_rounds_with_putts": 0,
            "comparison_to_tour": "no_data",
        }

    total_sg = 0.0
    sg_by_zone = {"c1": 0.0, "c1x": 0.0, "c2": 0.0}
    count_by_zone = {"c1": 0, "c1x": 0, "c2": 0}
    round_ids = set()

    for putt in putts:
        distance = float(putt.distance_meters) if putt.distance_meters else 5.0
        expected = _expected_putts_tour(distance)
        actual = 1.0 if putt.made else 2.05  # miss = 1 attempt + expected tap-in

        sg = expected - actual
        total_sg += sg

        zone = putt.zone or classify_zone(distance)
        if zone in sg_by_zone:
            sg_by_zone[zone] += sg
            count_by_zone[zone] += 1

        if putt.round_id:
            round_ids.add(putt.round_id)

    total_putts = len(putts)
    total_rounds = max(len(round_ids), 1)
    sg_per_round = total_sg / total_rounds

    # Normalize zone SG to per-putt for meaningful comparison
    sg_c1 = round(sg_by_zone["c1"], 2)
    sg_c1x = round(sg_by_zone["c1x"], 2)
    sg_c2 = round(sg_by_zone["c2"], 2)

    # Comparison label
    if sg_per_round > 1.0:
        comparison = "well_above_tour"
    elif sg_per_round > 0.2:
        comparison = "above_tour"
    elif sg_per_round > -0.2:
        comparison = "near_tour"
    elif sg_per_round > -1.0:
        comparison = "below_tour"
    else:
        comparison = "well_below_tour"

    return {
        "total_sg": round(total_sg, 2),
        "sg_per_round": round(sg_per_round, 2),
        "sg_c1": sg_c1,
        "sg_c1x": sg_c1x,
        "sg_c2": sg_c2,
        "total_putts": total_putts,
        "total_rounds_with_putts": len(round_ids),
        "comparison_to_tour": comparison,
    }
