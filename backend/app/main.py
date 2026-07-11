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
app.include_router(math.router,