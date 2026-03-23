"""Entry point for the RGDGC OpenClaw bot.

Loads configuration from the environment, starts Discord and/or Telegram
bots depending on which tokens are present, runs the scheduler, and
handles graceful shutdown.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys

from dotenv import load_dotenv

from bot.ai_handler import AIHandler
from bot.api_client import RGDGCClient
from bot.scheduler import Scheduler

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("rgdgc-bot")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _required(var: str) -> str:
    val = os.getenv(var)
    if not val:
        logger.error("Missing required environment variable: %s", var)
        sys.exit(1)
    return val


def _optional_int(var: str) -> int | None:
    val = os.getenv(var)
    return int(val) if val else None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    # Core services
    api_url = _required("RGDGC_API_URL")
    api_key = os.getenv("RGDGC_API_KEY", "")  # Optional — public endpoints don't require auth
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")  # Optional — only needed for /ask and @mention AI
    claude_model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

    api_client = RGDGCClient(base_url=api_url, api_key=api_key)
    ai_handler = None
    if anthropic_key:
        ai_handler = AIHandler(
            api_key=anthropic_key,
            model=claude_model,
            api_client=api_client,
            rate_limit=int(os.getenv("AI_RATE_LIMIT_PER_USER", "20")),
            rate_window=int(os.getenv("AI_RATE_LIMIT_WINDOW_SECONDS", "3600")),
        )
    else:
        logger.warning("ANTHROPIC_API_KEY not set — /ask and AI features disabled")

    # Scheduler
    standings_day = os.getenv("STANDINGS_POST_DAY", "monday")
    standings_hour = int(os.getenv("STANDINGS_POST_HOUR", "9"))
    reminder_hours_str = os.getenv("EVENT_REMINDER_HOURS", "24,1")
    reminder_hours = tuple(int(h.strip()) for h in reminder_hours_str.split(","))

    scheduler = Scheduler(
        api_client,
        standings_day=standings_day,
        standings_hour=standings_hour,
        reminder_hours=reminder_hours,
    )

    # Shutdown event
    shutdown_event = asyncio.Event()

    def _handle_signal() -> None:
        logger.info("Shutdown signal received")
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    tasks: list[asyncio.Task[None]] = []

    # ----- Discord -----
    discord_token = os.getenv("DISCORD_BOT_TOKEN")
    discord_bot = None
    if discord_token:
        from bot.discord_bot import RGDGCBot

        discord_bot = RGDGCBot(
            api_client=api_client,
            ai_handler=ai_handler,
            standings_channel_id=_optional_int("DISCORD_STANDINGS_CHANNEL_ID"),
            reminders_channel_id=_optional_int("DISCORD_REMINDERS_CHANNEL_ID"),
        )
        scheduler.set_discord_callback(discord_bot.post_to_channel)

        async def run_discord() -> None:
            assert discord_bot is not None and discord_token is not None
            try:
                await discord_bot.start(discord_token)
            except asyncio.CancelledError:
                pass
            finally:
                if not discord_bot.is_closed():
                    await discord_bot.close()

        tasks.append(asyncio.create_task(run_discord()))
        logger.info("Discord bot starting")
    else:
        logger.warning("DISCORD_BOT_TOKEN not set — Discord bot disabled")

    # ----- Telegram -----
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
    telegram_bot = None
    if telegram_token:
        from bot.telegram_bot import TelegramBot

        telegram_bot = TelegramBot(
            token=telegram_token,
            api_client=api_client,
            ai_handler=ai_handler,
            chat_id=_optional_int("TELEGRAM_CHAT_ID"),
        )
        scheduler.set_telegram_callback(telegram_bot.post_message)

        async def run_telegram() -> None:
            assert telegram_bot is not None
            try:
                await telegram_bot.application.initialize()
                await telegram_bot.application.start()
                await telegram_bot.application.updater.start_polling()  # type: ignore[union-attr]
                await shutdown_event.wait()
            except asyncio.CancelledError:
                pass
            finally:
                if telegram_bot.application.updater and telegram_bot.application.updater.running:
                    await telegram_bot.application.updater.stop()
                if telegram_bot.application.running:
                    await telegram_bot.application.stop()
                    await telegram_bot.application.shutdown()

        tasks.append(asyncio.create_task(run_telegram()))
        logger.info("Telegram bot starting")
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled")

    if not tasks:
        logger.error("No bot tokens configured. Set DISCORD_BOT_TOKEN and/or TELEGRAM_BOT_TOKEN.")
        await api_client.close()
        sys.exit(1)

    # Start scheduler
    scheduler.start()

    # Wait for shutdown
    await shutdown_event.wait()

    logger.info("Shutting down...")
    await scheduler.stop()
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await api_client.close()
    logger.info("Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())
