"""Tests for Web3 wallet authentication (nonce + signature verification)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_nonce_valid_address(client: AsyncClient):
    """Nonce endpoint accepts a valid Ethereum address."""
    res = await client.post(
        "/api/v1/auth/web3/nonce",
        json={"wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"},
    )
    # Should return 200 with nonce or 503 if blockchain not configured
    assert res.status_code in (200, 503)
    if res.status_code == 200:
        data = res.json()
        assert "nonce" in data or "message" in data


@pytest.mark.asyncio
async def test_nonce_invalid_address(client: AsyncClient):
    """Nonce endpoint rejects invalid Ethereum addresses."""
    res = await client.post(
        "/api/v1/auth/web3/nonce",
        json={"wallet_address": "not-an-eth-address"},
    )
    assert res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_verify_missing_signature(client: AsyncClient):
    """Verify endpoint rejects requests without proper signature."""
    res = await client.post(
        "/api/v1/auth/web3/verify",
        json={
            "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
            "signature": "0xinvalid",
            "nonce": "fake-nonce",
        },
    )
    # 400 = invalid sig, 422 = validation error, 503 = blockchain not configured
    assert res.status_code in (400, 401, 422, 503)
