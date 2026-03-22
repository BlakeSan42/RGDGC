"""Integration tests for league and event endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_list_leagues(client: AsyncClient, auth_headers, seeded_league):
    res = await client.get("/api/v1/leagues", headers=auth_headers)
    assert res.status_code == 200
    leagues = res.json()
    assert any(l["name"] == "Test League" for l in leagues)


@pytest.mark.asyncio
async def test_get_league(client: AsyncClient, auth_headers, seeded_league):
    res = await client.get(
        f"/api/v1/leagues/{seeded_league['league_id']}",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Test League"


@pytest.mark.asyncio
async def test_leaderboard_empty(client: AsyncClient, auth_headers, seeded_league):
    res = await client.get(
        f"/api/v1/leagues/{seeded_league['league_id']}/leaderboard",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_create_event_admin(client: AsyncClient, admin_headers, seeded_league, seeded_course):
    res = await client.post(
        "/api/v1/admin/events",
        headers=admin_headers,
        json={
            "league_id": seeded_league["league_id"],
            "layout_id": seeded_course["layout_id"],
            "event_date": "2026-04-01",
            "name": "Test Event",
        },
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Test Event"
    assert res.json()["status"] == "upcoming"


@pytest.mark.asyncio
async def test_event_checkin(client: AsyncClient, auth_headers, admin_headers, seeded_league, seeded_course):
    # Create event as admin
    event_res = await client.post(
        "/api/v1/admin/events",
        headers=admin_headers,
        json={
            "league_id": seeded_league["league_id"],
            "layout_id": seeded_course["layout_id"],
            "event_date": "2026-04-01",
        },
    )
    event_id = event_res.json()["id"]

    # Check in as player
    res = await client.post(f"/api/v1/events/{event_id}/checkin", headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["players"] >= 1

    # Can't check in twice
    res2 = await client.post(f"/api/v1/events/{event_id}/checkin", headers=auth_headers)
    assert res2.status_code == 400


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/events?status=upcoming", headers=auth_headers)
    assert res.status_code == 200
