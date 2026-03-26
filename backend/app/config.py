from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://dewey:dewey_dev@localhost:5432/dewey"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    TMDB_API_KEY: str | None = None
    TMDB_READ_ACCESS_TOKEN: str | None = None
    GOOGLE_BOOKS_API_KEY: str | None = None
    IGDB_CLIENT_ID: str | None = None
    IGDB_CLIENT_SECRET: str | None = None
    HARDCOVER_API_TOKEN: str | None = None

    COVERS_DIR: str = "/data/covers"

    model_config = {"env_prefix": "", "env_file": ("../.env", ".env"), "extra": "ignore"}


settings = Settings()
