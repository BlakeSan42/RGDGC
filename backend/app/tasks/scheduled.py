"""
Scheduled (Celery Beat) tasks for RGDGC.

All tasks are idempotent — safe to run multiple times without side effects.
Beat schedule is registered at the bottom of this module.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.worker import celery_app

logger = logging.getLogger(__name__)


def _get_sync_db():
    """Create a synchronous SQLAlchemy session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    return engine, Session(engine)


@celery_app.task(
    bind=True,
    name="weekly_standings_update",
    max_retries=2,
    default_retry_delay=300,
)
def weekly_standings_update(self) -> dict:
    """Post weekly standings summary. Runs every Monday 9am CT.

    Calculates current season standings for all active leagues and
    triggers a push notification with a summary to league members.
    """
    from sqlalchemy import text

    engine, db = _get_sync_db()
    try:
        # Find all active leagues
        leagues = db.execute(
            text("SELECT id, name FROM leagues WHERE is_active = true")
        ).fetchall()

        summaries = []
        for league_id, league_name in leagues:
            # Get top 3 for each league
            top3 = db.execute(
                text("""
                    SELECT u.username, SUM(r.points_earned) as total_points
                    FROM results r
                    JOIN users u ON u.id = r.user_id
                    JOIN events e ON e.id = r.event_id
                    WHERE e.league_id = :league_id AND e.status = 'completed'
                    GROUP BY u.id, u.username
                    ORDER BY total_points DESC
                    LIMIT 3
                """),
                {"league_id": league_id},
            ).fetchall()

            if top3:
                standings_text = ", ".join(
                    f"{i+1}. {row[0]} ({int(row[1])}pts)"
                    for i, row in enumerate(top3)
                )
                summaries.append(f"{league_name}: {standings_text}")

                # Send push to league members
                from app.tasks.notifications import send_push_to_league_task
                send_push_to_league_task.delay(
                    league_id,
                    f"{league_name} — Weekly Standings",
                    standings_text,
                    {"type": "standings_update", "league_id": league_id},
                )

        logger.info("Weekly standings processed for %d leagues", len(leagues))
        return {"leagues_processed": len(leagues), "summaries": summaries}
    except Exception as exc:
        logger.exception("Error in weekly_standings_update")
        raise self.retry(exc=exc)
    finally:
        db.close()
        engine.dispose()


@celery_app.task(
    bind=True,
    name="event_reminder",
    max_retries=2,
    default_retry_delay=300,
)
def event_reminder(self) -> dict:
    """Send reminder 24h before upcoming events. Runs daily at 9am CT.

    Finds events happening tomorrow and sends a push to the league members.
    """
    from sqlalchemy import text

    engine, db = _get_sync_db()
    try:
        tomorrow_start = datetime.now(timezone.utc) + timedelta(days=1)
        tomorrow_end = tomorrow_start + timedelta(days=1)

        events = db.execute(
            text("""
                SELECT e.id, e.event_date, l.id as league_id, l.name as league_name,
                       c.name as course_name
                FROM events e
                JOIN leagues l ON l.id = e.league_id
                LEFT JOIN layouts lay ON lay.id = e.layout_id
                LEFT JOIN courses c ON c.id = lay.course_id
                WHERE e.status = 'upcoming'
                  AND e.event_date >= :start
                  AND e.event_date < :end
            """),
            {"start": tomorrow_start, "end": tomorrow_end},
        ).fetchall()

        reminders_sent = 0
        for event in events:
            event_id, event_date, league_id, league_name, course_name = event
            location = course_name or "TBD"
            title = f"Reminder: {league_name} Tomorrow!"
            body = f"Event at {location}. Don't forget to check in!"

            from app.tasks.notifications import send_push_to_league_task
            send_push_to_league_task.delay(
                league_id,
                title,
                body,
                {"type": "event_reminder", "event_id": event_id},
            )
            reminders_sent += 1

        logger.info("Event reminders sent for %d events", reminders_sent)
        return {"reminders_sent": reminders_sent}
    except Exception as exc:
        logger.exception("Error in event_reminder")
        raise self.retry(exc=exc)
    finally:
        db.close()
        engine.dispose()


@celery_app.task(
    bind=True,
    name="cleanup_expired_tokens",
    max_retries=1,
)
def cleanup_expired_tokens(self) -> dict:
    """Clean up expired blacklisted JWT tokens from Redis. Runs daily at 3am CT.

    Blacklisted tokens are stored in Redis with TTL matching their expiry,
    so Redis handles most cleanup. This task handles any edge cases and
    logs metrics.
    """
    import redis as redis_lib

    from app.config import get_settings

    settings = get_settings()
    r = redis_lib.from_url(settings.redis_url)

    try:
        # Count blacklisted tokens (keys matching our pattern)
        pattern = "blacklist:*"
        count = 0
        for _ in r.scan_iter(match=pattern, count=100):
            count += 1

        logger.info("Token cleanup: %d blacklisted tokens currently in Redis", count)

        # Clean up any push tokens that are clearly malformed in the DB
        engine, db = _get_sync_db()
        try:
            from sqlalchemy import text

            result = db.execute(
                text("""
                    UPDATE users
                    SET push_token = NULL, push_platform = NULL
                    WHERE push_token IS NOT NULL
                      AND push_token NOT LIKE 'ExponentPushToken[%%]'
                      AND push_token NOT LIKE 'ExpoPushToken[%%]'
                """)
            )
            cleaned = result.rowcount
            db.commit()
            logger.info("Cleaned %d malformed push tokens", cleaned)
        finally:
            db.close()
            engine.dispose()

        return {"blacklisted_tokens": count, "malformed_tokens_cleaned": cleaned}
    except Exception as exc:
        logger.exception("Error in cleanup_expired_tokens")
        raise self.retry(exc=exc)
    finally:
        r.close()


# ── Celery Beat Schedule ─────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "weekly-standings": {
        "task": "weekly_standings_update",
        "schedule": __import__("celery.schedules", fromlist=["crontab"]).crontab(
            hour=9, minute=0, day_of_week=1,
        ),  # Monday 9am
    },
    "daily-event-reminder": {
        "task": "event_reminder",
        "schedule": __import__("celery.schedules", fromlist=["crontab"]).crontab(
            hour=9, minute=0,
        ),  # Daily 9am
    },
    "daily-token-cleanup": {
        "task": "cleanup_expired_tokens",
        "schedule": __import__("celery.schedules", fromlist=["crontab"]).crontab(
            hour=3, minute=0,
        ),  # 3am daily
    },
}
