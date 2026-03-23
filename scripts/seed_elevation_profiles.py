#!/usr/bin/env python3
"""
Sample elevation profiles along each hole's fairway line using USGS 3DEP EPQS.

For each hole with tee/basket GPS coordinates, this script:
1. Interpolates points every ~30ft along the tee→basket line
2. Queries USGS EPQS for 1m DEM elevation at each point
3. Stores the result as JSON in Hole.elevation_profile

The elevation profile powers:
- Mobile hole detail elevation charts
- AR putting overlay (slope visualization)
- Game engine terrain for flight simulation

Data source: USGS 3D Elevation Program (3DEP) via EPQS
  https://epqs.nationalmap.gov/v1/json
  Resolution: 1 meter bare-earth DEM

Usage:
    cd backend && python ../scripts/seed_elevation_profiles.py
    cd backend && python ../scripts/seed_elevation_profiles.py --offline   # use cached
"""

import argparse
import asyncio
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import httpx
from shapely.geometry import Point

EPQS_URL = "https://epqs.nationalmap.gov/v1/json"

# Sampling interval in feet (1 sample every 30ft along fairway)
SAMPLE_INTERVAL_FT = 30.0

# GPS coordinates from UDisc "All 18 plus 3A" layout
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


def haversine_ft(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in feet between two WGS84 points."""
    R = 20_902_231  # Earth radius in feet
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_points(
    tee_lat: float, tee_lng: float,
    basket_lat: float, basket_lng: float,
    interval_ft: float,
) -> list[tuple[float, float, float]]:
    """
    Generate evenly-spaced sample points along a straight line from tee to basket.
    Returns [(distance_ft, lat, lng), ...] including tee (0) and basket (total).
    """
    total_ft = haversine_ft(tee_lat, tee_lng, basket_lat, basket_lng)
    n_samples = max(2, int(total_ft / interval_ft) + 1)

    points = []
    for i in range(n_samples):
        t = i / (n_samples - 1)
        lat = tee_lat + t * (basket_lat - tee_lat)
        lng = tee_lng + t * (basket_lng - tee_lng)
        dist = t * total_ft
        points.append((round(dist, 1), lat, lng))

    return points


async def query_elevation(client: httpx.AsyncClient, lat: float, lng: float) -> float | None:
    """Query USGS EPQS for elevation in feet."""
    try:
        r = await client.get(EPQS_URL, params={
            "x": lng, "y": lat, "wkid": 4326, "units": "Feet", "includeDate": "false",
        }, timeout=15.0)
        if r.status_code == 200:
            val = r.json().get("value")
            if val is not None and val != -1000000:
                return round(float(val), 2)
    except Exception as e:
        print(f"      EPQS error ({lat:.5f}, {lng:.5f}): {e}")
    return None


# Cached profiles queried from USGS 3DEP (March 2026)
# Each entry: hole_number -> [(distance_ft, elevation_ft), ...]
CACHED_PROFILES: dict[int, list[tuple[float, float]]] = {}


async def build_profile_live(
    client: httpx.AsyncClient,
    hole_num: int,
    tee_lat: float, tee_lng: float,
    basket_lat: float, basket_lng: float,
) -> list[dict[str, float]] | None:
    """Query USGS for elevation at sample points along the fairway."""
    points = interpolate_points(tee_lat, tee_lng, basket_lat, basket_lng, SAMPLE_INTERVAL_FT)
    profile = []

    for dist_ft, lat, lng in points:
        elev = await query_elevation(client, lat, lng)
        if elev is None:
            print(f"      ✗ {dist_ft:.0f}ft — no data")
            continue
        profile.append({"distance_ft": dist_ft, "elevation_ft": elev, "lat": round(lat, 6), "lng": round(lng, 6)})
        print(f"      {dist_ft:>6.0f}ft → {elev:.1f}ft")
        await asyncio.sleep(0.25)  # polite rate limit

    return profile if len(profile) >= 2 else None


async def fetch_all_profiles() -> dict[int, list[dict[str, float]]]:
    """Query USGS EPQS for elevation profiles on all holes."""
    profiles: dict[int, list[dict[str, float]]] = {}

    async with httpx.AsyncClient() as client:
        for hole_num, tee_lat, tee_lng, basket_lat, basket_lng in HOLE_COORDS:
            total_ft = haversine_ft(tee_lat, tee_lng, basket_lat, basket_lng)
            points = interpolate_points(tee_lat, tee_lng, basket_lat, basket_lng, SAMPLE_INTERVAL_FT)
            print(f"  Hole {hole_num}: {total_ft:.0f}ft, {len(points)} sample points")

            profile = await build_profile_live(client, hole_num, tee_lat, tee_lng, basket_lat, basket_lng)
            if profile:
                profiles[hole_num] = profile
                print(f"    ✓ {len(profile)} elevation samples")
            else:
                print(f"    ✗ Failed to build profile")

    return profiles


async def seed_profiles(offline: bool = False):
    """Fetch elevation profiles and update holes in the database."""
    print("=" * 65)
    print("ELEVATION PROFILE SEEDER — River Grove DGC")
    print("=" * 65)

    if offline and CACHED_PROFILES:
        print("\nUsing cached elevation profiles...")
        profiles = {
            k: [{"distance_ft": d, "elevation_ft": e} for d, e in v]
            for k, v in CACHED_PROFILES.items()
        }
    else:
        if offline:
            print("\nNo cached profiles available, querying USGS live...")
        else:
            print("\nQuerying USGS 3DEP for elevation profiles along fairways...")
        profiles = await fetch_all_profiles()

    if not profiles:
        print("\nERROR: No profiles retrieved. Aborting.")
        return

    # Save to JSON cache file for future offline use
    cache_path = os.path.join(os.path.dirname(__file__), "elevation_profiles_cache.json")
    with open(cache_path, "w") as f:
        json.dump({str(k): v for k, v in profiles.items()}, f, indent=2)
    print(f"\nCached profiles to {cache_path}")

    # Update database
    print(f"\nUpdating database with {len(profiles)} hole profiles...")

    from app.db.database import get_engine, get_session_factory
    from app.models.course import Course, Layout, Hole
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    session_factory = get_session_factory()
    async with session_factory() as db:
        result = await db.execute(
            select(Course).where(Course.name == "River Grove DGC")
        )
        course = result.scalar_one_or_none()
        if not course:
            print("ERROR: Course 'River Grove DGC' not found. Run seed.py first.")
            return

        result = await db.execute(
            select(Layout)
            .where(Layout.course_id == course.id)
            .options(selectinload(Layout.hole_list))
        )
        layouts = result.scalars().all()

        updated = 0
        for layout in layouts:
            for hole in layout.hole_list:
                if hole.hole_number in profiles:
                    profile = profiles[hole.hole_number]
                    hole.elevation_profile = json.dumps(profile)
                    updated += 1

                    # Compute stats
                    elevs = [p["elevation_ft"] for p in profile]
                    min_e, max_e = min(elevs), max(elevs)
                    total_climb = sum(
                        max(0, elevs[i + 1] - elevs[i]) for i in range(len(elevs) - 1)
                    )
                    total_drop = sum(
                        max(0, elevs[i] - elevs[i + 1]) for i in range(len(elevs) - 1)
                    )
                    print(
                        f"  Hole {hole.hole_number:>2}: {len(profile)} pts, "
                        f"range {min_e:.1f}-{max_e:.1f}ft, "
                        f"climb +{total_climb:.1f}ft, drop -{total_drop:.1f}ft"
                    )

        await db.commit()
        print(f"\nUpdated {updated} holes with elevation profiles.")

    await get_engine().dispose()

    # Summary
    print("\n" + "=" * 65)
    print("PROFILE SUMMARY")
    print("=" * 65)
    for hole_num in sorted(profiles.keys()):
        p = profiles[hole_num]
        elevs = [pt["elevation_ft"] for pt in p]
        net = elevs[-1] - elevs[0]
        arrow = "↓" if net < 0 else "↑" if net > 0 else "→"
        print(f"  Hole {hole_num:>2}: {len(p):>2} samples, {p[-1]['distance_ft']:.0f}ft long, net {net:+.1f}ft {arrow}")
    print("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed elevation profiles for River Grove DGC")
    parser.add_argument("--offline", action="store_true", help="Use cached profiles if available")
    args = parser.parse_args()
    asyncio.run(seed_profiles(offline=args.offline))
