"""
AI Mentor Mode — Socratic dialogue engine.
Guides learners to mathematical discovery through questions, never direct answers.
"""
import logging
import re
from typing import Optional, List
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.mentor import MentorConversation
from app.models.user import User
from app.routers.auth import get_current_user

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/math/mentor", tags=["mentor"])

# ── AI imports ────────────────────────────────────────────────────────────────

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

# ── System prompt ─────────────────────────────────────────────────────────────

MENTOR_SYSTEM = """You are a Socratic mathematics mentor in AI Mathematics Copilot™.

Your ONLY teaching method is the Socratic method. These rules are absolute:
1. NEVER give direct answers, formulas, derivations, or complete solutions.
2. ALWAYS respond with exactly ONE guiding question (ending with "?").
3. When the learner answers correctly: affirm in ≤8 words, then deepen with another question.
4. When the learner is wrong: surface the contradiction gently with a question.
5. Use analogies, "what if" scenarios, and "imagine" prompts to redirect confusion.
6. Your goal: the learner must feel they discovered the insight themselves.

VISUAL DIAGRAMS:
When the learner explicitly asks for a sketch, diagram, or visual — OR when a diagram would
significantly clarify your Socratic question — include an inline SVG after your question using
this EXACT format (no spaces inside the tags):

[SVG]<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><rect width="400" height="220" fill="#0f0a1e"/><!-- elements --></svg>[/SVG]

SVG rules:
- viewBox must be exactly "0 0 400 220"
- Background rect: fill="#0f0a1e" (required, always first element)
- Primary color #a855f7 (purple) for key shapes/curves
- Secondary color #22d3ee (cyan) for labels/axes
- Text: fill="#e2e8f0" font-family="sans-serif" font-size="12"
- Keep geometry clean and minimal: shapes, arrows (marker-end), coordinate axes, labels
- Use <text> elements for all labels; never rely on emoji or unicode math
- Only include SVG when it genuinely aids the learner's visual intuition

Topic: {topic}
Subject: {subject}
Education level: {level}

After 6–10 exchanges, if the learner has demonstrated genuine understanding, begin your response
with the exact token [COMPLETE] followed by a warm one-sentence celebration and the key insight.

Format: question text first (2–3 sentences max), then [SVG]...[/SVG] block if needed."""


COMPLETE_PATTERN = re.compile(r'^\[COMPLETE\]\s*', re.IGNORECASE)
SVG_PATTERN = re.compile(r'\[SVG\](.*?)\[/SVG\]', re.DOTALL)


def extract_svg(text: str) -> tuple[str, Optional[str]]:
    """Strip [SVG]...[/SVG] from AI reply; return (clean_text, svg_string | None)."""
    m = SVG_PATTERN.search(text)
    if m:
        svg = m.group(1).strip()
        clean = SVG_PATTERN.sub("", text).strip()
        return clean, svg
    return text, None

# ── Schemas ───────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    model_name: str = "gpt-4o"


class RespondRequest(BaseModel):
    session_id: str
    user_message: str
    model_name: str = "gpt-4o"


class MentorMessage(BaseModel):
    role: str   # "mentor" | "user"
    content: str
    svg_diagram: Optional[str] = None


class MentorSessionOut(BaseModel):
    session_id: str
    topic: str
    subject: str
    level: str
    messages: List[MentorMessage]
    turn_count: int
    is_complete: bool
    completion_insight: Optional[str] = None


# ── Multi-turn AI dispatch ────────────────────────────────────────────────────

MODEL_PROVIDER_MAP = {
    "gpt-4o":            "openai",
    "gpt-4o-mini":       "openai",
    "claude-sonnet-4":   "anthropic",
    "claude-haiku-4":    "anthropic",
    "claude-opus-4":     "anthropic",
    "claude-3-5-sonnet": "anthropic",
}

ANTHROPIC_MODEL_MAP = {
    "claude-sonnet-4":   "claude-sonnet-4-6",
    "claude-haiku-4":    "claude-haiku-4-5-20251001",
    "claude-opus-4":     "claude-opus-4-8",
    "claude-3-5-sonnet": "claude-sonnet-4-6",
}


