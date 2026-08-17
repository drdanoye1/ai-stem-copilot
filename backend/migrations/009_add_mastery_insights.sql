-- Migration 009: Academic Outcomes / Mastery Dashboard(TM) -- Part III
-- Adds the mastery_insight_snapshots table that caches the AI-generated
-- "Insights & Next Steps" narrative shown on the /outcomes dashboard.
-- See claude project doc part-3-outcomes-dashboard-2026-08-16.md for the
-- build record and v1 scope decisions.

CREATE TABLE IF NOT EXISTS mastery_insight_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_fingerprint VARCHAR(64) NOT NULL,
    strengths TEXT NOT NULL,
    opportunities TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    model_name VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_mastery_insight_snapshots_user_id ON mastery_insight_snapshots(user_id);
CREATE INDEX IF NOT EXISTS ix_mastery_insight_snapshots_created_at ON mastery_insight_snapshots(created_at);

-- Verification (run manually after migration):
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'mastery_insight_snapshots';
