"""
Test fixtures — uses a fresh test database on each session.
"""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.db.database import get_db
from app.main import app

TEST_DB_URL = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc_test"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_db():
    """Create test database if it doesn't exist."""
    admin_url = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1 FROM pg_database WHERE datname='rgdgc_test'"))
        if not result.scalar():
            await conn.execute(text("CREATE DATABASE rgdgc_test"))
    await admin_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def reset_tables():
    """Drop and recreate all tables before each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    # no cleanup needed — drop_all runs before next test


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async def override_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
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
async def admin_headers(client: AsyncClient) -> dict:
    # Register then promote to admin
    res = await client.post("/api/v1/auth/register", json={
        "email": "admin_test@rgdgc.com",
        "username": "admin_test",
        "password": "admin123",
    })
    assert res.status_code == 201, f"Admin register failed: {res.text}"
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]

    # Directly update role in DB
    async with TestSession() as session:
        from app.models.user import User
        user = await session.get(User, user_id)
        user.role = "admin"
        await session.commit()

    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def seeded_course() -> dict:
    from app.models.course import Course, Layout, Hole

    async with TestSession() as session:
        course = Course(name="Test Course", city="Test City", state="IL")
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

    async with TestSession() as session:
        league = League(
            name="Test League", season="2026", league_type="singles",
            points_rule="field_size", drop_worst=0, is_active=True,
        )
        session.add(league)
        await session.commit()
        return {"league_id": league.id}
