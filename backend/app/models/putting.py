from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class PuttAttempt(Base):
    """Individual putt attempt for analytics and physics model fitting."""

    __tablename__ = "putt_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    round_id: Mapped[int | None] = mapped_column(ForeignKey("rounds.id"))
    distance_meters: Mapped[float] = mapped_column(Float, nullable=False)
    zone: Mapped[str] = mapped_column(String(10))  # c1, c1x, c2
    made: Mapped[bool] = mapped_column(Boolean, nullable=False)
    elevation_change: Mapped[float | None] = mapped_column(Float)  # meters
    wind_speed: Mapped[float | None] = mapped_column(Float)  # mph
    wind_direction: Mapped[int | None] = mapped_column(Integer)  # degrees
    chain_hit: Mapped[bool | None] = mapped_column(Boolean)
    result_type: Mapped[str | None] = mapped_column(String(20))  # center_chains, edge_chains, cage, miss_*
    putt_style: Mapped[str | None] = mapped_column(String(10))  # spin, push, spush, turbo
    disc_used: Mapped[str | None] = mapped_column(String(50))
    pressure: Mapped[str | None] = mapped_column(String(20))  # casual, league, tournament
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="putt_attempts")
