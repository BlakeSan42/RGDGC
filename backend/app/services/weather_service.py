"""
Weather service using NWS (weather.gov) API.
Free, no API key needed. Rate limit: be polite (few requests/min).

River Grove DGC: Kingwood, TX — NWS Houston/Galveston office.
"""

import httpx
import logging
from datetime import datetime, timedelta
from functools import lru_cache

logger = logging.getLogger(__name__)

NWS_BASE = "https://api.weather.gov"
NWS_HEADERS = {
    "User-Agent": "(rgdgc-app, admin@rgdgc.com)",  # NWS requires identification
    "Accept": "application/geo+json",
}

# Cache the grid coordinates for River Grove DGC
# NWS uses a grid system — we need to look up the grid point once
RIVER_GROVE_LAT = 30.027066
RIVER_GROVE_LNG = -95.208576


async def _get_grid_info(lat: float, lng: float) -> dict | None:
    """Look up NWS grid point for coordinates."""
    # NWS requires max 4 decimal places, and follow_redirects for precision adjustment
    lat = round(lat, 4)
    lng = round(lng, 4)
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(
                f"{NWS_BASE}/points/{lat},{lng}",
                headers=NWS_HEADERS,
            )
            if r.status_code == 200:
                props = r.json()["properties"]
                return {
                    "office": props["gridId"],
                    "grid_x": props["gridX"],
                    "grid_y": props["gridY"],
                    "forecast_url": props["forecast"],
                    "forecast_hourly_url": props["forecastHourly"],
                    "observation_stations_url": props["observationStations"],
                }
    except Exception as e:
        logger.warning(f"NWS grid lookup failed: {e}")
    return None


async def get_current_conditions(
    lat: float = RIVER_GROVE_LAT,
    lng: float = RIVER_GROVE_LNG,
) -> dict:
    """
    Get current weather conditions for a location.

    Returns dict with:
        temperature_f, wind_speed_mph, wind_direction, wind_gust_mph,
        description, humidity, pressure_mb, timestamp
    """
    grid = await _get_grid_info(lat, lng)
    if not grid:
        return {"error": "Could not determine NWS grid point", "source": "weather.gov"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Get nearest observation station
            r = await client.get(grid["observation_stations_url"], headers=NWS_HEADERS)
            if r.status_code != 200:
                return {"error": "Could not find observation stations"}

            stations = r.json()["features"]
            if not stations:
                return {"error": "No observation stations nearby"}

            station_id = stations[0]["properties"]["stationIdentifier"]

            # Get latest observation
            r = await client.get(
                f"{NWS_BASE}/stations/{station_id}/observations/latest",
                headers=NWS_HEADERS,
            )
            if r.status_code != 200:
                return {"error": f"Observation fetch failed: {r.status_code}"}

            obs = r.json()["properties"]

            # Extract and convert units
            temp_c = obs.get("temperature", {}).get("value")
            wind_speed_kmh = obs.get("windSpeed", {}).get("value")
            wind_dir_deg = obs.get("windDirection", {}).get("value")
            wind_gust_kmh = obs.get("windGust", {}).get("value")
            humidity = obs.get("relativeHumidity", {}).get("value")
            pressure_pa = obs.get("barometricPressure", {}).get("value")

            return {
                "temperature_f": round(temp_c * 9 / 5 + 32, 1) if temp_c is not None else None,
                "temperature_c": round(temp_c, 1) if temp_c is not None else None,
                "wind_speed_mph": round(wind_speed_kmh * 0.621371, 1) if wind_speed_kmh is not None else None,
                "wind_speed_kmh": round(wind_speed_kmh, 1) if wind_speed_kmh is not None else None,
                "wind_direction_deg": wind_dir_deg,
                "wind_direction": _deg_to_cardinal(wind_dir_deg) if wind_dir_deg is not None else None,
                "wind_gust_mph": round(wind_gust_kmh * 0.621371, 1) if wind_gust_kmh is not None else None,
                "humidity_pct": round(humidity, 1) if humidity is not None else None,
                "pressure_mb": round(pressure_pa / 100, 1) if pressure_pa is not None else None,
                "description": obs.get("textDescription", ""),
                "station": station_id,
                "timestamp": obs.get("timestamp", ""),
                "source": "weather.gov",
            }

    except Exception as e:
        logger.warning(f"NWS observation fetch failed: {e}")
        return {"error": str(e), "source": "weather.gov"}


async def get_wind_for_putting(
    lat: float = RIVER_GROVE_LAT,
    lng: float = RIVER_GROVE_LNG,
) -> dict:
    """
    Get wind data formatted for the putting probability model.

    Returns: wind_speed_mph, wind_direction_deg, wind_description
    """
    conditions = await get_current_conditions(lat, lng)

    if "error" in conditions:
        return {
            "wind_speed_mph": 0,
            "wind_direction_deg": 0,
            "wind_description": "Unknown (weather data unavailable)",
            "source": "fallback",
        }

    speed = conditions.get("wind_speed_mph") or 0
    direction = conditions.get("wind_direction_deg") or 0
    gust = conditions.get("wind_gust_mph")

    if speed < 5:
        desc = "Calm"
    elif speed < 10:
        desc = "Light breeze"
    elif speed < 20:
        desc = "Moderate wind"
    elif speed < 30:
        desc = "Strong wind"
    else:
        desc = "Very strong wind"

    if gust and gust > speed * 1.5:
        desc += f" (gusting to {gust} mph)"

    cardinal = conditions.get("wind_direction") or ""
    if cardinal:
        desc += f" from {cardinal}"

    return {
        "wind_speed_mph": speed,
        "wind_direction_deg": direction,
        "wind_gust_mph": gust,
        "wind_description": desc,
        "temperature_f": conditions.get("temperature_f"),
        "source": "weather.gov",
    }


def _deg_to_cardinal(deg: float | int) -> str:
    """Convert wind direction degrees to cardinal direction."""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(deg / 22.5) % 16
    return dirs[idx]
