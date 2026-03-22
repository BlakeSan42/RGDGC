"""
Test fixtures — uses a dedicated test database with table truncation between tests.
"""

import os
from typing import AsyncGenerator

# Configure test environment BEFORE importing app modules
os.environ["ENVIRONMENT"] = "testing"
_main_db = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc"
TEST_DB_URL = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc_test"
os.environ["DATABASE_URL"] = TEST_DB_URL

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
import app.db.database as db_module
from app.db.database import get_db
from app.main import create_app

# Will be initialized in session fixture (in the correct event loop)
_engine = None
_TestSession = None


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create test database and tables once per session."""
    global _engine, _TestSession

    # Create test DB if it doesn't exist
    admin_engine = create_async_engine(_main_db, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1 FROM pg_database WHERE datname='rgdgc_test'"))
        if not result.scalar():
            await conn.execute(text("CREATE DATABASE rgdgc_test"))
    await admin_engine.dispose()

    # Enable PostGIS
    postgis_engine = create_async_engine(TEST_DB_URL, isolation_level="AUTOCOMMIT")
    async with postgis_engine.connect() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    await postgis_engine.dispose()

    # Create engine IN this event loop — critical for asyncpg
    _engine = create_async_engine(TEST_DB_URL, echo=False)
    _TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

    # Inject into the app's database module so all code uses the same loop-bound engine
    db_module._engine = _engine
    db_module._async_session = _TestSession

    # Create all tables
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables():
    """Truncate all tables before each test for isolation."""
    async with _engine.begin() as conn:
        await conn.execute(text(
            "DO $$ DECLARE r RECORD; BEGIN "
            "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
            "AND tablename != 'spatial_ref_sys') LOOP "
            "EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; "
            "END LOOP; END $$;"
        ))
    yield


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSession() as session:
        yield session


_test_app = None

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    global _test_app
    if _test_app is None:
        _test_app = create_app()

    async def override_db():
        async with _TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    _test_app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    _test_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/auth/register", json={
        "email": "test@rgdgc.com",
        "username": "testplayer",
        "password": "testpass123",
        "display_name": "Test Player",
    })
    assert res.status_code == 201, f"Register failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/auth/register", json={
        "email": "admin_test@rgdgc.com",
        "username": "admin_test",
        "password": "admin123",
    })
    assert res.status_code == 201, f"Admin register failed: {res.text}"
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]

    async with _TestSession() as session:
        from app.models.user import User
        user = await session.get(User, user_id)
        user.role = "admin"
        await session.commit()

    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def seeded_course() -> dict:
    from app.models.course import Course, Layout, Hole

    async with _TestSession() as session:
        course = Course(name="Test Course", city="Kingwood", state="TX")
        session.add(course)
        await session.flush()

        layout = Layout(
            course_id=course.id, name="Main", holes=9, total_par=27,
            difficulty="intermediate", is_default=True,
        )
        session.add(layout)
        await session.flush()

        for i in range(1, 10):
            session.add(Hole(layout_id=layout.id, hole_number=i, par=3, distance=250))
        await session.commit()

        return {"course_id": course.id, "layout_id": layout.id}


@pytest_asyncio.fixture
async def seeded_league() -> dict:
    from app.models.league import League

    async with _TestSession() as session:
        league = League(
            name="Test League", season="2026", league_type="singles",
            points_rule="field_size", drop_worst=0, is_active=True,
        )
        session.add(league)
        await session.commit()
        return {"league_id": league.id}
