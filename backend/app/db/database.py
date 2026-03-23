from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

# Lazy engine creation — avoids binding to wrong event loop during import
_engine = None
_async_session = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.async_database_url,
            echo=settings.environment == "development",
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_session_factory():
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _async_session


# Backward compat for scripts that do `from app.db.database import engine, async_session`
class _LazyEngine:
    """Proxy that defers engine creation until first attribute access."""
    def __getattr__(self, name):
        return getattr(get_engine(), name)

engine = _LazyEngine()
async_session = get_session_factory


async def get_db() -> AsyncSession:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
