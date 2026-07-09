"""
Discovery Projects™ — list, detail, submit, AI feedback.
Projects are seeded once at startup; submissions are persisted per-user.
"""
import json
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.project import Project, ProjectSubmission, SEED_PROJECTS
from app.models.user import User
from app.routers.auth import get_current_user

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/math/projects", tags=["projects"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectOut(BaseModel):
    id: str
    title: str
    subject: str
    level: str
    description: str
    difficulty: int
    estimated_hours: float
    tags: List[str]
    steps_json: List[dict]
    rubric_json: List[dict]
    pro_only: bool

    class Config:
        from_attributes = True


class SubmitRequest(BaseModel):
    work_text: str
    model_name: str = "gpt-4o"


class FeedbackOut(BaseModel):
    submission_id: str
    score: int            # 0-100
    verdict: str          # "Excellent" | "Good" | "Needs work"
    strengths: List[str]
    improvements: List[str]
    next_steps: str
    rubric_scores: List[dict]  # [{criterion, score, comment}]

# ── AI model dispatch ─────────────────────────────────────────────────────────

ANTHROPIC_MODEL_MAP = {
    "claude-sonnet-4":   "claude-sonnet-4-6",
    "claude-haiku-4":    "claude-haiku-4-5-20251001",
    "claude-opus-4":     "claude-opus-4-8",
    "claude-3-5-sonnet": "claude-sonnet-4-6",
}


async def _ai_feedback(prompt: str, model: str) -> str:
    if model.startswith("claude"):
        try:
            import anthropic as sdk
        except ImportError:
            raise HTTPException(500, "Anthropic SDK not installed.")
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            raise HTTPException(500, "Anthropic API key not configured.")
        api_model = ANTHROPIC_MODEL_MAP.get(model, "claude-sonnet-4-6")
        client = sdk.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=90.0)
        resp = await client.messages.create(
            model=api_model, max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text if resp.content else "{}"

    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise HTTPException(500, "OpenAI SDK not installed.")
    if not getattr(settings, "OPENAI_API_KEY", ""):
        raise HTTPException(500, "OpenAI API key not configured.")
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=90.0)
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000,
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    return resp.choices[0].message.content or "{}"

# ── Startup seed ──────────────────────────────────────────────────────────────

