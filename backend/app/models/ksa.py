"""
KSA Knowledge Base & Tow Alert System — Database Models

Two concerns:
1. KSA Knowledge Base: Structured articles about KSA history, governance, finances,
   and rights — so admins and players can learn the full context.
2. Tow Alert System: Real-time crowdsourced alerts when tow trucks are spotted
   at KSA parks, with push notifications to nearby players.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey,
    Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from app.models import Base
import enum


# ═══════════════════════════════════════════════════════════════════════════
# KSA KNOWLEDGE BASE
# ═══════════════════════════════════════════════════════════════════════════

class KSACategory(str, enum.Enum):
    history = "history"              # KSA founding, timeline, key events
    governance = "governance"        # Board structure, bylaws, voting, conflicts
    finances = "finances"            # 990 data, budgets, surplus retention
    parks = "parks"                  # Park details, amenities, rules
    parking = "parking"              # K-stickers, towing, enforcement
    legal = "legal"                  # Lawsuits, Texas law, rights
    reform = "reform"               # RGPC proposal, conservancy model
    rights = "rights"               # Homeowner rights, complaint process, records requests


class KSAArticle(Base):
    """Knowledge base article about KSA — the learning paradigm."""
    __tablename__ = "ksa_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    slug = Column(String(200), nullable=False, unique=True, index=True)
    summary = Column(String(500), nullable=False)  # One-line for list view
    body = Column(Text, nullable=False)             # Full markdown content
    category = Column(SAEnum(KSACategory), nullable=False, index=True)
    tags = Column(JSON, default=list)               # ["mccormick", "article-viii", "surplus"]
    source_urls = Column(JSON, default=list)        # Citation links
    key_facts = Column(JSON, default=list)          # Structured quick-reference facts

    # Metadata
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_published = Column(Boolean, default=True)
    is_pinned = Column(Boolean, default=False)      # Pinned articles show first
    read_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", backref="ksa_articles")


class KSATimeline(Base):
    """Chronological events in KSA history — for interactive timeline view."""
    __tablename__ = "ksa_timeline"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(SAEnum(KSACategory), nullable=False)
    significance = Column(String(20), default="normal")  # normal, important, critical
    source_url = Column(String(500), nullable=True)
    related_article_id = Column(Integer, ForeignKey("ksa_articles.id"), nullable=True)

    related_article = relationship("KSAArticle")


# ═══════════════════════════════════════════════════════════════════════════
# TOW ALERT SYSTEM
# ═══════════════════════════════════════════════════════════════════════════

class TowAlertStatus(str, enum.Enum):
    active = "active"        # Tow truck spotted — alert is live
    responding = "responding" # Someone is heading to help
    resolved = "resolved"    # Car saved or tow completed
    expired = "expired"      # Alert timed out (2 hours)
    false_alarm = "false_alarm"


class TowAlertType(str, enum.Enum):
    tow_truck_spotted = "tow_truck_spotted"  # Tow truck seen in lot
    car_being_towed = "car_being_towed"      # Active tow in progress
    enforcement_patrol = "enforcement_patrol" # Enforcement checking stickers
    boot_applied = "boot_applied"            # Boot on vehicle


class TowAlert(Base):
    """A crowdsourced tow alert — player spots tow truck, alerts community."""
    __tablename__ = "tow_alerts"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type = Column(SAEnum(TowAlertType), nullable=False)
    status = Column(SAEnum(TowAlertStatus), default=TowAlertStatus.active)

    # Location
    park_name = Column(String(100), nullable=False)  # "River Grove Park"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_description = Column(String(300), nullable=True)  # "Main parking lot near boat ramp"

    # Details
    description = Column(Text, nullable=True)         # "White flatbed tow truck checking stickers"
    vehicle_description = Column(String(200), nullable=True)  # Tow truck description
    license_plate_targeted = Column(String(20), nullable=True)  # If they saw which car

    # Metrics
    players_notified = Column(Integer, default=0)
    responses_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)      # Auto-expire after 2 hours

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], backref="tow_alerts_reported")
    responses = relationship("TowAlertResponse", back_populates="alert")


class TowAlertResponse(Base):
    """A response to a tow alert — someone is helping or providing info."""
    __tablename__ = "tow_alert_responses"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("tow_alerts.id"), nullable=False)
    responder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)            # "I'm heading there now"
    response_type = Column(String(50), default="info")  # info, heading_there, resolved, false_alarm

    created_at = Column(DateTime, default=datetime.utcnow)

    alert = relationship("TowAlert", back_populates="responses")
    responder = relationship("User", backref="tow_alert_responses")


class TowIncident(Base):
    """Historical record of towing incidents — builds evidence over time."""
    __tablename__ = "tow_incidents"

    id = Column(Integer, primary_key=True, index=True)
    reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # What happened
    park_name = Column(String(100), nullable=False)
    incident_date = Column(DateTime, nullable=False)
    vehicle_description = Column(String(200), nullable=True)
    had_valid_sticker = Column(Boolean, nullable=True)
    tow_company = Column(String(100), nullable=True)  # "EMC Towing"
    tow_fee_charged = Column(Float, nullable=True)
    storage_fee_charged = Column(Float, nullable=True)

    # Outcome
    contested = Column(Boolean, default=False)
    hearing_requested = Column(Boolean, default=False)
    hearing_outcome = Column(String(50), nullable=True)  # won, lost, pending
    refund_received = Column(Boolean, default=False)

    # Context
    was_disc_golfer = Column(Boolean, default=False)
    was_kingwood_resident = Column(Boolean, nullable=True)
    notes = Column(Text, nullable=True)
    photo_urls = Column(JSON, default=list)

    # Legal reference
    signage_compliant = Column(Boolean, nullable=True)  # Were signs up per TDLR?
    tdlr_fee_exceeded = Column(Boolean, nullable=True)  # Did fees exceed TDLR max?

    created_at = Column(DateTime, default=datetime.utcnow)

    reported_by = relationship("User", backref="tow_incidents_reported")


class ParkingKnowledge(Base):
    """Quick-reference parking info per park — what players need to know."""
    __tablename__ = "parking_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    park_name = Column(String(100), nullable=False, unique=True)
    requires_k_sticker = Column(Boolean, default=True)
    sticker_cost = Column(String(100), nullable=True)  # "Free for Kingwood residents"
    sticker_office = Column(String(200), nullable=True)
    sticker_hours = Column(String(100), nullable=True)  # "Mon-Fri 9am-5pm"
    tow_company = Column(String(100), nullable=True)
    tow_company_phone = Column(String(20), nullable=True)
    max_tow_fee = Column(Float, nullable=True)  # TDLR max
    max_daily_storage = Column(Float, nullable=True)
    drop_fee = Column(Float, nullable=True)

    # Alternative parking
    alt_parking_description = Column(Text, nullable=True)
    alt_parking_latitude = Column(Float, nullable=True)
    alt_parking_longitude = Column(Float, nullable=True)

    # Your rights
    rights_summary = Column(Text, nullable=True)  # Quick summary of TX tow law
    tdlr_complaint_url = Column(String(300), nullable=True)
    justice_court_info = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
