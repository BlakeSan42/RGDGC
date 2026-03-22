#!/usr/bin/env python3
"""
Fetch elevation data from USGS 3DEP (National Map) for all tee pads and baskets.

Uses the USGS Elevation Point Query Service (EPQS) — free, no API key needed.
Produces 1m resolution bare-earth DEM elevations for Kingwood, TX area.

Usage:
    cd backend && python ../scripts/fetch_elevation.py

Requires: httpx, asyncio
Outputs: Updates hole records in the database with elevation data.
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import httpx

EPQS_URL = "https://epqs.nationalmap.gov/v1/json"


async def get_elevation(lat: float, lng: float) -> float | None:
    """Query USGS EPQS for elevation at a point. Returns feet."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(EPQS_URL, params={
                "x": lng,
                "y": lat,
                "wkid": 4326,
                "units": "Feet",
                "includeDate": "false",
            })
            if r.status_code == 200:
                data = r.json()
                value = data.get("value")
                if value is not None and value != -1000000:
                    return round(float(value), 2)
    except Exception as e:
        print(f"  EPQS error for ({lat}, {lng}): {e}")
    return None


async def fetch_all():
    from app.db.database import engine, async_session
    from app.models.course import Hole
    from geoalchemy2.shape import to_shape
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(select(Hole))
        holes = list(result.scalars().all())

        print(f"Found {len(holes)} holes to process")
        updated = 0

        for hole in holes:
            tee_lat, tee_lng = None, None
            basket_lat, basket_lng = None, None

            if hole.tee_position:
                shape = to_shape(hole.tee_position)
                tee_lng, tee_lat = shape.x, shape.y

            if hole.basket_position:
                shape = to_shape(hole.basket_position)
                basket_lng, basket_lat = shape.x, shape.y

            if tee_lat and tee_lng:
                tee_elev = await get_elevation(tee_lat, tee_lng)
                if tee_elev is not None:
                    hole.tee_elevation_ft = tee_elev

                    if basket_lat and basket_lng:
                        basket_elev = await get_elevation(basket_lat, basket_lng)
                        if basket_elev is not None:
                            hole.basket_elevation_ft = basket_elev
                            hole.elevation_change_ft = round(basket_elev - tee_elev, 2)
                            updated += 1
                            print(
                                f"  Hole {hole.hole_number} (layout {hole.layout_id}): "
                                f"tee={tee_elev}ft, basket={basket_elev}ft, "
                                f"change={hole.elevation_change_ft:+.2f}ft"
                            )

                # Rate limit — USGS asks us to be polite
                await asyncio.sleep(0.3)
            else:
                print(f"  Hole {hole.hole_number} (layout {hole.layout_id}): no GPS data, skipping")

        await db.commit()
        print(f"\nUpdated {updated} holes with elevation data")

    await engine.dispose()


if __name__ == "__main__":
    print("Fetching elevation data from USGS 3DEP for River Grove DGC...")
    print(f"Location: Kingwood, TX (Harris County)")
    print()
    asyncio.run(fetch_all())
