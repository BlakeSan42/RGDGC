from fastapi import APIRouter

from app.api.v1 import auth, users, courses, rounds, leagues, events, putting, admin, stickers, geo, discs, chat, weather, blockchain, web3auth, owner, ksa

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(web3auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(rounds.router, prefix="/rounds", tags=["rounds"])
api_router.include_router(leagues.router, prefix="/leagues", tags=["leagues"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(putting.router, prefix="/putting", tags=["putting"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(stickers.router, prefix="/stickers", tags=["stickers"])
api_router.include_router(geo.router, prefix="/geo", tags=["geo"])
api_router.include_router(discs.router, prefix="/discs", tags=["discs"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(blockchain.router, prefix="/blockchain", tags=["blockchain"])
api_router.include_router(ksa.router, tags=["ksa"])

# Owner-only endpoints — hidden from Swagger docs (include_in_schema=False)
api_router.include_router(owner.router, prefix="/owner", include_in_schema=False)
