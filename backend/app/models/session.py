import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class SessionType(str, enum.Enum):
    solve    = "solve"     # AI Math Solver
    explore  = "explore"   # Topic Explorer
    practice = "practice"  # Practice Generator
    theory   = "theory"    # Theory Intelligence™ — derivations, proofs, theorems


class MathSubject(str, enum.Enum):
    arithmetic    = "arithmetic"
    algebra       = "algebra"
    geometry      = "geometry"
    trigonometry  = "trigonometry"
    precalculus   = "precalculus"
    calculus      = "calculus"
    statistics    = "statistics"
    linear_algebra = "linear_algebra"
    differential_equations = "differential_equations"
    discrete_math = "discrete_math"
    number_theory = "number_theory"
    other         = "other"


class MathSession(Base):
    __tablename__ = "math_sessions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_type   = Column(Enum(SessionType, name="session_type"), nullable=False)
    subject        = Column(Enum(MathSubject, name="math_subject"), default=MathSubject.other)
    level          = Column(String, nullable=False, default="high_school")
    model_name     = Column(String, nullable=False)
    input_text     = Column(Text, nullable=False)   # problem or topic
    output_text    = Column(Text)                   # AI solution
    prompt_tokens  = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    duration_ms    = Column(Integer)
    is_saved       = Column(String, default="false")
    saved_title    = Column(String)
    extra          = Column(JSONB, default=dict)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


class UserTopicProgress(Base):
    __tablename__ = "user_topic_progress"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject         = Column(String, nullable=False)
    topic           = Column(String, nullable=False)
    problems_solved = Column(Integer, default=0)
    mastery_score   = Column(Integer, default=0)    # 0–100
    last_practiced  = Column(DateTime(timezone=True), server_default=func.no