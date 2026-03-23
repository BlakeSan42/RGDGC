"""
Intel Report Model — Daily intelligence monitoring for RGDGC admins.

Stores structured reports about KSA, River Grove, disc golf news, and club activity.
Reports can be generated manually by admins or (future) via automated web search.
Queryable by the Clawd chatbot for contextual answers.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class IntelReport(Base):
    __tablename__ = "intel_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True
    )  # ksa, river_grove, disc_golf, club, general
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)  # 2-3 paragraph summary
    key_findings: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of bullet points
    sources: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of {url, title, snippet}
    search_queries: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of queries used
    sentiment: Mapped[str] = mapped_column(
        String(20), default="neutral"
    )  # positive, negative, neutral, mixed
    relevance_score: Mapped[float] = mapped_column(
        Float, default=0.5
    )  # 0-1 how relevant to the club
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    author = relationship("User", foreign_keys=[created_by])

    # Composite index for common query pattern
    __table_args__ = (
        Index("ix_intel_reports_category_date", "category", "report_date"),
    )
