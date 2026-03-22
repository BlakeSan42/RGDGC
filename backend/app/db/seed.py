"""
Seed River Grove DGC course data and initial leagues.

Real course data from UDisc, PDGA, and DGCourseReview.
River Grove DGC — River Grove Park, Kingwood, TX 77339

Usage:
    cd backend && python -m app.db.seed
"""

import asyncio
from app.db.database import engine, async_session
from app.models import Base
from app.models.course import Course, Layout, Hole
from app.models.league import League
from app.models.user import User
from app.core.security import hash_password


# Real hole data from UDisc "All 18 plus 3A" layout
# Source: https://udisc.com/courses/river-grove-Kv1X
TOURNAMENT_HOLES = [
    # (hole_number, par, distance_ft)
    (1,  3, 263),
    (2,  3, 340),
    (3,  3, 300),
    (4,  4, 557),  # longest hole, only par 4
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
    (15, 3, 193),  # shortest hole
    (16, 3, 345),
    (17, 3, 305),
    (18, 3, 234),
]

# Hole 3A — alternate hole used in tournament layout
HOLE_3A = (19, 3, 200)  # stored as hole 19 in the 21-hole layout


async def seed():
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ── Admin User ──
        admin = User(
            email="admin@rgdgc.com",
            username="admin",
            password_hash=hash_password("admin123"),
            display_name="RGDGC Admin",
            role="admin",
        )
        db.add(admin)

        # ── River Grove DGC ──
        # Location: River Grove Park, 800 Woodland Hills Dr, Kingwood, TX 77339
        # GPS: 30.027066, -95.208576 (from PDGA directory)
        # Established: 2006, Designer: Andi Lehman Young (PDGA #2094)
        # UDisc: https://udisc.com/courses/river-grove-Kv1X (4.2/5, 1063 ratings)
        # PDGA: #26253
        course = Course(
            name="River Grove DGC",
            location="River Grove Park, 800 Woodland Hills Dr",
            city="Kingwood",
            state="TX",
            country="USA",
            latitude=30.027066,
            longitude=-95.208576,
            description=(
                "Heavily wooded course in River Grove Park along the San Jacinto River. "
                "21 installed holes with tight fairways, low ceilings, and well-placed trees "
                "that penalize anything short of perfection off the tee. Mix of left, right, "
                "and straight holes requiring shot shaping. 3 tee pads per hole. "
                "Concrete tees, Mach III/V/VII baskets. Designed by Andi Lehman Young. "
                "Free to play, dawn to dusk. Parking requires Kingwood resident 'K' sticker."
            ),
        )
        db.add(course)
        await db.flush()

        # ── Tournament Layout: "All 18 plus 3A" ──
        # This is the primary layout used for PDGA events
        # Par 58, 5,404 ft (1,647 m), 19 holes, Intermediate
        tournament = Layout(
            course_id=course.id,
            name="All 18 plus 3A",
            holes=19,
            total_par=58,
            total_distance=5404,
            difficulty="intermediate",
            is_default=True,
        )
        db.add(tournament)
        await db.flush()

        for hole_num, par, dist in TOURNAMENT_HOLES:
            db.add(Hole(
                layout_id=tournament.id,
                hole_number=hole_num,
                par=par,
                distance=dist,
            ))
        # Add hole 3A as hole 19
        db.add(Hole(
            layout_id=tournament.id,
            hole_number=HOLE_3A[0],
            par=HOLE_3A[1],
            distance=HOLE_3A[2],
            description="Alternate hole 3A",
        ))

        # ── Standard 18 Layout ──
        # Same holes but without 3A
        standard = Layout(
            course_id=course.id,
            name="Standard 18",
            holes=18,
            total_par=55,
            total_distance=5206,
            difficulty="intermediate",
            is_default=False,
        )
        db.add(standard)
        await db.flush()

        for hole_num, par, dist in TOURNAMENT_HOLES:
            db.add(Hole(
                layout_id=standard.id,
                hole_number=hole_num,
                par=par,
                distance=dist,
            ))

        # ── Ryne Theis Memorial Layout ──
        # Memorial layout honoring Ryne Timothy Theis (1985-2025)
        # who finished 2nd at Glide the Grove 2021 with -7
        # Exact hole configuration TBD from UDisc (layout ID 149108)
        memorial = Layout(
            course_id=course.id,
            name="Ryne Theis Memorial",
            holes=18,
            total_par=55,
            total_distance=5206,
            difficulty="intermediate",
            is_default=False,
        )
        db.add(memorial)
        await db.flush()

        # Use standard holes for now — update when memorial layout details confirmed
        for hole_num, par, dist in TOURNAMENT_HOLES:
            db.add(Hole(
                layout_id=memorial.id,
                hole_number=hole_num,
                par=par,
                distance=dist,
            ))

        # ── Leagues ──
        dubs = League(
            name="Dubs",
            description="Saturday doubles league. Random draw partners each week.",
            season="2026",
            league_type="doubles",
            points_rule="field_size",
            drop_worst=2,
            is_active=True,
        )
        db.add(dubs)

        singles = League(
            name="Sunday Singles",
            description="Sunday singles league. Individual play, all skill levels welcome.",
            season="2026",
            league_type="singles",
            points_rule="field_size",
            drop_worst=2,
            is_active=True,
        )
        db.add(singles)

        await db.commit()
        print("Seed complete!")
        print(f"  Admin user: admin@rgdgc.com / admin123")
        print(f"  Course: {course.name} (ID {course.id})")
        print(f"    Location: Kingwood, TX (30.027066, -95.208576)")
        print(f"  Layouts:")
        print(f"    All 18 plus 3A (ID {tournament.id}) — 19 holes, par 58, 5404 ft")
        print(f"    Standard 18    (ID {standard.id}) — 18 holes, par 55, 5206 ft")
        print(f"    Ryne Theis Mem (ID {memorial.id}) — 18 holes, par 55")
        print(f"  Leagues: Dubs (ID {dubs.id}), Sunday Singles (ID {singles.id})")


if __name__ == "__main__":
    asyncio.run(seed())
