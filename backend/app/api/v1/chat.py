"""
Clawd Chat Endpoint — AI-powered assistant for RGDGC.

- Players: disc golf Q&A, standings, events, rules, putting tips
- Admins: + member analytics, round stats, system status
- Security: blocks probing questions about architecture/codebase/secrets
- Falls back to keyword matching if no ANTHROPIC_API_KEY is set
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user
from app.db.database import get_db
from app.models.user import User
from app.services.chat_service import handle_chat

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    suggestions: list[str]
    blocked: bool = False


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to Clawd (admin-only for now).

    Admins get tools for member analytics, standings, and system management.
    Security guardrails block questions about system architecture and secrets.
    Uses Claude API if ANTHROPIC_API_KEY is set, keyword matching otherwise.
    """
    result = await handle_chat(
        message=data.message,
        user_id=user.id,
        username=user.display_name or user.username,
        role=user.role,
        db_session=db,
    )

    return ChatResponse(**result)
