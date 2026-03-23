"""Telegram bot for RGDGC — commands and inline keyboards."""

from __future__ import annotations

import logging
from typing import Any

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

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

WELCOME_MESSAGE = (
    "Welcome to the <b>River Grove Disc Golf Club</b> bot!\n\n"
    "Here's what I can do:\n"
    "/standings — League standings\n"
    "/events — Upcoming events\n"
    "/results &lt;event_id&gt; — Event results\n"
    "/stats — Your player stats\n"
    "/checkin &lt;event_id&gt; — Check into an event\n"
    "/rules &lt;query&gt; — PDGA rule lookup\n"
    "/disc &lt;name&gt; — Disc information\n"
    "/course — Course info\n"
    "/ask &lt;question&gt; — Ask Clawd anything\n"
)


class TelegramBot:
    """Telegram bot wrapper managing handlers and the application lifecycle."""

    def __init__(
        self,
        token: str,
        api_client: RGDGCClient,
        ai_handler: AIHandler,
        *,
        chat_id: int | None = None,
    ) -> None:
        self.api = api_client
        self.ai = ai_handler
        self.chat_id = chat_id
        self._app = Application.builder().token(token).build()
        self._register_handlers()

    def _register_handlers(self) -> None:
        app = self._app
        app.add_handler(CommandHandler("start", self._cmd_start))
        app.add_handler(CommandHandler("standings", self._cmd_standings))
        app.add_handler(CommandHandler("events", self._cmd_events))
        app.add_handler(CommandHandler("results", self._cmd_results))
        app.add_handler(CommandHandler("stats", self._cmd_stats))
        app.add_handler(CommandHandler("checkin", self._cmd_checkin))
        app.add_handler(CommandHandler("rules", self._cmd_rules))
        app.add_handler(CommandHandler("disc", self._cmd_disc))
        app.add_handler(CommandHandler("course", self._cmd_course))
        app.add_handler(CommandHandler("ask", self._cmd_ask))
        app.add_handler(CallbackQueryHandler(self._handle_callback))
        # Catch-all for plain text — treat as AI question
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_text))

    @property
    def application(self) -> Application:
        return self._app

    async def post_message(self, text: str) -> None:
        """Post a message to the configured chat. Used by the scheduler."""
        if not self.chat_id:
            return
        try:
            await self._app.bot.send_message(
                chat_id=self.chat_id,
                text=text[:4096],
                parse_mode="HTML",
            )
        except Exception:
            logger.exception("Failed to send Telegram message")

    # ------------------------------------------------------------------
    # Command handlers
    # ------------------------------------------------------------------

    async def _cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        await update.effective_message.reply_text(WELCOME_MESSAGE, parse_mode="HTML")

    async def _cmd_standings(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        args = context.args or []
        league_id = _parse_league(args[0] if args else None)

        # Offer league selection via inline keyboard if no arg
        if not args:
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("Sunday Singles", callback_data="standings:1"),
                    InlineKeyboardButton("Dubs", callback_data="standings:2"),
                ]
            ])
            await update.effective_message.reply_text("Which league?", reply_markup=keyboard)
            return

        data = await self.api.get_leaderboard(league_id)
        if data:
            await update.effective_message.reply_text(format_leaderboard(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text("Could not fetch standings. Try again later.")

    async def _cmd_events(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        data = await self.api.get_upcoming_events()
        if data:
            events = data.get("events", data if isinstance(data, list) else [])
            await update.effective_message.reply_text(format_events_list(events, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text("No upcoming events or the API is unavailable.")

    async def _cmd_results(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        args = context.args or []
        if not args or not args[0].isdigit():
            await update.effective_message.reply_text("Usage: /results <event_id>")
            return
        event_id = int(args[0])
        data = await self.api.get_event_results(event_id)
        if data:
            await update.effective_message.reply_text(format_event_results(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text(f"Could not fetch results for event {event_id}.")

    async def _cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message and update.effective_user
        args = context.args or []
        if args and args[0].isdigit():
            player_id = int(args[0])
        else:
            resolved = await self.api.get_player_by_telegram(update.effective_user.id)
            if resolved:
                player_id = resolved.get("id", 0)
            else:
                await update.effective_message.reply_text(
                    "Your Telegram account is not linked to RGDGC. "
                    "Please link it in the mobile app or provide a player ID: /stats <id>"
                )
                return

        data = await self.api.get_player_stats(player_id)
        if data:
            await update.effective_message.reply_text(format_player_stats(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text("Could not fetch player stats.")

    async def _cmd_checkin(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message and update.effective_user
        args = context.args or []
        if not args or not args[0].isdigit():
            await update.effective_message.reply_text("Usage: /checkin <event_id>")
            return

        event_id = int(args[0])
        resolved = await self.api.get_player_by_telegram(update.effective_user.id)
        if not resolved:
            await update.effective_message.reply_text(
                "Your Telegram account is not linked. Please link it in the mobile app first."
            )
            return

        user_id = resolved.get("id", 0)
        result = await self.api.checkin_event(event_id, user_id)
        if result:
            await update.effective_message.reply_text(f"You're checked in for event {event_id}!")
        else:
            await update.effective_message.reply_text(
                f"Could not check you in for event {event_id}. It may not be open yet."
            )

    async def _cmd_rules(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        args = context.args or []
        if not args:
            await update.effective_message.reply_text("Usage: /rules <keyword>  (e.g., /rules OB)")
            return
        query = " ".join(args)
        data = await self.api.lookup_rule(query)
        if data:
            await update.effective_message.reply_text(format_rule(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text("No matching rules found.")

    async def _cmd_disc(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        args = context.args or []
        if not args:
            await update.effective_message.reply_text("Usage: /disc <name>  (e.g., /disc Destroyer)")
            return
        code = " ".join(args)
        data = await self.api.lookup_disc(code)
        if data:
            await update.effective_message.reply_text(format_disc_info(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text(f"Could not find disc '{code}'.")

    async def _cmd_course(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message
        data = await self.api.get_course_info()
        if data:
            await update.effective_message.reply_text(format_course_info(data, html=True), parse_mode="HTML")
        else:
            await update.effective_message.reply_text("Could not fetch course info.")

    async def _cmd_ask(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        assert update.effective_message and update.effective_user
        args = context.args or []
        if not args:
            await update.effective_message.reply_text("Usage: /ask <question>")
            return
        question = " ".join(args)
        response = await self.ai.handle_message(str(update.effective_user.id), question)
        await update.effective_message.reply_text(response[:4096])

    # ------------------------------------------------------------------
    # Callback query handler (inline keyboards)
    # ------------------------------------------------------------------

    async def _handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        if not query or not query.data:
            return
        await query.answer()

        parts = query.data.split(":")
        action = parts[0]

        if action == "standings" and len(parts) == 2 and parts[1].isdigit():
            league_id = int(parts[1])
            data = await self.api.get_leaderboard(league_id)
            if data:
                text = format_leaderboard(data, html=True)
            else:
                text = "Could not fetch standings."
            assert query.message
            await query.message.edit_text(text, parse_mode="HTML")

    # ------------------------------------------------------------------
    # Plain text → AI
    # ------------------------------------------------------------------

    async def _handle_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Treat plain text messages as questions for the AI."""
        assert update.effective_message and update.effective_user
        text = update.effective_message.text
        if not text:
            return
        response = await self.ai.handle_message(str(update.effective_user.id), text)
        await update.effective_message.reply_text(response[:4096])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_league(value: str | None) -> int:
    if value is None:
        return 1
    if value.isdigit():
        return int(value)
    lookup = {
        "singles": 1, "sunday": 1,
        "dubs": 2, "doubles": 2,
    }
    return lookup.get(value.lower(), 1)
