"""Tests for owner-only system control endpoints.

These endpoints require super_admin role + X-Owner-Key header.
Security is critical — test all access control paths.
"""

import pytest
from httpx import AsyncClient


# The owner key is empty in test env — these tests verify access control


@pytest.mark.asyncio
async def test_owner_endpoints_reject_regular_user(client: AsyncClient, auth_headers):
    """Regular users cannot access any owner endpoint."""
    endpoints = [
        ("POST", "/api/v1/owner/impersonate", {"user_id": 1}),
        ("POST", "/api/v1/owner/override-role", {"user_id": 1, "role": "admin"}),
        ("POST", "/api/v1/owner/lock-user", {"user_id": 1}),
        ("POST", "/api/v1/owner/unlock-user", {"user_id": 1}),
        ("GET", "/api/v1/owner/audit", None),
        ("GET", "/api/v1/owner/system-status", None),
        ("GET", "/api/v1/owner/admins", None),
    ]
    for method, path, body in endpoints:
        headers = {**auth_headers, "X-Owner-Key": "wrong-key"}
        if method == "GET":
            res = await client.get(path, headers=headers)
        else:
            res = await client.post(path, headers=headers, json=body or {})
        assert res.status_code in (401, 403, 422), f"{method} {path} returned {res.status_code}"


@pytest.mark.asyncio
async def test_owner_endpoints_reject_admin_without_key(client: AsyncClient, admin_headers):
    """Admin users without the owner key cannot access owner endpoints."""
    res = await client.get("/api/v1/owner/system-status", headers=admin_headers)
    # Missing X-Owner-Key header → 422 (validation error) or 403
    assert res.status_code in (403, 422)


@pytest.mark.asyncio
async def test_owner_endpoints_reject_admin_with_wrong_key(client: AsyncClient, admin_headers):
    """Admin with wrong owner key is rejected."""
    headers = {**admin_headers, "X-Owner-Key": "definitely-wrong-key"}
    res = await client.get("/api/v1/owner/system-status", headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_owner_endpoints_no_auth(client: AsyncClient):
    """No auth at all is rejected."""
    res = await client.get("/api/v1/owner/admins", headers={"X-Owner-Key": "test"})
    assert res.status_code in (401, 403)
