from datetime import datetime

from pydantic import BaseModel


# --- Audit Log ---

class AuditLogResponse(BaseModel):
    id: int
    admin_id: int
    action: str
    target_type: str
    target_id: str
    details: dict | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Announcements ---

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    priority: str = "normal"
    expires_at: datetime | None = None


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    priority: str | None = None
    is_active: bool | None = None
    expires_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    id: int
    author_id: int
    title: str
    body: str
    is_active: bool
    priority: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}


# --- Analytics ---

class PlayerAnalytics(BaseModel):
    total_players: int
    active_this_week: int
    new_this_month: int
    retention_rate: float  # percentage of players active in last 30 days vs total


class RoundAnalytics(BaseModel):
    total_rounds: int
    rounds_per_day: float
    avg_score: float | None
    completion_rate: float  # percentage of rounds that were completed
