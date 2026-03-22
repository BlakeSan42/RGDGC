from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.course import Course, Layout
from app.schemas.course import CourseDetailOut, CourseOut, LayoutDetailOut

router = APIRouter()


@router.get("", response_model=list[CourseOut])
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.is_active.is_(True)))
    return [CourseOut.model_validate(c) for c in result.scalars().all()]


@router.get("/{course_id}", response_model=CourseDetailOut)
async def get_course(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Course).where(Course.id == course_id).options(selectinload(Course.layouts))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return CourseDetailOut.model_validate(course)


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
