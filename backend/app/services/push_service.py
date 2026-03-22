"""
Push notification delivery via Expo Push API.

Uses httpx to POST directly to https://exp.host/--/api/v2/push/send.
No Expo SDK required. All functions are fire-and-forget safe — they log
errors but never raise exceptions that would break the calling endpoint.
"""

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_LIMIT = 100  # Expo accepts up to 100 messages per request


def _is_expo_token(token: str) -> bool:
    """Validate that a string looks like an Expo push token."""
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


def _build_message(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    msg: dict[str, Any] = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    if data:
        msg["data"] = data
    return msg


async def send_push(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> bool:
    """Send a single push notification via Expo.

    Returns True if the push was accepted by Expo, False otherwise.
    """
    if not _is_expo_token(token):
        logger.warning("Invalid Expo push token format: %s", token[:30])
        return False

    message = _build_message(token, title, body, data)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            result = resp.json()

            # Expo wraps single messages in {"data": {...}}
            ticket = result.get("data", {})
            if ticket.get("status") == "error":
                detail = ticket.get("details", {})
                error_type = detail.get("error")
                logger.error(
                    "Expo push error for token %s: %s — %s",
                    token[:30],
                    ticket.get("message"),
                    error_type,
                )
                # DeviceNotRegistered means the token is stale
                if error_type == "DeviceNotRegistered":
                    return False
            return True

    except httpx.HTTPStatusError as exc:
        logger.error("Expo push HTTP error: %s", exc.response.status_code)
        return False
    except Exception:
        logger.exception("Unexpected error sending push notification")
        return False


async def send_push_to_user(
    db: AsyncSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> bool:
    """Look up a user's push token and send a notification.

    If the token turns out to be invalid (DeviceNotRegistered), it is
    cleared from the database so we don't keep trying.
    """
    try:
        user = await db.get(User, user_id)
        if not user or not user.push_token:
            return False

        success = await send_push(user.push_token, title, body, data)

        # Clean up stale token
        if not success and user.push_token:
            logger.info("Clearing stale push token for user %d", user_id)
            user.push_token = None
            user.push_platform = None
            await db.flush()

        return success
    except Exception:
        logger.exception("Error in send_push_to_user for user %d", user_id)
        return False


async def send_push_to_many(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Batch send to multiple tokens.

    Expo supports up to 100 per request, so we chunk accordingly.
    Returns a list of ticket dicts from Expo.
    """
    # Filter to valid tokens only
    valid_tokens = [t for t in tokens if _is_expo_token(t)]
    if not valid_tokens:
        return []

    messages = [_build_message(t, title, body, data) for t in valid_tokens]
    all_tickets: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i in range(0, len(messages), EXPO_BATCH_LIMIT):
                chunk = messages[i : i + EXPO_BATCH_LIMIT]
                try:
                    resp = await client.post(
                        EXPO_PUSH_URL,
                        json=chunk,
                        headers={
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    tickets = result.get("data", [])
                    if isinstance(tickets, list):
                        all_tickets.extend(tickets)
                    else:
                        all_tickets.append(tickets)
                except httpx.HTTPStatusError as exc:
                    logger.error(
                        "Expo batch push HTTP error (chunk %d): %s",
                        i // EXPO_BATCH_LIMIT,
                        exc.response.status_code,
                    )
                except Exception:
                    logger.exception("Error sending push batch chunk %d", i // EXPO_BATCH_LIMIT)

    except Exception:
        logger.exception("Unexpected error in send_push_to_many")

    return all_tickets


async def _collect_tokens_for_invalid_cleanup(
    db: AsyncSession,
    tokens_and_users: list[tuple[str, int]],
    tickets: list[dict[str, Any]],
) -> None:
    """Check Expo ticket responses and clear tokens that are DeviceNotRegistered."""
    for idx, ticket in enumerate(tickets):
        if idx >= len(tokens_and_users):
            break
        if ticket.get("status") == "error":
            detail = ticket.get("details", {})
            if detail.get("error") == "DeviceNotRegistered":
                token, user_id = tokens_and_users[idx]
                logger.info("Clearing stale push token for user %d", user_id)
                user = await db.get(User, user_id)
                if user and user.push_token == token:
                    user.push_token = None
                    user.push_platform = None
    try:
        await db.flush()
    except Exception:
        logger.exception("Error flushing stale token cleanup")


async def send_push_to_league(
    db: AsyncSession,
    league_id: int,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> None:
    """Send a push notification to all members of a league who have push tokens.

    League members are identified as users who have a Result row for any event
    in this league.
    """
    try:
        from app.models.league import Event, Result

        # Find all users who have participated in any event for this league
        stmt = (
            select(User.push_token, User.id)
            .join(Result, Result.user_id == User.id)
            .join(Event, Event.id == Result.event_id)
            .where(Event.league_id == league_id)
            .where(User.push_token.isnot(None))
            .where(User.is_active.is_(True))
            .distinct()
        )
        rows = (await db.execute(stmt)).all()
        if not rows:
            return

        tokens = [row[0] for row in rows]
        tokens_and_users = [(row[0], row[1]) for row in rows]

        tickets = await send_push_to_many(tokens, title, body, data)

        # Clean up any stale tokens
        await _collect_tokens_for_invalid_cleanup(db, tokens_and_users, tickets)

        logger.info(
            "Sent league push to %d members (league_id=%d)", len(tokens), league_id
        )
    except Exception:
        logger.exception("Error in send_push_to_league (league_id=%d)", league_id)


async def send_push_to_all(
    db: AsyncSession,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> None:
    """Send a push notification to all users with push tokens (for announcements)."""
    try:
        stmt = (
            select(User.push_token, User.id)
            .where(User.push_token.isnot(None))
            .where(User.is_active.is_(True))
        )
        rows = (await db.execute(stmt)).all()
        if not rows:
            return

        tokens = [row[0] for row in rows]
        tokens_and_users = [(row[0], row[1]) for row in rows]

        tickets = await send_push_to_many(tokens, title, body, data)

        # Clean up any stale tokens
        await _collect_tokens_for_invalid_cleanup(db, tokens_and_users, tickets)

        logger.info("Sent announcement push to %d users", len(tokens))
    except Exception:
        logger.exception("Error in send_push_to_all")
