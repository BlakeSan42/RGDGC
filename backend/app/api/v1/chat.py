"""
Clawd Chat Endpoint — AI-powered assistant for RGDGC.

- Admin-only access (for now)
- Multi-provider: OpenAI, Anthropic, Google, Groq, Ollama — via LiteLLM
- Security: blocks probing questions about architecture/codebase/secrets
- Cost tracking: every call logged to llm_usage table
- Falls back to keyword matching if no LLM provider configured
- Conversation memory: persists chat history per user
- Feedback: users can rate responses and provide corrections
"""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.services.chat_service import handle_chat, handle_feedback

router = APIRouter()

# Simple rate limiter: max 10 messages per 60 seconds per user
_rate_limits: dict[int, list[float]] = defaultdict(list)
RATE_LIMIT = 10
RATE_WINDOW = 60  # seconds


def _check_rate_limit(user_id: int) -> None:
    now = time.time()
    window_start = now - RATE_WINDOW
    # Remove old entries
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if t > window_start]
    if len(_rate_limits[user_id]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages. Please wait a minute.")
    _rate_limits[user_id].append(now)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    suggestions: list[str]
    blocked: bool = False
    model: str | None = None  # which LLM model was used
    cost_usd: float | None = None  # cost of this request


class FeedbackRequest(BaseModel):
    message_text: str = Field(..., max_length=2000, description="The user message that triggered the response")
    rating: str = Field(..., pattern="^(up|down)$", description="Thumbs up or down")
    correction: str | None = Field(None, max_length=2000, description="What the bot should have said instead")


class FeedbackResponse(BaseModel):
    status: str
    learning_id: int | None = None


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to Clawd.

    Routes to the best available LLM provider (OpenAI, Anthropic, Google, Groq, or local Ollama).
    Cost is tracked per-request in the llm_usage table.
    Security guardrails block questions about system architecture and secrets.
    Conversation history is maintained per user for multi-turn context.
    """
    _check_rate_limit(user.id)

    result = await handle_chat(
        message=data.message,
        user_id=user.id,
        username=user.display_name or user.username,
        role=user.role,
        db_session=db,
    )

    return ChatResponse(**result)


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    data: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rate a bot response (thumbs up/down) with optional correction.

    When a user gives thumbs down with a correction, a BotLearning entry is created
    so the bot can improve its responses over time.
    """
    result = await handle_feedback(
        message_text=data.message_text,
        rating=data.rating,
        correction=data.correction,
        user_id=user.id,
        db_session=db,
    )

    return FeedbackResponse(**result)
