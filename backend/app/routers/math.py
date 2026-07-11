"""
AI Mathematics Copilot™ — Math Execution Router
Solve, Explore, Practice, Theory Intelligence™, Visualization Intelligence™
"""
import json as _json
import logging
import re as _re
import time
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.session import MathSession, MathSubject, SessionType, UserTopicProgress
from app.config import settings

logger = logging.getLogger("uvicorn.error")


def _ai_http_error(endpoint: str, exc: Exception) -> HTTPException:
    """Convert raw AI-provider exceptions into sanitised HTTP responses.

    The real error is logged server-side only — users never see API keys,
    quota details, model names, or provider internals.
    """
    logger.error("[%s] AI provider error — %s: %s", endpoint, type(exc).__name__, exc, exc_info=True)
    msg = str(exc).lower()

    # Rate-limit / quota (OpenAI 429, Anthropic 429, Gemini quota)
    if any(k in msg for k in ("rate limit", "quota", "insufficient_quota", "ratelimit", "429")):
        return HTTPException(
            status_code=503,
            detail={"code": "SERVICE_BUSY", "message": "The AI service is temporarily busy. Please try again in a few moments."},
        )

    # Auth / key problems
    if any(k in msg for k in ("authentication", "api key", "unauthorized", "invalid_api_key", "401")):
        return HTTPException(
            status_code=503,
            detail={"code": "SERVICE_UNAVAILABLE", "message": "AI service is temporarily unavailable. Please try again later."},
        )

    # Model not found / invalid model
    if any(k in msg for k in ("model", "does not exist", "invalid_value", "not found")):
        return HTTPException(
            status_code=503,
            detail={"code": "SERVICE_UNAVAILABLE", "message": "AI service is temporarily unavailable. Please try again later."},
        )

    # Generic fallback
    return HTTPException(
        status_code=500,
        detail={"code": "AI_ERROR", "message": "Something went wrong while processing your request. Please try again."},
    )


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

try:
    import google.generativeai as genai
    import asyncio as _asyncio
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False

router = APIRouter(prefix="/math", tags=["math"])

# ── Model routing ─────────────────────────────────────────────────────────────

MODEL_PROVIDER_MAP = {
    "gpt-4o":              "openai",
    "gpt-4o-mini":         "openai",
    "gpt-4-turbo":         "openai",
    "claude-sonnet-4":     "anthropic",
    "claude-haiku-4":      "anthropic",
    "claude-opus-4":       "anthropic",
    "claude-3-5-sonnet":   "anthropic",
    "gemini-1.5-pro":      "google",
    "gemini-1.5-flash":    "google",
}

ANTHROPIC_MODEL_MAP = {
    "claude-sonnet-4":   "claude-sonnet-4-5",
    "claude-haiku-4":    "claude-haiku-4-5",
    "claude-opus-4":     "claude-opus-4-5",
    "claude-3-5-sonnet": "claude-sonnet-4-6",
}

