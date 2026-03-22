from datetime import datetime

from pydantic import BaseModel


class RoundCreate(BaseModel):
    layout_id: int
    is_practice: bool = False


class ScoreSubmit(BaseModel):
    hole_number: int
    strokes: int
    putts: int | None = None
    ob_strokes: int = 0
    fairway_hit: bool | None = None


class HoleScoreOut(BaseModel):
    id: int
    hole_id: int
    strokes: int
    putts: int | None
    ob_strokes: int
    fairway_hit: bool | None

    model_config = {"from_attributes": True}


class RoundOut(BaseModel):
    id: int
    user_id: int
    layout_id: int
    started_at: datetime
    completed_at: datetime | None
    total_score: int | None
    total_strokes: int | None
    is_practice: bool
    weather: str | None

    model_config = {"from_attributes": True}


class RoundDetailOut(RoundOut):
    scores: list[HoleScoreOut]
