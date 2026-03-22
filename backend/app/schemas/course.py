from pydantic import BaseModel


class HoleOut(BaseModel):
    id: int
    hole_number: int
    par: int
    distance: int | None
    description: str | None

    model_config = {"from_attributes": True}


class LayoutOut(BaseModel):
    id: int
    course_id: int
    name: str
    holes: int
    total_par: int
    total_distance: int | None
    difficulty: str | None
    is_default: bool

    model_config = {"from_attributes": True}


class LayoutDetailOut(LayoutOut):
    hole_list: list[HoleOut]


class CourseOut(BaseModel):
    id: int
    name: str
    location: str | None
    city: str | None
    state: str | None
    latitude: float | None
    longitude: float | None
    description: str | None
    photo_url: str | None

    model_config = {"from_attributes": True}


class CourseDetailOut(CourseOut):
    layouts: list[LayoutOut]
