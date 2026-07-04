"""
AI Mathematics Copilot™ — Math Execution Router
Three core features: Solve, Explore, Practice
"""
import time
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.session import MathSession, MathSubject, SessionType, UserTopicProgress
from app.config import settings

# ── Graceful AI imports ───────────────────────────────────────────────────────

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    AsyncOpenAI = None
    OPENAI_AVAILABLE = False

try:
    import anthropic as anthropic_sdk
    ANTHROPIC_AVAILABLE = True
except ImportError:
    anthropic_sdk = None
    ANTHROPIC_AVAILABLE = False

router = APIRouter(prefix="/math", tags=["math"])

# ── Model routing ─────────────────────────────────────────────────────────────

MODEL_PROVIDER_MAP = {
    "gpt-4o":            "openai",
    "gpt-4o-mini":       "openai",
    "gpt-4-turbo":       "openai",
    "claude-sonnet-4":   "anthropic",
    "claude-haiku-4":    "anthropic",
    "claude-opus-4":     "anthropic",
    "claude-3-5-sonnet": "anthropic",
}

# ── Prompt templates ──────────────────────────────────────────────────────────

SOLVE_SYSTEM = """You are an expert mathematics tutor for AI Mathematics Copilot™.
Your role is to produce clear, complete, step-by-step mathematical solutions.

CRITICAL FORMATTING RULES:
- Use LaTeX notation for ALL mathematical expressions:
  • Inline math: $expression$ (e.g. $x^2 + 3x - 4$)
  • Display math: $$expression$$ (e.g. $$\\frac{d}{dx}[x^3] = 3x^2$$)
- Use ## for section headings, ### for step headings
- Use bold (**text**) for key mathematical terms on first use
- Every step must have a clear title and plain-English explanation before the math
- Never skip steps — if a student can't fill in the gap, the solution is incomplete"""

SOLVE_PROMPT = """PROBLEM: {problem}

SUBJECT: {subject}
EDUCATION LEVEL: {level}
SOLUTION STYLE: {style}

Generate a complete solution in this exact structure:

## Problem Statement
Restate the problem clearly using LaTeX notation.

## Solution Strategy
Briefly identify the approach/rule/theorem being applied (1-3 sentences).

{steps_instruction}

## Final Answer
$$[Clearly boxed or stated final answer in LaTeX]$$

## Key Concepts Applied
- List 2–5 mathematical concepts, theorems, or rules used (with brief definition for each)

## Common Mistakes
- List 1–2 errors students commonly make with this type of problem

{difficulty_note}"""

EXPLORE_SYSTEM = """You are an expert mathematics educator for AI Mathematics Copilot™.
Your role is to explain mathematical topics clearly, comprehensively, and at the right level.

FORMATTING RULES:
- Use LaTeX for ALL mathematical expressions ($...$ inline, $$...$$ display)
- Use structured headings: ## for main sections, ### for subsections
- Include worked examples with full solutions
- Use tables (markdown) for comparisons, formulas, and reference data"""

EXPLORE_PROMPT = """TOPIC: {topic}
SUBJECT AREA: {subject}
EDUCATION LEVEL: {level}

Generate a comprehensive topic explanation with this structure:

## Overview
Brief introduction to the topic and why it matters (2-3 sentences).

## Core Concepts
Explain the fundamental ideas, definitions, and notation. Use LaTeX throughout.

## Key Formulas & Theorems
Present the essential formulas in a clear table or structured format.

## Worked Examples
Provide {example_count} fully worked examples, progressing from basic to advanced.
Each example must show every step with explanation.

## Visual Intuition
Describe the geometric or graphical interpretation where applicable.

## Common Applications
List 3-5 real-world applications of this topic.

## Practice Problems
Generate 5 practice problems (with answers hidden in a spoiler format using > Answer: ...).

## Related Topics
List 3-5 topics to explore next, with a one-sentence description of each."""

PRACTICE_SYSTEM = """You are an expert mathematics problem generator for AI Mathematics Copilot™.
Generate high-quality, well-structured practice problems with complete solutions.

FORMATTING RULES:
- Use LaTeX for ALL mathematical expressions
- Problems must be solvable with the knowledge implied by the subject and level
- Solutions must show every step"""

