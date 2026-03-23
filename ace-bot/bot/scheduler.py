"""Asyncio-based scheduled tasks for automated posts and reminders."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Coroutine

from bot.api_client import RGDGCClient
from bot.formatters import format_events_list, format_leaderboard

logger = logging.getLogger(__name__)

# Type alias for async post callbacks
PostCallback = Callable[[str], Coroutine[Any, Any, None]]


class Scheduler:
    """Lightweight asyncio scheduler for periodic bot tasks.

    Instead of pulling in Celery or APScheduler, this uses simple
    ``asyncio.sleep`` loops.  Each task checks a condition (day/hour match
    or event proximity) once per minute and fires the callback when
    appropriate.
    """

    def __init__(
        self,
        api_client: RGDGCClient,
        *,
        standings_day: str = "monday",
        standings_hour: int = 9,
        reminder_hours: tuple[int, ...] = (24, 1),
    ) -> None:
        self._api = api_client
        self._standings_day = standings_day.lower()
        self._standings_hour = standings_hour
        self._reminder_hours = reminder_hours

        self._discord_post: PostCallback | None = None
        self._telegram_post: PostCallback | None = None
        self._tasks: list[asyncio.Task[None]] = []

    def set_discord_callback(self, callback: PostCallback) -> None:
        self._discord_post = callback

    def set_telegram_callback(self, callback: PostCallback) -> None:
        self._telegram_post = callback

    async def _post(self, message: str) -> None:
        """Send a message via all configured channels."""
        if self._discord_post:
            try:
                await self._discord_post(message)
            except Exception:
                logger.exception("Failed to post to Discord")
        if self._telegram_post:
            try:
                await self._telegram_post(message)
            except Exception:
                logger.exception("Failed to post to Telegram")

    # ------------------------------------------------------------------
    # Weekly standings
    # ------------------------------------------------------------------

    async def _standings_loop(self, league_ids: list[int]) -> None:
        """Post weekly standings at the configured day/time."""
        day_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6,
        }
        target_day = day_map.get(self._standings_day, 0)
        last_posted: datetime | None = None

        while True:
            now = datetime.now(timezone.utc)
            if (
                now.weekday() == target_day
                and now.hour == self._standings_hour
                and (last_posted is None or (now - last_posted) > timedelta(hours=23))
            ):
                for lid in league_ids:
                    data = await self._api.get_leaderboard(lid)
                    if data:
                        await self._post(format_leaderboard(data))
                last_posted = now

            await asyncio.sleep(60)

    # ------------------------------------------------------------------
    # Event reminders
    # ------------------------------------------------------------------

    async def _event_reminder_loop(self) -> None:
        """Check for upcoming events and send reminders."""
        notified: set[tuple[int, int]] = set()  # (event_id, hours_before)

        while True:
            now = datetime.now(timezone.utc)
            events_data = await self._api.get_upcoming_events()
            events: list[dict[str, Any]] = []
            if events_data:
                events = events_data.get("events", events_data if isinstance(events_data, list) else [])

            for event in events:
                event_id = event.get("id")
                event_date_str = event.get("event_date")
                if not event_id or not event_date_str:
                    continue

                try:
                    event_dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    continue

                hours_until = (event_dt - now).total_seconds() / 3600

                for reminder_h in self._reminder_hours:
                    key = (event_id, reminder_h)
                    if key in notified:
                        continue
                    # Fire if we're within 5 minutes of the reminder window
                    if 0 <= (hours_until - reminder_h) < (5 / 60):
                        name = event.get("name", event.get("league_name", "Event"))
                        if reminder_h >= 24:
                            time_str = f"{reminder_h // 24} day(s)"
                        else:
                            time_str = f"{reminder_h} hour(s)"
                        msg = f"Reminder: **{name}** starts in {time_str}! Check in now with `/checkin {event_id}`"
                        await self._post(msg)
                        notified.add(key)

            await asyncio.sleep(60)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, league_ids: list[int] | None = None) -> None:
        """Start all scheduled task loops.  Call after the event loop is running."""
        loop = asyncio.get_event_loop()
        self._tasks.append(loop.create_task(self._standings_loop(league_ids or [1, 2])))
        self._tasks.append(loop.create_task(self._event_reminder_loop()))
        logger.info(
            "Scheduler started — standings every %s at %02d:00 UTC, reminders at %s hours before",
            self._standings_day,
            self._standings_hour,
            self._reminder_hours,
        )

    async def stop(self) -> None:
        """Cancel all running tasks."""
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Scheduler stopped")