GEMINI_MODEL_MAP = {
    "gemini-1.5-pro":   "gemini-1.5-pro",
    "gemini-1.5-flash": "gemini-1.5-flash",
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
CURRICULUM STANDARD: {curriculum}

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
CURRICULUM STANDARD: {curriculum}

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
List 3-5 topics to explore next, with a one-sentence description of each.

VISUALIZATION REQUIREMENT — You MUST end your response with exactly one visualization hint block.
The delimiters [VIZ_HINT] and [/VIZ_HINT] are MANDATORY — do not omit them.

Choose the most relevant type for {topic}. Use REAL numeric values (never empty arrays []).

Type examples:
• function_graph — any function, curve, or graph (algebra/calculus/trig/analysis):
  [VIZ_HINT]{{"type":"function_graph","expressions":["x**2-4","2*x+1"],"x_range":[-4,4],"title":"Quadratic vs Linear","labels":["f(x)=x²−4","g(x)=2x+1"]}}[/VIZ_HINT]

• statistics_chart/bar — comparing discrete quantities (frequencies, probabilities, categories):
  [VIZ_HINT]{{"type":"statistics_chart","chart_type":"bar","title":"Empirical Rule","data":[68.27,95.45,99.73],"categories":["±1σ","±2σ","±3σ"]}}[/VIZ_HINT]

• statistics_chart/normal_dist — bell curve / normal distribution (data = [mean, std]):
  [VIZ_HINT]{{"type":"statistics_chart","chart_type":"normal_dist","title":"Standard Normal Distribution","data":[0,1]}}[/VIZ_HINT]

• surface_3d — 3D surface z=f(x,y) for multivariable calculus:
  [VIZ_HINT]{{"type":"surface_3d","expression":"Math.sin(Math.sqrt(x*x+y*y))","x_range":[-6,6],"y_range":[-6,6],"title":"3D Surface"}}[/VIZ_HINT]

• geometry — geometric constructions (geogebra_applet: Triangle|Circle|Pythagoras|Vectors|Transformations):
  [VIZ_HINT]{{"type":"geometry","geogebra_applet":"Triangle","title":"Triangle Geometry"}}[/VIZ_HINT]

• none — only if absolutely no meaningful visualization exists:
  [VIZ_HINT]{{"type":"none"}}[/VIZ_HINT]

Use JS Math syntax in expressions: Math.sin(x), Math.sqrt(x), x**2, Math.PI, Math.E."""

PRACTICE_SYSTEM = """You are an expert mathematics problem generator for AI Mathematics Copilot™.
Generate high-quality, well-structured practice problems with complete solutions.

FORMATTING RULES:
- Use LaTeX for ALL mathematical expressions
- Problems must be solvable with the knowledge implied by the subject and level
- Solutions must show every step"""

# ── Theory Intelligence™ prompts ──────────────────────────────────────────────

THEORY_SYSTEM = """You are an expert mathematics professor for AI Mathematics Copilot™ Theory Intelligence™.
Your role is to generate rigorous, complete mathematical theory lessons that go far beyond textbook summaries.

CRITICAL FORMATTING RULES:
- Use LaTeX for ALL mathematical expressions ($...$ inline, $$...$$ display)
- Use ## for main section headings, ### for subsections
- Use **bold** for key terms and theorem names on first use
- Every derivation and proof must show EVERY step — never skip algebra
- Write for the specified education level but never sacrifice mathematical accuracy
- Use tables (markdown) for formula summaries and comparisons"""

THEORY_PROMPT = """TOPIC: {topic}
SUBJECT AREA: {subject}
EDUCATION LEVEL: {level}
THEORY DEPTH: {theory_level}
CURRICULUM STANDARD: {curriculum}

Generate a complete Theory Lesson with ALL twelve sections below. Do not skip any section.

## 1. Historical Background
Who discovered or developed this concept? When? What problem were they trying to solve?
Write 2–4 engaging sentences — make the history vivid and human.

## 2. Intuition & Motivation
Why does this concept exist? What problem does it solve in plain English?
Use an analogy or everyday example. No formulas yet — pure intuition first.

## 3. Formal Definition
State the precise mathematical definition using full LaTeX notation.
Define every symbol used. Include any necessary preliminary definitions.

## 4. Fundamental Principles & Axioms
What core ideas and axioms underlie this concept?
What must be true for this to work? What assumptions are being made?

## 5. Mathematical Derivation
Derive the main formula or result from first principles. Show EVERY algebraic step.
Each step must have a plain-English explanation of what was done and why.

## 6. Formal Proof
Prove the main theorem or result. Label the proof appropriately (Beginner or Advanced).
For beginner levels, use geometric or intuitive proof. For advanced, use rigorous proof.

## 7. Key Formulas & Theorems
Present a summary table:
| Formula / Theorem | LaTeX Notation | When to Use | Conditions |
|---|---|---|---|
(Include at least 3–5 entries)

## 8. Assumptions & Limitations
Under what conditions does this concept or formula break down?
What assumptions are implicit? What are the boundaries of applicability?

## 9. Common Mistakes & Misconceptions
List 2–3 specific errors students make with this topic.
For each: describe what they do wrong, why it is incorrect, and the correct approach.

## 10. Worked Examples
Provide 3 worked examples at increasing difficulty levels.
Each example must include a clear problem statement, every solution step with LaTeX, and a final answer.

## 11. Visual Intuition
Describe how to visualize this concept geometrically, graphically, or physically.
Reference any diagrams, graphs, or geometric constructions that illuminate the idea.

## 12. Summary
Write one concise paragraph synthesizing the lesson.
What should the learner now understand that they did not before?
What is the single most important insight from this topic?

VISUALIZATION REQUIREMENT — You MUST end your response (after Section 12) with exactly one visualization hint block.
The delimiters [VIZ_HINT] and [/VIZ_HINT] are MANDATORY — do not omit them.

Choose the most relevant type for {topic}. Use REAL numeric values (never empty arrays []).

Type examples:
• function_graph — any function, curve, or graph (algebra/calculus/trig/analysis):
  [VIZ_HINT]{{"type":"function_graph","expressions":["x**2-4","2*x+1"],"x_range":[-4,4],"title":"Quadratic vs Linear","labels":["f(x)=x²−4","g(x)=2x+1"]}}[/VIZ_HINT]

• statistics_chart/bar — comparing discrete quantities (frequencies, probabilities, categories):
  [VIZ_HINT]{{"type":"statistics_chart","chart_type":"bar","title":"Empirical Rule","data":[68.27,95.45,99.73],"categories":["±1σ","±2σ","±3σ"]}}[/VIZ_HINT]

• statistics_chart/normal_dist — bell curve / normal distribution (data = [mean, std]):
  [VIZ_HINT]{{"type":"statistics_chart","chart_type":"normal_dist","title":"Standard Normal Distribution","data":[0,1]}}[/VIZ_HINT]

• surface_3d — 3D surface z=f(x,y) for multivariable calculus:
  [VIZ_HINT]{{"type":"surface_3d","expression":"Math.sin(Math.sqrt(x*x+y*y))","x_range":[-6,6],"y_range":[-6,6],"title":"3D Surface"}}[/VIZ_HINT]

• geometry — geometric constructions (geogebra_applet: Triangle|Circle|Pythagoras|Vectors|Transformations):
  [VIZ_HINT]{{"type":"geometry","geogebra_applet":"Triangle","title":"Triangle Geometry"}}[/VIZ_HINT]

• none — only if absolutely no meaningful visualization exists:
  [VIZ_HINT]{{"type":"none"}}[/VIZ_HINT]

Use JS Math syntax in expressions: Math.sin(x), Math.sqrt(x), x**2, Math.PI, Math.E."""

OBJECTIVES_PROMPT = """TOPIC: {topic}
SUBJECT AREA: {subject}
EDUCATION LEVEL: {level}
CURRICULUM STANDARD: {curriculum}

Generate a structured list of learning objectives for this mathematics topic.
Map each objective to a Bloom's Taxonomy level.

Return ONLY a valid JSON array (no markdown, no explanation) in this exact format:
[
  {{"objective": "Recall and state the definition of [topic]", "bloom": "Remember", "description": "Student can recite the formal definition from memory"}},
  {{"objective": "Explain [topic] in plain language", "bloom": "Understand", "description": "Student can describe the concept without formulas"}},
  {{"objective": "Apply [topic] to solve standard problems", "bloom": "Apply", "description": "Student can use the formula or method in routine problems"}},
  {{"objective": "Analyze how [topic] relates to [related concept]", "bloom": "Analyze", "description": "Student can compare, contrast, and break down the concept"}},
  {{"objective": "Evaluate which method is appropriate for a given problem", "bloom": "Evaluate", "description": "Student can judge and justify the best approach"}},
  {{"objective": "Create a proof or novel application of [topic]", "bloom": "Create", "description": "Student can construct original solutions or proofs"}}
]

Customize all objectives specifically for: {topic}. Return only the JSON array."""

# ── Visualization Gallery prompt ───────────────────────────────────────────────

VISUALIZE_PROMPT = """TOPIC: {topic}
SUBJECT: {subject}
EDUCATION LEVEL: {level}
CURRICULUM: {curriculum}

Generate exactly 3 different visualizations that each illuminate a DIFFERENT aspect of {topic}.
Return ONLY valid JSON (no markdown, no code fences):
{{
  "topic": "{topic}",
  "charts": [
    {{
      "title": "Descriptive chart title",
      "description": "2-3 sentences: what this visualization shows and how it builds intuition for {topic}.",
      "hint": {{"type":"function_graph","expressions":["Math.sin(x)"],"x_range":[-6.28,6.28],"title":"Example","labels":["sin(x)"]}}
    }}
  ]
}}

For each chart "hint" use the most appropriate type with REAL numeric values (never empty arrays []):
- function_graph (curves, functions): {{"type":"function_graph","expressions":["x**2","2*x"],"x_range":[-4,4],"title":"...","labels":["x²","2x"]}}
- statistics_chart bar (categorical/discrete data): {{"type":"statistics_chart","chart_type":"bar","title":"...","data":[68.27,95.45,99.73],"categories":["±1σ","±2σ","±3σ"]}}
- statistics_chart normal_dist (bell curve — data=[mean,std]): {{"type":"statistics_chart","chart_type":"normal_dist","title":"...","data":[0,1]}}
- surface_3d (multivariable z=f(x,y)): {{"type":"surface_3d","expression":"x**2+y**2","x_range":[-3,3],"y_range":[-3,3],"title":"..."}}
- geometry (geometric constructions): {{"type":"geometry","geogebra_applet":"Triangle","title":"..."}}

Use JS Math syntax: Math.sin(x), Math.sqrt(x), x**2, Math.PI, Math.abs(x).
Make each of the 3 charts show a genuinely different aspect (e.g., the main function, key values/properties, transformations or special cases)."""

# ── Simulation prompt ──────────────────────────────────────────────────────────

SIMULATE_PROMPT = """TOPIC: {topic}
SUBJECT: {subject}
EDUCATION LEVEL: {level}
CURRICULUM: {curriculum}

Create an interactive mathematical simulation for {topic} where students adjust parameters and instantly see how the graph changes.
Return ONLY valid JSON (no markdown, no code fences):
{{
  "topic": "{topic}",
  "expression": "JS-Math expression using x and parameter names (e.g. a*Math.sin(b*x+c))",
  "parameters": [
    {{"name": "a", "label": "Amplitude", "min": 0.1, "max": 5, "default": 1, "step": 0.1}},
    {{"name": "b", "label": "Frequency", "min": 0.1, "max": 5, "default": 1, "step": 0.1}}
  ],
  "x_range": [-10, 10],
  "y_label": "f(x)",
  "description": "2-3 sentences: what mathematical concept this simulation demonstrates and why it is useful.",
  "key_insight": "The single most important insight a student should discover by playing with this simulation.",
  "what_to_observe": [
    {{"parameter": "a", "effect": "Increasing a stretches the graph vertically, showing how amplitude scales the output range..."}}
  ]
}}

Requirements:
- 2-4 parameters that are mathematically meaningful for {topic}
- Each parameter name must appear verbatim in the expression
- Use JS Math syntax: Math.sin(x), Math.sqrt(x), x**2, Math.PI
- Choose x_range appropriate for the topic (e.g. [-10,10] for most algebra; [-6.28,6.28] for trig)"""

# ── Applications prompt ────────────────────────────────────────────────────────

APPLICATIONS_PROMPT = """TOPIC: {topic}
SUBJECT: {subject}
EDUCATION LEVEL: {level}
CURRICULUM: {curriculum}

Generate 5 compelling real-world applications of {topic} spanning different industries and careers.
Return ONLY valid JSON (no markdown, no code fences):
{{
  "topic": "{topic}",
  "applications": [
    {{
      "title": "Specific application name",
      "field": "Industry/field (Engineering, Medicine, Finance, Physics, Computer Science, Environment, Architecture, Music, Sports, Astronomy)",
      "icon": "one of: engineering, medicine, finance, physics, computer_science, environment, architecture, music, sports, astronomy",
      "problem": "The real-world problem this solves — 2 sentences, be specific.",
      "math_connection": "Exactly how {topic} is applied to solve it — mention the specific formula or method used.",
      "formula": "Key formula in LaTeX (empty string if not applicable)",
      "example": "A concrete example with real numbers: e.g. 'A bridge spanning 200m with load X kg/m² requires...'",
      "careers": ["Job Title 1", "Job Title 2", "Job Title 3"],
      "image_prompt": "Photorealistic scene of this application in action — describe the physical setting, equipment, people, and activity in 1-2 sentences. No text, no formulas, no diagrams. Professional photography."
    }}
  ]
}}

Make applications span 5 different fields. Be specific: real companies, real numbers, real scenarios.
For {level} students, choose applications that are motivating and relatable."""

LEVEL_LABELS = {
    "pre_k":             "Pre-K / Kindergarten (ages 3–6)",
    "middle_school":     "Middle School",
    "high_school":       "High School",
    "ap_ib":             "AP/IB Advanced High School",
    "community_college": "Community College",
    "university":        "University undergraduate",
    "graduate":          "Graduate / postgraduate",
    "professional":      "Professional / research level",
}

SUBLEVEL_LABELS = {
    # Pre-K sublevels
    "pre_k_3":      "Pre-K 3 (age ~3)",
    "pre_k_4":      "Pre-K 4 (age ~4)",
    "kindergarten": "Kindergarten (age ~5-6)",
    # Middle school
    "grade_6":  "Grade 6 (age ~11-12)",
    "grade_7":  "Grade 7 (age ~12-13)",
    "grade_8":  "Grade 8 (age ~13-14)",
    # High school
    "grade_9":  "Grade 9 (age ~14-15)",
    "grade_10": "Grade 10 (age ~15-16)",
    "grade_11": "Grade 11 (age ~16-17)",
    "grade_12": "Grade 12 (age ~17-18)",
    # University
    "year_1":   "Year 1 (first year)",
    "year_2":   "Year 2 (second year)",
    "year_3":   "Year 3 (third year)",
    "year_4":   "Year 4 (final year)",
}

DIFFICULTY_NOTES = {
    "pre_k":             (
        "Write for very young children (ages 3–6). "
        "Use the simplest possible language — short sentences, friendly tone, and lots of encouragement. "
        "Focus ONLY on: counting (1–20), basic shapes (circle, square, triangle, rectangle), "
        "simple patterns (AB, AAB), size comparisons (big/small, more/less), "
        "and early addition/subtraction using objects or fingers (e.g. '2 apples + 1 apple = ?'). "
        "NEVER use mathematical notation, symbols, fractions, or decimals. "
        "Use stories, animals, or everyday objects to illustrate every concept. "
        "Always celebrate curiosity and effort."
    ),
    "middle_school":     "Use simple language. Avoid jargon. Relate to everyday examples.",
    "high_school":       "Use standard notation. Assume basic algebra and geometry knowledge.",
    "ap_ib":             "Use rigorous notation. Reference relevant theorems by name.",
    "community_college": "Assume pre-calculus or calculus I background. Use clear notation with brief reminders of prerequisite concepts.",
    "university":        "Use university-level rigor. Reference theorems formally.",
    "graduate":          "Use research-level notation. Prove all claims rigorously.",
    "professional":      "Assume expert knowledge. Focus on efficiency and correctness.",
}


def _level_str(level: str, sublevel: Optional[str]) -> str:
    """Build a descriptive education-level string for the AI prompt."""
    base = LEVEL_LABELS.get(level, level.replace("_", " ").title())
    if sublevel:
        sl = SUBLEVEL_LABELS.get(sublevel, sublevel.replace("_", " ").title())
        return f"{base} — {sl}"
    return base


CURRICULUM_CONTEXT = {
    "general":   "General mathematics curriculum.",
    "waec":      "West African Examinations Council (WAEC) syllabus. Use WAEC-style question formatting and mark-scheme language.",
    "cambridge":  "Cambridge International AS & A Level / IGCSE curriculum. Follow Cambridge notation, mark-scheme conventions, and command words (show, prove, hence, etc.).",
    "ib":         "International Baccalaureate (IB) Mathematics — Applications & Interpretation or Analysis & Approaches. Use IB command terms (find, determine, justify, etc.) and GDC context where relevant.",
    "ap":         "College Board AP Mathematics (AP Calculus AB/BC, AP Statistics, AP Precalculus). Follow College Board format and free-response conventions.",
    "gcse":       "UK GCSE Mathematics. Target grade 1–9 range; use Ofqual-approved methods and show systematic working expected in GCSE mark schemes.",
    "sat":        "SAT / ACT Mathematics test preparation. Use multiple-choice and grid-in formats where applicable; focus on time-efficient strategies.",
    "abet":       "ABET engineering mathematics standards. Frame solutions in engineering contexts; use SI units and reference standard engineering theorems.",
    "tvet":       "Technical and Vocational Education and Training (TVET) applied mathematics. Emphasise real-world trade/technical applications.",
}

PRACTICE_PROMPT = """Generate {count} {difficulty} practice problems for:

SUBJECT: {subject}
TOPIC (optional): {topic}
EDUCATION LEVEL: {level}
CURRICULUM STANDARD: {curriculum}

CRITICAL FORMATTING RULES:
- Use $...$ for inline math (e.g. $x^2 + 1$)
- Use $$...$$ on its own line for display/block math (e.g. $$\\int x^2\\,dx$$)
- NEVER use square brackets [ ] around math expressions
- NEVER use \\[...\\] notation — use $$...$$ only
- Do NOT output HTML tags like <details> or <summary>

Format each problem exactly as shown below (replace angle-bracket placeholders with real content):

---
### Problem {n}

<Write the problem statement here. Use $...$ for inline math and $$...$$ for display math.>

**Hint:** <Optional hint — only include if difficulty is Hard or Expert. Omit this line otherwise.>

**▶ Show Solution**

<Write the complete step-by-step solution here. Use $...$ for inline math and $$...$$ for display math.>

**Answer:** $<final answer>$

---

Problems should vary in style and approach. Ensure all {count} problems are distinct."""

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SolveRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    problem: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    style: str = "detailed"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class ExploreRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    example_count: int = 3
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class PracticeRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    subject: str = "algebra"
    topic: Optional[str] = None
    level: str = "high_school"
    sublevel: Optional[str] = None
    count: int = 5
    difficulty: str = "medium"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


# ── Visualization hint extractor ──────────────────────────────────────────────

_VIZ_HINT_RE = _re.compile(r'\[VIZ_HINT\]\s*(\{.*?\})\s*\[/VIZ_HINT\]', _re.DOTALL)
_VIZ_TYPES   = {"function_graph", "parametric", "statistics_chart", "surface_3d",
                "geometry", "number_line", "none"}


def _find_balanced_json(text: str, start: int) -> Optional[str]:
    """Return the smallest balanced {...} string starting at `start`, or None."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _extract_viz_hint(text: str) -> tuple[str, Optional[dict]]:
    """
    Strip visualization hint from output text; return (clean_text, hint_dict).

    Handles two cases:
    1. AI used the [VIZ_HINT]...[/VIZ_HINT] delimiters correctly.
    2. AI forgot the delimiters and output bare JSON (most common failure mode).
    """
    # ── Case 1: delimited block ───────────────────────────────────────────────
    m = _VIZ_HINT_RE.search(text)
    if m:
        try:
            hint = _json.loads(m.group(1))
        except Exception:
            hint = None
        cleaned = (text[:m.start()].rstrip() + "\n" + text[m.end():].lstrip()).strip()
        return cleaned, hint

    # ── Case 2: bare JSON blob (AI omitted delimiters) ────────────────────────
    # Search backwards for the last {"type": occurrence so we find the hint, not
    # an inline example that the AI may have written earlier in the explanation.
    for marker in ('{"type":', '{ "type":'):
        idx = text.rfind(marker)
        if idx == -1:
            continue
        json_str = _find_balanced_json(text, idx)
        if json_str is None:
            continue
        try:
            hint = _json.loads(json_str)
        except Exception:
            continue
        if not isinstance(hint, dict) or hint.get("type") not in _VIZ_TYPES:
            continue
        end = idx + len(json_str)
        cleaned = (text[:idx].rstrip() + text[end:].lstrip()).strip()
        return cleaned, hint

    return text, None


class MathSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
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
    extra: Optional[Dict] = None
    created_at: str


class TheoryRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    theory_level: str = "intermediate"   # beginner | intermediate | advanced | university
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: Optional[int] = None


class ObjectivesRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"


class VisualizeRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"


class SimulateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"


class ApplicationsRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    image_model: str = "gpt-image-1"


class ReformulateRequest(BaseModel):
    raw_input: str
    subject: str = "general"
    level: str = "high_school"
    curriculum: str = "general"
    context: str = "general"  # theory | visualization | simulation | applications | solve


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    image_model: str = "gpt-image-1"   # gpt-image-1 | dall-e-3


SCENARIO_PROMPT = """You are an expert mathematics educator creating immersive real-world scenarios.

Topic: {topic}
Subject: {subject}
Level: {level}
Curriculum: {curriculum}

Generate a compelling two-part scenario that shows how this mathematics solves a real engineering or scientific problem.

Return ONLY a JSON object, no markdown fences, no explanation:
{{
  "problem_prompt": "Short scene-setting title (5-8 words, e.g. 'Bridge Cable Snaps Under Ice Load')",
  "problem_description": "3-5 sentence vivid narrative of the real-world problem or failure. Describe the physical situation, the consequences, and exactly WHY mathematics is needed to resolve it. Use concrete numbers, measurements, and technical details appropriate for {level} level.",
  "problem_equations": ["key governing equation for the problem in valid LaTeX", "second relevant equation or constraint in LaTeX (omit if only one applies)"],
  "solution_prompt": "Short outcome title (5-8 words, e.g. 'Structural Redesign Prevents Catastrophic Collapse')",
  "solution_description": "3-5 sentence narrative of how the mathematics solves the problem. Describe the key equations or concepts applied, the quantitative result achieved, and the real-world impact. Make the mathematical connection explicit and inspiring.",
  "solution_equations": ["primary mathematical solution or formula applied in valid LaTeX", "quantitative result or verification equation in LaTeX (omit if only one applies)"]
}}

Rules for equations:
- Write valid LaTeX using standard notation: \\frac{{a}}{{b}}, \\int_0^t, \\sum_{{i=1}}^n, subscripts x_0, superscripts e^{{-t}}.
- 1-2 equations per side that directly model the {topic} problem and solution.
- Symbols must be mathematically correct — no invented constants.
- Do NOT wrap the entire equation in \\text{{}}.
- Each equation is a plain LaTeX string (no $$, no \\[, no \\begin{{equation}})."""


class PatchSessionRequest(BaseModel):
    is_saved: str          # "true" or "false"
    saved_title: Optional[str] = None


class ProgressOut(BaseModel):
    total_sessions: int
    sessions_this_week: int
    streak_days: int
    saved_count: int
    subjects_practiced: List[str]
    recent_sessions: List[MathSessionOut]
    all_sessions: List[MathSessionOut]
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
    model_map = ANTHROPIC_MODEL_MAP
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


async def call_gemini(system: str, prompt: str, model: str, max_tokens: int) -> tuple[str, int, int]:
    if not GEMINI_AVAILABLE or not genai:
        raise HTTPException(500, "Google Generative AI package not installed.")
    api_key = getattr(settings, "GOOGLE_API_KEY", "") or ""
    if not api_key:
        raise HTTPException(500, "GOOGLE_API_KEY not configured.")
    gemini_model_id = GEMINI_MODEL_MAP.get(model, "gemini-1.5-pro")
    def _sync_call():
        genai.configure(api_key=api_key)
        gm = genai.GenerativeModel(model_name=gemini_model_id, system_instruction=system)
        resp = gm.generate_content(prompt)
        return resp.text or ""
    text = await _asyncio.to_thread(_sync_call)
    return text, 0, 0


async def dispatch(system: str, prompt: str, model: str, max_tokens: int) -> tuple[str, int, int]:
    provider = MODEL_PROVIDER_MAP.get(model, "openai")
    if provider == "google":
        google_key = getattr(settings, "GOOGLE_API_KEY", "") or ""
        if not google_key or not GEMINI_AVAILABLE:
            logger.warning("[dispatch] GOOGLE_API_KEY not set — falling back to gpt-4o for model %s", model)
            return await call_openai(system, prompt, "gpt-4o", max_tokens)
        return await call_gemini(system, prompt, model, max_tokens)
    if provider == "anthropic":
        anthropic_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
        if not anthropic_key or not ANTHROPIC_AVAILABLE:
            logger.warning("[dispatch] ANTHROPIC_API_KEY not set — falling back to gpt-4o for model %s", model)
            return await call_openai(system, prompt, "gpt-4o", max_tokens)
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
        extra=s.extra if s.extra else None,
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
    steps_instruction = {
        "quick":    "## Solution\n### Step 1: [title]\n... (3-5 steps)",
        "detailed": "## Solution\n### Step 1: [title]\n[explanation]\n$$[math]$$\n### Step 2: ...\n(continue for ALL steps — do not skip any)",
        "proof":    "## Proof\n**Theorem:** [state theorem]\n**Proof:**\n[rigorous step-by-step proof]",
    }

    max_tokens = min(max(req.max_tokens or 3500, 500), 7000)
    subject_enum = MathSubject.other
    for s in MathSubject:
        if s.value == req.subject:
            subject_enum = s
            break

    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    level_full = _level_str(req.level, req.sublevel)
    prompt = SOLVE_PROMPT.format(
        problem=req.problem,
        subject=req.subject.replace("_", " ").title(),
        level=level_full,
        style=req.style.title(),
        curriculum=curriculum_ctx,
        steps_instruction=steps_instruction.get(req.style, steps_instruction["detailed"]),
        difficulty_note=f"TONE: {DIFFICULTY_NOTES.get(req.level, '')}",
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(SOLVE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        logger.error(f"[solve] {type(e).__name__}: {e}", exc_info=True)
        raise _ai_http_error("solve", e)

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

    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = EXPLORE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=_level_str(req.level, req.sublevel),
        example_count=req.example_count,
        curriculum=curriculum_ctx,
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(EXPLORE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        raise _ai_http_error("explore", e)

    duration = int(time.time() * 1000) - start_ms
    output, viz_hint = _extract_viz_hint(output)
    extra: dict = {"visualization_hints": viz_hint} if viz_hint else {}

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
        extra=extra,
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

    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = PRACTICE_PROMPT.format(
        count=req.count,
        difficulty=req.difficulty.title(),
        subject=req.subject.replace("_", " ").title(),
        topic=req.topic or "any topic in this subject",
        level=_level_str(req.level, req.sublevel),
        curriculum=curriculum_ctx,
        n="{n}",
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(PRACTICE_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        raise _ai_http_error("practice", e)

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


@router.post("/theory", response_model=MathSessionOut, status_code=status.HTTP_201_CREATED)
async def theory(
    req: TheoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Theory Intelligence™ — rigorous lesson with derivation, proof, formulas, and examples."""
    THEORY_LEVEL_DESC = {
        "beginner":     "Beginner — use plain language, intuitive proofs, minimal jargon. Prioritise understanding over rigour.",
        "intermediate": "Intermediate — use standard mathematical notation. Show all steps. Reference theorems by name.",
        "advanced":     "Advanced — use rigorous notation. Formal proofs. Reference related theorems and corollaries.",
        "university":   "University / Graduate — research-level rigour. Use abstract notation where appropriate. Cite standard references if relevant.",
    }

    max_tokens = min(max(req.max_tokens or 5000, 1000), 7000)
    subject_enum = MathSubject.other
    for s in MathSubject:
        if s.value == req.subject:
            subject_enum = s
            break

    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    level_full = _level_str(req.level, req.sublevel)
    theory_desc = THEORY_LEVEL_DESC.get(req.theory_level, THEORY_LEVEL_DESC["intermediate"])

    prompt = THEORY_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=level_full,
        theory_level=theory_desc,
        curriculum=curriculum_ctx,
    )

    start_ms = int(time.time() * 1000)
    try:
        output, prompt_tok, completion_tok = await dispatch(THEORY_SYSTEM, prompt, req.model_name, max_tokens)
    except Exception as e:
        logger.error(f"[theory] {type(e).__name__}: {e}", exc_info=True)
        raise _ai_http_error("theory", e)

    duration = int(time.time() * 1000) - start_ms
    output, viz_hint = _extract_viz_hint(output)
    theory_extra: dict = {
        "theory_level": req.theory_level,
        "curriculum": req.curriculum,
    }
    if viz_hint:
        theory_extra["visualization_hints"] = viz_hint

    session = MathSession(
        user_id=current_user.id,
        session_type=SessionType.theory,
        subject=subject_enum,
        level=req.level,
        model_name=req.model_name,
        input_text=req.topic,
        output_text=output,
        prompt_tokens=prompt_tok,
        completion_tokens=completion_tok,
        duration_ms=duration,
        extra=theory_extra,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _session_out(session)


@router.post("/objectives", status_code=200)
async def objectives(
    req: ObjectivesRequest,
    current_user: User = Depends(get_current_user),
):
    """Learning Objectives — returns Bloom's taxonomy-tagged objectives for a topic as JSON."""
    import json

    prompt = OBJECTIVES_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=LEVEL_LABELS.get(req.level, req.level.replace("_", " ").title()),
        curriculum=CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"]),
    )

    try:
        raw, _, _ = await dispatch(
            "You are a JSON generator. Return only valid JSON arrays. No markdown, no explanation.",
            prompt,
            req.model_name,
            800,
        )
        # Strip potential markdown code fences
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
        objectives_list = json.loads(cleaned)
    except Exception as e:
        logger.error(f"[objectives] {type(e).__name__}: {e}", exc_info=True)
        # Return a sensible fallback so the UI doesn't crash
        objectives_list = [
            {"objective": f"Understand the core concepts of {req.topic}", "bloom": "Understand", "description": ""},
            {"objective": f"Apply {req.topic} to solve problems", "bloom": "Apply", "description": ""},
            {"objective": f"Analyse relationships involving {req.topic}", "bloom": "Analyze", "description": ""},
        ]

    return {"topic": req.topic, "objectives": objectives_list}


def _parse_json_response(raw: str) -> dict:
    """Strip markdown fences and parse JSON.

    Attempt 1 — direct parse.
    Attempt 2 — repair unescaped LaTeX backslashes then retry.
    LLMs frequently output LaTeX like \\frac{} instead of JSON-safe \\\\frac{}.
    Raises ValueError on failure.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
    # Strip trailing commas before closing braces (common LLM mistake)
    cleaned = _re.sub(r",\s*([}\]])", r"\1", cleaned)
    # Attempt 1: direct parse
    try:
        return _json.loads(cleaned)
    except _json.JSONDecodeError:
        pass
    # Attempt 2: fix unescaped backslashes (LaTeX in JSON)
    # Walk char-by-char: keep \\ and \" as-is; double all other bare backslashes.
    repaired = []
    i = 0
    while i < len(cleaned):
        ch = cleaned[i]
        if ch == "\\" and i + 1 < len(cleaned):
            nxt = cleaned[i + 1]
            if nxt in ('"', "\\"):
                # Valid JSON escape — keep both chars
                repaired.append(ch)
                repaired.append(nxt)
                i += 2
            else:
                # Bare LaTeX backslash — double it so JSON can parse it
                repaired.append("\\\\")
                i += 1
        else:
            repaired.append(ch)
            i += 1
    fixed = "".join(repaired)
    try:
        return _json.loads(fixed)
    except _json.JSONDecodeError:
        pass
    raise ValueError(f"Could not parse JSON response (len={len(cleaned)}): {cleaned[:300]}")



@router.post("/visualize", status_code=status.HTTP_200_OK)
async def visualize(
    req: VisualizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Visualization Gallery — generate 3 charts illuminating different aspects of a topic."""
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = VISUALIZE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=LEVEL_LABELS.get(req.level, req.level.replace("_", " ").title()),
        curriculum=curriculum_ctx,
    )
    try:
        raw, _, _ = await dispatch(
            "You are a JSON generator for a math visualization system. Return only valid JSON. No markdown.",
            prompt, req.model_name, 1500,
        )
        result = _parse_json_response(raw)
    except Exception as e:
        logger.error(f"[visualize] {type(e).__name__}: {e}", exc_info=True)
        # Graceful fallback
        result = {
            "topic": req.topic,
            "charts": [
                {
                    "title": req.topic,
                    "description": f"Interactive graph of {req.topic}.",
                    "hint": {"type": "function_graph", "expressions": ["x**2"], "x_range": [-5, 5],
                             "title": req.topic, "labels": ["f(x)"]},
                }
            ],
        }
    return result


@router.post("/simulate", status_code=status.HTTP_200_OK)
async def simulate(
    req: SimulateRequest,
    current_user: User = Depends(get_current_user),
):
    """Simulation Intelligence™ — interactive parameter-based simulation for a topic."""
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = SIMULATE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=LEVEL_LABELS.get(req.level, req.level.replace("_", " ").title()),
        curriculum=curriculum_ctx,
    )
    try:
        raw, _, _ = await dispatch(
            "You are a JSON generator for an interactive math simulation system. Return only valid JSON. No markdown.",
            prompt, req.model_name, 1000,
        )
        result = _parse_json_response(raw)
    except Exception as e:
        logger.error(f"[simulate] {type(e).__name__}: {e}", exc_info=True)
        result = {
            "topic": req.topic,
            "expression": "a*Math.sin(b*x)",
            "parameters": [
                {"name": "a", "label": "Amplitude", "min": 0.1, "max": 5, "default": 1, "step": 0.1},
                {"name": "b", "label": "Frequency", "min": 0.1, "max": 5, "default": 1, "step": 0.1},
            ],
            "x_range": [-10, 10],
            "y_label": "f(x)",
            "description": f"Interactive simulation for {req.topic}.",
            "key_insight": "Observe how changing each parameter transforms the graph.",
            "what_to_observe": [
                {"parameter": "a", "effect": "Changes the vertical scale (amplitude)."},
                {"parameter": "b", "effect": "Changes the horizontal compression (frequency)."},
            ],
        }
    return result


@router.post("/applications", status_code=status.HTTP_200_OK)
async def applications(
    req: ApplicationsRequest,
    current_user: User = Depends(get_current_user),
):
    """Applications Intelligence™ — real-world applications + gpt-image-1 images for each."""
    import asyncio
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = APPLICATIONS_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=LEVEL_LABELS.get(req.level, req.level.replace("_", " ").title()),
        curriculum=curriculum_ctx,
    )
    try:
        raw, _, _ = await dispatch(
            "You are a JSON generator for a math applications system. Return only valid JSON. No markdown.",
            prompt, req.model_name, 2000,
        )
        result = _parse_json_response(raw)
    except Exception as e:
        logger.error(f"[applications] {type(e).__name__}: {e}", exc_info=True)
        result = {
            "topic": req.topic,
            "applications": [
                {
                    "title": f"{req.topic} in Engineering",
                    "field": "Engineering",
                    "icon": "engineering",
                    "problem": f"Engineers apply {req.topic} to design and analyze systems.",
                    "math_connection": f"{req.topic} provides the mathematical foundation.",
                    "formula": "",
                    "example": "See your textbook for concrete examples.",
                    "careers": ["Engineer", "Scientist", "Analyst"],
                    "image_prompt": f"Photorealistic engineering lab with engineers working on {req.topic} applications",
                }
            ],
        }

    # Generate one photorealistic image per application (parallel)
    img_model = req.image_model or "gpt-image-1"
    app_list = result.get("applications", [])

    async def gen_app_image(image_prompt: str, label: str = "") -> str:
        """Return data URI or empty string on failure."""
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)
            if img_model == "gpt-image-1":
                resp = await client.images.generate(
                    model="gpt-image-1",
                    prompt=image_prompt,
                    size="1024x1024",
                    n=1,
                )
            else:
                resp = await client.images.generate(
                    model=img_model,
                    prompt=image_prompt,
                    size="1024x1024",
                    quality="standard",
                    n=1,
                    response_format="b64_json",
                )
            b64 = resp.data[0].b64_json
            if b64:
                logger.info("[applications] image OK for %s (%d chars)", label, len(b64))
                return f"data:image/png;base64,{b64}"
            url = resp.data[0].url or ""
            if url:
                import httpx, base64 as _b64
                async with httpx.AsyncClient(timeout=20.0) as hc:
                    img_bytes = (await hc.get(url)).content
                return f"data:image/png;base64,{_b64.b64encode(img_bytes).decode()}"
            return ""
        except Exception as img_err:
            logger.warning("[applications] image failed for %s: %s: %s",
                           label, type(img_err).__name__, img_err)
            return ""

    if OPENAI_AVAILABLE and getattr(settings, "OPENAI_API_KEY", ""):
        image_urls = await asyncio.gather(*[
            gen_app_image(
                app.get("image_prompt", f"Photorealistic professional scene: {app.get('title', 'engineering application')}"),
                app.get("title", f"app_{i}"),
            )
            for i, app in enumerate(app_list)
        ])
        for app, url in zip(app_list, image_urls):
            app["image_url"] = url
            app.pop("image_prompt", None)   # don't expose raw prompt to frontend
    else:
        for app in app_list:
            app["image_url"] = ""
            app.pop("image_prompt", None)

    result["applications"] = app_list
    return result


@router.post("/reformulate", status_code=status.HTTP_200_OK)
async def reformulate(
    req: ReformulateRequest,
    current_user: User = Depends(get_current_user),
):
    """Return 3 AI-improved reformulations of the user's raw topic/problem input."""
    context_hints = {
        "theory":         "a theory lesson covering formal definitions, derivations, proofs, and historical context",
        "visualization":  "mathematical visualization using graphs, charts, 3D surfaces, or geometric constructions",
        "simulation":     "an interactive mathematical simulation with adjustable parameters and real-time feedback",
        "applications":   "real-world engineering or scientific applications of mathematics",
        "solve":          "a precisely stated, solvable mathematics problem with clear constraints",
    }
    hint = context_hints.get(req.context, "a mathematics exercise")
    system = "You are a mathematics education expert. Your job is to improve vague or incomplete topic inputs into clear, specific, well-scoped formulations."
    prompt = f"""The user typed this rough input for {hint}:
"{req.raw_input}"

Subject: {req.subject.replace('_', ' ')}
Education level: {req.level.replace('_', ' ')}
Curriculum: {req.curriculum}

Generate exactly 3 distinct, well-formulated reformulations that are specific, pedagogically clear, and appropriate for the context and level.
Return ONLY a valid JSON array of exactly 3 strings, with no explanation, no markdown, no extra text:
["reformulation 1", "reformulation 2", "reformulation 3"]"""

    try:
        raw, _, _ = await dispatch(system, prompt, "gpt-4o-mini", 300)
        import json as _json, re as _re
        m = _re.search(r'\[.*?\]', raw, _re.DOTALL)
        suggestions = _json.loads(m.group()) if m else [req.raw_input]
        return {"suggestions": suggestions[:3]}
    except Exception as e:
        logger.error(f"[reformulate] {e}", exc_info=True)
        return {"suggestions": []}


@router.post("/scenario", status_code=status.HTTP_200_OK)
async def scenario(
    req: ScenarioRequest,
    current_user: User = Depends(get_current_user),
):
    """Scenario Intelligence™ — rich text scenario + gpt-image-1 images (b64_json)."""
    import asyncio

    if not OPENAI_AVAILABLE or not getattr(settings, "OPENAI_API_KEY", ""):
        raise HTTPException(500, "OpenAI not configured. Set OPENAI_API_KEY.")

    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    prompt = SCENARIO_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=LEVEL_LABELS.get(req.level, req.level.replace("_", " ").title()),
        curriculum=curriculum_ctx,
    )

    # Step 1 — LLM generates scenario text + image prompts
    try:
        raw, _, _ = await dispatch(
            "You are a JSON generator. Return only valid JSON with no markdown fences.",
            prompt, req.model_name, 1500,
        )
        data = _parse_json_response(raw)
        problem_prompt      = data.get("problem_prompt", "")
        problem_description = data.get("problem_description", "")
        problem_equations   = data.get("problem_equations", [])
        solution_prompt     = data.get("solution_prompt", "")
        solution_description = data.get("solution_description", "")
        solution_equations  = data.get("solution_equations", [])
    except Exception as e:
        logger.error("[scenario] text generation failed: %s", e, exc_info=True)
        raise _ai_http_error("scenario", e)

    # Step 2 — Generate images; gpt-image-1 always returns b64, dall-e-3 needs response_format
    img_model = req.image_model or "gpt-image-1"

    async def gen_image_b64(image_prompt: str, label: str = "") -> str:
        """Returns base64-encoded PNG string, or empty string on any failure."""
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=120.0)
            if img_model == "gpt-image-1":
                # gpt-image-1 does NOT accept response_format; returns b64_json by default
                resp = await client.images.generate(
                    model="gpt-image-1",
                    prompt=image_prompt,
                    size="1024x1024",
                    n=1,
                )
            else:
                # dall-e-2 / dall-e-3 support response_format
                resp = await client.images.generate(
                    model=img_model,
                    prompt=image_prompt,
                    size="1024x1024",
                    quality="standard",
                    n=1,
                    response_format="b64_json",
                )
            b64 = resp.data[0].b64_json
            if b64:
                logger.info("[scenario] %s image OK (%d chars)", label or img_model, len(b64))
                return b64
            # Some variants return a URL instead — fetch and base64-encode it
            import httpx, base64 as _b64
            url = resp.data[0].url or ""
            if url:
                async with httpx.AsyncClient(timeout=30.0) as hc:
                    img_bytes = (await hc.get(url)).content
                logger.info("[scenario] %s image fetched from URL (%d bytes)", label or img_model, len(img_bytes))
                return _b64.b64encode(img_bytes).decode()
            logger.error("[scenario] %s: response had neither b64_json nor url", label or img_model)
            return ""
        except Exception as img_err:
            logger.error("[scenario] %s image generation FAILED: %s: %s",
                         label or img_model, type(img_err).__name__, img_err, exc_info=True)
            return ""

    problem_b64, solution_b64 = await asyncio.gather(
        gen_image_b64(problem_prompt,  "problem"),
        gen_image_b64(solution_prompt, "solution"),
    )
    if problem_b64 or solution_b64:
        logger.info("[scenario] images ready — problem=%s solution=%s",
                    "OK" if problem_b64 else "MISSING",
                    "OK" if solution_b64 else "MISSING")
    else:
        logger.warning("[scenario] both images missing — text-only response")

    return {
        "topic": req.topic,
        "problem_prompt": problem_prompt,
        "problem_description": problem_description,
        "problem_equations": problem_equations if isinstance(problem_equations, list) else [],
        "problem_image_url": f"data:image/png;base64,{problem_b64}" if problem_b64 else "",
        "solution_prompt": solution_prompt,
        "solution_description": solution_description,
        "solution_equations": solution_equations if isinstance(solution_equations, list) else [],
        "solution_image_url": f"data:image/png;base64,{solution_b64}" if solution_b64 else "",
    }


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


