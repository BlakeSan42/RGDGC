from datetime import datetime

from pydantic import BaseModel, Field


class RoundCreate(BaseModel):
    layout_id: int
    is_practice: bool = False
    event_id: int | None = None


class ScoreSubmit(BaseModel):
    hole_number: int = Field(..., ge=1, le=30)
    strokes: int = Field(..., ge=1, le=20)
    putts: int | None = Field(None, ge=0, le=15)
    ob_strokes: int = Field(0, ge=0, le=10)
    fairway_hit: bool | None = None
    is_dnf: bool = False
    disc_used: str | None = Field(None, max_length=100)
    circle_hit: str | None = Field(None, pattern=r"^(c1|c2|parked|none)$")
    scramble: bool | None = None
    drive_distance: int | None = Field(None, ge=0, le=1500)  # feet


class HoleScoreOut(BaseModel):
    id: int
    hole_id: int
    strokes: int
    putts: int | None
    ob_strokes: int
    fairway_hit: bool | None
    is_dnf: bool = False
    disc_used: str | None = None
    circle_hit: str | None = None
    scramble: bool | None = None
    drive_distance: int | None = None

    model_config = {"from_attributes": True}


class RoundOut(BaseModel):
    id: int
    user_id: int
    layout_id: int
    group_id: int | None = None
    share_code: str | None = None
    event_id: int | None = None
    started_at: datetime
    completed_at: datetime | None
    total_score: int | None
    total_strokes: int | None
    is_practice: bool
    weather: str | None

    model_config = {"from_attributes": True}


class ScoringBreakdown(BaseModel):
    eagles: int = 0
    birdies: int = 0
    pars: int = 0
    bogeys: int = 0
    doubles: int = 0
    others: int = 0


class RoundDetailOut(RoundOut):
    scores: list[HoleScoreOut]


class RoundCompleteOut(RoundDetailOut):
    scoring_breakdown: ScoringBreakdown | None = None
    is_personal_best: bool = False


class ShareLinkOut(BaseModel):
    share_url: str
    share_code: str


class GroupCreateRequest(BaseModel):
    layout_id: int
    player_ids: list[int] = Field(..., min_length=1, max_length=20)
    event_id: int | None = None


class GroupRoundOut(BaseModel):
    """A single player's round within a group scorecard."""
    round_id: int
    user_id: int
    username: str
    display_name: str | None
    total_score: int | None
    total_strokes: int | None
    completed_at: datetime | None
    scores: list[HoleScoreOut]

    model_config = {"from_attributes": True}


class GroupScorecardOut(BaseModel):
    group_id: int
    layout_id: int
    event_id: int | None
    created_at: datetime
    players: list[GroupRoundOut]
