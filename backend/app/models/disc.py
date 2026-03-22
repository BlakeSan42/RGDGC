"""SQLAlchemy models for disc registration and NFT tracking."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class RegisteredDisc(Base):
    """A physical disc registered to a player with a unique QR code."""

    __tablename__ = "registered_discs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disc_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(100))
    mold: Mapped[str] = mapped_column(String(100), nullable=False)
    plastic: Mapped[str | None] = mapped_column(String(100))
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String(50))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, lost, found, retired
    notes: Mapped[str | None] = mapped_column(Text)
    registered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", backref="registered_discs")
    found_reports = relationship("DiscFoundReport", back_populates="disc", order_by="DiscFoundReport.found_at.desc()")
    messages = relationship("DiscMessage", back_populates="disc", order_by="DiscMessage.created_at.desc()")


class DiscFoundReport(Base):
    """Report filed when someone finds a lost disc via QR scan."""

    __tablename__ = "disc_found_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disc_id: Mapped[int] = mapped_column(ForeignKey("registered_discs.id"), nullable=False)
    finder_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    finder_name: Mapped[str] = mapped_column(String(100), nullable=False)
    finder_contact: Mapped[str | None] = mapped_column(String(200))
    found_location: Mapped[str | None] = mapped_column(String(300))
    found_lat: Mapped[float | None] = mapped_column(Float)
    found_lng: Mapped[float | None] = mapped_column(Float)
    message: Mapped[str | None] = mapped_column(Text)
    found_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    disc = relationship("RegisteredDisc", back_populates="found_reports")
    finder = relationship("User", backref="disc_found_reports")


class DiscMessage(Base):
    """Message thread between disc finder and owner."""

    __tablename__ = "disc_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disc_id: Mapped[int] = mapped_column(ForeignKey("registered_discs.id"), nullable=False)
    sender_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    disc = relationship("RegisteredDisc", back_populates="messages")
    sender = relationship("User", backref="disc_messages")
