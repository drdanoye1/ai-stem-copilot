-- Migration: add Part I Personalized Learning Goals, Objectives & Outcomes
-- Plan(TM) tables -- learning_plans (one active plan per user) and
-- learning_goals (the Curriculum Goal / Learning Objective / Expected
-- Outcome / Application Outcome / Cognitive Target / Success Criterion
-- rows under a plan). Brand-new tables, no backfill needed.
--
-- Run this against your PostgreSQL database.

CREATE TABLE IF NOT EXISTS learning_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learning_aim TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_learning_plans_user_id ON learning_plans(user_id);

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
);
CREATE INDEX IF NOT EXISTS ix_learning_goals_plan_id ON learning_goals(plan_id);

-- Verify:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('learning_plans', 'learning_goals');
