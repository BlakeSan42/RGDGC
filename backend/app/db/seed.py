"""
Seed River Grove DGC course data and initial leagues.

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
        course = Course(
            name="River Grove DGC",
            location="River Grove Park",
            city="River Grove",
            state="IL",
            country="USA",
            latitude=41.9261,
            longitude=-87.8361,
            description="Home course of River Grove Disc Golf Club. "
            "A wooded, riverside course with three layouts.",
        )
        db.add(course)
        await db.flush()

        # ── White Layout (default, 18 holes) ──
        white = Layout(
            course_id=course.id,
            name="White",
            holes=18,
            total_par=54,
            total_distance=4800,
            difficulty="intermediate",
            is_default=True,
        )
        db.add(white)
        await db.flush()

        white_pars = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
        white_distances = [
            250, 310, 280, 200, 350, 270, 290, 240, 320,
            260, 300, 230, 340, 275, 310, 250, 285, 330,
        ]
        for i, (par, dist) in enumerate(zip(white_pars, white_distances), 1):
            db.add(Hole(layout_id=white.id, hole_number=i, par=par, distance=dist))

        # ── Red Layout (short, 18 holes) ──
        red = Layout(
            course_id=course.id,
            name="Red",
            holes=18,
            total_par=54,
            total_distance=3600,
            difficulty="beginner",
            is_default=False,
        )
        db.add(red)
        await db.flush()

        red_distances = [
            180, 220, 200, 150, 250, 190, 210, 170, 230,
            185, 215, 165, 240, 195, 225, 175, 205, 235,
        ]
        for i, dist in enumerate(red_distances, 1):
            db.add(Hole(layout_id=red.id, hole_number=i, par=3, distance=dist))

        # ── Blue Layout (long, 18 holes) ──
        blue = Layout(
            course_id=course.id,
            name="Blue",
            holes=18,
            total_par=56,
            total_distance=6200,
            difficulty="advanced",
            is_default=False,
        )
        db.add(blue)
        await db.flush()

        blue_pars = [3, 4, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
        blue_distances = [
            320, 420, 350, 280, 450, 340, 370, 310, 400,
            330, 380, 300, 430, 345, 390, 320, 360, 410,
        ]
        for i, (par, dist) in enumerate(zip(blue_pars, blue_distances), 1):
            db.add(Hole(layout_id=blue.id, hole_number=i, par=par, distance=dist))

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
        print(f"  Layouts: White (ID {white.id}), Red (ID {red.id}), Blue (ID {blue.id})")
        print(f"  Leagues: Dubs (ID {dubs.id}), Sunday Singles (ID {singles.id})")


if __name__ == "__main__":
    asyncio.run(seed())
