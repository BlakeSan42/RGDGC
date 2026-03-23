import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.course import Hole, Layout
from app.models.league import Event, Result
from app.models.round import HoleScore, Round, RoundGroup
from app.models.user import User
from app.schemas.round import (
    GroupCreateRequest,
    GroupRoundOut,
    GroupScorecardOut,
    RoundCompleteOut,
    RoundCreate,
    RoundDetailOut,
    RoundOut,
    ScoringBreakdown,
    ScoreSubmit,
    ShareLinkOut,
)
from app.services.stats_service import calculate_scoring_breakdown

router = APIRouter()

SHARE_BASE_URL = "https://disc.rgdgc.com/round"


def _generate_share_code() -> str:
    """Generate a short, URL-safe share code (10 chars)."""
    return secrets.token_urlsafe(8)[:10]


@router.post("", response_model=RoundOut, status_code=201)
async def start_round(
    data: RoundCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    round_ = Round(
        user_id=user.id,
        layout_id=data.layout_id,
        is_practice=data.is_practice,
        event_id=data.event_id,
    )
    db.add(round_)
    await db.flush()
    return RoundOut.model_validate(round_)


@router.get("", response_model=list[RoundOut])
async def list_rounds(
    limit: int = Query(20, le=100),
    layout_id: int | None = None,
    user_id: int | None = Query(None, description="Filter by user ID (public). If omitted, returns current user's rounds."),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_user_id = user_id if user_id else user.id
    stmt = select(Round).where(Round.user_id == target_user_id).order_by(Round.started_at.desc()).limit(limit)
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
        disc_used=data.disc_used,
        circle_hit=data.circle_hit,
        scramble=data.scramble,
        drive_distance=data.drive_distance,
        is_dnf=False,
    )
    db.add(score)
    await db.flush()
    return {"id": score.id, "hole_number": data.hole_number, "strokes": data.strokes}


@router.put("/{round_id}/scores/{hole_number}")
async def update_hole_score(
    round_id: int,
    hole_number: int,
    data: ScoreSubmit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a previously submitted hole score. Owner only. Round must not be completed."""
    round_ = await db.get(Round, round_id)
    if not round_ or round_.user_id != user.id:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_.completed_at:
        raise HTTPException(status_code=400, detail="Round already completed — cannot edit scores")

    # Find the hole in this layout
    hole_result = await db.execute(
        select(Hole).where(Hole.layout_id == round_.layout_id, Hole.hole_number == hole_number)
    )
    hole = hole_result.scalar_one_or_none()
    if not hole:
        raise HTTPException(status_code=400, detail=f"Hole {hole_number} not found in layout")

    # Find existing score for this hole
    score_result = await db.execute(
        select(HoleScore).where(
            and_(HoleScore.round_id == round_id, HoleScore.hole_id == hole.id)
        )
    )
    existing_score = score_result.scalar_one_or_none()
    if not existing_score:
        raise HTTPException(status_code=404, detail=f"No score found for hole {hole_number}")

    # Update fields
    existing_score.strokes = data.strokes
    existing_score.putts = data.putts
    existing_score.ob_strokes = data.ob_strokes
    existing_score.fairway_hit = data.fairway_hit
    existing_score.disc_used = data.disc_used
    existing_score.circle_hit = data.circle_hit
    existing_score.scramble = data.scramble
    existing_score.drive_distance = data.drive_distance

    await db.flush()
    return {"id": existing_score.id, "hole_number": hole_number, "strokes": existing_score.strokes}


@router.put("/{round_id}/complete", response_model=RoundCompleteOut)
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
    layout = await db.get(Layout, round_.layout_id)
    total_par = layout.total_par if layout else 54

    round_.total_strokes = total_strokes
    round_.total_score = total_strokes - total_par
    round_.completed_at = datetime.utcnow()

    # Generate share code on completion
    round_.share_code = _generate_share_code()

    await db.flush()

    # --- Auto-create Result when round is linked to an event ---
    if round_.event_id and not round_.is_practice:
        event = await db.get(Event, round_.event_id)
        if event:
            # Count existing results for position calculation
            count_stmt = select(func.count(Result.id)).where(
                Result.event_id == round_.event_id
            )
            existing_count = (await db.execute(count_stmt)).scalar_one()

            # Preliminary position (will be recalculated on event finalize)
            position = existing_count + 1

            # Points based on field_size rule: points = num_participants - position + 1
            field_size = event.num_players or (existing_count + 1)
            points_earned = max(field_size - position + 1, 0)

            event_result = Result(
                event_id=round_.event_id,
                user_id=user.id,
                round_id=round_.id,
                total_strokes=total_strokes,
                total_score=round_.total_score,
                position=position,
                points_earned=points_earned,
                handicap_used=float(user.handicap) if user.handicap else None,
            )
            db.add(event_result)
            await db.flush()

    # --- Award $RGDG tokens for round completion (fire and forget) ---
    if not round_.is_practice:
        try:
            from app.services.token_service import award_round_completion
            await award_round_completion(db, user.id)
        except Exception:
            pass  # Token reward failure must never break round completion

    # --- Auto-calculate handicap on round completion ---
    if not round_.is_practice:
        await _update_handicap(user, db)

    # Build scoring breakdown by fetching hole pars
    hole_ids = [s.hole_id for s in round_.scores]
    holes_result = await db.execute(select(Hole).where(Hole.id.in_(hole_ids)))
    holes_by_id = {h.id: h for h in holes_result.scalars().all()}
    breakdown = calculate_scoring_breakdown(round_.scores, holes_by_id)

    # Check personal best for this layout
    pb_stmt = select(func.min(Round.total_score)).where(
        Round.user_id == user.id,
        Round.layout_id == round_.layout_id,
        Round.completed_at.is_not(None),
        Round.id != round_.id,
    )
    previous_best = (await db.execute(pb_stmt)).scalar_one_or_none()
    is_personal_best = previous_best is None or round_.total_score < previous_best

    out = RoundCompleteOut.model_validate(round_)
    out.scoring_breakdown = ScoringBreakdown(**breakdown)
    out.is_personal_best = is_personal_best
    return out


# --- Scorecard Sharing ---


@router.get("/{round_id}/share", response_model=ShareLinkOut)
async def get_share_link(
    round_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a shareable link for a completed round."""
    round_ = await db.get(Round, round_id)
    if not round_ or round_.user_id != user.id:
        raise HTTPException(status_code=404, detail="Round not found")
    if not round_.completed_at:
        raise HTTPException(status_code=400, detail="Round must be completed before sharing")

    # Generate share code if not already set
    if not round_.share_code:
        round_.share_code = _generate_share_code()
        await db.flush()

    return ShareLinkOut(
        share_url=f"{SHARE_BASE_URL}/{round_.share_code}",
        share_code=round_.share_code,
    )


# --- Group / Card Play ---


@router.post("/group", response_model=GroupScorecardOut, status_code=201)
async def create_group(
    data: GroupCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a group round -- creates rounds for multiple players on the same card."""
    from app.models.course import Layout

    # Verify layout exists
    layout = await db.get(Layout, data.layout_id)
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Verify event exists if provided
    if data.event_id:
        from app.models.league import Event
        event = await db.get(Event, data.event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

    # Build full player list: current user + specified player_ids (deduplicated)
    all_player_ids = list(dict.fromkeys([user.id] + data.player_ids))

    # Verify all players exist
    players_result = await db.execute(select(User).where(User.id.in_(all_player_ids)))
    found_players = {p.id: p for p in players_result.scalars().all()}
    missing = [pid for pid in all_player_ids if pid not in found_players]
    if missing:
        raise HTTPException(status_code=400, detail=f"Player IDs not found: {missing}")

    # Create the group
    group = RoundGroup(
        created_by=user.id,
        layout_id=data.layout_id,
        event_id=data.event_id,
    )
    db.add(group)
    await db.flush()

    # Create a round for each player
    rounds = []
    for pid in all_player_ids:
        r = Round(
            user_id=pid,
            layout_id=data.layout_id,
            group_id=group.id,
            event_id=data.event_id,
        )
        db.add(r)
        rounds.append(r)
    await db.flush()

    # Build response
    players_out = []
    for r in rounds:
        p = found_players[r.user_id]
        players_out.append(GroupRoundOut(
            round_id=r.id,
            user_id=r.user_id,
            username=p.username,
            display_name=p.display_name,
            total_score=None,
            total_strokes=None,
            completed_at=None,
            scores=[],
        ))

    return GroupScorecardOut(
        group_id=group.id,
        layout_id=group.layout_id,
        event_id=group.event_id,
        created_at=group.created_at,
        players=players_out,
    )


@router.get("/group/{group_id}", response_model=GroupScorecardOut)
async def get_group_scorecard(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get live scorecard for all players in a group."""
    group = await db.get(RoundGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Fetch all rounds in this group with their scores
    result = await db.execute(
        select(Round)
        .where(Round.group_id == group_id)
        .options(selectinload(Round.scores))
    )
    rounds = result.scalars().all()

    if not rounds:
        raise HTTPException(status_code=404, detail="No rounds found for this group")

    # Fetch player info
    player_ids = [r.user_id for r in rounds]
    players_result = await db.execute(select(User).where(User.id.in_(player_ids)))
    players_by_id = {p.id: p for p in players_result.scalars().all()}

    players_out = []
    for r in rounds:
        p = players_by_id[r.user_id]
        scores_out = [
            {
                "id": s.id,
                "hole_id": s.hole_id,
                "strokes": s.strokes,
                "putts": s.putts,
                "ob_strokes": s.ob_strokes,
                "fairway_hit": s.fairway_hit,
                "disc_used": s.disc_used,
                "circle_hit": s.circle_hit,
                "scramble": s.scramble,
                "drive_distance": s.drive_distance,
            }
            for s in r.scores
        ]
        players_out.append(GroupRoundOut(
            round_id=r.id,
            user_id=r.user_id,
            username=p.username,
            display_name=p.display_name,
            total_score=r.total_score,
            total_strokes=r.total_strokes,
            completed_at=r.completed_at,
            scores=scores_out,
        ))

    return GroupScorecardOut(
        group_id=group.id,
        layout_id=group.layout_id,
        event_id=group.event_id,
        created_at=group.created_at,
        players=players_out,
    )


# --- Handicap Calculation ---


async def _update_handicap(user: User, db: AsyncSession) -> None:
    """Recalculate player handicap from last 10 completed non-practice rounds.

    Simplified PDGA-style: average of best 5 scores relative to par * 0.9
    """
    stmt = (
        select(Round.total_score)
        .where(
            Round.user_id == user.id,
            Round.completed_at.is_not(None),
            Round.is_practice.is_(False),
            Round.total_score.is_not(None),
        )
        .order_by(Round.completed_at.desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    recent_scores = [row[0] for row in result.all()]

    if len(recent_scores) < 3:
        # Not enough rounds for a meaningful handicap
        return

    # Take best 5 (or fewer if less than 5 available)
    best_n = min(5, len(recent_scores))
    best_scores = sorted(recent_scores)[:best_n]
    avg_best = sum(best_scores) / best_n
    handicap = round(avg_best * 0.9, 1)

    user.handicap = handicap
    await db.flush()
