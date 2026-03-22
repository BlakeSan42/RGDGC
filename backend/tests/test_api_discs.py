"""Integration tests for disc registration, QR codes, and lost/found workflow."""

import pytest
from httpx import AsyncClient


# ── Registration ──


@pytest.mark.asyncio
async def test_register_disc_success(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={
            "mold": "Destroyer",
            "manufacturer": "Innova",
            "plastic": "Star",
            "weight_grams": 175,
            "color": "Red",
            "notes": "Seasoned, slight dome",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["mold"] == "Destroyer"
    assert data["manufacturer"] == "Innova"
    assert data["status"] == "active"
    assert data["disc_code"].startswith("RGDG-")
    assert data["owner_id"] is not None


@pytest.mark.asyncio
async def test_register_disc_missing_mold(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"manufacturer": "Innova"},
    )
    assert res.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_register_disc_unauthenticated(client: AsyncClient):
    res = await client.post(
        "/api/v1/discs/register",
        json={"mold": "Buzzz"},
    )
    assert res.status_code == 403


# ── List My Discs ──


@pytest.mark.asyncio
async def test_list_my_discs_returns_own_only(client: AsyncClient, auth_headers):
    # Register two discs for the test user
    await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Buzzz"},
    )

    # Register a disc with a different user
    res2 = await client.post("/api/v1/auth/register", json={
        "email": "other@rgdgc.com",
        "username": "otherplayer",
        "password": "pass123",
    })
    other_headers = {"Authorization": f"Bearer {res2.json()['access_token']}"}
    await client.post(
        "/api/v1/discs/register",
        headers=other_headers,
        json={"mold": "Luna"},
    )

    # List first user's discs
    res = await client.get("/api/v1/discs/my-discs", headers=auth_headers)
    assert res.status_code == 200
    discs = res.json()
    assert len(discs) == 2
    molds = {d["mold"] for d in discs}
    assert molds == {"Destroyer", "Buzzz"}


@pytest.mark.asyncio
async def test_list_my_discs_empty(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/discs/my-discs", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


# ── Public Lookup ──


@pytest.mark.asyncio
async def test_lookup_disc_public(client: AsyncClient, auth_headers):
    # Register a disc first
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer", "manufacturer": "Innova", "color": "Blue"},
    )
    disc_code = reg.json()["disc_code"]

    # Public lookup (no auth)
    res = await client.get(f"/api/v1/discs/{disc_code}/lookup")
    assert res.status_code == 200
    data = res.json()
    assert data["disc_code"] == disc_code
    assert data["mold"] == "Destroyer"
    assert data["status"] == "active"
    # Public response should include limited fields
    assert "owner_display_name" in data


@pytest.mark.asyncio
async def test_lookup_disc_invalid_code_404(client: AsyncClient):
    res = await client.get("/api/v1/discs/RGDG-9999/lookup")
    assert res.status_code == 404


# ── Report Found ──


@pytest.mark.asyncio
async def test_report_found_public(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    # Report found without auth
    res = await client.post(
        f"/api/v1/discs/{disc_code}/found",
        json={
            "finder_name": "Good Samaritan",
            "finder_contact": "555-1234",
            "found_location": "Hole 7 right side",
            "message": "Found your disc in the bushes!",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["finder_name"] == "Good Samaritan"
    assert data["resolved"] is False


@pytest.mark.asyncio
async def test_report_found_invalid_code_404(client: AsyncClient):
    res = await client.post(
        "/api/v1/discs/RGDG-0000/found",
        json={"finder_name": "Someone"},
    )
    assert res.status_code == 404


# ── Report Lost ──


@pytest.mark.asyncio
async def test_report_lost_owner(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    res = await client.post(
        f"/api/v1/discs/{disc_code}/lost",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "lost"


@pytest.mark.asyncio
async def test_report_lost_non_owner_forbidden(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    # Register a different user
    res2 = await client.post("/api/v1/auth/register", json={
        "email": "other2@rgdgc.com",
        "username": "other2",
        "password": "pass123",
    })
    other_headers = {"Authorization": f"Bearer {res2.json()['access_token']}"}

    res = await client.post(
        f"/api/v1/discs/{disc_code}/lost",
        headers=other_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_report_lost_unauthenticated(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    res = await client.post(f"/api/v1/discs/{disc_code}/lost")
    assert res.status_code == 403


# ── Confirm Returned ──


@pytest.mark.asyncio
async def test_confirm_returned_owner(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    # Mark as lost first
    await client.post(f"/api/v1/discs/{disc_code}/lost", headers=auth_headers)

    # Confirm returned
    res = await client.post(
        f"/api/v1/discs/{disc_code}/returned",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "active"


@pytest.mark.asyncio
async def test_confirm_returned_non_owner_forbidden(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    res2 = await client.post("/api/v1/auth/register", json={
        "email": "other3@rgdgc.com",
        "username": "other3",
        "password": "pass123",
    })
    other_headers = {"Authorization": f"Bearer {res2.json()['access_token']}"}

    res = await client.post(
        f"/api/v1/discs/{disc_code}/returned",
        headers=other_headers,
    )
    assert res.status_code == 403


# ── QR Code ──


@pytest.mark.asyncio
async def test_qr_code_generation(client: AsyncClient, auth_headers):
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Destroyer"},
    )
    disc_code = reg.json()["disc_code"]

    res = await client.get(
        f"/api/v1/discs/{disc_code}/qr",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["disc_code"] == disc_code
    assert "<svg" in data["qr_svg"].lower() or "svg" in data["qr_svg"].lower()
    assert disc_code in data["qr_url"]


@pytest.mark.asyncio
async def test_qr_code_invalid_disc_404(client: AsyncClient, auth_headers):
    res = await client.get(
        "/api/v1/discs/RGDG-9999/qr",
        headers=auth_headers,
    )
    assert res.status_code == 404


# ── Full Lost/Found/Returned Workflow ──


@pytest.mark.asyncio
async def test_full_lost_found_returned_workflow(client: AsyncClient, auth_headers):
    # 1. Register a disc
    reg = await client.post(
        "/api/v1/discs/register",
        headers=auth_headers,
        json={"mold": "Buzzz", "manufacturer": "Discraft"},
    )
    assert reg.status_code == 201
    disc_code = reg.json()["disc_code"]

    # 2. Mark as lost
    lost_res = await client.post(
        f"/api/v1/discs/{disc_code}/lost",
        headers=auth_headers,
    )
    assert lost_res.status_code == 200, f"Mark lost failed ({lost_res.status_code}): {lost_res.text}"
    lost_data = lost_res.json() if lost_res.text else {}
    assert lost_data.get("status") == "lost", f"Expected lost status, got: {lost_res.status_code} {lost_res.text}"

    # 3. Someone finds it (public, no auth)
    found_res = await client.post(
        f"/api/v1/discs/{disc_code}/found",
        json={"finder_name": "Finder Joe", "found_location": "Hole 3"},
    )
    assert found_res.status_code == 201

    # 4. Owner confirms return
    returned_res = await client.post(
        f"/api/v1/discs/{disc_code}/returned",
        headers=auth_headers,
    )
    assert returned_res.status_code == 200, f"Confirm return failed ({returned_res.status_code}): {returned_res.text}"
    returned_data = returned_res.json() if returned_res.text else {}
    assert returned_data.get("status") == "active", f"Expected active status, got: {returned_res.status_code} {returned_res.text}"
