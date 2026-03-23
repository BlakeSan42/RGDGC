"""Claude AI integration for intelligent disc golf Q&A."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Any

import anthropic

from bot.api_client import RGDGCClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are Clawd, the AI assistant for River Grove Disc Golf Club (RGDGC) in \
Kingwood, TX (Houston metro). You are friendly, knowledgeable about disc golf, and helpful.

Key facts:
- The club's home course is River Grove DGC in River Grove Park, Kingwood, TX.
- 21 holes with 3 tee pads per hole. Heavily wooded, tight fairways.
- Layouts: "All 18 plus 3A" (tournament), "Standard 18", "Ryne Theis Memorial".
- Concrete tees, Mach III/V/VII baskets. Par 58 (tournament), Par 55 (standard).
- Designed by Andi Lehman Young (PDGA #2094). Established 2006.
- Parking: Kingwood residents need 'K' sticker. Non-residents park outside gate.
- The club runs weekly leagues: "Dubs" (doubles) and "Sunday Singles".
- Currency: $RGDG (River Grove Disc Golf Token).
- Putting zones: C1 (0-10m), C1X (circle 1 exclusive, 10m), C2 (10-20m).
- Points system: field_size - finish_position + 1.

You can answer questions about:
- Disc golf rules (PDGA Official Rules)
- Strategy and technique advice
- Club events and standings (use the provided tools)
- Course information
- Disc recommendations

Guidelines:
- Keep responses concise — chat messages, not essays.
- Use the tools when the user asks about specific data (standings, events, etc.).
- If you don't know something, say so honestly.
- Be encouraging to beginners.
"""

# Tool definitions for Claude function calling
TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_leaderboard",
        "description": "Get current season league standings/leaderboard. Use when someone asks about standings, points, or who is winning.",
        "input_schema": {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "The league ID. Use 1 for Sunday Singles, 2 for Dubs if unsure.",
                },
            },
            "required": ["league_id"],
        },
    },
    {
        "name": "get_upcoming_events",
        "description": "Get upcoming scheduled events. Use when someone asks what events are coming up.",
        "input_schema": {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "Optional league ID to filter by.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_event_results",
        "description": "Get results from a completed event. Use when someone asks about results from a specific event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "description": "The event ID.",
                },
            },
            "required": ["event_id"],
        },
    },
    {
        "name": "get_player_stats",
        "description": "Get statistics for a specific player.",
        "input_schema": {
            "type": "object",
            "properties": {
                "player_id": {
                    "type": "integer",
                    "description": "The player ID.",
                },
            },
            "required": ["player_id"],
        },
    },
    {
        "name": "get_course_info",
        "description": "Get information about the course including layouts and hole details.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "lookup_rule",
        "description": "Search PDGA rules by keyword or topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The rule topic or keyword to search for.",
                },
            },
            "required": ["query"],
        },
    },
]


class RateLimiter:
    """Simple per-user sliding-window rate limiter."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 3600) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, user_id: str) -> bool:
        now = time.monotonic()
        timestamps = self._requests[user_id]
        # Prune expired entries
        self._requests[user_id] = [t for t in timestamps if now - t < self.window_seconds]
        if len(self._requests[user_id]) >= self.max_requests:
            return False
        self._requests[user_id].append(now)
        return True

    def remaining(self, user_id: str) -> int:
        now = time.monotonic()
        active = [t for t in self._requests.get(user_id, []) if now - t < self.window_seconds]
        return max(0, self.max_requests - len(active))


class AIHandler:
    """Manages Claude AI interactions with tool-use for RGDGC data."""

    def __init__(
        self,
        api_key: str,
        model: str,
        api_client: RGDGCClient,
        rate_limit: int = 20,
        rate_window: int = 3600,
    ) -> None:
        self._claude = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model
        self._api = api_client
        self._limiter = RateLimiter(max_requests=rate_limit, window_seconds=rate_window)

    async def handle_message(self, user_id: str, message: str) -> str:
        """Process a user message through Claude with tool use.

        Returns the final text response from the model.
        """
        if not self._limiter.is_allowed(user_id):
            remaining_time = self._limiter.window_seconds // 60
            return (
                f"You've hit the rate limit. Please try again in up to {remaining_time} minutes. "
                f"Remaining: {self._limiter.remaining(user_id)}"
            )

        messages: list[dict[str, Any]] = [{"role": "user", "content": message}]

        try:
            return await self._run_conversation(messages)
        except anthropic.APIError as exc:
            logger.error("Claude API error: %s", exc)
            return "Sorry, I'm having trouble thinking right now. Try again in a moment."
        except Exception:
            logger.exception("Unexpected error in AI handler")
            return "Something went wrong. Please try again."

    async def _run_conversation(self, messages: list[dict[str, Any]], depth: int = 0) -> str:
        """Run the conversation loop, handling tool calls recursively (max 5 rounds)."""
        if depth > 5:
            return "I got a bit lost trying to look that up. Could you try rephrasing?"

        response = await self._claude.messages.create(
            model=self._model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Collect text and tool-use blocks
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []

        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({"id": block.id, "name": block.name, "input": block.input})

        if response.stop_reason == "end_turn" or not tool_calls:
            return "\n".join(text_parts) if text_parts else "I don't have anything to add."

        # Execute tool calls
        messages.append({"role": "assistant", "content": response.content})

        tool_results: list[dict[str, Any]] = []
        for call in tool_calls:
            result = await self._execute_tool(call["name"], call["input"])
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": json.dumps(result) if result else json.dumps({"error": "Data unavailable"}),
            })

        messages.append({"role": "user", "content": tool_results})

        return await self._run_conversation(messages, depth + 1)

    async def _execute_tool(self, name: str, inputs: dict[str, Any]) -> Any:
        """Dispatch a tool call to the appropriate API client method."""
        dispatch = {
            "get_leaderboard": lambda: self._api.get_leaderboard(inputs["league_id"]),
            "get_upcoming_events": lambda: self._api.get_upcoming_events(inputs.get("league_id")),
            "get_event_results": lambda: self._api.get_event_results(inputs["event_id"]),
            "get_player_stats": lambda: self._api.get_player_stats(inputs["player_id"]),
            "get_course_info": lambda: self._api.get_course_info(),
            "lookup_rule": lambda: self._api.lookup_rule(inputs["query"]),
        }

        handler = dispatch.get(name)
        if handler is None:
            logger.warning("Unknown tool called: %s", name)
            return {"error": f"Unknown tool: {name}"}

        try:
            return await handler()
        except Exception:
            logger.exception("Tool %s failed", name)
            return {"error": f"Failed to execute {name}"}
