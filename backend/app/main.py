"""
AI Mathematics Copilot™ — FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.config import settings
from app.database import create_tables, engine
from app.routers import auth, math

app = FastAPI(
    title="AI Mathematics Copilot™ API",
    description="AI-powered mathematics tutoring platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(math.router, prefix=PREFIX)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    try:
        await create_tables()
        print("✓ Database tables ready")
    except Exception as e:
        print(f"⚠ DB startup warning (app continues): {e}")


@app.get("/")
async def root():
    return {"service": "AI Mathematics Copilot™ API", "version": "0.1.0", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/db-test")
async def db_test():
    """Diagnose DB connection — remove before production."""
    import os
    from app.config import settings
    raw_env = os.environ.get("DATABASE_URL", "NOT_IN_OS_ENVIRON")
    url = settings.DATABASE_URL
    host_part = url.split("@")[-1] if "@" in url else url
    scheme = url.split("://")[0] if "://" in url else "unknown"
    raw_host = raw_env.split("@")[-1][:40] if "@" in raw_env else raw_env[:40]
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "connected", "scheme": scheme, "host": host_part, "raw_env_host": raw_host}
    except Exception as e:
        return {"status": "error", "scheme": scheme, "host": host_part, "raw_env_host": raw_host, "error": str(e)[:300]}
