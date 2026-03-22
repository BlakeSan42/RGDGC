"""Weather endpoints — real-time conditions for course play and putting."""

from fastapi import APIRouter, Query

from app.services.weather_service import (
    get_current_conditions,
    get_wind_for_putting,
    RIVER_GROVE_LAT,
    RIVER_GROVE_LNG,
)

router = APIRouter()


@router.get("/current")
async def current_conditions(
    lat: float = Query(RIVER_GROVE_LAT, description="Latitude"),
    lng: float = Query(RIVER_GROVE_LNG, description="Longitude"),
):
    """Get current weather conditions from NWS (weather.gov). No API key needed."""
    return await get_current_conditions(lat, lng)


@router.get("/wind")
async def wind_for_putting(
    lat: float = Query(RIVER_GROVE_LAT, description="Latitude"),
    lng: float = Query(RIVER_GROVE_LNG, description="Longitude"),
):
    """
    Get wind data formatted for the putting probability model.

    Returns wind speed, direction, and a human-readable description.
    Defaults to River Grove DGC coordinates (Kingwood, TX).
    """
    return await get_wind_for_putting(lat, lng)
