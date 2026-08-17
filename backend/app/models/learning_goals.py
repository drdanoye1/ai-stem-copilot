"""
Learning Goals & Outcomes -- database models.

Part I of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0) -- see
claude project doc MASTER-REFERENCE-learning-goals-academic-outcomes-
mastery-career-readiness-framework-2026-08-16.md for the full spec this
implements.

A LearningPlan is the persisted "Personalized Learning Goals, Objectives &
Outcomes Plan(TM)" for one learner: one Learning Aim plus a handful of
LearningGoal rows (Curriculum Goal -> Learning Objective -> Expected
Outcome -> Application Outcome -> Cognitive Target -> Success Criterion,
matching the framework's Goal Hierarchy table exactly).

Deliberately does NOT track achievement/mastery status on a goal -- only
active/archived. Determining whether a goal has actually been achieved is
Part II's job (the Academic Outcomes, Mastery & Competency Measurement
Framework(TM), not yet built); Part I must not invent that judgment, only
define the target. Each row's UUID id is designed to be referenced later
by Part II evidence events (learning_goal_id), satisfying the framework's
"Required Data Objects" traceability requirement ahead of time.
"""
import uuid
import enum

from sqlalchemy import Column, String, Integer, Text, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LearningPlanStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class LearningPlan(Base):
    __tablename__ = "learning_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    learning_aim = Column(Text, nullable=False)
    status = Column(Enum(LearningPlanStatus, name="learning_plan_status"), nullable=False, default=LearningPlanStatus.active)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    archived_at = Column(DateTime(timezone=True), nullable=True)


class LearningGoal(Base):
    __tablename__ = "learning_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("learning_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    curriculum_goal = Column(Text, nullable=False)
    learning_objective = Column(Text, nullable=False)
    expected_outcome = Column(Text, nullable=False)
    application_outcome = Column(Text, nullable=False)
    cognitive_target = Column(String(60), nullable=False)  # e.g. "Apply -> Analyze"
    success_criterion = Column(Text, nullable=False)
    subject = Column(String(60), nullable=False)
    topic = Column(String(200), nullable=True)
    career_competency_key = Column(String(80), nullable=True)  # -> career_competency_registry.py
    sort_order = Column(Integer, nullable=False, default=0)  # renamed from "order" (SQL reserved word)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
