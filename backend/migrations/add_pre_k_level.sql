-- Migration: add Pre-K education level
-- Run this against your PostgreSQL database BEFORE deploying the updated backend.
-- PostgreSQL requires enum values to be added with ALTER TYPE.

ALTER TYPE education_level ADD VALUE IF NOT EXISTS 'pre_k' BEFORE 'middle_school';

-- Verify the new value is present:
-- SELECT enum_range(NULL::education_level);
