"""Integration tests for user profile, account deletion, and push tokens."""

import pytest
from httpx import AsyncClient


# ── Update Profile ──


@pytest.mark.asyncio
async def test_update_profile_display_name(client: AsyncClient, auth_headers):
    res = await client.put(
        "/api/v1/users/me",
        headers=auth_headers,
        json={"display_name": "New Display Name"},
    )
    assert res.status_code == 200
    assert res.json()["display_name"] == "New Display Name"


@pytest.mark.asyncio
async def test_update_profile_multiple_fields(client: AsyncClient, auth_headers):
    res = await client.put(
        "/api/v1/users/me",
        headers=auth_headers,
        json={
            "display_name": "Blake S",
            "phone": "555-0123",
            "bio": "Disc golf is life",
            "avatar_url": "https://example.com/avatar.jpg",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Blake S"
    assert data["phone"] == "555-0123"
    assert data["bio"] == "Disc golf is life"
    assert data["avatar_url"] == "https://example.com/avatar.jpg"


@pytest.mark.asyncio
async def test_update_profile_username_uniqueness(client: AsyncClient, auth_headers):
    # Register a second user
    await client.post("/api/v1/auth/register", json={
        "email": "taken@rgdgc.com",
        "username": "takenname",
        "password": "pass123",
    })

    # Try to change to the taken username
    res = await client.put(
        "/api/v1/users/me",
        headers=auth_headers,
        json={"username": "takenname"},
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_update_profile_unauthenticated(client: AsyncClient):
    res = await client.put(
        "/api/v1/users/me",
        json={"display_name": "Hacker"},
    )
    assert res.status_code == 403


# ── Delete Account ──


@pytest.mark.asyncio
async def test_delete_account_with_correct_password(client: AsyncClient, auth_headers):
    res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers,
        json={"password": "testpass123"},
    )
    assert res.status_code == 200
    assert "deactivated" in res.json()["message"].lower()

    # Verify account is deactivated (can't access protected endpoints)
    me_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_res.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_wrong_password(client: AsyncClient, auth_headers):
    res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers,
        json={"password": "wrongpassword"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_unauthenticated(client: AsyncClient):
    res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        json={"password": "anything"},
    )
    assert res.status_code == 403


# ── Push Token ──


@pytest.mark.asyncio
async def test_register_push_token_ios(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/users/me/push-token",
        headers=auth_headers,
        json={"token": "apns-device-token-abc123", "platform": "ios"},
    )
    assert res.status_code == 200
    assert res.json()["platform"] == "ios"


@pytest.mark.asyncio
async def test_register_push_token_android(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/users/me/push-token",
        headers=auth_headers,
        json={"token": "fcm-token-xyz789", "platform": "android"},
    )
    assert res.status_code == 200
    assert res.json()["platform"] == "android"


@pytest.mark.asyncio
async def test_register_push_token_invalid_platform(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/users/me/push-token",
        headers=auth_headers,
        json={"token": "some-token", "platform": "windows"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_register_push_token_unauthenticated(client: AsyncClient):
    res = await client.post(
        "/api/v1/users/me/push-token",
        json={"token": "some-token", "platform": "ios"},
    )
    assert res.status_code == 403


# ── Unauthorized Access ──


@pytest.mark.asyncio
async def test_unauthorized_access_returns_403(client: AsyncClient):
    """Endpoints requiring auth return 403 when no token is provided."""
    endpoints = [
        ("GET", "/api/v1/users/me/push-token"),
        ("PUT", "/api/v1/users/me"),
        ("DELETE", "/api/v1/users/me"),
    ]
    for method, path in endpoints:
        res = await client.request(method, path)
        assert res.status_code in (403, 405), f"{method} {path} returned {res.status_code}"


@pytest.mark.asyncio
async def test_invalid_bearer_token(client: AsyncClient):
    headers = {"Authorization": "Bearer invalid-jwt-token-here"}
    res = await client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
