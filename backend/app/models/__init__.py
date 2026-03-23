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
from app.models.payment import EventPayment  # noqa: E402, F401
from app.models.ledger import LedgerEntry, SeasonSummary, Budget  # noqa: E402, F401
from app.models.token_ledger import TokenLedger, RewardConfig  # noqa: E402, F401
from app.models.intel_report import IntelReport  # noqa: E402, F401

# KSA models — import only if the file exists (added by another terminal)
try:
    from app.models.ksa import KSAArticle, KSATimeline, TowAlert, TowAlertResponse, TowIncident, ParkingKnowledge  # noqa: E402, F401
except ImportError:
    pass
