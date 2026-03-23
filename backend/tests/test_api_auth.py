"""Integration tests for auth endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    res = await client.post("/api/v1/auth/register", json={
        "email": "new@rgdgc.com",
        "username": "newplayer",
        "password": "pass123",
        "display_name": "New Player",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "newplayer"
    assert data["user"]["role"] == "player"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/auth/register", json={
        "email": "test@rgdgc.com",
        "username": "different",
        "password": "pass123",
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_login(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/auth/login", json={
        "email": "test@rgdgc.com",
        "password": "testpass123",
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/auth/login", json={
        "email": "test@rgdgc.com",
        "password": "wrong",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "test@rgdgc.com"


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient, auth_headers):
    res = await client.put("/api/v1/users/me", headers=auth_headers, json={
        "display_name": "Updated Name",
    })
    assert res.status_code == 200
    assert res.json()["display_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_unauthorized_without_token(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, auth_headers):
    # First login to get tokens
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "test@rgdgc.com",
        "password": "testpass123",
    })
    refresh = login_res.json()["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh,
    })
    assert res.status_code == 200
    assert "access_token" in res.json()
