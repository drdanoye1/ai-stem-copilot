"""
Academic Outcomes, Mastery & Competency Measurement Framework(TM) --
database models.

Part II of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0) -- see
claude project doc MASTER-REFERENCE-learning-goals-academic-outcomes-
mastery-career-readiness-framework-2026-08-16.md for the full spec this
implements, and part-2-outcomes-mastery-engine-2026-08-16.md for the
build record and v1 scope decisions (deterministic Bloom/independence/
confidence mapping, threshold-based mastery states, no assessments-as-
a-tool or transfer-problem evidence yet).

An EvidenceEvent is one unit of evidence that a learner engaged with (and,
where gradable, correctly or incorrectly attempted) a subject/topic. Every
tool that generates learner-facing content -- Solve, Explore, Theory,
Mentor, AR/VR -- logs a low-confidence passive "exposure" event; the new
Practice Check flow (PracticeProblem + PracticeAttempt) is the platform's
first real answer-checking loop and is the only source of independent,
gradable evidence in this pass. EvidenceEvent deliberately does NOT derive
from MathSession -- Mentor and AR/VR don't create MathSession rows at all,
so evidence needed its own independent table (optionally traceable back to
a MathSession via math_session_id when one exists).

Mastery state (Not Yet Demonstrated -> Emerging -> Developing -> Proficient
-> Mastered) is intentionally NOT a stored column here -- it's computed on
read from EvidenceEvent rows by evidence_engine.compute_mastery(), so it
can never drift out of sync with the evidence backing it.
"""
import uuid
import enum

from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class EvidenceSource(str, enum.Enum):
    solve    = "solve"
    explore  = "explore"
    practice = "practice"   # Practice Check attempts (graded)
    theory   = "theory"
    mentor   = "mentor"
    ar_vr    = "ar_vr"


class BloomLevel(str, enum.Enum):
    remember   = "remember"
    understand = "understand"
    apply      = "apply"
    analyze    = "analyze"
    evaluate   = "evaluate"
    create     = "create"


class IndependenceLevel(str, enum.Enum):
    guided                 = "guided"                  # passive exposure to AI-generated content
    ai_assisted            = "ai_assisted"              # revealed solution before/while attempting
    partially_independent  = "partially_independent"    # attempted without help, got it wrong
    independent            = "independent"              # attempted without help, got it right


class EvidenceConfidence(str, enum.Enum):
    very_low  = "very_low"
    low       = "low"
    moderate  = "moderate"
    high      = "high"
    very_high = "very_high"


class EvidenceEvent(Base):
    __tablename__ = "evidence_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(Enum(EvidenceSource, name="evidence_source"), nullable=False)
    subject = Column(String(60), nullable=False, index=True)
    topic = Column(String(200), nullable=True)
    bloom_level = Column(Enum(BloomLevel, name="bloom_level"), nullable=False)
    independence_level = Column(Enum(IndependenceLevel, name="independence_level"), nullable=False)
    confidence = Column(Enum(EvidenceConfidence, name="evidence_confidence"), nullable=False)
    is_correct = Column(Boolean, nullable=True)  # null for non-gradable (exposure) events
    learning_goal_id = Column(UUID(as_uuid=True), ForeignKey("learning_goals.id", ondelete="SET NULL"), nullable=True, index=True)
    math_session_id = Column(UUID(as_uuid=True), ForeignKey("math_sessions.id", ondelete="SET NULL"), nullable=True)
    detail = Column(JSONB, nullable=True)  # small free-form context, e.g. topic label, problem excerpt
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class PracticeProblem(Base):
    __tablename__ = "practice_problems"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(60), nullable=False)
    topic = Column(String(200), nullable=True)
    difficulty = Column(String(20), nullable=False, default="medium")
    problem_text = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    solution_steps = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id = Column(UUID(as_uuid=True), ForeignKey("practice_problems.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    submitted_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    revealed_solution_first = Column(Boolean, nullable=False, default=False)
    grading_method = Column(String(20), nullable=False, default="exact_match")  # "exact_match" | "ai_graded"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
