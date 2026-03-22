"""Integration tests for round/scoring endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_start_round(client: AsyncClient, auth_headers, seeded_course):
    res = await client.post("/api/v1/rounds", headers=auth_headers, json={
        "layout_id": seeded_course["layout_id"],
        "is_practice": False,
    })
    assert res.status_code == 201
    data = res.json()
    assert data["layout_id"] == seeded_course["layout_id"]
    assert data["completed_at"] is None


@pytest.mark.asyncio
async def test_submit_scores_and_complete(client: AsyncClient, auth_headers, seeded_course):
    # Start round
    start_res = await client.post("/api/v1/rounds", headers=auth_headers, json={
        "layout_id": seeded_course["layout_id"],
    })
    round_id = start_res.json()["id"]

    # Submit 9 hole scores
    for hole_num in range(1, 10):
        res = await client.post(
            f"/api/v1/rounds/{round_id}/scores",
            headers=auth_headers,
            json={"hole_number": hole_num, "strokes": 3, "putts": 1},
        )
        assert res.status_code == 201

    # Complete round
    complete_res = await client.put(
        f"/api/v1/rounds/{round_id}/complete", headers=auth_headers,
    )
    assert complete_res.status_code == 200
    data = complete_res.json()
    assert data["total_strokes"] == 27  # 9 holes * 3 strokes
    assert data["total_score"] == 0  # par = 27
    assert data["completed_at"] is not None


@pytest.mark.asyncio
async def test_list_rounds(client: AsyncClient, auth_headers, seeded_course):
    # Start and complete a round
    start_res = await client.post("/api/v1/rounds", headers=auth_headers, json={
        "layout_id": seeded_course["layout_id"],
    })

    res = await client.get("/api/v1/rounds", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_get_round_detail(client: AsyncClient, auth_headers, seeded_course):
    start_res = await client.post("/api/v1/rounds", headers=auth_headers, json={
        "layout_id": seeded_course["layout_id"],
    })
    round_id = start_res.json()["id"]

    res = await client.get(f"/api/v1/rounds/{round_id}", headers=auth_headers)
    assert res.status_code == 200
    assert "scores" in res.json()
