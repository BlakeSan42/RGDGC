"""
Seed GPS coordinates for River Grove DGC holes.

Tee pad and basket positions sourced from UDisc course data.
Course: River Grove DGC, River Grove Park, Kingwood, TX 77339
UDisc: https://udisc.com/courses/river-grove-Kv1X (Layout ID 92860)

Usage:
    cd backend && python -m scripts.seed_geo
"""

import asyncio
from geoalchemy2.shape import from_shape
from shapely.geometry import Point, LineString
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.db.database import engine, async_session
from app.models.course import Course, Layout, Hole, CourseFeature


# GPS coordinates from UDisc "All 18 plus 3A" layout
# Format: (hole_number, tee_lat, tee_lng, basket_lat, basket_lng)
HOLE_COORDS = [
    (1,  30.02656, -95.20968, 30.02652, -95.21042),
    (2,  30.02654, -95.21064, 30.02655, -95.21171),
    (3,  30.02618, -95.21124, 30.02617, -95.21038),
    (4,  30.02576, -95.21111, 30.02665, -95.21247),
    (5,  30.02698, -95.21255, 30.02668, -95.21185),
    (6,  30.02680, -95.21163, 30.02693, -95.21090),
    (7,  30.02682, -95.21070, 30.02697, -95.20977),
    (8,  30.02706, -95.20966, 30.02732, -95.21035),
    (9,  30.02713, -95.21014, 30.02715, -95.21107),
    (10, 30.02737, -95.21126, 30.02707, -95.21189),
    (11, 30.02699, -95.21214, 30.02763, -95.21278),
    (12, 30.02775, -95.21255, 30.02729, -95.21212),
    (13, 30.02738, -95.21194, 30.02805, -95.21153),
    (14, 30.02809, -95.21142, 30.02802, -95.21075),
    (15, 30.02782, -95.21064, 30.02781, -95.21123),
    (16, 30.02768, -95.21168, 30.02740, -95.21064),
    (17, 30.02771, -95.21110, 30.02752, -95.21016),
    (18, 30.02759, -95.20996, 30.02725, -95.20942),
    # Hole 3A stored as hole 19
    (19, 30.02557, -95.21096, 30.02603, -95.21064),
]


def make_point(lat: float, lng: float):
    """Create a PostGIS point (SRID 4326) from lat/lng."""
    return from_shape(Point(lng, lat), srid=4326)


def make_line(lat1: float, lng1: float, lat2: float, lng2: float):
    """Create a PostGIS line from tee to basket."""
    return from_shape(LineString([(lng1, lat1), (lng2, lat2)]), srid=4326)


async def seed_geo():
    async with async_session() as db:
        # Find the course
        result = await db.execute(
            select(Course).where(Course.name == "River Grove DGC")
        )
        course = result.scalar_one_or_none()
        if not course:
            print("ERROR: Course 'River Grove DGC' not found. Run seed.py first.")
            return

        print(f"Found course: {course.name} (ID {course.id})")

        # Get all layouts for this course
        result = await db.execute(
            select(Layout)
            .where(Layout.course_id == course.id)
            .options(selectinload(Layout.hole_list))
        )
        layouts = result.scalars().all()

        updated = 0
        for layout in layouts:
            print(f"\n  Layout: {layout.name} (ID {layout.id}, {layout.holes} holes)")

            for hole in layout.hole_list:
                # Find matching coords
                coords = None
                for h_num, t_lat, t_lng, b_lat, b_lng in HOLE_COORDS:
                    if h_num == hole.hole_number:
                        coords = (t_lat, t_lng, b_lat, b_lng)
                        break

                if not coords:
                    print(f"    Hole {hole.hole_number}: no GPS data (skipped)")
                    continue

                t_lat, t_lng, b_lat, b_lng = coords

                hole.tee_position = make_point(t_lat, t_lng)
                hole.basket_position = make_point(b_lat, b_lng)
                hole.fairway_line = make_line(t_lat, t_lng, b_lat, b_lng)

                updated += 1
                print(f"    Hole {hole.hole_number}: tee ({t_lat}, {t_lng}) → basket ({b_lat}, {b_lng})")

        await db.commit()
        print(f"\nUpdated {updated} holes with GPS coordinates across {len(layouts)} layouts.")

        # Verify with a GeoJSON query
        result = await db.execute(
            select(Hole)
            .join(Layout)
            .where(Layout.course_id == course.id, Hole.tee_position.isnot(None))
        )
        geo_holes = result.scalars().all()
        print(f"Verification: {len(geo_holes)} holes now have tee_position data.")


if __name__ == "__main__":
    asyncio.run(seed_geo())
