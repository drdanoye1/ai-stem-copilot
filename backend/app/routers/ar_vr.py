"""
AI Mathematics Copilot™ — AR/VR Curriculum, Interpretation & Career Context Layer

Turns a raw computed result from one of the AR/VR flagship experiences
(ar-lab/*) into an 8-section interpretation calibrated to the learner's
full personalization ground truth — Education Level, Curriculum/Learning
Framework (+ Track), and Career Interest — reusing the same
PersonalizationContext engine (app/services/personalization.py) and AI
dispatch/JSON-parsing machinery already proven out in the math router,
rather than reimplementing either.

Guardrail this module exists to protect, same as the rest of the
personalization system: this never changes what the AR/VR experience
computes, only how the result is explained afterward.
"""
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.routers.math import dispatch, _parse_json_response
from app.models.user import User
from app.models.evidence import EvidenceSource
from app.services.evidence_engine import log_evidence_event
from app.services.personalization import build_personalization_context

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/ar-vr", tags=["ar-vr"])

EXPERIENCE_LABELS = {
    "algebra-lab": "Algebra Lab",
    "calculus-explorer": "Calculus Explorer",
    "coordinate-space": "Coordinate Space",
    "geometry-explorer": "Geometry Explorer",
    "probability-lab": "Probability Lab",
    "trigonometry-lab": "Trigonometry Lab",
}


class InterpretRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    experience_key: str
    topic: str
    subject: str = "algebra"
    result_summary: str
    computed_values: Optional[Dict[str, Any]] = None
    # Session-level overrides — mirrors the pattern already used by
    # mentor.py's start_session(): default to the account profile's ground
    # truth, but let a single AR/VR session temporarily use something else
    # without touching the saved profile.
    level: Optional[str] = None
    curriculum: Optional[str] = None
    curriculum_track: Optional[str] = None
    ai_mode: str = "smart"


INTERPRETATION_PROMPT = """A learner just used an interactive {experience_label} to explore "{topic}" (subject: {subject}).

What they computed or observed: {result_summary}
{computed_values_line}

Learner's personalization ground truth:
{personalization_block}

Produce an interpretation of this result as JSON with EXACTLY these 8 keys — no more, no fewer, no markdown, no text outside the JSON object:
{{
  "your_result": "...",
  "mathematical_meaning": "...",
  "at_your_level": "...",
  "curriculum_connection": "...",
  "career_connection": "...",
  "real_world_application": "...",
  "career_skill_developed": "...",
  "try_this_next": "..."
}}

Section guidelines:
- your_result: Restate in plain language what they just computed or observed, confirming what happened in the experience.
- mathematical_meaning: Explain the underlying mathematical concept or theorem at play.
- at_your_level: Calibrate the explanation depth precisely to the learner's stated education level — never assume more or less background than that level implies.
- curriculum_connection: Connect this result to the learner's specific curriculum/framework (and track/tier, if one is set) — reference topic names, unit numbers, or assessment objectives a learner following that curriculum would actually recognize. If the curriculum is "General", connect it to commonly-taught topic sequencing instead.
- career_connection: If a specific career interest is set (not "General/Exploring"), connect this result to that field concretely. Otherwise, briefly note where this mathematics shows up across a few different fields.
- real_world_application: One concrete, specific real-world scenario where this exact mathematics is used.
- career_skill_developed: The transferable analytical or technical skill this exercise builds, framed the way a resume or job description might.
- try_this_next: One concrete, specific next action or variation to try inside this same experience — not a generic "keep practicing".

Keep every section to 2–4 sentences. The mathematics itself must never be altered or re-derived differently than what the learner already computed — only the framing changes.
"""


def _fallback_interpretation(topic: str) -> Dict[str, str]:
    return {
        "your_result": f"You explored {topic} and produced a result in the experience above.",
        "mathematical_meaning": f"This result reflects the core mathematical relationship at the heart of {topic}.",
        "at_your_level": "Review the values above against what you've covered in class, and revisit any step that feels unfamiliar.",
        "curriculum_connection": "This connects to the topic sequencing most learners follow for this subject.",
        "career_connection": f"{topic} shows up across engineering, science, technology, and data-driven fields.",
        "real_world_application": f"Professionals use {topic} whenever they need to model or predict a real quantity precisely.",
        "career_skill_developed": "Quantitative reasoning and structured problem-solving.",
        "try_this_next": "Change one input in the experience and see how the result shifts.",
    }


@router.post("/interpret", status_code=200)
async def interpret(
    req: InterpretRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Curriculum, Interpretation & Career Context Layer — turns a raw AR/VR
    result into an 8-section, personalization-calibrated explanation.
    """
    ctx = build_personalization_context(
        current_user,
        level_override=req.level,
        curriculum_override=req.curriculum,
        curriculum_track_override=req.curriculum_track,
    )

    experience_label = EXPERIENCE_LABELS.get(
        req.experience_key, req.experience_key.replace("-", " ").title()
    )
    computed_values_line = (
        f"Computed values: {json.dumps(req.computed_values)}" if req.computed_values else ""
    )

    prompt = INTERPRETATION_PROMPT.format(
        experience_label=experience_label,
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        result_summary=req.result_summary,
        computed_values_line=computed_values_line,
        personalization_block=ctx.prompt_block(),
    )

    try:
        raw, _, _ = await dispatch(
            "You are the JSON-generating engine behind the AI Mathematics Copilot's AR/VR "
            "Interpretation Layer. Return only a single valid JSON object. No markdown, no "
            "explanation outside the JSON.",
            prompt,
            req.ai_mode,
            1200,
        )
        sections = _parse_json_response(raw)
        if not isinstance(sections, dict):
            raise ValueError("Interpretation response was not a JSON object")
    except Exception as e:
        logger.error(f"[ar_vr.interpret] {type(e).__name__}: {e}", exc_info=True)
        sections = _fallback_interpretation(req.topic)

    await log_evidence_event(
        db, current_user, EvidenceSource.ar_vr,
        subject=req.subject, topic=req.topic,
    )

    return {
        "experience_key": req.experience_key,
        "topic": req.topic,
        "education_level": ctx.education_level_label,
        "curriculum": ctx.curriculum_label,
        "curriculum_track": ctx.curriculum_track,
        "career_interest": ctx.career_interest_label,
        "sections": sections,
    }
