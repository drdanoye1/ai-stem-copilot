from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost/math_copilot"

    # JWT
    SECRET_KEY: str = "change-me-in-production-minimum-32-characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # AI Providers
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    DEFAULT_MODEL: str = "gpt-4o"

    # External Data APIs
    FRED_API_KEY: Optional[str] = None  # https://fred.stlouisfed.org/docs/api/api_key.html

    # App
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"

    # Admin
    # Comma-separated list of emails that are always granted the admin role.
    # Any of these addresses that registers (or re-registers) will have their
    # role forced to "admin" regardless of what the client sends.
    # Add more with: ADMIN_EMAILS=admin@aimathcopilot.com,other@example.com
    ADMIN_EMAILS: str = "admin@aimathcopilot.com"
    # Password used by the one-time /auth/setup endpoint to create the first
    # admin account.  Set this in .env — never leave the default in production.
    ADMIN_PASSWORD: str = "AIMathCopilot2026!"

    def admin_email_list(self) -> list[str]:
        """Return the admin emails as a cleaned list (lowercase, stripped)."""
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    @field_validator("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "FRED_API_KEY", mode="before")
    @classmethod
    def strip_api_keys(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace/newlines that get embedded when keys are pasted."""
        return v.strip() if isinstance(v, str) else v


settings = Settings()
