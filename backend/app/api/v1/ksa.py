"""
KSA Knowledge Base & Tow Alert API Endpoints

Two systems:
1. /ksa/* — Knowledge base for learning KSA history, governance, finances, rights
2. /tow-alerts/* — Real-time crowdsourced tow truck alerts with push notifications
"""

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user, get_admin_user
from app.models.ksa import (
    KSAArticle, KSACategory, KSATimeline,
    TowAlert, TowAlertResponse, TowAlertStatus, TowAlertType,
    TowIncident, ParkingKnowledge,
)
from app.services.push_service import send_push_to_all, send_push_to_user

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class ArticleOut(BaseModel):
    id: int
    title: str
    slug: str
    summary: str
    body: str
    category: str
    tags: list
    source_urls: list
    key_facts: list
    is_pinned: bool
    read_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArticleCreate(BaseModel):
    title: str = Field(max_length=200)
    slug: str = Field(max_length=200)
    summary: str = Field(max_length=500)
    body: str
    category: KSACategory
    tags: list = []
    source_urls: list = []
    key_facts: list = []
    is_pinned: bool = False


class TimelineOut(BaseModel):
    id: int
    date: datetime
    title: str
    description: str
    category: str
    significance: str
    source_url: Optional[str]

    class Config:
        from_attributes = True


class TowAlertCreate(BaseModel):
    alert_type: TowAlertType
    park_name: str
    latitude: float
    longitude: float
    location_description: Optional[str] = None
    description: Optional[str] = None
    vehicle_description: Optional[str] = None
    license_plate_targeted: Optional[str] = None


class TowAlertOut(BaseModel):
    id: int
    alert_type: str
    status: str
    park_name: str
    latitude: float
    longitude: float
    location_description: Optional[str]
    description: Optional[str]
    vehicle_description: Optional[str]
    players_notified: int
    responses_count: int
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class TowResponseCreate(BaseModel):
    message: str
    response_type: str = "info"  # info, heading_there, resolved, false_alarm


class TowIncidentCreate(BaseModel):
    park_name: str
    incident_date: datetime
    vehicle_description: Optional[str] = None
    had_valid_sticker: Optional[bool] = None
    tow_company: Optional[str] = None
    tow_fee_charged: Optional[float] = None
    storage_fee_charged: Optional[float] = None
    contested: bool = False
    hearing_requested: bool = False
    hearing_outcome: Optional[str] = None
    was_disc_golfer: bool = False
    was_kingwood_resident: Optional[bool] = None
    notes: Optional[str] = None
    signage_compliant: Optional[bool] = None
    tdlr_fee_exceeded: Optional[bool] = None


