import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.db.database import get_engine
from app.models import Base
from app.api.v1.router import api_router
from app.api.public import router as public_router

limiter = Limiter(
    key_func=get_remote_address,
    enabled=get_settings().environment != "testing",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (dev only — use Alembic in production)
    settings = get_settings()

    # Reject default secrets in any non-dev/non-test environment
    if settings.environment not in ("development", "test"):
        if "change-in-production" in settings.jwt_secret or len(settings.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be a strong random string in production")
        if "change-in-production" in settings.secret_key or len(settings.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be a strong random string in production")

    # Create tables on startup — non-blocking with 10s timeout
    import asyncio
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Starting RGDGC API ({settings.environment})")

    async def _init_db():
        engine = get_engine()
        async with engine.begin() as conn:
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            except Exception:
                logger.warning("PostGIS not available")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables ready")

    try:
        await asyncio.wait_for(_init_db(), timeout=10)
    except Exception as e:
        logger.warning(f"DB init deferred: {e}")

    yield
    # Shutdown — skip dispose in testing (engine is managed by test fixtures)
    if settings.environment != "testing":
        engine = get_engine()
        await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="River Grove Disc Golf Club API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Owner-Key"],
    )

    # Security headers
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request as StarletteRequest
    from starlette.responses import Response

    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: StarletteRequest, call_next):
            response: Response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            return response

    app.add_middleware(SecurityHeadersMiddleware)

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.include_router(api_router, prefix="/api/v1")
    app.include_router(public_router)

    # Serve uploaded files locally in development
    if settings.storage_backend == "local":
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "rgdgc-api"}

    return app


app = create_app()
