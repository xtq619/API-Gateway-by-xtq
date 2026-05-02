from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://gateway:gateway_secret@localhost:5432/api_gateway"
    DATABASE_URL_SYNC: str = "postgresql://gateway:gateway_secret@localhost:5432/api_gateway"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    API_KEY_PREFIX: str = "sk-"
    ENCRYPTION_KEY: str = "change-me-to-a-random-fernet-key-32b"
    DEBUG: bool = True
    DEFAULT_RATE_LIMIT_RPM: int = 60
    MARKUP_RATIO: float = 1.5
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    class Config:
        env_file = ".env"


settings = Settings()
