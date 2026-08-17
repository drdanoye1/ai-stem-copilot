"""
Academic Outcomes, Mastery & Competency Measurement Framework(TM) router.

Part II of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0). See
claude project docs MASTER-REFERENCE-learning-goals-academic-outcomes-
mastery-career-readiness-framework-2026-08-16.md and
part-2-outcomes-mastery-engine-2026-08-16.md for the full spec and v1
scope decisions this implements.

POST /outcomes/practice/structured -- generates and persists 3 gradable
"Practice Check" problems, the platform's first real answer-checking
flow. correct_answer/solution_steps are withheld from this response.

POST /outcomes/practice/{problem_id}/submit -- grades a submitted answer
(app/services/grading.py), persists the attempt, logs an EvidenceEvent
(app/services/evidence_engine.py), and returns the updated mastery state
for that subject/topic.

GET /outcomes/mastery -- the Dynamic Learner Mastery Model(TM): per
subject/topic mastery states plus a career-competency rollup.

GET /outcomes/evidence -- the Evidence Portfolio(TM).

GET /outcomes/dashboard -- Part III (Academic Outcomes / Mastery
Dashboard). Aggregates mastery + career-competency rollup + a weekly
evidence trend into one payload for the /outcomes page.

POST /outcomes/insights -- Part III's AI Insights & Next Steps(TM)
narrative (app/services/insight_engine.py), cached per learner and
regenerated only when their mastery data actually changes.

/mastery, /evidence, /dashboard, and /insights all accept an optional
learner_email, honored only for admin/teacher/parent roles (mirrors
app/routers/math.py::parent_summary()'s exact role check) -- silently
falls back to the caller's own data otherwise. See
part-3-outcomes-dashboard-2026-08-16.md for the full build record.
"""
import logging
from typing import List, Optional
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.routers.math import dispatch, _parse_json_response, curriculum_context, career_context, _level_str
from app.models.user import User
from app.models.evidence import EvidenceSource, PracticeProblem, PracticeAttempt
from app.services.evidence_engine import (
    log_evidence_event,
    compute_mastery,
    compute_career_competency_summary,
    get_evidence_portfolio,
    compute_evidence_trends,
)
from app.services.grading import grade_answer
from app.services.insight_engine import get_or_generate_insight

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


async def _resolve_target_user(db: AsyncSession, current_user: User, learner_email: Optional[str]) -> User:
    """Part III role-based views -- mirrors app/routers/math.py::
    parent_summary()'s role check exactly (same silent-fallback-to-self
    semantics) so a teacher/parent/admin can view a specific learner's
    Academic Outcomes dashboard the same way they already can view a
    learner's activity summary."""
    if learner_email and current_user.role.value in ("admin", "teacher", "parent"):
        result = await db.execute(select(User).where(User.email == learner_email))
        found = result.scalar_one_or_none()
        if found:
            return found
    return current_user


# ── Practice Check: structured problem generation ─────────────────────────────

class StructuredPracticeRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    subject: str = "algebra"
    topic: Optional[str] = None
    level: str = "high_school"
    difficulty: str = "medium"
    curriculum: str = "general"
    curriculum_track: Optional[str] = None
    ai_mode: str = "smart"


class StructuredPracticeProblemOut(BaseModel):
    id: str
    problem_text: str
    difficulty: str
    subject: str
    topic: Optional[str] = None


STRUCTURED_PRACTICE_PROMPT = """Generate exactly 3 gradable math practice problems for a "Check My Work" feature.

Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}
Level: {level}
{curriculum}
{personalization}

Each problem must have ONE unambiguous final answer a learner can type in (a number, a simplified expression, or a short equation) -- not an open-ended or multi-part question.

Return ONLY a JSON object, no markdown, no text outside the JSON:
{{
  "problems": [
    {{"problem_text": "...", "correct_answer": "...", "solution_steps": "..."}},
    {{"problem_text": "...", "correct_answer": "...", "solution_steps": "..."}},
    {{"problem_text": "...", "correct_answer": "...", "solution_steps": "..."}}
  ]
}}
"""


