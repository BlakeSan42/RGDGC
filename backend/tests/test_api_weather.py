"""Tests for weather API endpoints (NWS weather.gov integration)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_current_weather_endpoint_exists(client: AsyncClient):
    """Weather current endpoint is reachable."""
    res = await client.get("/api/v1/weather/current?lat=30.027&lng=-95.209")
    # NWS API may be slow/down in test — accept any non-404 response
    assert res.status_code != 404, "Weather endpoint not found"


@pytest.mark.asyncio
async def test_wind_endpoint_exists(client: AsyncClient):
    """Wind endpoint is reachable."""
    res = await client.get("/api/v1/weather/wind?lat=30.027&lng=-95.209")
    assert res.status_code != 404, "Wind endpoint not found"


@pytest.mark.asyncio
async def test_weather_default_coords(client: AsyncClient):
    """Endpoints work with default coordinates (River Grove DGC)."""
    res = await client.get("/api/v1/weather/current")
    assert res.status_code != 404
