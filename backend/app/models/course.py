from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(50))
    country: Mapped[str] = mapped_column(String(50), default="USA")
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    description: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    layouts = relationship("Layout", back_populates="course", cascade="all, delete-orphan")


class Layout(Base):
    __tablename__ = "layouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # "White", "Red", "Blue"
    holes: Mapped[int] = mapped_column(Integer, default=18)
    total_par: Mapped[int] = mapped_column(Integer, nullable=False)
    total_distance: Mapped[int | None] = mapped_column(Integer)  # feet
    difficulty: Mapped[str | None] = mapped_column(String(20))  # beginner, intermediate, advanced
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    course = relationship("Course", back_populates="layouts")
    hole_list = relationship("Hole", back_populates="layout", cascade="all, delete-orphan")


class Hole(Base):
    __tablename__ = "holes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    layout_id: Mapped[int] = mapped_column(ForeignKey("layouts.id", ondelete="CASCADE"))
    hole_number: Mapped[int] = mapped_column(Integer, nullable=False)
    par: Mapped[int] = mapped_column(Integer, nullable=False)
    distance: Mapped[int | None] = mapped_column(Integer)  # feet
    description: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(500))

    layout = relationship("Layout", back_populates="hole_list")

    __table_args__ = (
        # Unique hole number per layout
        {"info": {"unique_constraints": [("layout_id", "hole_number")]}},
    )
