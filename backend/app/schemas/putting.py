from pydantic import BaseModel


class PuttAttemptCreate(BaseModel):
    distance_meters: float
    zone: str  # c1, c1x, c2
    made: bool
    elevation_change: float | None = None
    wind_speed: float | None = None
    wind_direction: int | None = None
    chain_hit: bool | None = None
    result_type: str | None = None  # center_chains, edge_chains, cage, miss_*
    putt_style: str | None = None  # spin, push, spush, turbo
    disc_used: str | None = None
    pressure: str | None = None  # casual, league, tournament
    round_id: int | None = None


class PuttBatchCreate(BaseModel):
    attempts: list[PuttAttemptCreate]


class PuttingStats(BaseModel):
    total_attempts: int
    total_makes: int
    make_percentage: float
    c1_percentage: float
    c1x_percentage: float
    c2_percentage: float
    by_zone: dict[str, dict] = {}  # {"c1": {"attempts": 20, "makes": 18, "percentage": 90.0}}


class PuttProbability(BaseModel):
    distance_meters: float
    distance_feet: float
    zone: str
    make_probability: float
    tour_average: float
    personal_average: float | None
    wind_adjustment: float | None
    elevation_adjustment: float | None
