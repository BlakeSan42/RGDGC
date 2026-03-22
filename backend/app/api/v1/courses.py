from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.course import Course, Layout
from app.schemas.course import CourseDetailOut, CourseOut, LayoutDetailOut
from app.services.cache_service import CacheService

router = APIRouter()


@router.get("", response_model=list[CourseOut])
async def list_courses(db: AsyncSession = Depends(get_db)):
    # Check cache first (1-hour TTL — course data rarely changes)
    cached = await CacheService.get("courses")
    if cached is not None:
        return [CourseOut(**c) for c in cached]

    result = await db.execute(select(Course).where(Course.is_active.is_(True)))
    courses = [CourseOut.model_validate(c) for c in result.scalars().all()]

    await CacheService.set("courses", [c.model_dump() for c in courses], ttl=3600)
    return courses


@router.get("/{course_id}", response_model=CourseDetailOut)
async def get_course(course_id: int, db: AsyncSession = Depends(get_db)):
    # Check cache first (1-hour TTL)
    cache_key = f"course:{course_id}"
    cached = await CacheService.get(cache_key)
    if cached is not None:
        return CourseDetailOut(**cached)

    result = await db.execute(
        select(Course).where(Course.id == course_id).options(selectinload(Course.layouts))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_out = CourseDetailOut.model_validate(course)
    await CacheService.set(cache_key, course_out.model_dump(), ttl=3600)
    return course_out


@router.get("/layouts/{layout_id}", response_model=LayoutDetailOut)
async def get_layout_by_id(layout_id: int, db: AsyncSession = Depends(get_db)):
    """Get a layout by ID (without needing course_id)."""
    result = await db.execute(
        select(Layout)
        .where(Layout.id == layout_id)
        .options(selectinload(Layout.hole_list))
    )
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return LayoutDetailOut.model_validate(layout)


@router.get("/{course_id}/layouts/{layout_id}", response_model=LayoutDetailOut)
async def get_layout(course_id: int, layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Layout)
        .where(Layout.id == layout_id, Layout.course_id == course_id)
        .options(selectinload(Layout.hole_list))
    )
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return LayoutDetailOut.model_validate(layout)
