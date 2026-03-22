"""
Seed elevation data for River Grove DGC holes from USGS 3DEP (1m DEM).

Queries the USGS Elevation Point Query Service (EPQS) for tee and basket
elevations, then updates the holes table with:
  - tee_elevation_ft
  - basket_elevation_ft
  - elevation_change_ft (basket - tee; negative = downhill)

Data source: USGS 3D Elevation Program (3DEP) via National Map EPQS
  https://epqs.nationalmap.gov/v1/json
  Resolution: 1 meter (1/3 arc-second or better where available)

Course: River Grove DGC, River Grove Park, Kingwood, TX 77339
GPS coordinates from UDisc "All 18 plus 3A" layout.

Usage:
    cd backend && python -m scripts.seed_elevation
    cd backend && python -m scripts.seed_elevation --offline   # use cached values
"""

import argparse
import asyncio
import time

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import async_session
from app.models.course import Course, Layout, Hole


EPQS_URL = "https://epqs.nationalmap.gov/v1/json"

# GPS coordinates: (hole_number, tee_lat, tee_lng, basket_lat, basket_lng)
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
    (19, 30.02557, -95.21096, 30.02603, -95.21064),
]

# Cached USGS 3DEP elevations (feet) queried 2026-03-22
# Source: USGS EPQS v1, 1m resolution, WGS84 (WKID 4326)
CACHED_ELEVATIONS = {
    # hole: (tee_ft, basket_ft)
    1:  (49.51, 47.95),
    2:  (47.56, 48.05),
    3:  (49.58, 45.15),
    4:  (49.11, 46.43),
    5:  (46.09, 46.86),
    6:  (46.76, 47.33),
    7:  (48.34, 49.36),
    8:  (49.69, 48.33),
    9:  (49.14, 47.67),
    10: (46.75, 46.81),
    11: (46.57, 44.97),
    12: (44.78, 46.02),
    13: (46.33, 45.06),
    14: (45.24, 46.49),
    15: (46.82, 45.88),
    16: (46.01, 47.78),
    17: (46.44, 47.41),
    18: (47.46, 49.40),
    19: (50.95, 45.41),
}


