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
    STREAM_READ_TIMEOUT: int = 60
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:8000",
        "https://app.xtq619.xyz",
        "https://api.xtq619.xyz",
    ]

    # 每日摘要
    DIGEST_ENABLED: bool = False
    DIGEST_CRON: str = "0 8 * * *"  # 每天 8:00

    # 邮箱推送（QQ 邮箱 / 163 等 SMTP）
    SMTP_HOST: str = "smtp.qq.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""  # QQ 邮箱填授权码，不是登录密码
    SMTP_SENDER: str = ""    # 发件人，一般和 SMTP_USER 一致
    SMTP_RECIPIENTS: list[str] = []  # 收件人列表

    class Config:
        env_file = ".env"


settings = Settings()
