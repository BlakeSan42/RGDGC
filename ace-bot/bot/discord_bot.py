"""Discord bot for RGDGC — slash commands and event handlers."""

from __future__ import annotations

import logging
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from bot.ai_handler import AIHandler
from bot.api_client import RGDGCClient
from bot.formatters import (
    format_course_info,
    format_disc_info,
    format_event_results,
    format_events_list,
    format_leaderboard,
    format_player_stats,
    format_rule,
)

logger = logging.getLogger(__name__)


class RGDGCBot(commands.Bot):
    """Discord bot with slash commands for disc golf league management."""

    def __init__(
        self,
        api_client: RGDGCClient,
        ai_handler: AIHandler,
        *,
        standings_channel_id: int | None = None,
        reminders_channel_id: int | None = None,
    ) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)
        self.api = api_client
        self.ai = ai_handler
        self.standings_channel_id = standings_channel_id
        self.reminders_channel_id = reminders_channel_id

    async def setup_hook(self) -> None:
        """Register slash commands when the bot connects."""
        self.tree.add_command(_standings)
        self.tree.add_command(_events)
        self.tree.add_command(_results)
        self.tree.add_command(_stats)
        self.tree.add_command(_checkin)
        self.tree.add_command(_rules)
        self.tree.add_command(_disc)
        self.tree.add_command(_ask)
        self.tree.add_command(_course)
        await self.tree.sync()
        logger.info("Slash commands synced")

    async def on_ready(self) -> None:
        logger.info("Discord bot logged in as %s (ID: %s)", self.user, self.user.id if self.user else "?")
        await self.change_presence(
            activity=discord.Activity(type=discord.ActivityType.playing, name="disc golf")
        )

    async def on_message(self, message: discord.Message) -> None:
        """Handle @mentions as AI questions."""
        if message.author.bot or not self.user:
            return

        if self.user.mentioned_in(message) and not message.mention_everyone:
            content = message.content.replace(f"<@{self.user.id}>", "").replace(f"<@!{self.user.id}>", "").strip()
            if content:
                async with message.channel.typing():
                    response = await self.ai.handle_message(str(message.author.id), content)
                    await message.reply(response[:2000])

        await self.process_commands(message)

    async def post_to_channel(self, text: str) -> None:
        """Post a message to the configured standings/reminders channel.

        Used by the scheduler as a callback.
        """
        channel_id = self.standings_channel_id or self.reminders_channel_id
        if not channel_id:
            return
        channel = self.get_channel(channel_id)
        if channel and isinstance(channel, discord.TextChannel):
            await channel.send(text[:2000])


# ---------------------------------------------------------------------------
# Slash commands — defined at module level, bound to the bot in setup_hook.
# ---------------------------------------------------------------------------

def _get_bot(interaction: discord.Interaction) -> RGDGCBot:
    """Retrieve our custom bot instance from the interaction."""
    assert isinstance(interaction.client, RGDGCBot)
    return interaction.client


@app_commands.command(name="standings", description="Show league standings")
@app_commands.describe(league="League name or ID (default: Sunday Singles)")
async def _standings(interaction: discord.Interaction, league: str | None = None) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    league_id = _parse_league(league)
    data = await bot.api.get_leaderboard(league_id)
    if data:
        await interaction.followup.send(format_leaderboard(data))
    else:
        await interaction.followup.send("Could not fetch standings right now. Try again later.")


@app_commands.command(name="events", description="Show upcoming events")
async def _events(interaction: discord.Interaction) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    data = await bot.api.get_upcoming_events()
    if data:
        events = data.get("events", data if isinstance(data, list) else [])
        await interaction.followup.send(format_events_list(events))
    else:
        await interaction.followup.send("No upcoming events found or the API is unavailable.")


@app_commands.command(name="results", description="Show event results")
@app_commands.describe(event_id="The event ID")
async def _results(interaction: discord.Interaction, event_id: int) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    data = await bot.api.get_event_results(event_id)
    if data:
        await interaction.followup.send(format_event_results(data))
    else:
        await interaction.followup.send(f"Could not fetch results for event {event_id}.")


@app_commands.command(name="stats", description="Show player statistics")
@app_commands.describe(player="Player name or ID")
async def _stats(interaction: discord.Interaction, player: str | None = None) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()

    if player and player.isdigit():
        player_id = int(player)
    else:
        # Try to resolve from Discord ID
        resolved = await bot.api.get_player_by_discord(str(interaction.user.id))
        if resolved:
            player_id = resolved.get("id", 0)
        else:
            await interaction.followup.send(
                "Could not find your player profile. Please link your Discord account or provide a player ID."
            )
            return

    data = await bot.api.get_player_stats(player_id)
    if data:
        await interaction.followup.send(format_player_stats(data))
    else:
        await interaction.followup.send("Could not fetch player stats.")


@app_commands.command(name="checkin", description="Check into an upcoming event")
@app_commands.describe(event_id="The event ID to check into")
async def _checkin(interaction: discord.Interaction, event_id: int) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer(ephemeral=True)

    resolved = await bot.api.get_player_by_discord(str(interaction.user.id))
    if not resolved:
        await interaction.followup.send(
            "Your Discord account is not linked to an RGDGC profile. "
            "Please link it in the mobile app first.",
            ephemeral=True,
        )
        return

    user_id = resolved.get("id", 0)
    result = await bot.api.checkin_event(event_id, user_id)
    if result:
        await interaction.followup.send(f"You're checked in for event {event_id}!", ephemeral=True)
    else:
        await interaction.followup.send(
            f"Could not check you in for event {event_id}. It may not be open for check-in yet.",
            ephemeral=True,
        )


@app_commands.command(name="rules", description="Look up PDGA rules")
@app_commands.describe(query="Rule topic or keyword to search")
async def _rules(interaction: discord.Interaction, query: str) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    data = await bot.api.lookup_rule(query)
    if data:
        await interaction.followup.send(format_rule(data))
    else:
        await interaction.followup.send("Could not find matching rules. Try a different search term.")


@app_commands.command(name="disc", description="Look up disc information")
@app_commands.describe(code="Disc name or code (e.g., 'Destroyer', 'DD3')")
async def _disc(interaction: discord.Interaction, code: str) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    data = await bot.api.lookup_disc(code)
    if data:
        await interaction.followup.send(format_disc_info(data))
    else:
        await interaction.followup.send(f"Could not find disc '{code}'.")


@app_commands.command(name="ask", description="Ask Ace an AI-powered disc golf question")
@app_commands.describe(question="Your question about disc golf, the club, rules, etc.")
async def _ask(interaction: discord.Interaction, question: str) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    response = await bot.ai.handle_message(str(interaction.user.id), question)
    # Truncate to Discord's 2000-char limit
    await interaction.followup.send(response[:2000])


@app_commands.command(name="course", description="Show course information")
async def _course(interaction: discord.Interaction) -> None:
    bot = _get_bot(interaction)
    await interaction.response.defer()
    data = await bot.api.get_course_info()
    if data:
        await interaction.followup.send(format_course_info(data))
    else:
        await interaction.followup.send("Could not fetch course info.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_league(value: str | None) -> int:
    """Resolve a league name or ID string to an integer league ID."""
    if value is None:
        return 1  # Default: Sunday Singles
    if value.isdigit():
        return int(value)
    lookup = {
        "singles": 1, "sunday singles": 1, "sunday": 1,
        "dubs": 2, "doubles": 2,
    }
    return lookup.get(value.lower(), 1)
