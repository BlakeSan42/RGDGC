"""LLM usage tracking — cost per request, per user, per model."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class LLMUsage(Base):
    """Tracks every LLM API call for cost analysis."""

    __tablename__ = "llm_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(50))  # anthropic, openai, google, groq, ollama
    model: Mapped[str] = mapped_column(String(100))  # gpt-4o-mini, claude-haiku-4.5, etc.
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)  # calculated cost
    latency_ms: Mapped[int | None] = mapped_column(Integer)  # response time
    success: Mapped[bool] = mapped_column(default=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    endpoint: Mapped[str] = mapped_column(String(50), default="chat")  # chat, mcp, bot
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
