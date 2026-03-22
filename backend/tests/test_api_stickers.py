"""Tests for sticker generation, claiming, and inventory management."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generate_batch(client: AsyncClient, admin_headers):
    res = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 5, "batch_name": "Test Batch"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["quantity"] == 5
    assert data["batch_name"] == "Test Batch"
    assert len(data["codes"]) == 5
    assert data["first_code"].startswith("RGDG-")
    assert data["csv_download_url"].startswith("/api/v1/stickers/batch/")


@pytest.mark.asyncio
async def test_generate_batch_requires_admin(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=auth_headers,
        json={"quantity": 5, "batch_name": "Test"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_validate_unknown_code(client: AsyncClient):
    res = await client.get("/api/v1/stickers/validate/RGDG-ZZZZ")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False


@pytest.mark.asyncio
async def test_validate_available_code(client: AsyncClient, admin_headers):
    # Generate a batch first
    batch = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 1, "batch_name": "Validate Test"},
    )
    code = batch.json()["codes"][0]["code"]

    res = await client.get(f"/api/v1/stickers/validate/{code}")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["available"] is True


@pytest.mark.asyncio
async def test_claim_sticker(client: AsyncClient, admin_headers, auth_headers):
    # Generate batch as admin
    batch = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 1, "batch_name": "Claim Test"},
    )
    code = batch.json()["codes"][0]["code"]

    # Claim as regular user
    res = await client.post(
        f"/api/v1/stickers/claim/{code}",
        headers=auth_headers,
        json={"manufacturer": "Innova", "mold": "Destroyer", "color": "Blue"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["disc_code"] == code

    # Validate should now show claimed
    val = await client.get(f"/api/v1/stickers/validate/{code}")
    assert val.json()["available"] is False
    assert val.json()["claimed"] is True


@pytest.mark.asyncio
async def test_claim_already_claimed(client: AsyncClient, admin_headers, auth_headers):
    # Generate and claim
    batch = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 1, "batch_name": "Double Claim"},
    )
    code = batch.json()["codes"][0]["code"]
    await client.post(
        f"/api/v1/stickers/claim/{code}",
        headers=auth_headers,
        json={"mold": "Buzzz"},
    )

    # Register a second user and try to claim same code
    reg2 = await client.post("/api/v1/auth/register", json={
        "email": "other@rgdgc.com",
        "username": "otherplayer",
        "password": "test1234",
    })
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    res = await client.post(f"/api/v1/stickers/claim/{code}", headers=headers2)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_claim_invalid_code(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/stickers/claim/RGDG-FAKE",
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_sticker_stats(client: AsyncClient, admin_headers):
    # Generate a batch
    await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 3, "batch_name": "Stats Test"},
    )

    res = await client.get("/api/v1/stickers/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_stickers"] == 3
    assert data["available"] == 3
    assert data["claimed"] == 0
    assert data["batch_count"] == 1


@pytest.mark.asyncio
async def test_batch_csv_download(client: AsyncClient, admin_headers):
    batch = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 2, "batch_name": "CSV Test"},
    )
    batch_id = batch.json()["batch_id"]

    res = await client.get(
        f"/api/v1/stickers/batch/{batch_id}/csv",
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    lines = res.text.strip().split("\n")
    assert len(lines) == 3  # header + 2 rows
    assert "code,url,short_url" in lines[0]


@pytest.mark.asyncio
async def test_batch_inventory(client: AsyncClient, admin_headers):
    batch = await client.post(
        "/api/v1/stickers/generate-batch",
        headers=admin_headers,
        json={"quantity": 3, "batch_name": "Inventory Test"},
    )
    batch_id = batch.json()["batch_id"]

    res = await client.get(
        f"/api/v1/stickers/batch/{batch_id}/inventory",
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 3
    assert data["available"] == 3
    assert len(data["stickers"]) == 3
