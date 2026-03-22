"""Tests for blockchain API endpoints.

Blockchain service is not deployed, so these test error handling and auth guards.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_balance_no_wallet(client: AsyncClient, auth_headers):
    """Balance endpoint rejects users without a wallet address."""
    res = await client.get("/api/v1/blockchain/balance", headers=auth_headers)
    assert res.status_code == 400
    assert "wallet" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_balance_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/blockchain/balance")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_transactions_empty(client: AsyncClient, auth_headers):
    """Transaction history returns empty list for new user."""
    res = await client.get("/api/v1/blockchain/transactions", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["transactions"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_transactions_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/blockchain/transactions")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_pay_fee_no_wallet(client: AsyncClient, auth_headers):
    """Pay fee rejects users without wallet."""
    res = await client.post(
        "/api/v1/blockchain/pay-fee",
        headers=auth_headers,
        json={"tx_hash": "0xfake", "event_id": 1},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_treasury_requires_admin(client: AsyncClient, auth_headers):
    """Treasury endpoint is admin-only."""
    res = await client.get("/api/v1/blockchain/treasury", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_treasury_admin_blockchain_unavailable(client: AsyncClient, admin_headers):
    """Treasury returns 503 when blockchain is not configured."""
    res = await client.get("/api/v1/blockchain/treasury", headers=admin_headers)
    # 503 = blockchain not configured (expected in test env)
    assert res.status_code == 503
