from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Base.metadata knows about them
from app.models.user import User  # noqa: E402, F401
from app.models.course import Course, Layout, Hole  # noqa: E402, F401
from app.models.round import Round, HoleScore  # noqa: E402, F401
from app.models.league import League, Event, Team, TeamMember, Result, Prize  # noqa: E402, F401
from app.models.putting import PuttAttempt  # noqa: E402, F401
