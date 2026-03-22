from datetime import date, datetime

from pydantic import BaseModel


class LeagueOut(BaseModel):
    id: int
    name: str
    description: str | None
    season: str | None
    league_type: str
    points_rule: str
    drop_worst: int
    is_active: bool

    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    id: int
    league_id: int
    name: str | None
    event_date: date
    status: str
    num_players: int | None
    entry_fee: float | None
    notes: str | None

    model_config = {"from_attributes": True}


class ResultOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    total_strokes: int
    total_score: int
    position: int | None
    points_earned: int | None
    dnf: bool
    dq: bool

    model_config = {"from_attributes": True}


class ResultSubmit(BaseModel):
    user_id: int
    total_strokes: int
    dnf: bool = False
    dq: bool = False


class LeaderboardEntry(BaseModel):
    rank: int
    player_id: int
    player_name: str
    total_points: int
    events_played: int
    wins: int
    podiums: int
    average_points: float
    best_finish: int | None
