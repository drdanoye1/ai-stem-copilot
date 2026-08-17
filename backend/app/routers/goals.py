"""
AI Mathematics Copilot(TM) — Personalized Learning Goals, Objectives &
Outcomes Plan(TM) router.

Part I of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0). See claude
project doc MASTER-REFERENCE-learning-goals-academic-outcomes-mastery-
career-readiness-framework-2026-08-16.md for the full spec this implements.

POST /goals/generate — (re)generates the learner's plan, archiving any
prior active plan. Called once automatically right after onboarding
completes, and manually from the /goals page's "Regenerate Plan" button.

GET /goals/active — returns the learner's current active plan + goals, or
null if none has been generated yet (e.g. a pre-existing account that
hasn't onboarded through this feature).
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.learning_goals import LearningPlan, LearningGoal, LearningPlanStatus
from app.services.learning_goals_engine import generate_plan

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/goals", tags=["goals"])


class LearningGoalOut(BaseModel):
    id: str
    curriculum_goal: str
    learning_objective: str
    expected_outcome: str
    application_outcome: str
    cognitive_target: str
    success_criterion: str
    subject: str
    topic: Optional[str] = None
    career_competency_key: Optional[str] = None
    sort_order: int


class LearningPlanOut(BaseModel):
    id: str
    learning_aim: str
    status: str
    created_at: str
    goals: List[LearningGoalOut]


def _goal_out(g: LearningGoal) -> LearningGoalOut:
    return LearningGoalOut(
        id=str(g.id),
        curriculum_goal=g.curriculum_goal,
        learning_objective=g.learning_objective,
        expected_outcome=g.expected_outcome,
        application_outcome=g.application_outcome,
        cognitive_target=g.cognitive_target,
        success_criterion=g.success_criterion,
        subject=g.subject,
        topic=g.topic,
        career_competency_key=g.career_competency_key,
        sort_order=g.sort_order,
    )


async def _plan_out(plan: LearningPlan, db: AsyncSession) -> LearningPlanOut:
    result = await db.execute(
        select(LearningGoal)
        .where(LearningGoal.plan_id == plan.id)
        .order_by(LearningGoal.sort_order)
    )
    goals = result.scalars().all()
    return LearningPlanOut(
        id=str(plan.id),
        learning_aim=plan.learning_aim,
        status=plan.status.value if hasattr(plan.status, "value") else str(plan.status),
        created_at=plan.created_at.isoformat() if plan.created_at else "",
        goals=[_goal_out(g) for g in goals],
    )


@router.post("/generate", response_model=LearningPlanOut, status_code=201)
async def generate(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI Learning Goals & Objectives Engine(TM) — generates a new active
    Personalized Learning Goals, Objectives & Outcomes Plan(TM), archiving
    any prior active plan for this learner."""
    plan = await generate_plan(current_user, db)
    return await _plan_out(plan, db)


@router.get("/active", response_model=Optional[LearningPlanOut])
async def get_active(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the learner's current active plan + goals, or null if none
    has been generated yet."""
    result = await db.execute(
        select(LearningPlan).where(
            LearningPlan.user_id == current_user.id,
            LearningPlan.status == LearningPlanStatus.active,
        )
    )
    plan = result.scalars().first()
    if not plan:
        return None
    return await _plan_out(plan, db)
