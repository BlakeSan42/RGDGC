"""
Clawd Chat Endpoint — AI-powered assistant for RGDGC.

- Admin-only access (for now)
- Multi-provider: OpenAI, Anthropic, Google, Groq, Ollama — via LiteLLM
- Security: blocks probing questions about architecture/codebase/secrets
- Cost tracking: every call logged to llm_usage table
- Falls back to keyword matching if no LLM provider configured
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
    model: str | None = None  # which LLM model was used
    cost_usd: float | None = None  # cost of this request


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to Clawd (admin-only).

    Routes to the best available LLM provider (OpenAI, Anthropic, Google, Groq, or local Ollama).
    Cost is tracked per-request in the llm_usage table.
    Security guardrails block questions about system architecture and secrets.
    """
    result = await handle_chat(
        message=data.message,
        user_id=user.id,
        username=user.display_name or user.username,
        role=user.role,
        db_session=db,
    )

    return ChatResponse(**result)
