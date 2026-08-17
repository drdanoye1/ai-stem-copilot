"""
Run migrations/009_add_mastery_insights.sql against Neon directly.
Run from: AI-STEM-COPILOT/backend/
  python run_migration_009.py
"""
import asyncio
import ssl
import asyncpg

DATABASE_URL = "postgresql://neondb_owner:npg_jbdAGCg5DIa7@ep-steep-resonance-at467do3.c-9.us-east-1.aws.neon.tech/neondb"


async def main():
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    conn = await asyncpg.connect(DATABASE_URL, ssl=ssl_ctx)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mastery_insight_snapshots (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                input_fingerprint VARCHAR(64) NOT NULL,
                strengths TEXT NOT NULL,
                opportunities TEXT NOT NULL,
                next_steps TEXT NOT NULL,
                model_name VARCHAR(40) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_mastery_insight_snapshots_user_id ON mastery_insight_snapshots(user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_mastery_insight_snapshots_created_at ON mastery_insight_snapshots(created_at)")

        print("OK — mastery_insight_snapshots table created (if not already present).")
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'mastery_insight_snapshots'"
        )
        print("tables:", tables)
    finally:
        await conn.close()


asyncio.run(main())
