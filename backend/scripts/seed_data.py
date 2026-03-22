"""
Comprehensive seed data for RGDGC backend — development/testing.

Seeds: admin user, test players, River Grove DGC course with 3 layouts,
two leagues with events/results, and registered discs for the admin.

Idempotent: checks for existing data before inserting.

Usage:
    cd backend && python scripts/seed_data.py
"""

import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import engine, async_session
from app.models import Base
from app.models.user import User
from app.models.course import Course, Layout, Hole
from app.models.league import League, Event, Result
from app.models.disc import RegisteredDisc
from app.core.security import hash_password

from sqlalchemy import select, func


# ---------------------------------------------------------------------------
# Hole data — real River Grove DGC from UDisc
# ---------------------------------------------------------------------------

TOURNAMENT_HOLES = [
    # (hole_number, par, distance_ft)
    (1,  3, 263),
    (2,  3, 340),
    (3,  3, 300),
    (4,  4, 557),
    (5,  3, 249),
    (6,  3, 248),
    (7,  3, 298),
    (8,  3, 277),
    (9,  3, 301),
    (10, 3, 227),
    (11, 3, 310),
    (12, 3, 217),
    (13, 3, 326),
    (14, 3, 216),
    (15, 3, 193),
    (16, 3, 345),
    (17, 3, 305),
    (18, 3, 234),
]

HOLE_3A = (19, 3, 200)

STANDARD_HOLES = TOURNAMENT_HOLES[:]  # same 18

# Ryne Theis Memorial — slight variation for memorial layout
MEMORIAL_HOLES = [
    (1,  3, 270),
    (2,  3, 335),
    (3,  3, 310),
    (4,  4, 550),
    (5,  3, 255),
    (6,  3, 240),
    (7,  3, 305),
    (8,  3, 285),
    (9,  3, 295),
    (10, 3, 230),
    (11, 3, 315),
    (12, 3, 220),
    (13, 3, 330),
    (14, 3, 210),
    (15, 3, 200),
    (16, 3, 340),
    (17, 3, 300),
    (18, 3, 240),
]

# ---------------------------------------------------------------------------
# Test players
# ---------------------------------------------------------------------------

