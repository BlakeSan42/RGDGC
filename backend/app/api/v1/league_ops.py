"""
League Day Operations — The five features that make Sunday work.

1. Card assignments (player grouping)
2. CTP tracking (closest to pin)
3. Recurring events (auto-create weekly)
4. DNF/pickup scoring
5. Ace fund management
+ Social sharing (generate shareable images/text for Facebook)
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, desc, update, case
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
import random
import math

from app.db.database import get_db
from app.core.security import get_current_user, get_admin_user
from app.models.user import User
from app.models.league import Event, Result, League
from app.models.round import Round, HoleScore, RoundGroup
from app.models.ledger import LedgerEntry

router = APIRouter(prefix="/league-ops", tags=["league-ops"])


# ═══════════════════════════════════════════════════════════════════════════
# 1. CARD ASSIGNMENTS — Groups of 4
# ═══════════════════════════════════════════════════════════════════════════

class CardAssignmentRequest(BaseModel):
    event_id: int
    method: str = "random"  # random, handicap, snake
    group_size: int = Field(default=4, ge=2, le=6)
    shotgun_start: bool = False  # Assign starting holes?


class CardOut(BaseModel):
    card_number: int
    starting_hole: Optional[int]
    players: List[dict]


@router.post("/cards/assign", response_model=List[CardOut])
async def assign_cards(
    req: CardAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Auto-assign checked-in players to cards.
    Methods: random, handicap (balanced), snake (draft-style).
    Optional: shotgun start assigns each card a starting hole.
    """
    # Get checked-in players
    result = await db.execute(
        select(Result.user_id, User.username, User.display_name, User.handicap)
        .join(User, User.id == Result.user_id)
        .where(Result.event_id == req.event_id)
        .order_by(User.handicap.asc().nullslast())
    )
    players = [
        {"id": r.user_id, "username": r.username, "display_name": r.display_name,
         "handicap": float(r.handicap) if r.handicap else 999}
        for r in result.all()
    ]

    if len(players) < 2:
        raise HTTPException(400, "Need at least 2 checked-in players")

    # Sort/shuffle based on method
    if req.method == "random":
        random.shuffle(players)
    elif req.method == "handicap":
        players.sort(key=lambda p: p["handicap"])
    elif req.method == "snake":
        players.sort(key=lambda p: p["handicap"])

    # Create groups
    num_groups = math.ceil(len(players) / req.group_size)
    cards = [[] for _ in range(num_groups)]

    if req.method == "snake":
        # Snake draft: 1,2,3,4,4,3,2,1,1,2,3,4...
        for i, player in enumerate(players):
            cycle = i // num_groups
            idx = i % num_groups
            if cycle % 2 == 1:
                idx = num_groups - 1 - idx
            cards[idx].append(player)
    else:
        for i, player in enumerate(players):
            cards[i % num_groups].append(player)

    # Get hole count for shotgun
    event = await db.execute(select(Event).where(Event.id == req.event_id))
    event_obj = event.scalar_one_or_none()
    if not event_obj:
        raise HTTPException(404, "Event not found")

    # Build response
    response = []
    for i, card in enumerate(cards):
        starting_hole = None
        if req.shotgun_start:
            # Distribute starting holes evenly across available holes
            starting_hole = (i * (18 // max(num_groups, 1))) + 1

        response.append(CardOut(
            card_number=i + 1,
            starting_hole=starting_hole,
            players=card,
        ))

    return response


@router.post("/cards/notify")
async def notify_card_assignments(
    event_id: int,
    cards: List[CardOut],
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Push card assignments to each player."""
    from app.services.push_service import send_push_to_user

    for card in cards:
        names = ", ".join(p.get("display_name") or p.get("username", "?") for p in card.players)
        hole_text = f" | Start: Hole {card.starting_hole}" if card.starting_hole else ""
        body = f"Card {card.card_number}{hole_text}\n{names}"

        for player in card.players:
            await send_push_to_user(
                db, user_id=player["id"],
                title=f"Your Card Assignment",
                body=body,
                data={"type": "card_assignment", "event_id": str(event_id)},
            )

    return {"notified": sum(len(c.players) for c in cards)}


# ═══════════════════════════════════════════════════════════════════════════
# 2. CTP TRACKING — Closest to Pin
# ═══════════════════════════════════════════════════════════════════════════

class CTPEntry(BaseModel):
    event_id: int
    hole_number: int
    player_id: int
    distance_feet: float  # Distance from basket in feet
    distance_inches: Optional[float] = None  # For precise measurement


class CTPResult(BaseModel):
    hole_number: int
    winner_id: int
    winner_name: str
    distance: str
    pot: float


@router.post("/ctp/record")
async def record_ctp(
    entry: CTPEntry,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Record a CTP measurement. Best (shortest) distance per hole wins."""
    # Store as ledger note with CTP metadata
    total_distance = entry.distance_feet + (entry.distance_inches or 0) / 12

    # Check if this beats current best for this hole/event
    existing = await db.execute(
        select(LedgerEntry)
        .where(
            LedgerEntry.event_id == entry.event_id,
            LedgerEntry.entry_type == "ctp_measurement",
            LedgerEntry.notes.contains(f"hole:{entry.hole_number}"),
        )
        .order_by(LedgerEntry.amount.asc())
    )
    current_entries = existing.scalars().all()

    # Record the measurement (amount field stores distance for sorting)
    db_entry = LedgerEntry(
        entry_type="ctp_measurement",
        amount=Decimal(str(total_distance)),
        description=f"CTP Hole {entry.hole_number}: {total_distance:.1f}ft",
        event_id=entry.event_id,
        player_id=entry.player_id,
        recorded_by=admin.id,
        payment_method="measurement",
        notes=f"hole:{entry.hole_number}|ft:{entry.distance_feet}|in:{entry.distance_inches or 0}",
    )
    db.add(db_entry)
    await db.commit()

    is_leader = not current_entries or total_distance < float(current_entries[0].amount)
    return {"recorded": True, "distance_ft": round(total_distance, 1), "is_current_leader": is_leader}


@router.get("/ctp/results/{event_id}", response_model=List[CTPResult])
async def get_ctp_results(event_id: int, db: AsyncSession = Depends(get_db)):
    """Get CTP winners for each designated hole."""
    result = await db.execute(
        select(LedgerEntry, User.display_name, User.username)
        .join(User, User.id == LedgerEntry.player_id)
        .where(
            LedgerEntry.event_id == event_id,
            LedgerEntry.entry_type == "ctp_measurement",
            LedgerEntry.is_voided == False,
        )
        .order_by(LedgerEntry.amount.asc())
    )
    rows = result.all()

    # Group by hole, take best per hole
    holes = {}
    for entry, display_name, username in rows:
        hole = int(entry.notes.split("hole:")[1].split("|")[0]) if entry.notes else 0
        if hole not in holes:
            holes[hole] = (entry, display_name or username)

    # Calculate pot per hole
    ctp_q = await db.execute(
        select(func.count(Result.id))
        .where(Result.event_id == event_id)
    )
    player_count = ctp_q.scalar() or 0
    num_ctp_holes = len(holes) or 1
    pot_per_hole = player_count * 1.0 / num_ctp_holes  # $1/player split across CTP holes

    return [
        CTPResult(
            hole_number=hole,
            winner_id=entry.player_id,
            winner_name=name,
            distance=f"{float(entry.amount):.1f}ft",
            pot=round(pot_per_hole, 2),
        )
        for hole, (entry, name) in sorted(holes.items())
    ]


# ═══════════════════════════════════════════════════════════════════════════
# 3. RECURRING EVENTS — Auto-create weekly
# ═══════════════════════════════════════════════════════════════════════════

class RecurringEventTemplate(BaseModel):
    league_id: int
    layout_id: int
    name_template: str = "Sunday Singles"  # Can include {date}
    day_of_week: int = 6  # 0=Mon, 6=Sun
    hour: int = 14  # 2pm
    entry_fee: float = 5.0
    weeks_ahead: int = 4  # Create this many weeks in advance


@router.post("/recurring/setup")
async def setup_recurring_events(
    template: RecurringEventTemplate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """
    Create events for the next N weeks based on a template.
    Skips dates where an event already exists for that league.
    """
    created = []
    today = datetime.utcnow().date()

    for week in range(template.weeks_ahead):
        # Calculate next occurrence of the target day
        target = today + timedelta(days=(template.day_of_week - today.weekday()) % 7 + week * 7)
        event_dt = datetime.combine(target, datetime.min.time().replace(hour=template.hour))

        # Check if event already exists for this date/league
        existing = await db.execute(
            select(Event.id).where(
                Event.league_id == template.league_id,
                func.date(Event.event_date) == target,
            )
        )
        if existing.scalar_one_or_none():
            continue

        name = template.name_template.replace("{date}", target.strftime("%b %d"))
        event = Event(
            league_id=template.league_id,
            layout_id=template.layout_id,
            name=name,
            event_date=event_dt,
            status="upcoming",
            entry_fee=Decimal(str(template.entry_fee)),
        )
        db.add(event)
        created.append({"name": name, "date": target.isoformat()})

    await db.commit()
    return {"created": len(created), "events": created}


# ═══════════════════════════════════════════════════════════════════════════
# 4. DNF / PICKUP SCORING
# ═══════════════════════════════════════════════════════════════════════════

class PickupScore(BaseModel):
    round_id: int
    hole_id: int
    pickup_type: str = "double_par"  # double_par, par_plus_4, custom
    custom_strokes: Optional[int] = None


@router.post("/scoring/pickup")
async def record_pickup(
    pickup: PickupScore,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Record a pickup (when a player stops playing a hole).
    Automatically calculates the score based on league rules.
    """
    from app.models.course import Hole

    # Get hole par
    hole = await db.execute(select(Hole).where(Hole.id == pickup.hole_id))
    hole_obj = hole.scalar_one_or_none()
    if not hole_obj:
        raise HTTPException(404, "Hole not found")

    par = hole_obj.par
    if pickup.pickup_type == "double_par":
        strokes = par * 2
    elif pickup.pickup_type == "par_plus_4":
        strokes = par + 4
    elif pickup.pickup_type == "custom" and pickup.custom_strokes:
        strokes = pickup.custom_strokes
    else:
        strokes = par * 2

    # Upsert hole score
    existing = await db.execute(
        select(HoleScore).where(
            HoleScore.round_id == pickup.round_id,
            HoleScore.hole_id == pickup.hole_id,
        )
    )
    score = existing.scalar_one_or_none()
    if score:
        score.strokes = strokes
        score.notes = f"Pickup ({pickup.pickup_type})"
    else:
        score = HoleScore(
            round_id=pickup.round_id,
            hole_id=pickup.hole_id,
            strokes=strokes,
            notes=f"Pickup ({pickup.pickup_type})",
        )
        db.add(score)

    await db.commit()
    return {"hole": hole_obj.hole_number, "par": par, "recorded_strokes": strokes, "type": pickup.pickup_type}


# ═══════════════════════════════════════════════════════════════════════════
# 5. ACE FUND
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/ace-fund/balance")
async def ace_fund_balance(
    league_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Current ace fund balance. Every player can see this.
    Collected = sum of ace_fund_collected entries.
    Paid = sum of ace_fund_payout entries.
    Balance = collected - paid.
    """
    query = select(
        func.coalesce(func.sum(
            case((LedgerEntry.entry_type == "ace_fund_collected", LedgerEntry.amount), else_=0)
        ), 0).label("collected"),
        func.coalesce(func.sum(
            case((LedgerEntry.entry_type == "ace_fund_payout", func.abs(LedgerEntry.amount)), else_=0)
        ), 0).label("paid"),
    ).where(LedgerEntry.is_voided == False)

    if league_id:
        query = query.where(LedgerEntry.event_id.in_(
            select(Event.id).where(Event.league_id == league_id)
        ))

    result = await db.execute(query)
    row = result.one()
    collected = float(row.collected)
    paid = float(row.paid)

    return {
        "balance": round(collected - paid, 2),
        "total_collected": round(collected, 2),
        "total_paid_out": round(paid, 2),
        "note": "Hit an ace to claim it!",
    }


@router.post("/ace-fund/collect")
async def collect_ace_fund(
    event_id: int,
    amount_per_player: float = 1.0,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Bulk-collect ace fund from all checked-in players for an event."""
    checkins = await db.execute(
        select(Result.user_id).where(Result.event_id == event_id)
    )
    player_ids = [r.user_id for r in checkins.all()]

    for pid in player_ids:
        entry = LedgerEntry(
            entry_type="ace_fund_collected",
            amount=Decimal(str(amount_per_player)),
            description=f"Ace fund collection",
            event_id=event_id,
            player_id=pid,
            recorded_by=admin.id,
            payment_method="cash",
        )
        db.add(entry)

    await db.commit()
    return {"collected_from": len(player_ids), "amount_each": amount_per_player,
            "total": round(len(player_ids) * amount_per_player, 2)}


@router.post("/ace-fund/payout")
async def payout_ace_fund(
    player_id: int,
    event_id: int,
    hole_number: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Pay out the ace fund when someone hits an ace."""
    # Get current balance
    bal = await ace_fund_balance(db=db, user=admin)
    if bal["balance"] <= 0:
        raise HTTPException(400, "Ace fund is empty")

    payout_amount = bal["balance"]

    entry = LedgerEntry(
        entry_type="ace_fund_payout",
        amount=Decimal(str(-payout_amount)),
        description=f"ACE on hole {hole_number}! Payout ${payout_amount:.2f}",
        event_id=event_id,
        player_id=player_id,
        recorded_by=admin.id,
        payment_method="cash",
    )
    db.add(entry)
    await db.commit()

    # Notify everyone
    from app.services.push_service import send_push_to_all
    player = await db.execute(select(User).where(User.id == player_id))
    player_obj = player.scalar_one_or_none()
    name = player_obj.display_name or player_obj.username if player_obj else "Someone"

    await send_push_to_all(
        db,
        title=f"ACE! {name} on hole {hole_number}!",
        body=f"Ace fund payout: ${payout_amount:.2f}",
        data={"type": "ace_fund_payout"},
    )

    return {"player": name, "hole": hole_number, "payout": payout_amount}


# ═══════════════════════════════════════════════════════════════════════════
# 6. SOCIAL SHARING — Generate content for Facebook/iMessage
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/share/event-results/{event_id}")
async def shareable_event_results(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate formatted text for sharing event results on Facebook/iMessage.
    Copy-paste ready. Includes emoji, standings, CTP, ace fund.
    """
    event = await db.execute(select(Event).where(Event.id == event_id))
    ev = event.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Event not found")

    # Get results
    results = await db.execute(
        select(Result, User.display_name, User.username)
        .join(User, User.id == Result.user_id)
        .where(Result.event_id == event_id)
        .order_by(Result.position.asc())
    )
    rows = results.all()

    league = await db.execute(select(League).where(League.id == ev.league_id))
    league_obj = league.scalar_one_or_none()

    # Build text
    lines = []
    date_str = ev.event_date.strftime("%B %d, %Y") if ev.event_date else ""
    lines.append(f"{'🥏'} {ev.name} Results")
    lines.append(f"{'📅'} {date_str}")
    if league_obj:
        lines.append(f"{'🏆'} {league_obj.name} | {len(rows)} players")
    lines.append("")

    medals = ["🥇", "🥈", "🥉"]
    for res, display_name, username in rows:
        name = display_name or username
        pos = res.position or 0
        score = res.total_score or 0
        strokes = res.total_strokes or 0
        pts = res.points_earned or 0
        medal = medals[pos - 1] if pos <= 3 else f"{pos}."
        score_str = f"{score:+d}" if score != 0 else "E"
        lines.append(f"{medal} {name} — {strokes} ({score_str}) | {pts} pts")

    # CTP results
    ctp = await db.execute(
        select(LedgerEntry, User.display_name, User.username)
        .join(User, User.id == LedgerEntry.player_id)
        .where(
            LedgerEntry.event_id == event_id,
            LedgerEntry.entry_type == "ctp_measurement",
            LedgerEntry.is_voided == False,
        )
        .order_by(LedgerEntry.amount.asc())
    )
    ctp_rows = ctp.all()
    if ctp_rows:
        seen_holes = set()
        lines.append("")
        lines.append("{'🎯'} CTP Winners:")
        for entry, dn, un in ctp_rows:
            hole = int(entry.notes.split("hole:")[1].split("|")[0]) if entry.notes else 0
            if hole not in seen_holes:
                seen_holes.add(hole)
                lines.append(f"  Hole {hole}: {dn or un} ({float(entry.amount):.1f}ft)")

    # Ace fund balance
    ace = await ace_fund_balance(db=db, user=user)
    lines.append("")
    lines.append(f"{'💰'} Ace Fund: ${ace['balance']:.2f}")

    lines.append("")
    lines.append(f"{'📱'} River Grove Disc Golf Club")
    lines.append("#RGDGC #DiscGolf #RiverGrove #Kingwood")

    return {
        "text": "\n".join(lines),
        "event_name": ev.name,
        "date": date_str,
        "player_count": len(rows),
        "facebook_deep_link": "fb://group/500404870098909",
    }


@router.get("/share/standings/{league_id}")
async def shareable_standings(
    league_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Generate formatted season standings for sharing."""
    league = await db.execute(select(League).where(League.id == league_id))
    lg = league.scalar_one_or_none()
    if not lg:
        raise HTTPException(404, "League not found")

    results = await db.execute(
        select(
            Result.user_id,
            User.display_name, User.username,
            func.sum(Result.points_earned).label("total_pts"),
            func.count(Result.id).label("events"),
        )
        .join(User, User.id == Result.user_id)
        .join(Event, Event.id == Result.event_id)
        .where(Event.league_id == league_id, Event.status == "completed")
        .group_by(Result.user_id, User.display_name, User.username)
        .order_by(desc("total_pts"))
    )
    rows = results.all()

    lines = [f"{'🏆'} {lg.name} — {lg.season} Standings", ""]
    for i, r in enumerate(rows[:20], 1):
        name = r.display_name or r.username
        lines.append(f"{i:2d}. {name} — {r.total_pts} pts ({r.events} events)")

    lines.extend(["", f"{'📱'} River Grove Disc Golf Club", "#RGDGC #DiscGolf #LeagueStandings"])

    return {"text": "\n".join(lines), "league_name": lg.name, "season": lg.season}
