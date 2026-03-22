"""
Redis caching service for RGDGC.

All methods are resilient — if Redis is unavailable, they return None or
fail silently so the application keeps working (just without caching).

Keys are prefixed with ``rgdgc:`` to namespace within the Redis instance.
"""

import json
import logging
from typing import Any

import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)

KEY_PREFIX = "rgdgc:"


class CacheService:
    _redis: redis.Redis | None = None

    @classmethod
    async def get_redis(cls) -> redis.Redis | None:
        """Lazy-init Redis connection. Returns None if unavailable."""
        if cls._redis is not None:
            try:
                await cls._redis.ping()
                return cls._redis
            except Exception:
                cls._redis = None

        try:
            settings = get_settings()
            cls._redis = redis.from_url(
                settings.redis_url, decode_responses=True
            )
            await cls._redis.ping()
            return cls._redis
        except Exception as exc:
            logger.warning("Redis unavailable for caching: %s", exc)
            cls._redis = None
            return None

    @classmethod
    async def get(cls, key: str) -> dict | list | None:
        """Get cached value. Returns None on miss or error."""
        r = await cls.get_redis()
        if r is None:
            return None
        try:
            raw = await r.get(f"{KEY_PREFIX}{key}")
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.warning("Cache GET failed for %s: %s", key, exc)
            return None

    @classmethod
    async def set(cls, key: str, value: Any, ttl: int = 300) -> None:
        """Cache value with TTL (default 5 min). Fails silently."""
        r = await cls.get_redis()
        if r is None:
            return
        try:
            await r.setex(f"{KEY_PREFIX}{key}", ttl, json.dumps(value))
        except Exception as exc:
            logger.warning("Cache SET failed for %s: %s", key, exc)

    @classmethod
    async def delete(cls, key: str) -> None:
        """Delete a cached key."""
        r = await cls.get_redis()
        if r is None:
            return
        try:
            await r.delete(f"{KEY_PREFIX}{key}")
        except Exception as exc:
            logger.warning("Cache DELETE failed for %s: %s", key, exc)

    @classmethod
    async def delete_pattern(cls, pattern: str) -> None:
        """Delete all keys matching pattern (e.g. 'leaderboard:*')."""
        r = await cls.get_redis()
        if r is None:
            return
        try:
            cursor = None
            while cursor != 0:
                cursor, keys = await r.scan(
                    cursor=cursor or 0,
                    match=f"{KEY_PREFIX}{pattern}",
                    count=100,
                )
                if keys:
                    await r.delete(*keys)
        except Exception as exc:
            logger.warning("Cache DELETE_PATTERN failed for %s: %s", pattern, exc)

    @classmethod
    async def flush(cls) -> None:
        """Flush all rgdgc: keys (not the entire Redis DB, to preserve token blacklist etc.)."""
        await cls.delete_pattern("*")