async def mentor_call(system: str, history: list[dict], model: str) -> str:
    """Multi-turn AI call — history is [{role: 'user'|'assistant', content: str}]."""
    provider = MODEL_PROVIDER_MAP.get(model, "openai")

    if provider == "anthropic":
        if not ANTHROPIC_AVAILABLE or not getattr(settings, "ANTHROPIC_API_KEY", ""):
            raise HTTPException(500, "Anthropic not configured.")
        api_model = ANTHROPIC_MODEL_MAP.get(model, model)
        client = anthropic_sdk.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
        resp = await client.messages.create(
            model=api_model,
            max_tokens=800,
            system=system,
            messages=history,
        )
        return resp.content[0].text if resp.content else ""

    # OpenAI
    if not OPENAI_AVAILABLE or not getattr(settings, "OPENAI_API_KEY", ""):
        raise HTTPException(500, "OpenAI not configured.")
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)
    oai_msgs = [{"role": "system", "content": system}] + history
    resp = await client.chat.completions.create(
        model=model,
        messages=oai_msgs,
        max_tokens=800,
        temperature=0.7,
    )
    return resp.choices[0].message.content or ""


def _build_history(stored_messages: list) -> list[dict]:
    """Convert stored messages to OpenAI/Anthropic role format."""
    result = []
    for m in stored_messages:
        role = "assistant" if m["role"] == "mentor" else "user"
        result.append({"role": role, "content": m["content"]})
    return result


def _session_out(conv: MentorConversation) -> MentorSessionOut:
    msgs = conv.messages or []
    return MentorSessionOut(
        session_id=str(conv.id),
        topic=conv.topic,
        subject=conv.subject,
        level=conv.level,
        messages=[
            MentorMessage(
                role=m["role"],
                content=m["content"],
                svg_diagram=m.get("svg_diagram"),
            )
            for m in msgs
        ],
        turn_count=conv.turn_count or 0,
        is_complete=conv.is_complete or False,
        completion_insight=conv.completion_insight,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start", response_model=MentorSessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(
    req: StartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Begin a new Socratic mentor session.
    Returns the first guiding question from the AI Mentor.
    """
    system = MENTOR_SYSTEM.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
    )

    # Opening prompt — seed the first question
    opening_user_msg = (
        f"I want to understand: {req.topic}. "
        "Please start our Socratic session with your first guiding question."
    )

    try:
        mentor_reply = await mentor_call(
            system=system,
            history=[{"role": "user", "content": opening_user_msg}],
            model=req.model_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[mentor/start] {e}", exc_info=True)
        raise HTTPException(500, f"Mentor AI error: {str(e)[:200]}")

    # Extract optional SVG diagram
    mentor_reply, svg_diagram = extract_svg(mentor_reply)

    # Check for early [COMPLETE] (shouldn't happen on turn 1, but guard it)
    is_complete = bool(COMPLETE_PATTERN.match(mentor_reply))
    insight = None
    clean_reply = mentor_reply
    if is_complete:
        clean_reply = COMPLETE_PATTERN.sub("", mentor_reply).strip()
        insight = clean_reply

    stored_messages = [{"role": "mentor", "content": clean_reply, "svg_diagram": svg_diagram}]

    conv = MentorConversation(
        user_id=current_user.id,
        topic=req.topic,
        subject=req.subject,
        level=req.level,
        model_name=req.model_name,
        messages=stored_messages,
        turn_count=1,
        is_complete=is_complete,
        completion_insight=insight,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return _session_out(conv)


@router.post("/respond", response_model=MentorSessionOut)
async def respond(
    req: RespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send the learner's response; receive the next Socratic question (or completion).
    """
    # Load session
    result = await db.execute(
        select(MentorConversation).where(
            MentorConversation.id == PyUUID(req.session_id),
            MentorConversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Mentor session not found.")
    if conv.is_complete:
        raise HTTPException(400, "This session is already complete.")

    system = MENTOR_SYSTEM.format(
        topic=conv.topic,
        subject=conv.subject.replace("_", " ").title(),
        level=conv.level.replace("_", " ").title(),
    )

    # Build full history for the AI
    stored = list(conv.messages or [])
    history = _build_history(stored)
    # Append the user's latest message
    history.append({"role": "user", "content": req.user_message})

    try:
        mentor_reply = await mentor_call(
            system=system,
            history=history,
            model=req.model_name or conv.model_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[mentor/respond] {e}", exc_info=True)
        raise HTTPException(500, f"Mentor AI error: {str(e)[:200]}")

    # Extract optional SVG diagram
    mentor_reply, svg_diagram = extract_svg(mentor_reply)

    # Detect completion
    is_complete = bool(COMPLETE_PATTERN.match(mentor_reply))
    insight = None
    clean_reply 