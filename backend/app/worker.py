"""
Celery application for RGDGC background tasks.

Start the worker:
    celery -A app.worker worker --loglevel=info

Start the beat scheduler:
    celery -A app.worker beat --loglevel=info
"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "rgdgc",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Chicago",  # Kingwood, TX (Houston metro — Central Time)
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 min hard limit
    task_soft_time_limit=240,  # 4 min soft limit (raises SoftTimeLimitExceeded)
    worker_prefetch_multiplier=1,  # Fair scheduling — one task at a time per worker
    task_acks_late=True,  # Ack after execution so crashed tasks are retried
    task_reject_on_worker_lost=True,  # Re-queue if worker dies mid-task
    worker_max_tasks_per_child=200,  # Restart worker process every 200 tasks (leak guard)
    result_expires=86400,  # Results expire after 24h
    broker_connection_retry_on_startup=True,
)

# Auto-discover tasks in app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])