class ParkingInfoOut(BaseModel):
    park_name: str
    requires_k_sticker: bool
    sticker_cost: Optional[str]
    sticker_office: Optional[str]
    sticker_hours: Optional[str]
    tow_company: Optional[str]
    tow_company_phone: Optional[str]
    max_tow_fee: Optional[float]
    max_daily_storage: Optional[float]
    drop_fee: Optional[float]
    alt_parking_description: Optional[str]
    alt_parking_latitude: Optional[float]
    alt_parking_longitude: Optional[float]
    rights_summary: Optional[str]
    tdlr_complaint_url: Optional[str]
    justice_court_info: Optional[str]

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# KSA KNOWLEDGE BASE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/ksa/articles", response_model=List[ArticleOut])
async def list_articles(
    category: Optional[KSACategory] = None,
    search: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List KSA knowledge base articles. Filter by category or search."""
    query = select(KSAArticle).where(KSAArticle.is_published == True)

    if category:
        query = query.where(KSAArticle.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                KSAArticle.title.ilike(pattern),
                KSAArticle.summary.ilike(pattern),
                KSAArticle.body.ilike(pattern),
            )
        )

    query = query.order_by(
        desc(KSAArticle.is_pinned),
        desc(KSAArticle.updated_at)
    ).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/ksa/articles/{slug}", response_model=ArticleOut)
async def get_article(slug: str, db: AsyncSession = Depends(get_db)):
    """Get a single article by slug. Increments read count."""
    result = await db.execute(
        select(KSAArticle).where(KSAArticle.slug == slug)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.read_count += 1
    await db.commit()
    return article


@router.get("/ksa/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all categories with article counts."""
    result = await db.execute(
        select(KSAArticle.category, func.count(KSAArticle.id))
        .where(KSAArticle.is_published == True)
        .group_by(KSAArticle.category)
    )
    return [{"category": cat, "count": count} for cat, count in result.all()]


@router.get("/ksa/timeline", response_model=List[TimelineOut])
async def get_timeline(
    category: Optional[KSACategory] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get the KSA chronological timeline."""
    query = select(KSATimeline).order_by(KSATimeline.date)
    if category:
        query = query.where(KSATimeline.category == category)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/ksa/articles", response_model=ArticleOut)
async def create_article(
    article: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Create a KSA knowledge base article (admin only)."""
    db_article = KSAArticle(
        **article.model_dump(),
        author_id=admin.id,
    )
    db.add(db_article)
    await db.commit()
    await db.refresh(db_article)
    return db_article


# ═══════════════════════════════════════════════════════════════════════════
# TOW ALERT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tow-alerts", response_model=TowAlertOut)
async def create_tow_alert(
    alert: TowAlertCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Report a tow truck sighting. Sends push notification to ALL players.

    When a player spots a tow truck at a KSA park:
    1. They tap "Tow Alert" in the app
    2. Their GPS location is captured
    3. ALL players with push tokens get an instant notification
    4. Players at the park can rush to their cars if needed
    5. The drop fee is $135 max if they get there before the truck leaves

    This is the killer feature: the difference between a $272 tow
    and a $0 walk back to your car.
    """
    db_alert = TowAlert(
        reporter_id=user.id,
        alert_type=alert.alert_type,
        park_name=alert.park_name,
        latitude=alert.latitude,
        longitude=alert.longitude,
        location_description=alert.location_description,
        description=alert.description,
        vehicle_description=alert.vehicle_description,
        license_plate_targeted=alert.license_plate_targeted,
        expires_at=datetime.utcnow() + timedelta(hours=2),
    )
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)

    # Push notification to ALL players
    type_labels = {
        TowAlertType.tow_truck_spotted: "Tow truck spotted",
        TowAlertType.car_being_towed: "CAR BEING TOWED",
        TowAlertType.enforcement_patrol: "Enforcement patrol",
        TowAlertType.boot_applied: "Boot applied to vehicle",
    }
    title = f"⚠️ {type_labels.get(alert.alert_type, 'Tow Alert')}!"
    body = f"{alert.park_name}"
    if alert.location_description:
        body += f" — {alert.location_description}"
    body += "\nCheck your car NOW if you're parked there."

    count = await send_push_to_all(
        db, title=title, body=body,
        data={"type": "tow_alert", "alert_id": str(db_alert.id)},
    )
    db_alert.players_notified = count
    await db.commit()

    return db_alert


@router.get("/tow-alerts", response_model=List[TowAlertOut])
async def list_tow_alerts(
    status: Optional[TowAlertStatus] = TowAlertStatus.active,
    park: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List tow alerts. Defaults to active alerts only."""
    query = select(TowAlert).order_by(desc(TowAlert.created_at)).limit(limit)
    if status:
        query = query.where(TowAlert.status == status)
    if park:
        query = query.where(TowAlert.park_name.ilike(f"%{park}%"))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tow-alerts/{alert_id}/respond")
async def respond_to_alert(
    alert_id: int,
    response: TowResponseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Respond to a tow alert (heading there, info, resolved, false alarm)."""
    result = await db.execute(select(TowAlert).where(TowAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db_response = TowAlertResponse(
        alert_id=alert_id,
        responder_id=user.id,
        message=response.message,
        response_type=response.response_type,
    )
    db.add(db_response)
    alert.responses_count += 1

    if response.response_type == "resolved":
        alert.status = TowAlertStatus.resolved
        alert.resolved_at = datetime.utcnow()
    elif response.response_type == "false_alarm":
        alert.status = TowAlertStatus.false_alarm
        alert.resolved_at = datetime.utcnow()

    await db.commit()

    # Notify the original reporter
    await send_push_to_user(
        db, user_id=alert.reporter_id,
        title="Tow Alert Update",
        body=response.message,
        data={"type": "tow_alert_response", "alert_id": str(alert_id)},
    )

    return {"status": "ok", "alert_status": alert.status}


# ═══════════════════════════════════════════════════════════════════════════
# TOW INCIDENT TRACKING (Historical Record)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tow-incidents")
async def report_tow_incident(
    incident: TowIncidentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Report a towing incident for the historical record. Builds evidence."""
    # Check if TDLR fee was exceeded
    tdlr_exceeded = None
    if incident.tow_fee_charged and incident.tow_fee_charged > 272:
        tdlr_exceeded = True

    db_incident = TowIncident(
        reported_by_id=user.id,
        tdlr_fee_exceeded=tdlr_exceeded or incident.tdlr_fee_exceeded,
        **incident.model_dump(exclude={"tdlr_fee_exceeded"}),
    )
    db.add(db_incident)
    await db.commit()
    await db.refresh(db_incident)
    return db_incident


@router.get("/tow-incidents/stats")
async def tow_incident_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate towing statistics — how many, where, outcomes."""
    total = await db.execute(select(func.count(TowIncident.id)))
    disc_golfers = await db.execute(
        select(func.count(TowIncident.id)).where(TowIncident.was_disc_golfer == True)
    )
    contested = await db.execute(
        select(func.count(TowIncident.id)).where(TowIncident.contested == True)
    )
    hearings_won = await db.execute(
        select(func.count(TowIncident.id)).where(TowIncident.hearing_outcome == "won")
    )
    fee_exceeded = await db.execute(
        select(func.count(TowIncident.id)).where(TowIncident.tdlr_fee_exceeded == True)
    )
    avg_fee = await db.execute(
        select(func.avg(TowIncident.tow_fee_charged)).where(TowIncident.tow_fee_charged.isnot(None))
    )

    return {
        "total_incidents": total.scalar() or 0,
        "disc_golfer_incidents": disc_golfers.scalar() or 0,
        "contested": contested.scalar() or 0,
        "hearings_won": hearings_won.scalar() or 0,
        "tdlr_fee_exceeded": fee_exceeded.scalar() or 0,
        "average_tow_fee": round(avg_fee.scalar() or 0, 2),
        "tdlr_max_fee": 272.00,
        "tdlr_max_storage": 22.85,
        "tdlr_drop_fee": 135.00,
    }


# ═══════════════════════════════════════════════════════════════════════════
# PARKING KNOWLEDGE (Quick Reference)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/parking/{park_name}", response_model=ParkingInfoOut)
async def get_parking_info(park_name: str, db: AsyncSession = Depends(get_db)):
    """Get parking rules, towing info, alternative parking, and your rights for a park."""
    result = await db.execute(
        select(ParkingKnowledge).where(
            ParkingKnowledge.park_name.ilike(f"%{park_name}%")
        )
    )
    info = result.scalar_one_or_none()
    if not info:
        raise HTTPException(status_code=404, detail="Park not found")
    return info
