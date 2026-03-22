from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    layout_id: Mapped[int] = mapped_column(ForeignKey("layouts.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    total_score: Mapped[int | None] = mapped_column(Integer)  # relative to par
    total_strokes: Mapped[int | None] = mapped_column(Integer)
    weather: Mapped[str | None] = mapped_column(String(50))
    wind: Mapped[str | None] = mapped_column(String(50))
    temperature: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    is_practice: Mapped[bool] = mapped_column(Boolean, default=False)

    user = relationship("User", back_populates="rounds")
    layout = relationship("Layout")
    scores = relationship("HoleScore", back_populates="round", cascade="all, delete-orphan")


class HoleScore(Base):
    __tablename__ = "hole_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id", ondelete="CASCADE"))
    hole_id: Mapped[int] = mapped_column(ForeignKey("holes.id"))
    strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    putts: Mapped[int | None] = mapped_column(Integer)
    fairway_hit: Mapped[bool | None] = mapped_column(Boolean)
    green_in_regulation: Mapped[bool | None] = mapped_column(Boolean)
    ob_strokes: Mapped[int] = mapped_column(Integer, default=0)
    penalty_strokes: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    round = relationship("Round", back_populates="scores")
    hole = relationship("Hole")
