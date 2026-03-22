"""Tests for GeoJSON API, elevation profiles, and nearest-hole detection."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_course_geojson_empty(client: AsyncClient, seeded_course):
    """GeoJSON works but returns no features when holes have no geo data."""
    res = await client.get(f"/api/v1/geo/courses/{seeded_course['course_id']}/geojson")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert isinstance(data["features"], list)
    assert "properties" in data
    assert data["properties"]["course_id"] == seeded_course["course_id"]


@pytest.mark.asyncio
async def test_course_geojson_with_geo_data(client: AsyncClient, seeded_course, test_engine):
    """GeoJSON returns features when holes have tee/basket positions."""
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point, LineString
    from app.models.course import Hole
    from sqlalchemy import select

    _, sf = test_engine
    async with sf() as session:
        result = await session.execute(
            select(Hole).where(Hole.layout_id == seeded_course["layout_id"]).limit(1)
        )
        hole = result.scalar_one()
        hole.tee_position = from_shape(Point(-95.21, 30.027), srid=4326)
        hole.basket_position = from_shape(Point(-95.211, 30.028), srid=4326)
        hole.fairway_line = from_shape(LineString([(-95.21, 30.027), (-95.211, 30.028)]), srid=4326)
        await session.commit()

    res = await client.get(
        f"/api/v1/geo/courses/{seeded_course['course_id']}/geojson?layout_id={seeded_course['layout_id']}"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["properties"]["total_features"] >= 3  # tee + basket + fairway


@pytest.mark.asyncio
async def test_course_geojson_not_found(client: AsyncClient):
    res = await client.get("/api/v1/geo/courses/9999/geojson")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_hole_elevation(client: AsyncClient, seeded_course, test_engine):
    """Elevation endpoint returns data when seeded."""
    from app.models.course import Hole
    from sqlalchemy import select

    _, sf = test_engine
    async with sf() as session:
        result = await session.execute(
            select(Hole).where(
                Hole.layout_id == seeded_course["layout_id"],
                Hole.hole_number == 1,
            )
        )
        hole = result.scalar_one()
        hole.tee_elevation_ft = 49.5
        hole.basket_elevation_ft = 47.9
        hole.elevation_change_ft = -1.6
        await session.commit()

    res = await client.get(
        f"/api/v1/geo/courses/{seeded_course['course_id']}/holes/1/elevation"
        f"?layout_id={seeded_course['layout_id']}"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hole_number"] == 1
    assert data["tee_elevation_ft"] == pytest.approx(49.5, abs=0.1)
    assert data["elevation_change_ft"] == pytest.approx(-1.6, abs=0.1)


@pytest.mark.asyncio
async def test_hole_elevation_not_found(client: AsyncClient, seeded_course):
    res = await client.get(
        f"/api/v1/geo/courses/{seeded_course['course_id']}/holes/99/elevation"
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_nearest_hole(client: AsyncClient, seeded_course, test_engine):
    """Nearest-hole returns the closest tee to a GPS position."""
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    from app.models.course import Hole
    from sqlalchemy import select

    _, sf = test_engine
    async with sf() as session:
        result = await session.execute(
            select(Hole).where(
                Hole.layout_id == seeded_course["layout_id"],
                Hole.hole_number == 5,
            )
        )
        hole = result.scalar_one()
        hole.tee_position = from_shape(Point(-95.21255, 30.02698), srid=4326)
        await session.commit()

    # Query near hole 5's tee
    res = await client.get(
        f"/api/v1/geo/nearest-hole?lat=30.02700&lng=-95.21250&course_id={seeded_course['course_id']}"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["hole_number"] == 5
    assert data["distance_m"] < 10  # within 10m


@pytest.mark.asyncio
async def test_nearest_hole_no_geo_data(client: AsyncClient, seeded_course):
    """Returns not found when no holes have GPS data."""
    res = await client.get(
        f"/api/v1/geo/nearest-hole?lat=30.027&lng=-95.209&course_id={seeded_course['course_id']}"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is False