async def query_elevation(client: httpx.AsyncClient, lat: float, lng: float) -> float | None:
    """Query USGS EPQS for elevation in feet at a lat/lng point."""
    params = {
        "x": lng,
        "y": lat,
        "wkid": 4326,
        "units": "Feet",
        "includeDate": "false",
    }
    try:
        resp = await client.get(EPQS_URL, params=params, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
        value = data.get("value")
        if value is not None and value != -1000000:
            return round(float(value), 2)
        return None
    except Exception as e:
        print(f"    EPQS error for ({lat}, {lng}): {e}")
        return None


async def fetch_elevations() -> dict[int, tuple[float, float]]:
    """Query USGS EPQS for all hole tee/basket elevations."""
    elevations: dict[int, tuple[float, float]] = {}

    async with httpx.AsyncClient() as client:
        for hole_num, tee_lat, tee_lng, basket_lat, basket_lng in HOLE_COORDS:
            print(f"  Querying hole {hole_num}...", end=" ", flush=True)

            tee_elev = await query_elevation(client, tee_lat, tee_lng)
            # Small delay to be polite to the USGS API
            await asyncio.sleep(0.3)
            basket_elev = await query_elevation(client, basket_lat, basket_lng)
            await asyncio.sleep(0.3)

            if tee_elev is not None and basket_elev is not None:
                elevations[hole_num] = (tee_elev, basket_elev)
                change = basket_elev - tee_elev
                arrow = "↓" if change < 0 else "↑" if change > 0 else "→"
                print(f"tee={tee_elev:.1f} ft, basket={basket_elev:.1f} ft, change={change:+.1f} ft {arrow}")
            else:
                print(f"FAILED (tee={tee_elev}, basket={basket_elev})")

    return elevations


def get_cached_elevations() -> dict[int, tuple[float, float]]:
    """Return cached elevation data without querying USGS."""
    print("  Using cached USGS 3DEP elevations (queried 2026-03-22)")
    return dict(CACHED_ELEVATIONS)


async def seed_elevation(offline: bool = False):
    """Fetch elevations and update holes in the database."""
    print("=" * 65)
    print("USGS 3DEP Elevation Seeder — River Grove DGC")
    print("=" * 65)

    # Step 1: Get elevation data
    if offline:
        elevations = get_cached_elevations()
    else:
        print("\nQuerying USGS Elevation Point Query Service (1m DEM)...")
        elevations = await fetch_elevations()

    if not elevations:
        print("\nERROR: No elevation data retrieved. Aborting.")
        return

    # Step 2: Update database
    print(f"\nUpdating database with {len(elevations)} hole elevations...")

    session_factory = async_session() if callable(async_session) else async_session
    async with session_factory() as db:
        # Find the course
        result = await db.execute(
            select(Course).where(Course.name == "River Grove DGC")
        )
        course = result.scalar_one_or_none()
        if not course:
            print("ERROR: Course 'River Grove DGC' not found. Run seed.py first.")
            return

        print(f"  Course: {course.name} (ID {course.id})")

        # Get all layouts
        result = await db.execute(
            select(Layout)
            .where(Layout.course_id == course.id)
            .options(selectinload(Layout.hole_list))
        )
        layouts = result.scalars().all()

        updated = 0
        for layout in layouts:
            print(f"\n  Layout: {layout.name} (ID {layout.id})")

            for hole in sorted(layout.hole_list, key=lambda h: h.hole_number):
                if hole.hole_number not in elevations:
                    continue

                tee_ft, basket_ft = elevations[hole.hole_number]
                change_ft = round(basket_ft - tee_ft, 2)

                hole.tee_elevation_ft = tee_ft
                hole.basket_elevation_ft = basket_ft
                hole.elevation_change_ft = change_ft

                updated += 1
                arrow = "↓" if change_ft < 0 else "↑" if change_ft > 0 else "→"
                print(
                    f"    Hole {hole.hole_number:>2}: "
                    f"tee {tee_ft:>6.1f} ft  |  basket {basket_ft:>6.1f} ft  |  "
                    f"change {change_ft:>+6.1f} ft {arrow}"
                )

        await db.commit()
        print(f"\nUpdated {updated} holes across {len(layouts)} layouts.")

    # Step 3: Summary
    print("\n" + "=" * 65)
    print("ELEVATION SUMMARY — River Grove DGC")
    print("=" * 65)
    print(f"{'Hole':>4}  {'Tee (ft)':>9}  {'Basket (ft)':>11}  {'Change (ft)':>11}  {'Dir':>3}")
    print("-" * 46)

    min_elev = float("inf")
    max_elev = float("-inf")
    max_drop = 0
    max_drop_hole = 0
    max_climb = 0
    max_climb_hole = 0

    for hole_num in sorted(elevations.keys()):
        tee_ft, basket_ft = elevations[hole_num]
        change_ft = round(basket_ft - tee_ft, 2)
        arrow = "↓" if change_ft < 0 else "↑" if change_ft > 0 else "→"
        print(f"  {hole_num:>2}    {tee_ft:>7.1f}     {basket_ft:>7.1f}      {change_ft:>+7.1f}    {arrow}")

        min_elev = min(min_elev, tee_ft, basket_ft)
        max_elev = max(max_elev, tee_ft, basket_ft)
        if change_ft < max_drop:
            max_drop = change_ft
            max_drop_hole = hole_num
        if change_ft > max_climb:
            max_climb = change_ft
            max_climb_hole = hole_num

    print("-" * 46)
    print(f"  Elevation range: {min_elev:.1f} ft — {max_elev:.1f} ft ({max_elev - min_elev:.1f} ft total)")
    print(f"  Biggest drop:  Hole {max_drop_hole} ({max_drop:+.1f} ft)")
    print(f"  Biggest climb: Hole {max_climb_hole} ({max_climb:+.1f} ft)")
    print(f"  Source: USGS 3DEP 1m DEM via EPQS")
    print("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed USGS elevation data for River Grove DGC holes")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use cached elevation values instead of querying USGS API",
    )
    args = parser.parse_args()
    asyncio.run(seed_elevation(offline=args.offline))
