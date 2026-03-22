"""Integration tests for admin endpoints."""

import pytest
from httpx import AsyncClient


# ── Access Control ──


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_regular_user(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/admin/analytics/dashboard", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_unauthenticated(client: AsyncClient):
    res = await client.get("/api/v1/admin/analytics/dashboard")
    assert res.status_code == 403


# ── Analytics Dashboard ──


@pytest.mark.asyncio
async def test_analytics_dashboard(client: AsyncClient, admin_headers):
    res = await client.get("/api/v1/admin/analytics/dashboard", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "active_players" in data
    assert "rounds_this_week" in data
    assert "upcoming_events" in data
    assert isinstance(data["active_players"], int)


# ── Change User Role ──


@pytest.mark.asyncio
async def test_change_user_role_as_admin(client: AsyncClient, admin_headers, auth_headers):
    # Get the regular user's ID
    me_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me_res.json()["id"]

    # Admin changes user's role
    res = await client.post(
        f"/api/v1/admin/users/{user_id}/role",
        params={"role": "admin"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_change_user_role_regular_user_forbidden(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/admin/users/1/role",
        params={"role": "admin"},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_change_user_role_invalid_role(client: AsyncClient, admin_headers, auth_headers):
    me_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me_res.json()["id"]

    res = await client.post(
        f"/api/v1/admin/users/{user_id}/role",
        params={"role": "supervillain"},
        headers=admin_headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_change_user_role_nonexistent_user(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/admin/users/99999/role",
        params={"role": "player"},
        headers=admin_headers,
    )
    assert res.status_code == 404


# ── Create Event ──


@pytest.mark.asyncio
async def test_create_event_as_admin(
    client: AsyncClient, admin_headers, seeded_league, seeded_course
):
    res = await client.post(
        "/api/v1/admin/events",
        params={
            "league_id": seeded_league["league_id"],
            "layout_id": seeded_course["layout_id"],
            "event_date": "2026-04-15",
            "name": "Spring Dubs Week 1",
        },
        headers=admin_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Spring Dubs Week 1"
    assert data["status"] == "upcoming"


@pytest.mark.asyncio
async def test_create_event_regular_user_forbidden(
    client: AsyncClient, auth_headers, seeded_league, seeded_course
):
    res = await client.post(
        "/api/v1/admin/events",
        params={
            "league_id": seeded_league["league_id"],
            "layout_id": seeded_course["layout_id"],
            "event_date": "2026-04-15",
        },
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_event_nonexistent_league(
    client: AsyncClient, admin_headers, seeded_course
):
    res = await client.post(
        "/api/v1/admin/events",
        params={
            "league_id": 99999,
            "layout_id": seeded_course["layout_id"],
            "event_date": "2026-04-15",
        },
        headers=admin_headers,
    )
    assert res.status_code == 404


# ── List Users (admin) ──


@pytest.mark.asyncio
async def test_list_users_as_admin(client: AsyncClient, admin_headers, auth_headers):
    res = await client.get("/api/v1/users", headers=admin_headers)
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 2  # admin + regular user


@pytest.mark.asyncio
async def test_list_users_regular_user_forbidden(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/users", headers=auth_headers)
    assert res.status_code == 403