async def seed_projects(db: AsyncSession) -> None:
    """Insert seed projects if the table is empty."""
    result = await db.execute(select(Project).limit(1))
    if result.scalar_one_or_none() is not None:
        return  # already seeded
    for p in SEED_PROJECTS:
        db.add(Project(
            id=uuid.uuid4(),
            title=p["title"],
            subject=p["subject"],
            level=p["level"],
            description=p["description"],
            difficulty=p.get("difficulty", 2),
            estimated_hours=p.get("estimated_hours", 1.0),
            tags=p.get("tags", []),
            steps_json=p.get("steps_json", []),
            rubric_json=p.get("rubric_json", []),
            starter_context=p.get("starter_context", ""),
            pro_only=p.get("pro_only", True),
        ))
    await db.commit()
    logger.info(f"[projects] ✓ Seeded {len(SEED_PROJECTS)} discovery projects")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    subject: Optional[str] = None,
    level: Optional[str] = None,
    difficulty: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active discovery projects with optional filters."""
    q = select(Project).where(Project.is_active == True)
    if subject:
        q = q.where(Project.subject == subject)
    if level:
        q = q.where(Project.level == level)
    if difficulty is not None:
        q = q.where(Project.difficulty == difficulty)
    q = q.order_by(Project.subject, Project.difficulty)
    result = await db.execute(q)
    rows = result.scalars().all()

    return [
        ProjectOut(
            id=str(p.id),
            title=p.title,
            subject=p.subject,
            level=p.level,
            description=p.description,
            difficulty=p.difficulty,
            estimated_hours=p.estimated_hours,
            tags=p.tags or [],
            steps_json=p.steps_json or [],
            rubric_json=p.rubric_json or [],
            pro_only=p.pro_only,
        )
        for p in rows
    ]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == uuid.UUID(project_id), Project.is_active == True)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Project not found.")
    return ProjectOut(
        id=str(p.id),
        title=p.title,
        subject=p.subject,
        level=p.level,
        description=p.description,
        difficulty=p.difficulty,
        estimated_hours=p.estimated_hours,
        tags=p.tags or [],
        steps_json=p.steps_json or [],
        rubric_json=p.rubric_json or [],
        pro_only=p.pro_only,
    )


@router.post("/{project_id}/submit", response_model=FeedbackOut)
async def submit_project(
    project_id: str,
    req: SubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit work for a project; receive structured AI feedback scored against the rubric."""
    # Load project
    result = await db.execute(
        select(Project).where(Project.id == uuid.UUID(project_id), Project.is_active == True)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found.")

    if not req.work_text.strip():
        raise HTTPException(400, "Submission cannot be empty.")

    # Build rubric string
    rubric_str = "\n".join(
        f'- {r["criterion"]} ({r["weight"]}%): {r["description"]}'
        for r in (project.rubric_json or [])
    )
    steps_str = "\n".join(
        f'Step {s["step"]}: {s["instruction"]}'
        for s in (project.steps_json or [])
    )

    prompt = f"""You are a mathematics tutor grading a student's project submission.

PROJECT: {project.title}
SUBJECT: {project.subject.replace("_", " ").title()}
LEVEL: {project.level.replace("_", " ").title()}
CONTEXT: {project.starter_context}

PROJECT STEPS:
{steps_str}

RUBRIC (criterion — weight — what to look for):
{rubric_str}

STUDENT SUBMISSION:
{req.work_text[:3000]}

Evaluate the submission against the rubric. Be encouraging but honest. Reward correct mathematical reasoning even if notation is imperfect.

Respond with a JSON object with exactly these keys:
- "score": integer 0-100 overall score
- "verdict": one of "Excellent", "Good", "Needs work"
- "strengths": list of 2-3 specific things done well (strings)
- "improvements": list of 2-3 specific things to improve (strings)
- "next_steps": one sentence suggesting what to study or try next
- "rubric_scores": list of objects, one per rubric criterion:
    [{{"criterion": "...", "score": 0-100, "comment": "1 sentence"}}]

Return only valid JSON."""

    try:
        raw = await _ai_feedback(prompt, req.model_name)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[projects/submit] AI error: {e}", exc_info=True)
        raise HTTPException(500, f"AI feedback failed: {str(e)[:200]}")

    # Parse JSON
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) > 1 else text
    try:
        result_dict = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned malformed feedback — please retry.")

    # Persist submission
    sub = ProjectSubmission(
        project_id=uuid.UUID(project_id),
        user_id=current_user.id,
        work_text=req.work_text,
        ai_feedback=result_dict,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return FeedbackOut(
        submission_id=str(sub.id),
        score=result_dict.get("score", 0),
        verdict=result_dict.get("verdict", "Needs work"),
        strengths=result_dict.get("strengths", []),
        improvements=result_dict.get("improvements", []),
        next_steps=result_dict.get("next_steps", ""),
        rubric_scores=result_dict.get("rubric_scores", []),
    )


@router.get("/{project_id}/submissions", response_model=List[dict])
async def my_submissions(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's past submissions for a project."""
    result = await db.execute(
        select(ProjectSubmission)
        .where(
            ProjectSubmission.project_id == uuid.UUID(project_id),
            ProjectSubmission.user_id == current_user.id,
        )
        .order_by(desc(ProjectSubmission.created_at))
        .limit(5)
    )
    subs = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "score": s.ai_feedback.get("score") if s.ai_feedback else None,
            "verdict": s.ai_feedback.get("verdict") if s.ai_feedback else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in subs
    ]
