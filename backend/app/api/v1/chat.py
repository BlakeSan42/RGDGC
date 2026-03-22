from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.league import Event, League
from app.models.user import User
from app.services.points_service import get_leaderboard

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    suggestions: list[str]


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the Clawd bot and get a response.

    Currently uses keyword matching as a placeholder. In production this
    would proxy to the Claude API or OpenClaw service.
    """
    msg = data.message.lower().strip()

    # --- Standings / Leaderboard ---
    if any(kw in msg for kw in ("standings", "leaderboard", "points", "ranking")):
        return await _handle_standings(db)

    # --- Events ---
    if any(kw in msg for kw in ("event", "next event", "schedule", "upcoming")):
        return await _handle_events(db)

    # --- Rules ---
    if any(kw in msg for kw in ("rule", "rules", "pdga", "regulation")):
        return _handle_rules()

    # --- Help ---
    if any(kw in msg for kw in ("help", "what can you do", "commands")):
        return ChatResponse(
            response=(
                "I'm Clawd, your RGDGC assistant! Here's what I can help with:\n\n"
                "- **Standings** — Ask about league standings or leaderboards\n"
                "- **Events** — Find out about upcoming league events\n"
                "- **Rules** — Quick PDGA rules lookup\n"
                "- **General** — Disc golf tips and club info"
            ),
            suggestions=["Show me the standings", "When is the next event?", "What are the OB rules?"],
        )

    # --- Default ---
    return ChatResponse(
        response=(
            f"Hey {user.display_name or user.username}! "
            "I'm Clawd, your RGDGC assistant! "
            "Ask me about standings, events, or disc golf rules."
        ),
        suggestions=[
            "Show me the standings",
            "When is the next event?",
            "Explain the putting zones",
        ],
    )


async def _handle_standings(db: AsyncSession) -> ChatResponse:
    """Fetch active league standings and format a response."""
    result = await db.execute(select(League).where(League.is_active.is_(True)).limit(3))
    leagues = result.scalars().all()

    if not leagues:
        return ChatResponse(
            response="No active leagues right now. Check back when the next season starts!",
            suggestions=["When is the next event?", "Show me the rules"],
        )

    parts = []
    for league in leagues:
        try:
            entries = await get_leaderboard(db, league.id, limit=5)
        except ValueError:
            continue

        if not entries:
            continue

        lines = [f"**{league.name}** ({league.season or 'Current'})"]
        for e in entries:
            lines.append(
                f"  {e['rank']}. {e['player_name']} — {e['total_points']} pts "
                f"({e['events_played']} events)"
            )
        parts.append("\n".join(lines))

    if not parts:
        return ChatResponse(
            response="Leagues are active but no results posted yet. Stay tuned!",
            suggestions=["When is the next event?"],
        )

    return ChatResponse(
        response="Here are the current standings:\n\n" + "\n\n".join(parts),
        suggestions=["Show full leaderboard", "When is the next event?", "My stats"],
    )


async def _handle_events(db: AsyncSession) -> ChatResponse:
    """Fetch upcoming events and format a response."""
    result = await db.execute(
        select(Event)
        .where(Event.status == "upcoming")
        .order_by(Event.event_date)
        .limit(5)
    )
    events = result.scalars().all()

    if not events:
        return ChatResponse(
            response="No upcoming events scheduled right now. Check the league page for updates!",
            suggestions=["Show me the standings", "What are the rules?"],
        )

    lines = ["Here are the upcoming events:\n"]
    for event in events:
        name = event.name or "League Event"
        fee = f" (${float(event.entry_fee):.0f} entry)" if event.entry_fee else ""
        lines.append(f"- **{name}** — {event.event_date.strftime('%B %d, %Y')}{fee}")

    return ChatResponse(
        response="\n".join(lines),
        suggestions=["How do I check in?", "Show me the standings", "What are the rules?"],
    )


def _handle_rules() -> ChatResponse:
    """Return common PDGA rules as a quick reference."""
    return ChatResponse(
        response=(
            "Here are some key PDGA rules:\n\n"
            "- **Teeing off**: At least one supporting point must be within the teeing area.\n"
            "- **Lie**: Mark your lie with a mini marker disc behind your disc.\n"
            "- **OB (Out of Bounds)**: Take a 1-stroke penalty and play from the last in-bounds position "
            "or a designated drop zone.\n"
            "- **Mandatory (Mando)**: Must pass the correct side of the mando. "
            "Violation = rethrow or play from drop zone.\n"
            "- **Completion**: A hole is complete when the disc comes to rest in the basket.\n"
            "- **C1 putting (inside 10m)**: You must demonstrate balance behind your lie "
            "before moving forward.\n\n"
            "For the full PDGA rulebook, visit pdga.com/rules."
        ),
        suggestions=["What are putting zones?", "OB rules for our course", "Show me the standings"],
    )
