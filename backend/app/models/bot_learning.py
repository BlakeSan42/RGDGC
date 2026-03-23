"""Bot learning models — persistent knowledge and skills for Clawd."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class BotLearning(Base):
    """A learned fact, correction, or preference that Clawd remembers."""

    __tablename__ = "bot_learnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(30))  # "correction", "preference", "fact", "skill_feedback"
    trigger_pattern: Mapped[str | None] = mapped_column(String(200))  # what question triggered this
    learned_response: Mapped[str] = mapped_column(Text)  # what the bot should know/do
    source: Mapped[str] = mapped_column(String(20))  # "admin_feedback", "user_feedback", "auto_detected"
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)


class BotSkill(Base):
    """A configurable skill that extends Clawd's capabilities."""

    __tablename__ = "bot_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str] = mapped_column(String(200))
    trigger_keywords: Mapped[str] = mapped_column(Text)  # JSON array of trigger words
    system_prompt_addition: Mapped[str] = mapped_column(Text)  # injected into system prompt when skill activates
    tool_definition: Mapped[str | None] = mapped_column(Text)  # JSON tool schema (if it's a callable tool)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=50)  # higher = checked first
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
