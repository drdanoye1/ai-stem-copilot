"""
Run migrations/008_add_evidence_outcomes.sql against Neon directly.
Run from: AI-STEM-COPILOT/backend/
  python run_migration_008.py
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
            CREATE TABLE IF NOT EXISTS evidence_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                source VARCHAR(20) NOT NULL,
                subject VARCHAR(60) NOT NULL,
                topic VARCHAR(200),
                bloom_level VARCHAR(20) NOT NULL,
                independence_level VARCHAR(30) NOT NULL,
                confidence VARCHAR(20) NOT NULL,
                is_correct BOOLEAN,
                learning_goal_id UUID REFERENCES learning_goals(id) ON DELETE SET NULL,
                math_session_id UUID REFERENCES math_sessions(id) ON DELETE SET NULL,
                detail JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_evidence_events_user_id ON evidence_events(user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_evidence_events_subject ON evidence_events(subject)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_evidence_events_learning_goal_id ON evidence_events(learning_goal_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_evidence_events_created_at ON evidence_events(created_at)")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_problems (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subject VARCHAR(60) NOT NULL,
                topic VARCHAR(200),
                difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
                problem_text TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                solution_steps TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_practice_problems_user_id ON practice_problems(user_id)")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                problem_id UUID NOT NULL REFERENCES practice_problems(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                submitted_answer TEXT NOT NULL,
                is_correct BOOLEAN NOT NULL,
                revealed_solution_first BOOLEAN NOT NULL DEFAULT false,
                grading_method VARCHAR(20) NOT NULL DEFAULT 'exact_match',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_practice_attempts_problem_id ON practice_attempts(problem_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_practice_attempts_user_id ON practice_attempts(user_id)")

        print("OK — evidence_events, practice_problems, practice_attempts tables created (if not already present).")
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name IN ('evidence_events', 'practice_problems', 'practice_attempts')"
        )
        print("tables:", tables)
    finally:
        await conn.close()


asyncio.run(main())
