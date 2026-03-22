from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Base.metadata knows about them
from app.models.user import User  # noqa: E402, F401
from app.models.course import Course, Layout, Hole, CourseFeature  # noqa: E402, F401
from app.models.round import Round, HoleScore, RoundGroup  # noqa: E402, F401
from app.models.league import League, Event, Team, TeamMember, Result, Prize  # noqa: E402, F401
from app.models.putting import PuttAttempt  # noqa: E402, F401
from app.models.disc import RegisteredDisc, DiscFoundReport, DiscMessage  # noqa: E402, F401
from app.models.sticker import StickerOrder, StickerInventory  # noqa: E402, F401
from app.models.league_member import LeagueMember  # noqa: E402, F401
from app.models.admin import AuditLog, Announcement  # noqa: E402, F401
from app.models.transaction import Transaction  # noqa: E402, F401
