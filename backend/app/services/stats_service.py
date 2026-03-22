from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Hole, Layout
from app.models.round import HoleScore, Round


async def get_player_stats(db: AsyncSession, user_id: int) -> dict:
    """Calculate comprehensive stats from a player's round history."""

    # ── Basic round stats ──
    round_stmt = select(
        func.count(Round.id).label("total_rounds"),
        func.avg(Round.total_score).label("avg_score"),
        func.min(Round.total_score).label("best_round"),
        func.max(Round.total_score).label("worst_round"),
        func.avg(Round.total_strokes).label("avg_strokes"),
    ).where(Round.user_id == user_id, Round.completed_at.is_not(None))

    rr = (await db.execute(round_stmt)).one()

    # ── Hole-level stats (from HoleScore joined with Hole for par) ──
    hole_stmt = (
        select(
            func.count(HoleScore.id).label("total_holes"),
            func.sum(HoleScore.putts).label("total_putts"),
            func.count(HoleScore.putts).label("holes_with_putts"),
            func.sum(HoleScore.ob_strokes).label("total_ob"),
            # Fairway
            func.sum(case((HoleScore.fairway_hit.is_(True), 1), else_=0)).label("fairway_hits"),
            func.sum(case((HoleScore.fairway_hit.is_not(None), 1), else_=0)).label("fairway_tracked"),
            # Circle hit
            func.sum(case((HoleScore.circle_hit.in_(["c1", "parked"]), 1), else_=0)).label("c1_reg"),
            func.sum(case((HoleScore.circle_hit.in_(["c1", "c2", "parked"]), 1), else_=0)).label("c2_reg"),
            func.sum(case((HoleScore.circle_hit == "parked", 1), else_=0)).label("parked"),
            func.sum(case((HoleScore.circle_hit.is_not(None), 1), else_=0)).label("circle_tracked"),
            # Scramble
            func.sum(case((and_(HoleScore.scramble.is_(True)), 1), else_=0)).label("scrambles"),
            func.sum(case((HoleScore.fairway_hit.is_(False), 1), else_=0)).label("missed_fairways"),
            # Scoring distribution (need par from Hole)
            func.sum(case((HoleScore.strokes - Hole.par <= -2, 1), else_=0)).label("eagles"),
            func.sum(case((HoleScore.strokes - Hole.par == -1, 1), else_=0)).label("birdies"),
            func.sum(case((HoleScore.strokes - Hole.par == 0, 1), else_=0)).label("pars"),
            func.sum(case((HoleScore.strokes - Hole.par == 1, 1), else_=0)).label("bogeys"),
            func.sum(case((HoleScore.strokes - Hole.par == 2, 1), else_=0)).label("doubles"),
            func.sum(case((HoleScore.strokes - Hole.par >= 3, 1), else_=0)).label("others"),
        )
        .join(Round, HoleScore.round_id == Round.id)
        .join(Hole, HoleScore.hole_id == Hole.id)
        .where(Round.user_id == user_id, Round.completed_at.is_not(None))
    )

    hr = (await db.execute(hole_stmt)).one()

    total_holes = hr.total_holes or 0
    holes_with_putts = hr.holes_with_putts or 0
    fairway_tracked = hr.fairway_tracked or 0
    circle_tracked = hr.circle_tracked or 0
    missed_fairways = hr.missed_fairways or 0

    # ── Personal bests per layout ──
    pb_stmt = (
        select(
            Round.layout_id,
            Layout.name.label("layout_name"),
            func.min(Round.total_score).label("best_score"),
        )
        .join(Layout, Round.layout_id == Layout.id)
        .where(Round.user_id == user_id, Round.completed_at.is_not(None))
        .group_by(Round.layout_id, Layout.name)
    )

    pb_rows = (await db.execute(pb_stmt)).all()

    # For each layout, get the date of the personal best
    personal_bests = []
    for row in pb_rows:
        date_stmt = (
            select(Round.completed_at)
            .where(
                Round.user_id == user_id,
                Round.layout_id == row.layout_id,
                Round.total_score == row.best_score,
                Round.completed_at.is_not(None),
            )
            .order_by(Round.completed_at.desc())
            .limit(1)
        )
        date_result = (await db.execute(date_stmt)).scalar_one_or_none()
        personal_bests.append({
            "layout_id": row.layout_id,
            "layout_name": row.layout_name,
            "score": row.best_score,
            "date": date_result.isoformat() if date_result else None,
        })

    # ── OB per round ──
    total_rounds = rr.total_rounds or 0
    total_ob = hr.total_ob or 0

    return {
        "total_rounds": total_rounds,
        "avg_score": round(float(rr.avg_score), 1) if rr.avg_score else None,
        "best_round": rr.best_round,
        "worst_round": rr.worst_round,
        "avg_strokes": round(float(rr.avg_strokes), 1) if rr.avg_strokes else None,
        "fairway_hit_pct": round(hr.fairway_hits / fairway_tracked * 100, 1) if fairway_tracked > 0 else None,
        "c1_in_regulation": round(hr.c1_reg / circle_tracked * 100, 1) if circle_tracked > 0 else None,
        "c2_in_regulation": round(hr.c2_reg / circle_tracked * 100, 1) if circle_tracked > 0 else None,
        "scramble_rate": round(hr.scrambles / missed_fairways * 100, 1) if missed_fairways > 0 else None,
        "parked_pct": round(hr.parked / circle_tracked * 100, 1) if circle_tracked > 0 else None,
        "avg_putts_per_hole": round(hr.total_putts / holes_with_putts, 2) if holes_with_putts > 0 else None,
        "avg_ob_per_round": round(total_ob / total_rounds, 2) if total_rounds > 0 else None,
        "personal_bests": personal_bests,
        "scoring_distribution": {
            "eagles": hr.eagles or 0,
            "birdies": hr.birdies or 0,
            "pars": hr.pars or 0,
            "bogeys": hr.bogeys or 0,
            "doubles": hr.doubles or 0,
            "others": hr.others or 0,
        },
    }


