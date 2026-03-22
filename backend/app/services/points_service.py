"""
Points calculation for RGDGC leagues.

Scoring System:
- Points = Number of participants - finish position + 1
- Example: 8 players -> 1st=8pts, 2nd=7pts, ..., 8th=1pt
- Ties: Same rank, next position skipped
- DNF/DQ: 0 points
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.league import Event, Result, League


def calculate_points(num_participants: int, position: int) -> int:
    if position > num_participants:
        return 0
    return max(num_participants - position + 1, 0)


async def finalize_event(db: AsyncSession, event_id: int) -> list[Result]:
    """Calculate positions and points for a completed event."""
    event = await db.get(Event, event_id)
    if not event:
        raise ValueError(f"Event {event_id} not found")

    result = await db.execute(
        select(Result).where(Result.event_id == event_id)
    )
    results = list(result.scalars().all())

    completed = [r for r in results if not r.dnf and not r.dq]
    incomplete = [r for r in results if r.dnf or r.dq]

    # Sort by total_score ascending (lower is better in golf)
    completed.sort(key=lambda r: r.total_score)

    num_participants = len(results)
    current_position = 1
    i = 0

    while i < len(completed):
        current_score = completed[i].total_score
        tied = []

        while i < len(completed) and completed[i].total_score == current_score:
            tied.append(completed[i])
            i += 1

        points = calculate_points(num_participants, current_position)

        for r in tied:
            r.position = current_position
            r.points_earned = points

        current_position += len(tied)

    for r in incomplete:
        r.position = len(completed) + 1
        r.points_earned = 0

    event.status = "completed"
    event.num_players = num_participants

    await db.flush()
    return results


async def get_leaderboard(db: AsyncSession, league_id: int, limit: int = 10) -> list[dict]:
    """Generate season leaderboard from all event results."""
    league = await db.get(League, league_id)
    if not league:
        raise ValueError(f"League {league_id} not found")

    # Get all results for this league's events
    stmt = (
        select(Result)
        .join(Event, Result.event_id == Event.id)
        .where(Event.league_id == league_id, Event.status == "completed")
    )
    result = await db.execute(stmt)
    all_results = list(result.scalars().all())

    # Aggregate by player
    player_stats: dict[int, dict] = {}

    for r in all_results:
        pid = r.user_id
        if pid not in player_stats:
            # Need to load user name
            from app.models.user import User

            user = await db.get(User, pid)
            player_stats[pid] = {
                "player_id": pid,
                "player_name": user.display_name or user.username if user else f"Player {pid}",
                "events_played": 0,
                "total_points": 0,
                "all_points": [],
                "wins": 0,
                "podiums": 0,
                "best_finish": None,
            }

        stats = player_stats[pid]
        stats["events_played"] += 1
        stats["all_points"].append(r.points_earned or 0)

        pos = r.position or 999
        if stats["best_finish"] is None or pos < stats["best_finish"]:
            stats["best_finish"] = pos
        if pos == 1:
            stats["wins"] += 1
        if pos <= 3:
            stats["podiums"] += 1

    # Calculate totals with drop_worst
    leaderboard = []
    for stats in player_stats.values():
        points_list = sorted(stats["all_points"], reverse=True)
        drop = league.drop_worst or 0

        if drop > 0 and len(points_list) > drop:
            counted = points_list[:-drop]
        else:
            counted = points_list

        total = sum(counted)
        avg = round(total / max(len(counted), 1), 2)

        leaderboard.append({
            "player_id": stats["player_id"],
            "player_name": stats["player_name"],
            "total_points": total,
            "events_played": stats["events_played"],
            "wins": stats["wins"],
            "podiums": stats["podiums"],
            "average_points": avg,
            "best_finish": stats["best_finish"],
        })

    leaderboard.sort(key=lambda x: (-x["total_points"], -x["wins"], -x["average_points"]))

    # Assign ranks
    for i, entry in enumerate(leaderboard):
        if i > 0 and entry["total_points"] == leaderboard[i - 1]["total_points"]:
            entry["rank"] = leaderboard[i - 1]["rank"]
        else:
            entry["rank"] = i + 1

    return leaderboard[:limit]