TEST_PLAYERS = [
    {
        "email": "jake.rivers@example.com",
        "username": "jake_rivers",
        "display_name": "Jake Rivers",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("-2.5"),
    },
    {
        "email": "maria.chain@example.com",
        "username": "maria_chain",
        "display_name": "Maria Chain",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("1.0"),
    },
    {
        "email": "tommy.ace@example.com",
        "username": "tommy_ace",
        "display_name": "Tommy Ace",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("3.5"),
    },
    {
        "email": "sarah.putter@example.com",
        "username": "sarah_putter",
        "display_name": "Sarah Putter",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("0.0"),
    },
    {
        "email": "derek.hyzer@example.com",
        "username": "derek_hyzer",
        "display_name": "Derek Hyzer",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("5.0"),
    },
    {
        "email": "lin.fairway@example.com",
        "username": "lin_fairway",
        "display_name": "Lin Fairway",
        "password": "test1234",
        "role": "player",
        "handicap": None,
    },
    {
        "email": "carlos.grip@example.com",
        "username": "carlos_grip",
        "display_name": "Carlos Grip",
        "password": "test1234",
        "role": "player",
        "handicap": Decimal("2.0"),
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def row_exists(db, model, **filters):
    """Return True if at least one row matches the filters."""
    stmt = select(func.count()).select_from(model)
    for col, val in filters.items():
        stmt = stmt.where(getattr(model, col) == val)
    result = await db.execute(stmt)
    return result.scalar() > 0


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------

async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:

        # ── 1. Admin User ─────────────────────────────────────────────
        print("Seeding admin user...")
        if await row_exists(db, User, email="admin@rgdgc.com"):
            print("  Admin user already exists, skipping.")
            admin_result = await db.execute(
                select(User).where(User.email == "admin@rgdgc.com")
            )
            admin = admin_result.scalar_one()
        else:
            admin = User(
                email="admin@rgdgc.com",
                username="admin",
                password_hash=hash_password("admin123"),
                display_name="Blake Sanders",
                role="admin",
                auth_provider="email",
            )
            db.add(admin)
            await db.flush()
            print(f"  Created admin: admin@rgdgc.com / admin123 (ID {admin.id})")

        # ── 2. Test Players ───────────────────────────────────────────
        print("Seeding test players...")
        player_ids = []
        for p in TEST_PLAYERS:
            if await row_exists(db, User, email=p["email"]):
                print(f"  {p['display_name']} already exists, skipping.")
                res = await db.execute(select(User).where(User.email == p["email"]))
                player_ids.append(res.scalar_one().id)
            else:
                user = User(
                    email=p["email"],
                    username=p["username"],
                    password_hash=hash_password(p["password"]),
                    display_name=p["display_name"],
                    role=p["role"],
                    handicap=p["handicap"],
                    auth_provider="email",
                )
                db.add(user)
                await db.flush()
                player_ids.append(user.id)
                print(f"  Created {p['display_name']} (ID {user.id})")

        # ── 3. Course: River Grove DGC ────────────────────────────────
        print("Seeding course...")
        if await row_exists(db, Course, name="River Grove DGC"):
            print("  River Grove DGC already exists, skipping.")
            course_result = await db.execute(
                select(Course).where(Course.name == "River Grove DGC")
            )
            course = course_result.scalar_one()
        else:
            course = Course(
                name="River Grove DGC",
                location="River Grove Park, 800 Woodland Hills Dr",
                city="Kingwood",
                state="TX",
                country="USA",
                latitude=Decimal("30.0270660"),
                longitude=Decimal("-95.2085760"),
                description=(
                    "Heavily wooded course in River Grove Park along the San Jacinto River. "
                    "21 installed holes with tight fairways, low ceilings, and well-placed trees "
                    "that penalize anything short of perfection off the tee. Mix of left, right, "
                    "and straight holes requiring shot shaping. 3 tee pads per hole. "
                    "Concrete tees, Mach III/V/VII baskets. Designed by Andi Lehman Young (PDGA #2094). "
                    "Free to play, dawn to dusk."
                ),
            )
            db.add(course)
            await db.flush()
            print(f"  Created River Grove DGC (ID {course.id})")

        # ── 4. Layouts + Holes ────────────────────────────────────────
        print("Seeding layouts and holes...")

        layout_configs = [
            {
                "name": "All 18 plus 3A",
                "holes_count": 19,
                "total_par": 58,
                "total_distance": 5404,
                "difficulty": "intermediate",
                "is_default": True,
                "hole_data": TOURNAMENT_HOLES + [HOLE_3A],
            },
            {
                "name": "Standard 18",
                "holes_count": 18,
                "total_par": 55,
                "total_distance": 5206,
                "difficulty": "intermediate",
                "is_default": False,
                "hole_data": STANDARD_HOLES,
            },
            {
                "name": "Ryne Theis Memorial",
                "holes_count": 18,
                "total_par": 55,
                "total_distance": 5230,
                "difficulty": "advanced",
                "is_default": False,
                "hole_data": MEMORIAL_HOLES,
            },
        ]

        layout_objs = {}
        for lc in layout_configs:
            if await row_exists(db, Layout, course_id=course.id, name=lc["name"]):
                print(f"  Layout '{lc['name']}' already exists, skipping.")
                lr = await db.execute(
                    select(Layout).where(
                        Layout.course_id == course.id, Layout.name == lc["name"]
                    )
                )
                layout_objs[lc["name"]] = lr.scalar_one()
            else:
                layout = Layout(
                    course_id=course.id,
                    name=lc["name"],
                    holes=lc["holes_count"],
                    total_par=lc["total_par"],
                    total_distance=lc["total_distance"],
                    difficulty=lc["difficulty"],
                    is_default=lc["is_default"],
                )
                db.add(layout)
                await db.flush()
                layout_objs[lc["name"]] = layout
                print(f"  Created layout '{lc['name']}' (ID {layout.id})")

                for hole_num, par, dist in lc["hole_data"]:
                    db.add(Hole(
                        layout_id=layout.id,
                        hole_number=hole_num,
                        par=par,
                        distance=dist,
                    ))
                await db.flush()
                print(f"    Added {len(lc['hole_data'])} holes")

        default_layout = layout_objs["Standard 18"]

        # ── 5. Leagues ────────────────────────────────────────────────
        print("Seeding leagues...")

        league_configs = [
            {
                "name": "Dubs",
                "description": "Saturday doubles league. Random draw partners each week.",
                "season": "2026",
                "league_type": "doubles",
                "points_rule": "field_size",
                "drop_worst": 2,
            },
            {
                "name": "Sunday Singles",
                "description": "Sunday singles league. Individual play, all skill levels welcome.",
                "season": "2026",
                "league_type": "singles",
                "points_rule": "field_size",
                "drop_worst": 1,
            },
        ]

        league_objs = {}
        for lconf in league_configs:
            if await row_exists(db, League, name=lconf["name"], season="2026"):
                print(f"  League '{lconf['name']}' already exists, skipping.")
                lr = await db.execute(
                    select(League).where(
                        League.name == lconf["name"], League.season == "2026"
                    )
                )
                league_objs[lconf["name"]] = lr.scalar_one()
            else:
                league = League(**lconf, is_active=True)
                db.add(league)
                await db.flush()
                league_objs[lconf["name"]] = league
                print(f"  Created league '{lconf['name']}' (ID {league.id})")

        # ── 6. Events + Results ───────────────────────────────────────
        print("Seeding events and results...")

        today = date.today()
        # Use all player IDs (admin + test players) for event participation
        all_player_ids = [admin.id] + player_ids

        # Event definitions per league
        event_defs = {
            "Dubs": [
                {"name": "Dubs Week 1", "date": today - timedelta(days=21), "status": "completed"},
                {"name": "Dubs Week 2", "date": today - timedelta(days=14), "status": "completed"},
                {"name": "Dubs Week 3", "date": today - timedelta(days=7), "status": "completed"},
                {"name": "Dubs Week 4", "date": today + timedelta(days=7), "status": "upcoming"},
            ],
            "Sunday Singles": [
                {"name": "Singles Week 1", "date": today - timedelta(days=20), "status": "completed"},
                {"name": "Singles Week 2", "date": today - timedelta(days=13), "status": "completed"},
                {"name": "Singles Week 3", "date": today + timedelta(days=1), "status": "upcoming"},
            ],
        }

        # Simulated stroke totals for completed events (total strokes for 18 holes, par 55)
        # Realistic range: 50-65 strokes
        simulated_scores = {
            "Dubs Week 1":     [51, 53, 54, 55, 56, 58, 60, 62],
            "Dubs Week 2":     [50, 52, 55, 55, 57, 59, 61, 63],
            "Dubs Week 3":     [52, 53, 54, 56, 57, 58, 60, 64],
            "Singles Week 1":  [53, 54, 55, 56, 57, 59, 61, 63],
            "Singles Week 2":  [51, 54, 54, 56, 58, 60, 62, 65],
        }

        for league_name, events in event_defs.items():
            league = league_objs[league_name]
            for edef in events:
                if await row_exists(db, Event, league_id=league.id, name=edef["name"]):
                    print(f"  Event '{edef['name']}' already exists, skipping.")
                    continue

                num_players = len(all_player_ids)
                event = Event(
                    league_id=league.id,
                    layout_id=default_layout.id,
                    name=edef["name"],
                    event_date=edef["date"],
                    status=edef["status"],
                    num_players=num_players if edef["status"] == "completed" else None,
                    entry_fee=Decimal("5.00"),
                )
                db.add(event)
                await db.flush()
                print(f"  Created event '{edef['name']}' (ID {event.id}, {edef['status']})")

                # Add results for completed events
                if edef["status"] == "completed" and edef["name"] in simulated_scores:
                    scores = simulated_scores[edef["name"]]
                    par = default_layout.total_par  # 55

                    # Assign scores to players (sorted ascending = best first)
                    sorted_scores = sorted(scores[:num_players])

                    for pos_idx, (pid, strokes) in enumerate(
                        zip(all_player_ids, sorted_scores)
                    ):
                        position = pos_idx + 1
                        score_to_par = strokes - par
                        points = num_players - position + 1

                        result = Result(
                            event_id=event.id,
                            user_id=pid,
                            total_strokes=strokes,
                            total_score=score_to_par,
                            position=position,
                            points_earned=points,
                            dnf=False,
                            dq=False,
                        )
                        db.add(result)

                    await db.flush()
                    print(f"    Added {num_players} results (1st: {sorted_scores[0]}, last: {sorted_scores[num_players-1]})")

        # ── 7. Registered Discs ───────────────────────────────────────
        print("Seeding registered discs...")

        disc_defs = [
            {
                "disc_code": "RGDG-0001",
                "manufacturer": "Innova",
                "mold": "Destroyer",
                "plastic": "Star",
                "weight_grams": 175,
                "color": "Blue",
                "status": "active",
                "notes": "Primary distance driver. Beat in nicely, slight turn.",
            },
            {
                "disc_code": "RGDG-0002",
                "manufacturer": "Discraft",
                "mold": "Buzzz",
                "plastic": "ESP",
                "weight_grams": 177,
                "color": "Green/Pink swirl",
                "status": "active",
                "notes": "Go-to midrange. Dead straight.",
            },
            {
                "disc_code": "RGDG-0003",
                "manufacturer": "MVP",
                "mold": "Nomad",
                "plastic": "Electron",
                "weight_grams": 174,
                "color": "White",
                "status": "lost",
                "notes": "Lost on hole 13 — thick brush right of fairway. RIP.",
            },
        ]

        for ddef in disc_defs:
            if await row_exists(db, RegisteredDisc, disc_code=ddef["disc_code"]):
                print(f"  Disc '{ddef['disc_code']}' already exists, skipping.")
                continue

            disc = RegisteredDisc(owner_id=admin.id, **ddef)
            db.add(disc)
            await db.flush()
            print(f"  Created disc: {ddef['manufacturer']} {ddef['mold']} ({ddef['disc_code']}, {ddef['status']})")

        # ── Commit ────────────────────────────────────────────────────
        await db.commit()

    print()
    print("=" * 60)
    print("  Seed complete!")
    print("=" * 60)
    print()
    print("  Admin login:  admin@rgdgc.com / admin123")
    print("  Test players: 7 players (password: test1234)")
    print("  Course:       River Grove DGC, Kingwood, TX")
    print("  Layouts:      All 18 plus 3A, Standard 18, Ryne Theis Memorial")
    print("  Leagues:      Dubs (drop 2), Sunday Singles (drop 1)")
    print("  Events:       3 completed + 2 upcoming (with results)")
    print("  Discs:        3 registered (1 lost)")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
