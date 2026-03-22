from fastapi import APIRouter

from app.api.v1 import auth, users, courses, rounds, leagues, events, putting, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(rounds.router, prefix="/rounds", tags=["rounds"])
api_router.include_router(leagues.router, prefix="/leagues", tags=["leagues"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(putting.router, prefix="/putting", tags=["putting"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