@router.get("/saved", response_model=List[MathSessionOut])
async def saved_sessions(
    session_type: Optional[str] = None,
    subject: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all bookmarked sessions for the current user."""
    q = select(MathSession).where(
        MathSession.user_id == current_user.id,
        MathSession.is_saved == "true",
    ).order_by(desc(MathSession.created_at)).limit(limit)

    if session_type:
        for st in SessionType:
            if st.value == session_type:
                q = q.where(MathSession.session_type == st)
                break

    if subject:
        for s in MathSubject:
            if s.value == subject:
                q = q.where(MathSession.subject == s)
                break

    result = await db.execute(q)
    return [_session_out(r) for r in result.scalars().all()]


@router.patch("/sessions/{session_id}", response_model=MathSessionOut)
async def patch_session(
    session_id: str,
    req: PatchSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or unsave a session (bookmark it with an optional title)."""
    result = await db.execute(
        select(MathSession).where(
            MathSession.id == session_id,
            MathSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    session.is_saved = req.is_saved
    if req.saved_title is not None:
        session.saved_title = req.saved_title
    await db.commit()
    await db.refresh(session)
    return _session_out(session)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a session."""
    result = await db.execute(
        select(MathSession).where(
            MathSession.id == session_id,
            MathSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.get("/progress", response_model=ProgressOut)
async def progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta, timezone, date as date_type

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

    # ── Streak calculation ──────────────────────────────────────────────────────
    dates_q = await db.execute(
        select(func.date(MathSession.created_at))
        .where(MathSession.user_id == current_user.id)
        .distinct()
    )
    session_dates = {row[0] for row in dates_q.fetchall()}
    streak = 0
    today = date_type.today()
    # Start from today; if no session today, start from yesterday
    check = today if today in session_dates else today - timedelta(days=1)
    while check in session_dates:
        streak += 1
        check -= timedelta(days=1)

    # ── Saved count ─────────────────────────────────────────────────────────────
    saved_count = (await db.execute(
        select(func.count(MathSession.id)).where(
            MathSession.user_id == current_user.id,
            MathSession.is_saved == "true",
        )
    )).scalar() or 0

    # ── Recent sessions (10 for dashboard widget) ───────────────────────────────
    recent_q = await db.execute(
        select(MathSession).where(MathSession.user_id == current_user.id)
        .order_by(desc(MathSession.created_at)).limit(10)
    )
    recent = [_session_out(r) for r in recent_q.scalars().all()]

    # ── All sessions (50 for full history view) ──────────────────────────────────
    all_q = await db.execute(
        select(MathSession).where(MathSession.user_id == current_user.id)
        .order_by(desc(MathSession.created_at)).limit(50)
    )
    all_sessions = [_session_out(r) for r in all_q.scalars().all()]

    # ── Subjects ─────────────────────────────────────────────────────────────────
    subj_q = await db.execute(
        select(MathSession.subject).where(MathSession.user_id == current_user.id).distinct()
    )
    subjects = [r[0].value if r[0] else "other" for r in subj_q.fetchall()]

    # ── Topic progress ────────────────────────────────────────────────────────────
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
        streak_days=streak,
        saved_count=saved_count,
        subjects_practiced=subjects,
        recent_sessions=recent,
        all_sessions=all_sessions,
        topic_progress=topic_progress,
    )


@router.get("/parent-summary")
async def parent_summary(
    learner_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a child/student activity summary for parents and teachers.
    If learner_email is provided (admin/teacher only), returns that user's data.
    Otherwise returns the current user's data (useful for self-overview).
    """
    from datetime import timedelta, timezone, datetime as dt

    target_user = current_user
    if learner_email and current_user.role.value in ("admin", "teacher", "parent"):
        result = await db.execute(select(User).where(User.email == learner_email))
        found = result.scalar_one_or_none()
        if found:
            target_user = found

    uid = target_user.id
    now = dt.now(timezone.utc)

    # Total + last 7 days
    total = (await db.execute(
        select(func.count(MathSession.id)).where(MathSession.user_id == uid)
    )).scalar() or 0

    week_count = (await db.execute(
        select(func.count(MathSession.id)).where(
            MathSession.user_id == uid,
            MathSession.created_at >= now - timedelta(days=7),
        )
    )).scalar() or 0

    # Subjects practiced
    subj_q = await db.execute(
        select(MathSession.subject, func.count(MathSession.id).label("cnt"))
        .where(MathSession.user_id == uid)
        .group_by(MathSession.subject)
        .order_by(desc("cnt"))
    )
    subject_counts = [{"subject": r[0].value if r[0] else "other", "count": r[1]} for r in subj_q.fetchall()]

    # Recent 20 sessions
    recent_q = await db.execute(
        select(MathSession).where(MathSession.user_id == uid)
        .order_by(desc(MathSession.created_at)).limit(20)
    )
    recent = [_session_out(r) for r in recent_q.scalars().all()]

    # Daily activity — last 14 days
    daily = []
    for d in range(13, -1, -1):
        day_start = (now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        cnt = (await db.execute(
            select(func.count(MathSession.id)).where(
                MathSession.user_id == uid,
                MathSession.created_at >= day_start,
                MathSession.created_at <  day_end,
            )
        )).scalar() or 0
        daily.append({"date": day_start.strftime("%b %d"), "sessions": cnt})

    return {
        "learner_name": target_user.full_name or target_user.email,
        "learner_email": target_user.email,
        "learner_level": target_user.level.value if hasattr(target_user.level, "value") else str(target_user.level),
        "total_sessions": total,
        "sessions_this_week": week_count,
        "subject_breakdown": subject_counts,
        "daily_activity": daily,
        "recent_sessions": recent,
        "member_since": target_user.created_at.isoformat() if target_user.created_at else "",
    }


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