"""Integration tests for course endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_courses(client: AsyncClient, auth_headers, seeded_course):
    res = await client.get("/api/v1/courses", headers=auth_headers)
    assert res.status_code == 200
    courses = res.json()
    assert len(courses) >= 1
    course_names = [c["name"] for c in courses]
    assert "Test Course" in course_names


@pytest.mark.asyncio
async def test_get_course_detail(client: AsyncClient, auth_headers, seeded_course):
    res = await client.get(
        f"/api/v1/courses/{seeded_course['course_id']}",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Test Course"
    assert len(data["layouts"]) >= 1
    assert data["layouts"][0]["name"] == "Main"


@pytest.mark.asyncio
async def test_get_layout_with_holes(client: AsyncClient, auth_headers, seeded_course):
    res = await client.get(
        f"/api/v1/courses/{seeded_course['course_id']}/layouts/{seeded_course['layout_id']}",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["hole_list"]) == 9
    assert all(h["par"] == 3 for h in data["hole_list"])


@pytest.mark.asyncio
async def test_course_not_found(client: AsyncClient, auth_headers):
    res = await client.get("/api/v1/courses/9999", headers=auth_headers)
    assert res.status_code == 404