PRACTICE_PROMPT = """Generate {count} {difficulty} practice problems for:

SUBJECT: {subject}
TOPIC (optional): {topic}
EDUCATION LEVEL: {level}

Format each problem as:

---
### Problem {n}
[Problem statement using LaTeX]

**Hint:** [Optional hint — only include if difficulty is Hard or Expert]

<details>
<summary>Show Solution</summary>

[Complete step-by-step solution using LaTeX]

**Answer:** $[final answer]$
</details>
---

Problems should vary in style and approach. Ensure all {count} problems are distinct."""

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SolveRequest(BaseModel):
    problem: str
    subject: str = "algebra"
    level: str = "high_school"
    style: str = "detailed"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class ExploreRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    example_count: int = 3
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class PracticeRequest(BaseModel):
    subject: str = "algebra"
    topic: Optional[str] = None
    level: str = "high_school"
    count: int = 5
    difficulty: str = "medium"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class MathSessionOut(BaseModel):
    id: str
    session_type: str
    subject: str
    level: str
    model_name: str
    input_text: str
    output_text: Optional[str]
    prompt_tokens: int
    completion_tokens: int
    duration_ms: Optional[int]
    is_saved: str
    saved_title: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class ProgressOut(BaseModel):
    total_sessions: int
    sessions_this_week: int
    subjects_practiced: List[str]
    recent_sessions: List[MathSessionOut]
    topic_progress: List[Dict]


# ── AI provider calls ─────────────────────────────────────────────────────────

async def call_openai(system: str, prompt: str, model: str, max_tokens: int) -> tuple[str, int, int]:
    if not OPENAI_AVAILABLE or not getattr(settings, "OPENAI_API_KEY", ""):
        raise HTTPException(500, "OpenAI not configured. Set OPENAI_API_KEY.")
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=180.0)
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=max_tokens,
    )
    text = resp.choices[0].message.content or ""
    return text, resp.usage.prompt_tokens, resp.usage.completion_tokens


