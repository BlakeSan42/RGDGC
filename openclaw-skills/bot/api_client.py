"""Async HTTP client for the RGDGC FastAPI backend."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Re-export for type annotations in other modules.
APIResponse = dict[str, Any]


class RGDGCClient:
    """Thin async wrapper around the RGDGC REST API.

    Every public method returns a typed dict on success or ``None`` when the
    upstream API is unreachable / returns an error so callers can degrade
    gracefully.
    """

    def __init__(self, base_url: str, api_key: str = "", timeout: float = 10.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers: dict[str, str] = {"Accept": "application/json"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=self._timeout,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> APIResponse | None:
        try:
            client = await self._ensure_client()
            resp = await client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("API %s returned %s: %s", path, exc.response.status_code, exc.response.text[:200])
            return None
        except httpx.HTTPError as exc:
            logger.error("API request to %s failed: %s", path, exc)
            return None

    async def _post(self, path: str, json: dict[str, Any] | None = None) -> APIResponse | None:
        try:
            client = await self._ensure_client()
            resp = await client.post(path, json=json)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("API POST %s returned %s: %s", path, exc.response.status_code, exc.response.text[:200])
            return None
        except httpx.HTTPError as exc:
            logger.error("API POST request to %s failed: %s", path, exc)
            return None

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    async def get_leaderboard(self, league_id: int) -> APIResponse | None:
        """Fetch season standings for a league."""
        data = await self._get(f"/leagues/{league_id}/leaderboard")
        # Backend returns a list; wrap it for the formatter
        if isinstance(data, list):
            league_info = await self._get(f"/leagues/{league_id}")
            league_name = league_info.get("name", "League") if league_info else "League"
            season = league_info.get("season", "") if league_info else ""
            # Add position numbers if missing
            for i, entry in enumerate(data):
                if "position" not in entry or entry["position"] is None:
                    entry["position"] = i + 1
            return {"league_name": league_name, "season": season, "standings": data}
        return data

    async def get_player_stats(self, player_id: int) -> APIResponse | None:
        """Fetch individual player statistics."""
        return await self._get(f"/users/{player_id}/stats")

    async def get_upcoming_events(self, league_id: int | None = None) -> APIResponse | None:
        """Fetch upcoming scheduled events, optionally filtered by league."""
        params: dict[str, Any] = {"status": "upcoming"}
        if league_id is not None:
            params["league_id"] = league_id
        data = await self._get("/events", params=params)
        # Backend returns a list; wrap for the formatter
        if isinstance(data, list):
            return {"events": data}
        return data

    async def get_event_results(self, event_id: int) -> APIResponse | None:
        """Fetch results for a completed event."""
        return await self._get(f"/events/{event_id}")

    async def checkin_event(self, event_id: int, user_id: int) -> APIResponse | None:
        """Check a player into an event."""
        return await self._post(f"/events/{event_id}/checkin", json={"user_id": user_id})

    async def lookup_disc(self, disc_code: str) -> APIResponse | None:
        """Look up a disc by its code."""
        return await self._get(f"/discs/{disc_code}/lookup")

    async def get_course_info(self, course_id: int | None = None) -> APIResponse | None:
        """Fetch course/layout details. Defaults to the first course (home course)."""
        if course_id is not None:
            return await self._get(f"/courses/{course_id}")
        # No home filter — get all courses, return the first one
        courses = await self._get("/courses")
        if isinstance(courses, list) and courses:
            return await self._get(f"/courses/{courses[0]['id']}")
        return courses

    async def lookup_rule(self, query: str) -> APIResponse | None:
        """Search PDGA rules by keyword.

        No dedicated rules search endpoint exists in the backend.
        Returns a marker so the AI handler uses its own PDGA knowledge.
        """
        return {"rules": [], "query": query, "note": "No rules search API — Claude should answer from knowledge."}

    async def get_player_by_discord(self, discord_id: str) -> APIResponse | None:
        """Resolve a Discord user ID to an RGDGC player record.

        NOTE: Social identity linking not yet implemented in the backend.
        Returns None until the backend adds discord_id to the user model.
        """
        return None

    async def get_player_by_telegram(self, telegram_id: int) -> APIResponse | None:
        """Resolve a Telegram user ID to an RGDGC player record.

        NOTE: Social identity linking not yet implemented in the backend.
        Returns None until the backend adds telegram_id to the user model.
        """
        return None

    async def get_users(self) -> list[APIResponse] | None:
        """Fetch the list of all users (for player name resolution)."""
        return await self._get("/users")
