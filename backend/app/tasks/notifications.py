"""
Push notification tasks — offloaded from request/response cycle via Celery.

All tasks are idempotent: sending the same notification twice is harmless
(user just sees a duplicate, no data mutation).
"""

import logging

import httpx

from app.worker import celery_app

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_LIMIT = 100


def _is_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


def _build_message(token: str, title: str, body: str, data: dict | None = None) -> dict:
    msg = {"to": token, "title": title, "body": body, "sound": "default"}
    if data:
        msg["data"] = data
    return msg


def _send_sync(messages: list[dict]) -> list[dict]:
    """Synchronous batch send via httpx (Celery tasks are sync)."""
    all_tickets: list[dict] = []
    with httpx.Client(timeout=30.0) as client:
        for i in range(0, len(messages), EXPO_BATCH_LIMIT):
            chunk = messages[i : i + EXPO_BATCH_LIMIT]
            try:
                resp = client.post(
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
    return all_tickets


@celery_app.task(
    bind=True,
    name="send_push_notification",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException),
    retry_backoff=True,
)
def send_push_notification(
    self,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """Send a single push notification (async via Celery)."""
    if not _is_expo_token(token):
        logger.warning("Invalid Expo push token format: %s", token[:30])
        return False

    message = _build_message(token, title, body, data)

    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            EXPO_PUSH_URL,
            json=message,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        result = resp.json()
        ticket = result.get("data", {})
        if ticket.get("status") == "error":
            logger.error(
                "Expo push error for token %s: %s",
                token[:30],
                ticket.get("message"),
            )
            return False
    return True


@celery_app.task(
    bind=True,
    name="send_push_to_league",
    max_retries=2,
    default_retry_delay=60,
)
def send_push_to_league_task(
    self,
    league_id: int,
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Send push to all league members. Returns count of tokens sent to."""
    from sqlalchemy import create_engine, select, text

    from app.config import get_settings

    settings = get_settings()

    # Use synchronous DB connection for Celery tasks
    sync_url = settings.database_url.replace("+asyncpg", "")
    from sqlalchemy.orm import Session

    engine = create_engine(sync_url)

    try:
        with Session(engine) as db:
            # Query users with push tokens who have results in this league's events
            rows = db.execute(
                text("""
                    SELECT DISTINCT u.push_token
                    FROM users u
                    JOIN results r ON r.user_id = u.id
                    JOIN events e ON e.id = r.event_id
                    WHERE e.league_id = :league_id
                      AND u.push_token IS NOT NULL
                      AND u.is_active = true
                """),
                {"league_id": league_id},
            ).fetchall()

            tokens = [row[0] for row in rows if _is_expo_token(row[0])]
    finally:
        engine.dispose()

    if not tokens:
        logger.info("No push tokens found for league %d", league_id)
        return 0

    messages = [_build_message(t, title, body, data) for t in tokens]
    _send_sync(messages)
    logger.info("Sent league push to %d members (league_id=%d)", len(tokens), league_id)
    return len(tokens)


@celery_app.task(
    bind=True,
    name="send_push_to_all",
    max_retries=2,
    default_retry_delay=60,
)
def send_push_to_all_task(
    self,
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Send push to all users with tokens. Returns count sent."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session

    from app.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)

    try:
        with Session(engine) as db:
            rows = db.execute(
                text("""
                    SELECT push_token FROM users
                    WHERE push_token IS NOT NULL AND is_active = true
                """)
            ).fetchall()

            tokens = [row[0] for row in rows if _is_expo_token(row[0])]
    finally:
        engine.dispose()

    if not tokens:
        logger.info("No push tokens found for broadcast")
        return 0

    messages = [_build_message(t, title, body, data) for t in tokens]
    _send_sync(messages)
    logger.info("Sent announcement push to %d users", len(tokens))
    return len(tokens)
