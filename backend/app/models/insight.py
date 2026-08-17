"""
Academic Outcomes / Mastery Dashboard(TM) -- database model.

Part III of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0) -- see
claude project doc MASTER-REFERENCE-learning-goals-academic-outcomes-
mastery-career-readiness-framework-2026-08-16.md for the full spec this
implements, and part-3-outcomes-dashboard-2026-08-16.md for the build
record and v1 scope decisions.

MasteryInsightSnapshot caches the AI-generated "Insights & Next Steps"
narrative shown on the dashboard. It is deliberately a cache, not a
fresh-every-load generation -- app/services/insight_engine.py fingerprints
the mastery data that produced a narrative (input_fingerprint) and only
calls the AI again when that fingerprint changes or the caller forces a
refresh, so a learner revisiting an unchanged dashboard never pays the
latency/token cost of a repeat AI call.

strengths/opportunities/next_steps are three separate Text columns rather
than one JSON blob so a missing/malformed section is independently
detectable, matching the rest of this schema's convention of JSONB being
reserved for genuinely free-form data (EvidenceEvent.detail) rather than
structured, always-present fields.
"""
import uuid

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class MasteryInsightSnapshot(Base):
    __tablename__ = "mastery_insight_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    input_fingerprint = Column(String(64), nullable=False)  # sha256 hex of the mastery/competency snapshot that produced this narrative
    strengths = Column(Text, nullable=False)
    opportunities = Column(Text, nullable=False)
    next_steps = Column(Text, nullable=False)
    model_name = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
