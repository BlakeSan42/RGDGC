"""
Test fixtures — uses a dedicated test database, fresh tables per test.
"""

import os
from typing import AsyncGenerator

os.environ["ENVIRONMENT"] = "testing"
TEST_DB_URL = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc_test"
MAIN_DB_URL = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc"
os.environ["DATABASE_URL"] = TEST_DB_URL

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
import app.db.database as db_module
from app.db.database import get_db
from app.main import create_app


import asyncio
import pytest

@pytest.fixture(scope="session", autouse=True)
def ensure_test_db():
    """Create test database once (synchronous wrapper to avoid scope mismatch)."""
    async def _create():
        engine = create_async_engine(MAIN_DB_URL, isolation_level="AUTOCOMMIT")
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1 FROM pg_database WHERE datname='rgdgc_test'"))
            if not result.scalar():
                await conn.execute(text("CREATE DATABASE rgdgc_test"))
        await engine.dispose()

        engine = create_async_engine(TEST_DB_URL, isolation_level="AUTOCOMMIT")
        async with engine.connect() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await engine.dispose()

    asyncio.run(_create())


@pytest_asyncio.fixture(autouse=True)
async def setup_tables():
    """Create fresh tables for each test — guarantees correct event loop."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Inject into app's database module
    db_module._engine = engine
    db_module._async_session = session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine, session_factory

    await engine.dispose()
    db_module._engine = None
    db_module._async_session = None


@pytest_asyncio.fixture
async def db(setup_tables) -> AsyncGenerator[AsyncSession, None]:
    _, session_factory = setup_tables
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(setup_tables) -> AsyncGenerator[AsyncClient, None]:
    _, session_factory = setup_tables
    app = create_app()

    async def override_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


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
async def admin_headers(client: AsyncClient, setup_tables) -> dict:
    _, session_factory = setup_tables
    res = await client.post("/api/v1/auth/register", json={
        "email": "admin_test@rgdgc.com",
        "username": "admin_test",
        "password": "admin123",
    })
    assert res.status_code == 201, f"Admin register failed: {res.text}"
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]

    async with session_factory() as session:
        from app.models.user import User
        user = await session.get(User, user_id)
        user.role = "admin"
        await session.commit()

    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def seeded_course(setup_tables) -> dict:
    from app.models.course import Course, Layout, Hole
    _, session_factory = setup_tables

    async with session_factory() as session:
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
async def seeded_league(setup_tables) -> dict:
    from app.models.league import League
    _, session_factory = setup_tables

    async with session_factory() as session:
        league = League(
            name="Test League", season="2026", league_type="singles",
            points_rule="field_size", drop_worst=0, is_active=True,
        )
        session.add(league)
        await session.commit()
        return {"league_id": league.id}