async def get_hole_averages(
    db: AsyncSession, layout_id: int, user_id: int | None = None
) -> list[dict]:
    """Average score per hole on a layout. If user_id given, personal averages."""

    filters = [Hole.layout_id == layout_id]
    if user_id is not None:
        filters.append(Round.user_id == user_id)

    stmt = (
        select(
            Hole.hole_number,
            Hole.par,
            func.avg(HoleScore.strokes).label("avg_score"),
            func.avg(HoleScore.putts).label("avg_putts"),
            func.min(HoleScore.strokes).label("best_score"),
            func.count(HoleScore.id).label("times_played"),
        )
        .join(HoleScore, HoleScore.hole_id == Hole.id)
        .join(Round, HoleScore.round_id == Round.id)
        .where(Round.completed_at.is_not(None), *filters)
        .group_by(Hole.hole_number, Hole.par)
        .order_by(Hole.hole_number)
    )

    rows = (await db.execute(stmt)).all()

    return [
        {
            "hole_number": r.hole_number,
            "par": r.par,
            "avg_score": round(float(r.avg_score), 2) if r.avg_score else None,
            "avg_putts": round(float(r.avg_putts), 2) if r.avg_putts else None,
            "best_score": r.best_score,
            "times_played": r.times_played,
        }
        for r in rows
    ]


def calculate_scoring_breakdown(scores: list, holes_by_id: dict) -> dict:
    """Calculate scoring breakdown from a list of HoleScore objects.

    Args:
        scores: List of HoleScore model instances.
        holes_by_id: Dict mapping hole_id -> Hole model instance (must have .par).

    Returns:
        Dict with keys: eagles, birdies, pars, bogeys, doubles, others.
    """
    breakdown = {"eagles": 0, "birdies": 0, "pars": 0, "bogeys": 0, "doubles": 0, "others": 0}
    for s in scores:
        hole = holes_by_id.get(s.hole_id)
        if not hole:
            continue
        diff = s.strokes - hole.par
        if diff <= -2:
            breakdown["eagles"] += 1
        elif diff == -1:
            breakdown["birdies"] += 1
        elif diff == 0:
            breakdown["pars"] += 1
        elif diff == 1:
            breakdown["bogeys"] += 1
        elif diff == 2:
            breakdown["doubles"] += 1
        else:
            breakdown["others"] += 1
    return breakdown