def _fallback_structured_problems(subject: str, topic: Optional[str], difficulty: str) -> list:
    label = (topic or subject).replace("_", " ")
    return [
        {
            "problem_text": (
                f"Practice problem {i + 1} on {label} ({difficulty}) -- the AI generator is "
                "temporarily unavailable. Please try generating a new Check My Work set shortly."
            ),
            "correct_answer": "N/A",
            "solution_steps": "Regenerate this set once the AI service is available again.",
        }
        for i in range(3)
    ]


@router.post("/practice/structured", response_model=List[StructuredPracticeProblemOut], status_code=201)
async def generate_structured_practice(
    req: StructuredPracticeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    curriculum_ctx = curriculum_context(req.curriculum, req.curriculum_track)
    personalization = career_context(current_user, req.level, req.curriculum, req.curriculum_track)
    prompt = STRUCTURED_PRACTICE_PROMPT.format(
        subject=req.subject.replace("_", " ").title(),
        topic=req.topic or "any topic in this subject",
        difficulty=req.difficulty.title(),
        level=_level_str(req.level, None),
        curriculum=curriculum_ctx,
        personalization=personalization,
    )

    try:
        raw, _, _ = await dispatch(
            "You are the JSON-generating engine behind the AI Mathematics Copilot's Practice "
            "Check flow. Return only a single valid JSON object. No markdown, no explanation.",
            prompt,
            req.ai_mode,
            1500,
        )
        data = _parse_json_response(raw)
        problems_data = data.get("problems") if isinstance(data, dict) else None
        if not problems_data:
            raise ValueError("Structured practice response missing 'problems'")
    except Exception as e:
        logger.error(f"[outcomes.generate_structured_practice] {type(e).__name__}: {e}", exc_info=True)
        problems_data = _fallback_structured_problems(req.subject, req.topic, req.difficulty)

    out = []
    for p in problems_data[:3]:
        problem = PracticeProblem(
            user_id=current_user.id,
            subject=req.subject,
            topic=req.topic,
            difficulty=req.difficulty,
            problem_text=str(p.get("problem_text") or "").strip(),
            correct_answer=str(p.get("correct_answer") or "").strip(),
            solution_steps=str(p.get("solution_steps") or "").strip(),
        )
        db.add(problem)
        await db.flush()
        out.append(StructuredPracticeProblemOut(
            id=str(problem.id),
            problem_text=problem.problem_text,
            difficulty=problem.difficulty,
            subject=problem.subject,
            topic=problem.topic,
        ))
    await db.commit()
    return out


# ── Practice Check: submit + grade ─────────────────────────────────────────────

class SubmitAnswerRequest(BaseModel):
    submitted_answer: str
    revealed_solution_first: bool = False


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    grading_method: str
    solution_steps: str
    correct_answer: str
    mastery_state: str


@router.post("/practice/{problem_id}/submit", response_model=SubmitAnswerResponse)
async def submit_practice_answer(
    problem_id: str,
    req: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeProblem).where(
            PracticeProblem.id == PyUUID(problem_id),
            PracticeProblem.user_id == current_user.id,
        )
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(404, "Practice problem not found.")

    is_correct, grading_method = await grade_answer(
        problem.problem_text, req.submitted_answer, problem.correct_answer,
    )

    attempt = PracticeAttempt(
        problem_id=problem.id,
        user_id=current_user.id,
        submitted_answer=req.submitted_answer,
        is_correct=is_correct,
        revealed_solution_first=req.revealed_solution_first,
        grading_method=grading_method,
    )
    db.add(attempt)
    await db.commit()

    await log_evidence_event(
        db, current_user, EvidenceSource.practice,
        subject=problem.subject,
        topic=problem.topic,
        is_correct=is_correct,
        revealed_solution_first=req.revealed_solution_first,
        difficulty=problem.difficulty,
        detail={"problem_id": str(problem.id)},
    )

    mastery = await compute_mastery(db, current_user)
    topic_key = problem.topic or "general"
    matching = next(
        (m for m in mastery if m["subject"] == problem.subject and m["topic"] == topic_key),
        None,
    )
    mastery_state = matching["mastery_state"] if matching else "Not Yet Demonstrated"

    return SubmitAnswerResponse(
        is_correct=is_correct,
        grading_method=grading_method,
        solution_steps=problem.solution_steps,
        correct_answer=problem.correct_answer,
        mastery_state=mastery_state,
    )


# ── Dynamic Learner Mastery Model(TM) ──────────────────────────────────────────

class MasteryTopicOut(BaseModel):
    subject: str
    topic: str
    mastery_state: str
    evidence_count: int
    independent_correct_count: int
    last_evidence_at: Optional[str] = None


class CareerCompetencySummaryOut(BaseModel):
    career_competency_key: str
    mastery_state: str
    evidence_count: int
    independent_correct_count: int
    last_evidence_at: Optional[str] = None


class MasteryOut(BaseModel):
    topics: List[MasteryTopicOut]
    career_competencies: List[CareerCompetencySummaryOut]


@router.get("/mastery", response_model=MasteryOut)
async def get_mastery(
    learner_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _resolve_target_user(db, current_user, learner_email)
    topics = await compute_mastery(db, target)
    competencies = await compute_career_competency_summary(db, target)
    return MasteryOut(
        topics=[MasteryTopicOut(**t) for t in topics],
        career_competencies=[CareerCompetencySummaryOut(**c) for c in competencies],
    )


# ── Evidence Portfolio(TM) ──────────────────────────────────────────────────────

class EvidenceEventOut(BaseModel):
    id: str
    source: str
    subject: str
    topic: Optional[str] = None
    bloom_level: str
    independence_level: str
    confidence: str
    is_correct: Optional[bool] = None
    created_at: Optional[str] = None


@router.get("/evidence", response_model=List[EvidenceEventOut])
async def get_evidence(
    subject: str,
    topic: Optional[str] = None,
    learner_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _resolve_target_user(db, current_user, learner_email)
    events = await get_evidence_portfolio(db, target, subject, topic)
    return [EvidenceEventOut(**e) for e in events]


# ── Academic Outcomes / Mastery Dashboard(TM) -- Part III ──────────────────────

class TrendWeekOut(BaseModel):
    week_start: str
    evidence_count: int
    independent_correct_count: int


class DashboardOut(BaseModel):
    learner_name: str
    learner_email: str
    topics: List[MasteryTopicOut]
    career_competencies: List[CareerCompetencySummaryOut]
    trends: List[TrendWeekOut]


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    learner_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _resolve_target_user(db, current_user, learner_email)
    topics = await compute_mastery(db, target)
    competencies = await compute_career_competency_summary(db, target)
    trends = await compute_evidence_trends(db, target)
    return DashboardOut(
        learner_name=target.full_name or target.email,
        learner_email=target.email,
        topics=[MasteryTopicOut(**t) for t in topics],
        career_competencies=[CareerCompetencySummaryOut(**c) for c in competencies],
        trends=[TrendWeekOut(**w) for w in trends],
    )


# ── AI Insights & Next Steps(TM) -- Part III ────────────────────────────────────

class InsightRequest(BaseModel):
    learner_email: Optional[str] = None
    force: bool = False
    ai_mode: str = "smart"


class InsightOut(BaseModel):
    strengths: str
    opportunities: str
    next_steps: str
    generated_at: Optional[str] = None
    model_name: str
    from_cache: bool


@router.post("/insights", response_model=InsightOut)
async def get_insights(
    req: InsightRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _resolve_target_user(db, current_user, req.learner_email)
    topics = await compute_mastery(db, target)
    competencies = await compute_career_competency_summary(db, target)
    data, from_cache = await get_or_generate_insight(
        db, target, topics, competencies, force=req.force, ai_mode=req.ai_mode,
    )
    return InsightOut(**data, from_cache=from_cache)
