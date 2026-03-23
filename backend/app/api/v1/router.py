from fastapi import APIRouter

from app.api.v1 import auth, users, courses, rounds, leagues, events, putting, admin, stickers, geo, discs, chat, weather, blockchain, web3auth, owner, payments, treasury, tokens, intel, marketplace

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
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(treasury.router, prefix="/treasury", tags=["treasury"])
api_router.include_router(tokens.router, prefix="/tokens", tags=["tokens"])
api_router.include_router(intel.router, prefix="/intel", tags=["intel"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])

# LLM usage analytics
from app.api.v1 import llm_analytics
api_router.include_router(llm_analytics.router, prefix="/admin", tags=["llm-analytics"])

# League operations — card assignments, CTP, recurring events, ace fund
try:
    from app.api.v1 import league_ops
    api_router.include_router(league_ops.router, tags=["league-ops"])
except (ImportError, AttributeError):
    pass

# Analytics router — club leader dashboard
try:
    from app.api.v1 import analytics
    api_router.include_router(analytics.router, prefix="/admin", tags=["analytics"])
except (ImportError, AttributeError):
    pass

# KSA router — import only if module exists (added by another terminal)
try:
    from app.api.v1 import ksa
    api_router.include_router(ksa.router, tags=["ksa"])
except (ImportError, AttributeError):
    pass

# Owner-only endpoints — hidden from Swagger docs (include_in_schema=False)
api_router.include_router(owner.router, prefix="/owner", include_in_schema=False)