async def call_anthropic(system: str, prompt: str, model: str, max_tokens: int) -> tuple[str, int, int]:
    if not ANTHROPIC_AVAILABLE or not getattr(settings, "ANTHROPIC_API_KEY", ""):
        raise HTTPException(500, "Anthropic not configured. Set ANTHROPIC_API_KEY.")
    model_map = {
        "claude-sonnet-4":   "claude-sonnet-4-6",
        "claude-haiku-4":    "claude-haiku-4-5-20251001",
        "claude-opus-4":     "claude-opus-4-8",
        "claude-3-5-sonnet": "claude-sonnet-4-6",
    }
    api_model = model_map.get(model, model)
    client = anthropic_sdk.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180.0)
    resp = await client.messages.create(
        model=api_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text if resp.content else ""
    return text, resp.usage.input_tokens, resp.usage.output_tokens


async def dispatch(system: str, prompt: str, model: str, max_tokens: int) -> tuple[str, int, int]:
    provider = MODEL_PROVIDER_MAP.get(model, "openai")
    if provider == "anthropic":
        return await call_anthropic(system, prompt, model, max_tokens)
    return await call_openai(system, prompt, model, max_tokens)


def _session_out(s: MathSession) -> MathSessionOut:
    return MathSessionOut(
        id=str(s.id),
        session_type=s.session_type.value,
        subject=s.subject.value if s.subject else "other",
        level=s.level,
        model_name=s.model_name,
        input_text=s.input_text,
        output_text=s.output_text,
        prompt_tokens=s.prompt_tokens or 0,
        completion_tokens=s.completion_tokens or 0,
        duration_ms=s.duration_ms,
        is_saved=s.is_saved or "false",
        saved_title=s.saved_title,
        created_at=s.created_at.isoformat() if s.created_at else "",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/solve", response_model=MathSessionOut, status_code=status.HTTP_201_CREATED)
async def solve(
    req: SolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI Math Solver — step-by-step solution with LaTeX."""
    level_labels = {
        "middle_school": "Middle School (ages 11-14)",
        "high_school":   "High School (ages 14-18)",
        "ap_ib":         "AP/IB Advanced High School",
        "university":    "University undergraduate",
        "graduate":      "Graduate / postgraduate",
        "professional":  "Professional / research level",
    }
    steps_instruction = {
        "quick": "## Solution\n### Step 1: [title]\n... (3-5 steps)",
        "detailed": "## Solution\n### Step 1: [title]\n[explanation]\n$$[math]$$\n### Step 2: ...\n(continue for ALL steps — do not skip any)",
        "proof": "## Proof\n**Theorem:** [state theorem]\n**Proof:**\n[rigorous step-by-step proof]",
    }
    difficulty_notes = {
        "middle_school": "Use simple language. Avoid jargon. Relate to everyday examples.",
        "high_school": "Use standard notation. Assume basic algebra and geometry knowledge.",
        "ap_ib": "Use rigorous notation. Reference relevant theorems by name.",
        "university": "Use university-level rigor. Reference theorems formally.",
        "graduate": "Use research-level notation. Prove all claims rigorously.",
        "professional": "Assume expert knowledge. Focus on efficiency and correctness.",
    }

    max_tokens = min(max(req.max_tokens or 3500, 500), 7000)
    subject_enum = MathSubject.other
    for s in MathSubject:
        if s.value == req.subject:
            subject_enum = s
            break

    prompt = SOLVE_PROMPT.format(
        problem=req.problem,
        subject=req.subject.replace("_", " ").title(),
        level=level_labels.get(req.level, req.level),
        style=req.style.title(),
        steps_instruction=steps_instruction.get(req.style, steps_instruction["detailed"]),
        difficulty_note=f"TONE: {difficulty_notes.get(req.level, '')}",
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(SOLVE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        raise HTTPException(500, f"AI solver error: {str(e)[:200]}")

    duration = int(time.time() * 1000) - start_ms

    session = MathSession(
        user_id=current_user.id,
        session_type=SessionType.solve,
        subject=subject_enum,
        level=req.level,
        model_name=req.model_name,
        input_text=req.problem,
        output_text=output,
        prompt_tokens=prompt_tok,
        completion_tokens=completion_tok,
        duration_ms=duration,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    try:
        result = await db.execute(
            select(UserTopicProgress).where(
                UserTopicProgress.user_id == current_user.id,
                UserTopicProgress.subject == req.subject,
                UserTopicProgress.topic == "general",
            )
        )
        progress = result.scalar_one_or_none()
        if progress:
            progress.problems_solved += 1
        else:
            db.add(UserTopicProgress(
                user_id=current_user.id,
                subject=req.subject,
                topic="general",
                problems_solved=1,
            ))
        await db.commit()
    except Exception:
        pass

    return _session_out(session)


@router.post("/explore", response_model=MathSessionOut, status_code=status.HTTP_201_CREATED)
async def explore(
    req: ExploreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Topic Explorer — comprehensive AI explanation of a mathematical concept."""
    max_tokens = min(max(req.max_tokens or 4096, 500), 7000)
    subject_enum = MathSubject.other
    for s in MathSubject:
        if s.value == req.subject:
            subject_enum = s
            break

    prompt = EXPLORE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        example_count=req.example_count,
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(EXPLORE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        raise HTTPException(500, f"AI explorer error: {str(e)[:200]}")

    duration = int(time.time() * 1000) - start_ms

    session = MathSession(
        user_id=current_user.id,
        session_type=SessionType.explore,
        subject=subject_enum,
        level=req.level,
        model_name=req.model_name,
        input_text=req.topic,
        output_text=output,
        prompt_tokens=prompt_tok,
        completion_tokens=completion_tok,
        duration_ms=duration,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _session_out(session)


@router.post("/practice", response_model=MathSessionOut, status_code=status.HTTP_201_CREATED)
async def practice(
    req: PracticeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Practice Generator — AI-generated problems with worked solutions."""
    max_tokens = min(max(req.max_tokens or 4096, 500), 7000)
    subject_enum = MathSubject.other
    for s in MathSubject:
        if s.value == req.subject:
            subject_enum = s
            break

    prompt = PRACTICE_PROMPT.format(
        count=req.count,
        difficulty=req.difficulty.title(),
        subject=req.subject.replace("_", " ").title(),
        topic=req.topic or "any topic in this subject",
        level=req.level.replace("_", " ").title(),
        n="{n}",
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(PRACTICE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        raise HTTPException(500, f"AI practice error: {str(e)[:200]}")

    duration = int(time.time() * 1000) - start_ms

    session = MathSession(
        user_id=current_user.id,
        session_type=SessionType.practice,
        subject=subject_enum,
        level=req.level,
        model_name=req.model_name,
        input_text=f"{req.subject} — {req.topic or 'general'} — {req.difficulty} × {req.count}",
        output_text=output,
        prompt_tokens=prompt_tok,
        completion_tokens=completion_tok,
        duration_ms=duration,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _session_out(session)


@router.get("/history", response_model=List[MathSessionOut])
async def history(
    limit: int = 20,
    session_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(MathSession).where(
        MathSession.user_id == current_user.id
    ).order_by(desc(MathSession.created_at)).limit(limit)

    if session_type:
        for st in SessionType:
            if st.value == session_type:
                q = q.where(MathSession.session_type == st)
                break

    result = await db.execute(q)
    return [_session_out(r) for r in result.scalars().all()]


@router.get("/progress", response_model=ProgressOut)
async def progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta, timezone

    total = (await db.execute(
        select(func.count(MathSession.id)).where(MathSession.user_id == current_user.id)
    )).scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_count = (await db.execute(
        select(func.count(MathSession.id)).where(
            MathSession.user_id == current_user.id,
            MathSession.created_at >= week_ago,
        )
    )).scalar() or 0

    recent_q = await db.execute(
        select(MathSession).where(MathSession.user_id == current_user.id)
        .order_by(desc(MathSession.created_at)).limit(10)
    )
    recent = [_session_out(r) for r in recent_q.scalars().all()]

    subj_q = await db.execute(
        select(MathSession.subject).where(MathSession.user_id == current_user.id).distinct()
    )
    subjects = [r[0].value if r[0] else "other" for r in subj_q.fetchall()]

    tp_q = await db.execute(
        select(UserTopicProgress).where(UserTopicProgress.user_id == current_user.id)
        .order_by(desc(UserTopicProgress.problems_solved))
    )
    topic_progress = [
        {
            "subject": tp.subject,
            "topic": tp.topic,
            "problems_solved": tp.problems_solved,
            "mastery_score": tp.mastery_score,
            "last_practiced": tp.last_practiced.isoformat() if tp.last_practiced else "",
        }
        for tp in tp_q.scalars().all()
    ]

    return ProgressOut(
        total_sessions=total,
        sessions_this_week=week_count,
        subjects_practiced=subjects,
        recent_sessions=recent,
        topic_progress=topic_progress,
    )


@router.get("/subjects")
async def list_subjects():
    """Return the full mathematics curriculum structure."""
    return {
        "subjects": [
            {"key": "arithmetic",    "label": "Arithmetic",               "icon": "Hash",       "color": "bg-sky-100 text-sky-700",      "topics": ["Number Systems", "Fractions", "Decimals", "Percentages", "Ratios", "Estimation"]},
            {"key": "algebra",       "label": "Algebra",                  "icon": "Variable",   "color": "bg-blue-100 text-blue-700",    "topics": ["Linear Equations", "Quadratic Equations", "Polynomials", "Factoring", "Systems of Equations", "Inequalities", "Functions", "Exponentials", "Logarithms"]},
            {"key": "geometry",      "label": "Geometry",                 "icon": "Triangle",   "color": "bg-violet-100 text-violet-700","topics": ["Triangles", "Circles", "Polygons", "Coordinate Geometry", "Transformations", "Proofs", "3D Geometry"]},
            {"key": "trigonometry",  "label": "Trigonometry",             "icon": "Waves",      "color": "bg-indigo-100 text-indigo-700","topics": ["Unit Circle", "Trig Functions", "Identities", "Solving Trig Equations", "Inverse Functions", "Law of Sines/Cosines"]},
            {"key": "precalculus",   "label": "Pre-Calculus",             "icon": "Activity",   "color": "bg-purple-100 text-purple-700","topics": ["Functions", "Polynomial Functions", "Rational Functions", "Exponential Functions", "Logarithmic Functions", "Sequences & Series"]},
            {"key": "calculus",      "label": "Calculus",                 "icon": "TrendingUp", "color": "bg-emerald-100 text-emerald-700","topics": ["Limits", "Derivatives", "Differentiation Rules", "Applications of Derivatives", "Integrals", "Integration Techniques", "Applications of Integrals", "Multivariable Calculus"]},
            {"key": "statistics",    "label": "Statistics & Probability", "icon": "BarChart2",  "color": "bg-amber-100 text-amber-700",  "topics": ["Descriptive Statistics", "Probability", "Distributions", "Hypothesis Testing", "Regression", "Confidence Intervals"]},
            {"key": "linear_algebra","label": "Linear Algebra",           "icon": "Grid",       "color": "bg-rose-100 text-rose-700",    "topics": ["Vectors", "Matrices", "Determinants", "Systems of Linear Equations", "Eigenvalues", "Vector Spaces", "Linear Transformations"]},
            {"key": "differential_equations","label": "Differential Equations","icon": "Sigma", "color": "bg-teal-100 text-teal-700",   "topics": ["First-Order ODEs", "Second-Order ODEs", "Systems of ODEs", "Laplace Transforms", "Series Solutions", "Partial Differential Equations"]},
            {"key": "discrete_math", "label": "Discrete Mathematics",     "icon": "Network",    "color": "bg-orange-100 text-orange-700","topics": ["Logic", "Set Theory", "Combinatorics", "Graph Theory", "Number Theory", "Proofs", "Algorithms"]},
        ]
    }
