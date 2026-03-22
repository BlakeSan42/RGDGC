from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "RGDGC API"
    environment: str = "development"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc"

    # Redis
    redis_url: str = "redis://localhost:6381"

    # Auth
    secret_key: str = "dev-secret-key-change-in-production"
    jwt_secret: str = "dev-jwt-secret-change-in-production"
    jwt_expiry: int = 3600  # 1 hour
    jwt_refresh_expiry: int = 604800  # 7 days
    jwt_algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:8081,http://localhost:5173"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_ios_client_id: str = ""  # For mobile app

    # Apple Sign-In
    apple_client_id: str = ""  # Bundle ID, e.g. com.rgdgc.app
    apple_team_id: str = ""
    apple_key_id: str = ""

    # Blockchain (P1)
    web3_provider_url: str = ""
    rgdg_token_address: str = ""
    treasury_address: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
