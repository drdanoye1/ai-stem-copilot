import ssl as _ssl
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Strip SSL query params — let asyncpg handle SSL via connect_args only
_db_url = settings.DATABASE_URL
for _param in ("?sslmode=require", "?sslmode=prefer", "?ssl=require", "?ssl=true",
               "&sslmode=require", "&ssl=require"):
    _db_url = _db_url.replace(_param, "")

# Normalise scheme for asyncpg
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# already postgresql+asyncpg:// — leave as-is

# SSL connect_args — Railway needs a permissive SSL ctx; Neon/Supabase need certs
_connect_args: dict = {}

if "railway.internal" in _db_url or "rlwy.net" in _db_url:
    # Railway (public proxy or private network) — plain connection, no SSL
    # asyncpg with ssl=None (default) does not send SSLRequest; Railway Postgres
    # does not support PostgreSQL-level SSL negotiation. Matches Promptivia's
    # working configuration exactly.
    _connect_args = {}

elif "neon.tech" in _db_url:
    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    _connect_args = {"ssl": _ssl_ctx}
elif "supabase.co" in _db_url or "pooler.supabase.com" in _db_url:
    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    _connect_args = {"ssl": _ssl_ctx}
    if "pooler.supabase.com" in _db_url:
        _connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
