from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/nihongo_dojo"
    REDIS_URL: str = "redis://localhost:6379/0"

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
