"""
AI Insights & Next Steps(TM) -- Academic Outcomes / Mastery Dashboard,
Part III of the AI Mathematics Copilot(TM) Personalized Learning Goals,
Academic Outcomes, Mastery & Career Readiness Framework (v4.0). See claude
project docs MASTER-REFERENCE-learning-goals-academic-outcomes-mastery-
career-readiness-framework-2026-08-16.md and part-3-outcomes-dashboard-
2026-08-16.md for the full spec and v1 scope decisions this implements.

get_or_generate_insight() turns Part II's already-computed mastery data
into a short, plain-language narrative for the learner (or the teacher/
parent viewing that learner's dashboard). It NEVER computes or infers
mastery itself -- Gate 3 of the master framework explicitly forbids Part
III from independently defining mastery, assigning Bloom levels, or
manufacturing a percentage/score, and that constraint applies just as much
to an AI-written narrative as it would to a hand-coded formula. Two layers
of enforcement: the system prompt hard-forbids percentages/scores/
overstated readiness claims and restates the exact mastery_state values it
must not deviate from, and the response is regex-scanned for a literal
percentage before being trusted -- if either the AI or the parser fails,
generation falls back to a deterministic, zero-AI template built directly
from the mastery data (same fail-safe convention as
app/routers/outcomes.py's _fallback_structured_problems()).

Generation is cached, not fresh-every-load: a sha256 fingerprint of the
(topics, competencies) snapshot is stored alongside the narrative in
MasteryInsightSnapshot, and a new AI call only happens when that
fingerprint changes or the caller passes force=True. Revisiting an
unchanged dashboard is then a cheap DB read, not a repeat AI call.
"""
import hashlib
import json
import logging
import re

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.insight import MasteryInsightSnapshot
from app.models.user import User
from app.routers.math import dispatch, _parse_json_response
from app.services.model_registry import resolve_text_mode

logger = logging.getLogger("uvicorn.error")

INSIGHT_SYSTEM_PROMPT = (
    "You are the narrative-generation engine behind the AI Mathematics Copilot's "
    "Academic Outcomes dashboard. You interpret mastery data that has ALREADY been "
    "computed by a separate evidence-based engine -- you never compute, estimate, or "
    "restate it differently. Hard rules, no exceptions: "
    "(1) Never output a percentage, numeric score, or grade of any kind -- none exists "
    "in the input and none may be invented. "
    "(2) Never state a mastery level for a topic other than exactly the mastery_state "
    "string given for it in the input. "
    "(3) Never claim the learner is 'ready' for an exam, course, or career milestone "
    "beyond what a 'Proficient' or 'Mastered' state directly supports. "
    "(4) Never mention a topic or competency that has evidence_count = 0 as something "
    "the learner has engaged with. "
    "Return only a single valid JSON object, no markdown, no text outside the JSON."
)

INSIGHT_PROMPT = """Here is this learner's current mastery data, computed by the platform's Evidence Engine (do not alter these values, only interpret them in plain language):

TOPIC MASTERY:
{topics_json}

CAREER COMPETENCY MASTERY:
{competencies_json}

Write three short sections for the learner, 2-4 sentences each, warm and encouraging but strictly grounded in the data above:
{{
  "strengths": "...",
  "opportunities": "...",
  "next_steps": "..."
}}
"""

_PCT_PATTERN = re.compile(r"\d+(\.\d+)?\s*%")


def _fingerprint(topics: list, competencies: list) -> str:
    canonical = json.dumps(
        {
            "topics": sorted(
                (t["subject"], t["topic"], t["mastery_state"], t["evidence_count"], t["independent_correct_count"])
                for t in topics
            ),
            "competencies": sorted(
                (c["career_competency_key"], c["mastery_state"], c["evidence_count"], c["independent_correct_count"])
                for c in competencies
            ),
        },
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _fallback_insight(topics: list, competencies: list) -> dict:
    """Deterministic, zero-AI fallback -- same convention as
    outcomes.py::_fallback_structured_problems(). Built directly from the
    mastery data, so it is trivially Gate-3-safe by construction."""
    if not topics:
        return {
            "strengths": "You haven't logged any practice evidence yet — once you try some problems, your strengths will show up here.",
            "opportunities": "Start with a Practice Check on a topic from your Learning Goals to begin building your Mastery record.",
            "next_steps": "Visit Practice Problems to generate your first Check My Work set.",
        }
    strong = [t for t in topics if t["mastery_state"] in ("Proficient", "Mastered")]
    developing = [t for t in topics if t["mastery_state"] in ("Emerging", "Developing")]
    strengths = (
        "You're showing strong evidence in " + ", ".join(f"{t['subject']}/{t['topic']}" for t in strong[:3]) + "."
        if strong else
        "You're early in building independent evidence across your topics — that's a normal starting point."
    )
    opportunities = (
        "Keep building independent practice evidence in " + ", ".join(f"{t['subject']}/{t['topic']}" for t in developing[:3]) + "."
        if developing else
        "Consider trying a new topic to broaden your evidence portfolio."
    )
    return {
        "strengths": strengths,
        "opportunities": opportunities,
        "next_steps": "Generate a new Practice Check on any topic below to add more independent evidence.",
    }


async def get_or_generate_insight(
    db: AsyncSession,
    user: User,
    topics: list,
    competencies: list,
    force: bool = False,
    ai_mode: str = "smart",
):
    """Returns (insight_dict, from_cache: bool). insight_dict has
    strengths/opportunities/next_steps/generated_at/model_name."""
    fingerprint = _fingerprint(topics, competencies)

    if not force:
        result = await db.execute(
            select(MasteryInsightSnapshot)
            .where(MasteryInsightSnapshot.user_id == user.id)
            .order_by(desc(MasteryInsightSnapshot.created_at))
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        if latest and latest.input_fingerprint == fingerprint:
            return {
                "strengths": latest.strengths,
                "opportunities": latest.opportunities,
                "next_steps": latest.next_steps,
                "generated_at": latest.created_at.isoformat() if latest.created_at else None,
                "model_name": latest.model_name,
            }, True

    if not topics:
        data = _fallback_insight(topics, competencies)
    else:
        try:
            prompt = INSIGHT_PROMPT.format(
                topics_json=json.dumps(topics, default=str),
                competencies_json=json.dumps(competencies, default=str),
            )
            raw, _, _ = await dispatch(INSIGHT_SYSTEM_PROMPT, prompt, ai_mode, 800)
            data = _parse_json_response(raw)
            for key in ("strengths", "opportunities", "next_steps"):
                if not data.get(key):
                    raise ValueError(f"Insight response missing '{key}'")
            combined = " ".join(str(data[k]) for k in ("strengths", "opportunities", "next_steps"))
            if _PCT_PATTERN.search(combined):
                raise ValueError("Insight response contained a disallowed percentage.")
        except Exception as e:
            logger.error(f"[insight_engine.get_or_generate_insight] {type(e).__name__}: {e}", exc_info=True)
            data = _fallback_insight(topics, competencies)

    snapshot = MasteryInsightSnapshot(
        user_id=user.id,
        input_fingerprint=fingerprint,
        strengths=data["strengths"],
        opportunities=data["opportunities"],
        next_steps=data["next_steps"],
        model_name=resolve_text_mode(ai_mode).id,
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return {
        "strengths": snapshot.strengths,
        "opportunities": snapshot.opportunities,
        "next_steps": snapshot.next_steps,
        "generated_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
        "model_name": snapshot.model_name,
    }, False
