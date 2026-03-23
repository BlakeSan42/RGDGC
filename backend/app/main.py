import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

    @app.get("/", response_class=HTMLResponse)
    async def root():
        return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>River Grove Disc Golf Club</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a1a0a;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
.hero{text-align:center;padding:2rem;max-width:600px}
h1{font-size:2.5rem;color:#4CAF50;margin-bottom:.5rem;letter-spacing:-1px}
.subtitle{font-size:1.1rem;color:#90A4AE;margin-bottom:2rem}
.badge{display:inline-block;background:#1B5E20;color:#fff;padding:.3rem .8rem;border-radius:20px;font-size:.85rem;font-weight:600;margin-bottom:1.5rem}
.course-info{background:rgba(255,255,255,.05);border-radius:12px;padding:1.5rem;margin:1.5rem 0;text-align:left}
.course-info h2{color:#4CAF50;font-size:1.2rem;margin-bottom:.8rem}
.course-info p{color:#B0BEC5;line-height:1.6;font-size:.95rem}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}
.stat{text-align:center;background:rgba(255,255,255,.05);border-radius:8px;padding:1rem .5rem}
.stat-num{font-size:1.8rem;font-weight:800;color:#FF6B35}
.stat-label{font-size:.75rem;color:#78909C;text-transform:uppercase;letter-spacing:1px;margin-top:.2rem}
.links{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem}
.links a{color:#4CAF50;text-decoration:none;padding:.6rem 1.2rem;border:2px solid #4CAF50;border-radius:8px;font-weight:600;font-size:.9rem;transition:all .2s}
.links a:hover{background:#4CAF50;color:#fff}
.links a.primary{background:#FF6B35;border-color:#FF6B35;color:#fff}
.links a.primary:hover{background:#E65100;border-color:#E65100}
.footer{margin-top:2rem;color:#546E7A;font-size:.8rem}
.disc{font-size:3rem;margin-bottom:.5rem}
</style>
</head>
<body>
<div class="hero">
<div class="disc">🥏</div>
<h1>River Grove DGC</h1>
<p class="subtitle">Kingwood, TX — Est. 2006</p>
<span class="badge">Dubs &bull; Sunday Singles &bull; Weekly Leagues</span>

<div class="stats">
<div class="stat"><div class="stat-num">21</div><div class="stat-label">Holes</div></div>
<div class="stat"><div class="stat-num">3</div><div class="stat-label">Layouts</div></div>
<div class="stat"><div class="stat-num">Par 58</div><div class="stat-label">Tournament</div></div>
</div>

<div class="course-info">
<h2>About the Course</h2>
<p>River Grove Park, 800 Woodland Hills Dr, Kingwood TX 77339. Heavily wooded with tight fairways along the San Jacinto River. Concrete tees, Mach III/V/VII baskets. Designed by Andi Lehman Young (PDGA #2094).</p>
</div>

<div class="links">
<a href="/docs" class="primary">API Docs</a>
<a href="/api/v1/courses">Courses</a>
<a href="/api/v1/leagues">Leagues</a>
<a href="/api/v1/events">Events</a>
<a href="/health">Health</a>
</div>

<p class="footer">&copy; 2026 River Grove Disc Golf Club &bull; $RGDG</p>
</div>
</body>
</html>"""

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "rgdgc-api"}

    return app


app = create_app()
