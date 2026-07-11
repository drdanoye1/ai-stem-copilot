"""
AI Mathematics Copilot™ — FastAPI Backend  v0.3.0
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.routers import auth, math
from app.routers import mentor as mentor_router
from app.routers import data as data_router
from app.routers import projects as projects_router
# Ensure new models are registered with Base metadata
import app.models.mentor   # noqa: F401
import app.models.project  # noqa: F401

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="AI Mathematics Copilot™ API",
    description="AI-powered mathematics tutoring platform",
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

_allowed_origins = [
    settings.FRONTEND_URL,
    "https://math-copilot.vercel.app",
    "https://math-copilot-1fv3fmyha-dr-david-noyes-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(math.router, prefix=PREFIX)
app.include_router(mentor_router.router, prefix=PREFIX)
app.include_router(data_router.router, prefix=PREFIX)
app.include_router(projects_router.router, prefix=PREFIX)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    try:
        await create_tables()
        logger.info("[startup] ✓ Database tables ready")
    except Exception as e:
        logger.warning(f"[startup] ⚠ DB warning (app continues): {e}")

    # Seed discovery projects (idempotent — skips if already seeded)
    try:
        from app.database import AsyncSessionLocal
        from app.routers.projects import seed_projects
        async with AsyncSessionLocal() as db:
            await seed_projects(db)
    except Exception as e:
        logger.warning(f"[startup] ⚠ Project seed warning: {e}")

    # ── Enum migrations (idempotent) ──────────────────────────────────────────
    # PostgreSQL enums cannot be modified by create_all — we patch them here.
    try:
        from app.database import engine
        async with engine.begin() as conn:
            # Add 'theory' to session_type enum if not already present
            await conn.execute(
                __import__("sqlalchemy").text(
                    "DO $$ BEGIN "
                    "  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'theory' "
                    "    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_type')) "
                    "  THEN ALTER TYPE session_type ADD VALUE 'theory'; "
                    "  END IF; "
                    "END $$;"
                )
            )
        logger.info("[startup] ✓ Enum migrations applied")
    except Exception as e:
        logger.warning(f"[startup] ⚠ Enum migration warning (app continues): {e}")


@app.get("/")
async def root():
    return {"service": "AI Mathematics Copilot™ API", "version": "0.3.0", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
