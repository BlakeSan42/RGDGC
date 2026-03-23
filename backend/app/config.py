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

    # Auth — MUST be overridden in production via env vars
    secret_key: str = "dev-secret-key-change-in-production"
    jwt_secret: str = "dev-jwt-secret-change-in-production"
    jwt_expiry: int = 3600  # 1 hour
    jwt_refresh_expiry: int = 604800  # 7 days
    jwt_algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8081,http://localhost:19006"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_ios_client_id: str = ""  # For mobile app

    # Apple Sign-In
    apple_client_id: str = ""  # Bundle ID, e.g. com.rgdgc.app
    apple_team_id: str = ""
    apple_key_id: str = ""

    # LLM Providers (Clawd AI chat — configure one or more)
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    ollama_base_url: str = ""  # e.g. http://localhost:11434
    llm_model: str = ""  # override auto-detection: gpt-4o-mini, claude-haiku-4-5-20251001, etc.

    # Storage
    storage_backend: str = "local"  # local or s3
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint: str = ""  # For R2: https://xxx.r2.cloudflarestorage.com
    s3_access_key: str = ""
    s3_secret_key: str = ""
    upload_max_size: int = 5 * 1024 * 1024  # 5MB

    # Owner override key — only Blake knows this. Required for:
    # promoting to super_admin, impersonating users, system reset.
    # Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
    owner_key: str = ""

    # Stripe Payments
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Blockchain (P1)
    web3_provider_url: str = ""  # e.g. https://sepolia.infura.io/v3/YOUR_KEY
    rgdg_token_address: str = ""  # Deployed RGDGToken contract address
    treasury_address: str = ""  # Deployed RGDGTreasury contract address
    disc_registry_address: str = ""  # Deployed DiscRegistry contract address
    deployer_private_key: str = ""  # Private key for signing mint/distribute txs
    web3_chain_id: int = 11155111  # Sepolia testnet by default

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def async_database_url(self) -> str:
        """Ensure DATABASE_URL uses asyncpg. Converts sslmode for asyncpg compatibility."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg doesn't understand sslmode — convert to ssl param
        url = url.replace("sslmode=require", "ssl=require")
        # Remove channel_binding (not supported by asyncpg)
        url = url.replace("&channel_binding=require", "").replace("?channel_binding=require", "?")
        return url

    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic/Celery (strip asyncpg if present)."""
        return self.database_url.replace("+asyncpg", "")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = self.cors_origins.strip()
        if origins == "*":
            return ["*"]
        return [o.strip() for o in origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
