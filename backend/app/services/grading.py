"""
Grading -- two-tier answer checking for Practice Check, the platform's
first real answer-checking flow (Part II, see part-2-outcomes-mastery-
engine-2026-08-16.md for the build record).

Tier 1: normalized exact-string match -- free, instant, handles the
common case (same answer, different whitespace/case/formatting).
Tier 2 (only reached if tier 1 doesn't match): an AI-graded equivalence
check via dispatch() -- reused from app/routers/math.py, same
AI-provider dispatch used throughout the platform -- handles "3/4" vs
"0.75" vs "x = 3/4" without needing a symbolic math library.
"""
import json
import logging
import re
from typing import Tuple

from app.routers.math import dispatch

logger = logging.getLogger("uvicorn.error")


def _normalize(answer: str) -> str:
    a = (answer or "").strip().lower()
    a = re.sub(r"^[a-z]\s*=\s*", "", a)   # strip "x = " / "y = " style prefixes
    a = re.sub(r"\s+", "", a)             # collapse all whitespace
    a = a.rstrip(".")                      # trailing period
    return a


GRADING_PROMPT = """A learner was asked this math problem:
{problem_text}

The correct answer is: {correct_answer}
The learner submitted: {submitted_answer}

Is the learner's submitted answer mathematically equivalent to the correct answer? Allow equivalent forms (fractions vs decimals, simplified vs unsimplified, different but equivalent notation). Ignore minor formatting differences.

Return ONLY a JSON object, no markdown, no explanation outside the JSON:
{{"is_correct": true or false, "feedback": "one short sentence explaining why"}}
"""


async def grade_answer(
    problem_text: str,
    submitted: str,
    correct_answer: str,
    ai_mode: str = "smart",
) -> Tuple[bool, str]:
    """Returns (is_correct, grading_method) -- grading_method is
    "exact_match" or "ai_graded"."""
    if _normalize(submitted) == _normalize(correct_answer):
        return True, "exact_match"

    try:
        raw, _, _ = await dispatch(
            "You are a strict but fair math grading assistant. Return only valid JSON.",
            GRADING_PROMPT.format(
                problem_text=problem_text,
                correct_answer=correct_answer,
                submitted_answer=submitted,
            ),
            ai_mode,
            200,
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
        data = json.loads(cleaned)
        return bool(data.get("is_correct", False)), "ai_graded"
    except Exception as e:
        logger.error(f"[grading.grade_answer] {type(e).__name__}: {e}", exc_info=True)
        # Fail safe: mark incorrect rather than silently awarding credit on
        # a grading error -- a false "incorrect" is recoverable (the
        # response still reveals the true solution), a false "correct"
        # would corrupt the evidence record.
        return False, "ai_graded"
