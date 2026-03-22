import logging
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ---------------------------------------------------------------------------
# Redis token blacklist (lazy init)
# ---------------------------------------------------------------------------
_redis_client = None


def _get_redis():
    """Lazily initialize and return a Redis client."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis as redis_lib
            settings = get_settings()
            _redis_client = redis_lib.Redis.from_url(
                settings.redis_url, decode_responses=True
            )
            _redis_client.ping()
        except Exception as exc:
            logger.warning("Redis unavailable for token blacklist: %s", exc)
            _redis_client = None
    return _redis_client


def blacklist_token(token: str, expires_in: int) -> None:
    """Store a token in the Redis blacklist with a TTL matching its expiry."""
    client = _get_redis()
    if client is None:
        logger.warning("Cannot blacklist token — Redis unavailable")
        return
    try:
        client.setex(f"bl:{token}", max(expires_in, 1), "1")
    except Exception as exc:
        logger.warning("Failed to blacklist token: %s", exc)


def is_token_blacklisted(token: str) -> bool:
    """Check whether a token has been blacklisted. Returns False if Redis is down."""
    client = _get_redis()
    if client is None:
        return False
    try:
        return client.exists(f"bl:{token}") > 0
    except Exception as exc:
        logger.warning("Failed to check token blacklist: %s", exc)
        return False


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_expiry)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_expiry)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    settings = get_settings()
    token = credentials.credentials

    if is_token_blacklisted(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """Require admin or super_admin role."""
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def get_super_admin(user: User = Depends(get_current_user)) -> User:
    """Require super_admin role. Only Blake."""
    if user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def verify_owner_key(request_key: str) -> bool:
    """
    Verify the owner override key. This is a secondary authentication
    factor that only the system owner (Blake) knows. Set via OWNER_KEY
    env var. Used for critical operations like role escalation,
    system reset, and user impersonation.
    """
    settings = get_settings()
    owner_key = settings.owner_key
    if not owner_key:
        return False
    import hmac
    return hmac.compare_digest(request_key, owner_key)
