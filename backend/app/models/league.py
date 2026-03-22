from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class League(Base):
    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    season: Mapped[str | None] = mapped_column(String(20))  # "2026", "Spring 2026"
    league_type: Mapped[str] = mapped_column(String(20))  # singles, doubles, teams
    points_rule: Mapped[str] = mapped_column(String(50), default="field_size")
    drop_worst: Mapped[int] = mapped_column(Integer, default=0)
    max_events: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    events = relationship("Event", back_populates="league", cascade="all, delete-orphan")
    prizes = relationship("Prize", back_populates="league", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id", ondelete="CASCADE"))
    layout_id: Mapped[int | None] = mapped_column(ForeignKey("layouts.id"))
    name: Mapped[str | None] = mapped_column(String(100))
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="upcoming")  # upcoming, active, completed, cancelled
    num_players: Mapped[int | None] = mapped_column(Integer)
    entry_fee: Mapped[float | None] = mapped_column(Numeric(10, 2))
    entry_fee_rgdg: Mapped[int | None] = mapped_column(Integer)  # P1: token fee
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    league = relationship("League", back_populates="events")
    layout = relationship("Layout")
    results = relationship("Result", back_populates="event", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="event", cascade="all, delete-orphan")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    name: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    event = relationship("Event", back_populates="teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    team = relationship("Team", back_populates="members")
    user = relationship("User")

    __table_args__ = (UniqueConstraint("team_id", "user_id"),)


class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"))
    round_id: Mapped[int | None] = mapped_column(ForeignKey("rounds.id"))
    total_strokes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)  # relative to par
    position: Mapped[int | None] = mapped_column(Integer)
    points_earned: Mapped[int | None] = mapped_column(Integer)
    handicap_used: Mapped[float | None] = mapped_column(Numeric(4, 1))
    handicap_score: Mapped[int | None] = mapped_column(Integer)
    dnf: Mapped[bool] = mapped_column(Boolean, default=False)
    dq: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    event = relationship("Event", back_populates="results")
    user = relationship("User", back_populates="results")


class Prize(Base):
    __tablename__ = "prizes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_usd: Mapped[float | None] = mapped_column(Numeric(10, 2))
    amount_rgdg: Mapped[int | None] = mapped_column(Integer)

    league = relationship("League", back_populates="prizes")

    __table_args__ = (UniqueConstraint("league_id", "position"),)
