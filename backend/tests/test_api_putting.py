"""Integration tests for putting analytics endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_log_putt_attempt(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/putting/attempt", headers=auth_headers, json={
        "distance_meters": 7.5,
        "zone": "c1x",
        "made": True,
        "putt_style": "spin",
        "disc_used": "Luna",
        "pressure": "casual",
    })
    assert res.status_code == 201
    assert "id" in res.json()


@pytest.mark.asyncio
async def test_batch_sync(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/putting/batch", headers=auth_headers, json={
        "attempts": [
            {"distance_meters": 5.0, "zone": "c1", "made": True},
            {"distance_meters": 8.0, "zone": "c1x", "made": False},
            {"distance_meters": 15.0, "zone": "c2", "made": False},
        ],
    })
    assert res.status_code == 201
    assert res.json()["synced"] == 3


@pytest.mark.asyncio
async def test_putting_stats(client: AsyncClient, auth_headers):
    # Log some putts first
    await client.post("/api/v1/putting/batch", headers=auth_headers, json={
        "attempts": [
            {"distance_meters": 5.0, "zone": "c1", "made": True},
            {"distance_meters": 5.0, "zone": "c1", "made": True},
            {"distance_meters": 8.0, "zone": "c1x", "made": False},
            {"distance_meters": 15.0, "zone": "c2", "made": True},
        ],
    })

    res = await client.get("/api/v1/putting/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_attempts"] >= 4
    assert data["total_makes"] >= 3


@pytest.mark.asyncio
async def test_putt_probability(client: AsyncClient, auth_headers):
    res = await client.get(
        "/api/v1/putting/probability?distance_meters=7.0",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert 0 < data["make_probability"] < 1
    assert data["distance_feet"] > 0
    assert data["tour_average"] > 0


@pytest.mark.asyncio
async def test_putt_probability_with_wind(client: AsyncClient, auth_headers):
    no_wind = await client.get(
        "/api/v1/putting/probability?distance_meters=10.0",
        headers=auth_headers,
    )
    with_wind = await client.get(
        "/api/v1/putting/probability?distance_meters=10.0&wind_speed=15&wind_direction=90",
        headers=auth_headers,
    )
    assert with_wind.json()["make_probability"] < no_wind.json()["make_probability"]
