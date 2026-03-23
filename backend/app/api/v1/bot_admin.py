"""
Bot Admin Endpoints — manage learnings and skills for Clawd.

Admin-only. Lets admins teach the bot new facts, correct mistakes,
and configure skills.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.bot_learning import BotLearning, BotSkill
from app.models.user import User

router = APIRouter()


# ── Schemas ──

class LearningCreate(BaseModel):
    category: str = Field(..., max_length=30, description="correction, preference, fact, or skill_feedback")
    trigger_pattern: Optional[str] = Field(None, max_length=200, description="Comma-separated trigger words")
    learned_response: str = Field(..., max_length=5000, description="What the bot should know/do")
    source: str = Field(default="admin_feedback", max_length=20)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class LearningUpdate(BaseModel):
    category: Optional[str] = Field(None, max_length=30)
    trigger_pattern: Optional[str] = Field(None, max_length=200)
    learned_response: Optional[str] = Field(None, max_length=5000)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_active: Optional[bool] = None


class LearningOut(BaseModel):
    id: int
    category: str
    trigger_pattern: Optional[str]
    learned_response: str
    source: str
    confidence: float
    is_active: bool
    created_by: int
    created_at: datetime
    used_count: int
    last_used_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    name: str = Field(..., max_length=50)
    description: str = Field(..., max_length=200)
    trigger_keywords: str = Field(..., description="JSON array of trigger words, e.g. [\"weather\", \"forecast\"]")
    system_prompt_addition: str = Field(..., max_length=5000)
    tool_definition: Optional[str] = Field(None, description="JSON tool schema")
    priority: int = Field(default=50, ge=0, le=100)


class SkillOut(BaseModel):
    id: int
    name: str
    description: str
    trigger_keywords: str
    system_prompt_addition: str
    tool_definition: Optional[str]
    is_enabled: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Learning endpoints ──

@router.get("/bot/learnings", response_model=list[LearningOut])
async def list_learnings(
    active_only: bool = True,
    category: Optional[str] = None,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bot learnings, optionally filtered by active status and category."""
    query = select(BotLearning).order_by(desc(BotLearning.created_at))
    if active_only:
        query = query.where(BotLearning.is_active.is_(True))
    if category:
        query = query.where(BotLearning.category == category)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/bot/learnings", response_model=LearningOut, status_code=201)
async def create_learning(
    data: LearningCreate,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually teach the bot something new."""
    learning = BotLearning(
        category=data.category,
        trigger_pattern=data.trigger_pattern,
        learned_response=data.learned_response,
        source=data.source,
        confidence=data.confidence,
        created_by=user.id,
    )
    db.add(learning)
    await db.flush()
    await db.refresh(learning)
    return learning


@router.put("/bot/learnings/{learning_id}", response_model=LearningOut)
async def update_learning(
    learning_id: int,
    data: LearningUpdate,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing learning."""
    result = await db.execute(select(BotLearning).where(BotLearning.id == learning_id))
    learning = result.scalar_one_or_none()
    if not learning:
        raise HTTPException(status_code=404, detail="Learning not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(learning, field, value)

    await db.flush()
    await db.refresh(learning)
    return learning


@router.delete("/bot/learnings/{learning_id}")
async def deactivate_learning(
    learning_id: int,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a learning (soft delete)."""
    result = await db.execute(select(BotLearning).where(BotLearning.id == learning_id))
    learning = result.scalar_one_or_none()
    if not learning:
        raise HTTPException(status_code=404, detail="Learning not found")

    learning.is_active = False
    await db.flush()
    return {"status": "deactivated", "id": learning_id}


# ── Skill endpoints ──

@router.get("/bot/skills", response_model=list[SkillOut])
async def list_skills(
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bot skills."""
    result = await db.execute(
        select(BotSkill).order_by(desc(BotSkill.priority))
    )
    return result.scalars().all()


@router.post("/bot/skills", response_model=SkillOut, status_code=201)
async def create_skill(
    data: SkillCreate,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new bot skill."""
    # Check for duplicate name
    existing = await db.execute(select(BotSkill).where(BotSkill.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Skill '{data.name}' already exists")

    skill = BotSkill(
        name=data.name,
        description=data.description,
        trigger_keywords=data.trigger_keywords,
        system_prompt_addition=data.system_prompt_addition,
        tool_definition=data.tool_definition,
        priority=data.priority,
    )
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.put("/bot/skills/{skill_id}/toggle")
async def toggle_skill(
    skill_id: int,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a bot skill."""
    result = await db.execute(select(BotSkill).where(BotSkill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill.is_enabled = not skill.is_enabled
    skill.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"id": skill_id, "name": skill.name, "is_enabled": skill.is_enabled}
