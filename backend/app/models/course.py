from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
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

    # Geo: course boundary polygon (WGS84)
    boundary = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)

    layouts = relationship("Layout", back_populates="course", cascade="all, delete-orphan")
    features = relationship("CourseFeature", back_populates="course", cascade="all, delete-orphan")


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

    # Geo: tee pad and basket positions (WGS84 points)
    tee_position = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    basket_position = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    # Geo: ideal flight line (tee to basket, may include doglegs)
    fairway_line = mapped_column(Geometry("LINESTRING", srid=4326), nullable=True)

    # Elevation data (from USGS DEM)
    tee_elevation_ft: Mapped[float | None] = mapped_column(Float)
    basket_elevation_ft: Mapped[float | None] = mapped_column(Float)
    elevation_change_ft: Mapped[float | None] = mapped_column(Float)  # basket - tee
    # JSON array of {distance_ft, elevation_ft} samples along fairway
    elevation_profile: Mapped[str | None] = mapped_column(Text)  # JSON

    layout = relationship("Layout", back_populates="hole_list")

    __table_args__ = (
        # Unique hole number per layout
        {"info": {"unique_constraints": [("layout_id", "hole_number")]}},
    )


class CourseFeature(Base):
    """GIS features on a course: OB zones, mandos, drop zones, trees, paths, water."""

    __tablename__ = "course_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    feature_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Types: ob_zone, mando, drop_zone, tree, path, water, tee_pad, building, parking
    name: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)

    # Flexible geometry — can be Point (tree, DZ), LineString (mando gate, path), or Polygon (OB, water)
    geom = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=False)

    # Feature-specific attributes (JSON for flexibility)
    # Trees: {"height_m": 15, "canopy_radius_m": 4, "species": "Oak"}
    # OB: {"penalty": 1, "relief": "previous_lie"}
    # Mando: {"direction": "left", "penalty": 1}
    properties: Mapped[str | None] = mapped_column(Text)  # JSON

    # Which holes does this feature affect? (comma-separated hole numbers, or null for course-wide)
    affects_holes: Mapped[str | None] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    course = relationship("Course", back_populates="features")
