"""Tests for the Clawd chat bot endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_chat_help(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/chat",
        headers=admin_headers,
        json={"message": "help"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "response" in data
    assert "suggestions" in data
    assert "Clawd" in data["response"]


@pytest.mark.asyncio
async def test_chat_standings(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/chat",
        headers=admin_headers,
        json={"message": "show me the standings"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "response" in data


@pytest.mark.asyncio
async def test_chat_events(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/chat",
        headers=admin_headers,
        json={"message": "when is the next event?"},
    )
    assert res.status_code == 200
    assert "response" in res.json()


@pytest.mark.asyncio
async def test_chat_rules(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/chat",
        headers=admin_headers,
        json={"message": "what are the rules?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "PDGA" in data["response"] or "rule" in data["response"].lower()


@pytest.mark.asyncio
async def test_chat_default_response(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/chat",
        headers=admin_headers,
        json={"message": "random nonsense xyzzy"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "Clawd" in data["response"]
    assert len(data["suggestions"]) > 0


@pytest.mark.asyncio
async def test_chat_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/chat", json={"message": "help"})
    assert res.status_code in (401, 403)
