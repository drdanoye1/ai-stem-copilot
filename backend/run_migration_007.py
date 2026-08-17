"""
Run migrations/007_add_learning_goals.sql against Neon directly.
Run from: AI-STEM-COPILOT/backend/
  python run_migration_007.py
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
            CREATE TABLE IF NOT EXISTS learning_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                learning_aim TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                archived_at TIMESTAMPTZ
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_learning_plans_user_id ON learning_plans(user_id)")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_goals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                plan_id UUID NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
                curriculum_goal TEXT NOT NULL,
                learning_objective TEXT NOT NULL,
                expected_outcome TEXT NOT NULL,
                application_outcome TEXT NOT NULL,
                cognitive_target VARCHAR(60) NOT NULL,
                success_criterion TEXT NOT NULL,
                subject VARCHAR(60) NOT NULL,
                topic VARCHAR(200),
                career_competency_key VARCHAR(80),
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_learning_goals_plan_id ON learning_goals(plan_id)")
        print("OK — learning_plans, learning_goals tables created (if not already present).")
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name IN ('learning_plans', 'learning_goals')"
        )
        print("tables:", tables)
    finally:
        await conn.close()


asyncio.run(main())
