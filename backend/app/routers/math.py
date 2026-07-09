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
      "careers": ["Job Title 1", "Job Title 2", "Job Title 3"]
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

Format each problem as:

---
### Problem {n}
[Problem statement using LaTeX]

**Hint:** [Optional hint — only include if difficulty is beginner/easy; omit for hard/expert]

**Answer:** [Final answer only — no working]

---

Generate exactly {count} problems. Number them 1 through {count}.
Vary problem types within the topic. Use LaTeX for all mathematics."""

SCENARIO_SYSTEM = """You are an expert mathematics educator specialising in real-world applications.
Your role: create vivid, engaging real-world scenarios that motivate a mathematics concept.
FORMATTING RULES:
- Use LaTeX for ALL mathematical expressions ($...$ inline, $$...$$ display)
- Use ## for section headings
- Lead with story/narrative before introducing any mathematics
- Show the full mathematical model, then solve it step by step"""

SCENARIO_PROMPT = """Create a rich real-world scenario that teaches the following concept:

TOPIC: {topic}
SUBJECT: {subject}
EDUCATION LEVEL: {level}
CURRICULUM: {curriculum}

Structure your response exactly as follows:

## The Scenario
[2-4 sentence narrative story that motivates the mathematics — profession, problem, tension]

## The Mathematics
[Introduce variables and set up the mathematical model using LaTeX]
[Solve completely step-by-step]

## The Result
[Plain-English interpretation of the answer in the story context]

## Try It Yourself
[One follow-up problem that changes a parameter — with answer]

## Key Insight
[1-2 sentence explanation of what this scenario reveals about the mathematics]"""

REFORMULATE_PROMPT = """You are an expert mathematics curriculum designer.

Given this raw input from a student or teacher:
INPUT: {raw_input}

SUBJECT AREA: {subject}
EDUCATION LEVEL: {level}
CURRICULUM: {curriculum}
CONTEXT (if any): {context}

Generate 3 well-formed, specific mathematics questions or topics that the user probably means.
Each suggestion should be precise enough to generate a complete lesson or solution.

Respond with ONLY a JSON array of 3 strings, no other text:
["suggestion 1", "suggestion 2", "suggestion 3"]"""


# ── Model maps ────────────────────────────────────────────────────────────────

ANTHROPIC_MODEL_MAP = {
    "claude-sonnet-4":   "claude-sonnet-4-5",
    "claude-haiku-4":    "claude-haiku-4-5",
    "claude-opus-4":     "claude-opus-4-5",
    "claude-3-5-sonnet": "claude-sonnet-4-6",
}

GEMINI_MODEL_MAP = {
    "gemini-1.5-pro":   "gemini-1.5-pro",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-pro":       "gemini-1.5-pro",
}

# Add Gemini to provider map
MODEL_PROVIDER_MAP.update({
    "gemini-1.5-pro":   "google",
    "gemini-1.5-flash": "google",
})


# ── Graceful Gemini import ────────────────────────────────────────────────────

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    GEMINI_AVAILABLE = False


# ── Core AI caller ────────────────────────────────────────────────────────────

import asyncio

async def call_ai(system: str, user: str, model: str = "gpt-4o", max_tokens: int = 2000) -> tuple[str, int, int]:
    """
    Unified AI call. Returns (response_text, prompt_tokens, completion_tokens).
    Supports OpenAI, Anthropic Claude, and Google Gemini.
    """
    provider = MODEL_PROVIDER_MAP.get(model, "openai")

    # ── Google Gemini ──────────────────────────────────────────────────────
    if provider == "google":
        if not GEMINI_AVAILABLE:
            raise HTTPException(500, "Google Generative AI package not installed.")
        api_key = getattr(settings, "GOOGLE_API_KEY", "") or ""
        if not api_key:
            raise HTTPException(500, "GOOGLE_API_KEY not configured.")
        gemini_model_id = GEMINI_MODEL_MAP.get(model, "gemini-1.5-pro")
        def _gemini_call():
            genai.configure(api_key=api_key)
            gm = genai.GenerativeModel(
                model_name=gemini_model_id,
                system_instruction=system,
            )
            resp = gm.generate_content(user)
            return resp.text or ""
        text = await asyncio.to_thread(_gemini_call)
        return text, 0, 0

    # ── Anthropic Claude ───────────────────────────────────────────────────
    if provider == "anthropic":
        if not ANTHROPIC_AVAILABLE or not anthropic_sdk:
            raise HTTPException(500, "Anthropic package not installed.")
        api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
        if not api_key:
            raise HTTPException(500, "ANTHROPIC_API_KEY not configured.")
        api_model = ANTHROPIC_MODEL_MAP.get(model, model)
        client = anthropic_sdk.AsyncAnthropic(api_key=api_key, timeout=60.0)
        resp = await client.messages.create(
            model=api_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = resp.content[0].text if resp.content else ""
        return text, resp.usage.input_tokens, resp.usage.output_tokens

    # ── OpenAI (default) ───────────────────────────────────────────────────
    if not OPENAI_AVAILABLE or not AsyncOpenAI:
        raise HTTPException(500, "OpenAI package not installed.")
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        raise HTTPException(500, "OPENAI_API_KEY not configured.")
    client = AsyncOpenAI(api_key=api_key, timeout=60.0)
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens,
        temperature=0.7,
    )
    text = resp.choices[0].message.content or ""
    usage = resp.usage
    return text, (usage.prompt_tokens if usage else 0), (usage.completion_tokens if usage else 0)


# ── VizHint extraction ────────────────────────────────────────────────────────

def _extract_viz_hints(text: str) -> list[dict]:
    """Pull [VIZ_HINT]...{json}...[/VIZ_HINT] blocks out of AI output."""
    hints = []
    for m in _re.finditer(r'\[VIZ_HINT\](.*?)\[/VIZ_HINT\]', text, _re.DOTALL):
        try:
            hints.append(_json.loads(m.group(1).strip()))
        except Exception:
            pass
    return hints

def _strip_viz(text: str) -> str:
    return _re.sub(r'\[VIZ_HINT\].*?\[/VIZ_HINT\]', '', text, flags=_re.DOTALL).strip()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    session_type: str
    subject: str
    level: str
    model_name: str
    input_text: str
    output_text: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    duration_ms: Optional[int] = None
    is_saved: str = "false"
    saved_title: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    created_at: str

    @classmethod
    def from_orm_safe(cls, s: MathSession) -> "SessionOut":
        return cls(
            id=str(s.id),
            session_type=s.session_type.value if hasattr(s.session_type, "value") else str(s.session_type),
            subject=s.subject.value if hasattr(s.subject, "value") else str(s.subject),
            level=s.level,
            model_name=s.model_name,
            input_text=s.input_text,
            output_text=s.output_text,
            prompt_tokens=s.prompt_tokens or 0,
            completion_tokens=s.completion_tokens or 0,
            duration_ms=s.duration_ms,
            is_saved=s.is_saved or "false",
            saved_title=s.saved_title,
            extra=s.extra or {},
            created_at=s.created_at.isoformat() if s.created_at else "",
        )


class SolveRequest(BaseModel):
    problem: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    style: str = "step_by_step"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 2000


class ExploreRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    example_count: int = 3
    max_tokens: int = 2000


class PracticeRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    curriculum: str = "general"
    difficulty: str = "medium"
    count: int = 5
    model_name: str = "gpt-4o"
    max_tokens: int = 2000


class TheoryRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    sublevel: Optional[str] = None
    theory_level: str = "standard"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 2500


class ObjectivesRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 800


class ScenarioRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 1500
    image_model: Optional[str] = None


class ReformulateRequest(BaseModel):
    topic: Optional[str] = None
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    context: Optional[str] = None
    model_name: str = "gpt-4o"
    raw_input: Optional[str] = None


class VisualizeRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 1500


class SimulateRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    model_name: str = "gpt-4o"
    curriculum: str = "general"
    max_tokens: int = 1500


class ApplicationsRequest(BaseModel):
    topic: str
    subject: str = "algebra"
    level: str = "high_school"
    curriculum: str = "general"
    model_name: str = "gpt-4o"
    max_tokens: int = 1500


class SaveTitleRequest(BaseModel):
    title: str


class DataFetchRequest(BaseModel):
    source: str
    indicator: str
    country: Optional[str] = None
    city: Optional[str] = None
    years: int = 5


class DataAnalyzeRequest(BaseModel):
    source: str
    indicator: Optional[str] = None
    indicator_name: Optional[str] = None
    location: Optional[str] = None
    unit: Optional[str] = None
    data: List[Dict[str, Any]]
    question: Optional[str] = None
    subject: Optional[str] = None
    model_name: str = "gpt-4o"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_subject(s: str) -> MathSubject:
    try:
        return MathSubject(s)
    except ValueError:
        return MathSubject.other


async def _save_session(
    db: AsyncSession,
    user: User,
    session_type: SessionType,
    subject: str,
    level: str,
    model_name: str,
    input_text: str,
    output_text: str,
    prompt_tokens: int,
    completion_tokens: int,
    duration_ms: int,
    extra: Optional[dict] = None,
) -> MathSession:
    sess = MathSession(
        user_id=user.id,
        session_type=session_type,
        subject=_safe_subject(subject),
        level=level,
        model_name=model_name,
        input_text=input_text,
        output_text=output_text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        duration_ms=duration_ms,
        extra=extra or {},
    )
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    return sess


# ── Routes ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/math", tags=["math"])


@router.post("/solve", response_model=SessionOut)
async def solve(
    req: SolveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    level_str = _level_str(req.level, req.sublevel)
    difficulty_note = DIFFICULTY_NOTES.get(req.level, "")
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    steps_instruction = (
        "## Steps\nProvide numbered steps. Each step: title, explanation, LaTeX derivation."
        if req.style == "step_by_step"
        else "## Solution\nProvide a complete solution with clear mathematical reasoning."
    )
    system = SOLVE_SYSTEM
    user_prompt = SOLVE_PROMPT.format(
        problem=req.problem,
        subject=req.subject.replace("_", " ").title(),
        level=level_str,
        style=req.style.replace("_", " "),
        curriculum=curriculum_ctx,
        steps_instruction=steps_instruction,
        difficulty_note=difficulty_note,
    )
    t0 = time.monotonic()
    text, pt, ct = await call_ai(system, user_prompt, req.model_name, req.max_tokens)
    ms = int((time.monotonic() - t0) * 1000)
    sess = await _save_session(db, user, SessionType.solve, req.subject, req.level,
                               req.model_name, req.problem, text, pt, ct, ms)
    return SessionOut.from_orm_safe(sess)


@router.post("/explore", response_model=SessionOut)
async def explore(
    req: ExploreRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    level_str = _level_str(req.level, req.sublevel)
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = EXPLORE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=level_str,
        curriculum=curriculum_ctx,
        example_count=req.example_count,
    )
    t0 = time.monotonic()
    text, pt, ct = await call_ai(EXPLORE_SYSTEM, user_prompt, req.model_name, req.max_tokens)
    ms = int((time.monotonic() - t0) * 1000)
    viz = _extract_viz_hints(text)
    clean = _strip_viz(text)
    extra = {"viz_hints": viz} if viz else {}
    sess = await _save_session(db, user, SessionType.explore, req.subject, req.level,
                               req.model_name, req.topic, clean, pt, ct, ms, extra)
    return SessionOut.from_orm_safe(sess)


@router.post("/practice", response_model=SessionOut)
async def practice(
    req: PracticeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    level_str = _level_str(req.level, req.sublevel)
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = PRACTICE_PROMPT.format(
        topic=req.topic, subject=req.subject.replace("_", " ").title(),
        level=level_str, curriculum=curriculum_ctx,
        difficulty=req.difficulty, count=req.count, n="{n}",
    )
    t0 = time.monotonic()
    text, pt, ct = await call_ai(PRACTICE_SYSTEM, user_prompt, req.model_name, req.max_tokens)
    ms = int((time.monotonic() - t0) * 1000)
    sess = await _save_session(db, user, SessionType.practice, req.subject, req.level,
                               req.model_name, req.topic, text, pt, ct, ms)
    return SessionOut.from_orm_safe(sess)


@router.post("/theory", response_model=SessionOut)
async def theory(
    req: TheoryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    level_str = _level_str(req.level, req.sublevel)
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = THEORY_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=level_str,
        theory_level=req.theory_level,
        curriculum=curriculum_ctx,
    )
    t0 = time.monotonic()
    text, pt, ct = await call_ai(THEORY_SYSTEM, user_prompt, req.model_name, req.max_tokens)
    ms = int((time.monotonic() - t0) * 1000)
    viz = _extract_viz_hints(text)
    clean = _strip_viz(text)
    extra = {"viz_hints": viz} if viz else {}
    sess = await _save_session(db, user, SessionType.theory, req.subject, req.level,
                               req.model_name, req.topic, clean, pt, ct, ms, extra)
    return SessionOut.from_orm_safe(sess)


@router.post("/objectives")
async def objectives(
    req: ObjectivesRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = OBJECTIVES_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
    )
    system = "You are an expert curriculum designer. Return ONLY valid JSON — no markdown, no explanation."
    text, _, _ = await call_ai(system, user_prompt, req.model_name, req.max_tokens)
    try:
        data = _json.loads(_re.sub(r'^```json\s*|```$', '', text.strip(), flags=_re.MULTILINE))
    except Exception:
        data = {"objectives": [], "prerequisites": [], "applications": []}
    return data


@router.post("/scenario")
async def scenario(
    req: ScenarioRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = SCENARIO_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
    )
    t0 = time.monotonic()
    text, pt, ct = await call_ai(SCENARIO_SYSTEM, user_prompt, req.model_name, req.max_tokens)
    ms = int((time.monotonic() - t0) * 1000)
    return {
        "topic": req.topic,
        "subject": req.subject,
        "level": req.level,
        "scenario_text": text,
        "model_used": req.model_name,
        "duration_ms": ms,
    }


@router.post("/reformulate")
async def reformulate(
    req: ReformulateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw = req.raw_input or req.topic or req.context or ""
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = REFORMULATE_PROMPT.format(
        raw_input=raw,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
        context=req.context or "none",
    )
    system = "You are an expert mathematics curriculum designer. Return ONLY a valid JSON array of 3 strings."
    text, _, _ = await call_ai(system, user_prompt, req.model_name, 500)
    try:
        suggestions = _json.loads(_re.sub(r'^```json?\s*|```$', '', text.strip(), flags=_re.MULTILINE))
        if not isinstance(suggestions, list):
            raise ValueError
    except Exception:
        suggestions = [raw, f"{raw} — worked example", f"{raw} — practice problems"]
    return {"suggestions": suggestions[:3]}


@router.post("/visualize")
async def visualize(
    req: VisualizeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = VISUALIZE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
    )
    system = "You are an expert mathematics educator. Return ONLY valid JSON, no markdown."
    text, _, _ = await call_ai(system, user_prompt, req.model_name, req.max_tokens)
    try:
        data = _json.loads(_re.sub(r'^```json\s*|```$', '', text.strip(), flags=_re.MULTILINE))
    except Exception:
        data = {"visualizations": [], "explanation": text}
    return data


@router.post("/simulate")
async def simulate(
    req: SimulateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = SIMULATE_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
    )
    system = "You are an expert mathematics educator. Return ONLY valid JSON."
    text, _, _ = await call_ai(system, user_prompt, req.model_name, req.max_tokens)
    try:
        data = _json.loads(_re.sub(r'^```json\s*|```$', '', text.strip(), flags=_re.MULTILINE))
    except Exception:
        data = {"simulation": text}
    return data


@router.post("/applications")
async def applications(
    req: ApplicationsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    curriculum_ctx = CURRICULUM_CONTEXT.get(req.curriculum, CURRICULUM_CONTEXT["general"])
    user_prompt = APPLICATIONS_PROMPT.format(
        topic=req.topic,
        subject=req.subject.replace("_", " ").title(),
        level=req.level.replace("_", " ").title(),
        curriculum=curriculum_ctx,
    )
    system = "You are an expert at connecting mathematics to real-world applications. Return ONLY valid JSON."
    text, _, _ = await call_ai(system, user_prompt, req.model_name, req.max_tokens)
    try:
        data = _json.loads(_re.sub(r'^```json\s*|```$', '', text.strip(), flags=_re.MULTILINE))
    except Exception:
        data = {"applications": text}
    return data


# ── Session management ────────────────────────────────────────────────────────

@router.get("/progress")
async def progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MathSession)
        .where(MathSession.user_id == user.id)
        .order_by(desc(MathSession.created_at))
        .limit(200)
    )
    sessions = result.scalars().all()
    total = len(sessions)
    solve_count = sum(1 for s in sessions if s.session_type == SessionType.solve)
    explore_count = sum(1 for s in sessions if s.session_type == SessionType.explore)
    practice_count = sum(1 for s in sessions if s.session_type == SessionType.practice)
    theory_count = sum(1 for s in sessions if s.session_type == SessionType.theory)
    streak = min(total, 7)
    recent = sessions[:10]
    return {
        "total_sessions": total,
        "solve_count": solve_count,
        "explore_count": explore_count,
        "practice_count": practice_count,
        "theory_count": theory_count,
        "streak_days": streak,
        "recent_sessions": [SessionOut.from_orm_safe(s) for s in recent],
        "subjects_explored": list({s.subject.value if hasattr(s.subject, "value") else str(s.subject) for s in sessions}),
    }


@router.get("/sessions/saved", response_model=List[SessionOut])
async def get_saved_sessions(
    limit: int = 50,
    subject: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(MathSession).where(
        MathSession.user_id == user.id,
        MathSession.is_saved == "true",
    ).order_by(desc(MathSession.created_at)).limit(limit)
    if subject:
        q = q.where(MathSession.subject == _safe_subject(subject))
    result = await db.execute(q)
    return [SessionOut.from_orm_safe(s) for s in result.scalars().all()]


@router.post("/sessions/{session_id}/save")
async def save_session(
    session_id: str,
    body: SaveTitleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MathSession).where(MathSession.id == session_id, MathSession.user_id == user.id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    sess.is_saved = "true"
    sess.saved_title = body.title
    await db.commit()
    return {"ok": True}


@router.delete("/sessions/{session_id}/save")
async def unsave_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MathSession).where(MathSession.id == session_id, MathSession.user_id == user.id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    sess.is_saved = "false"
    sess.saved_title = None
    await db.commit()
    return {"ok": True}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MathSession).where(MathSession.id == session_id, MathSession.user_id == user.id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    await db.delete(sess)
    await db.commit()
    return {"ok": True}


# ── Subjects & Parent summary ─────────────────────────────────────────────────

SUBJECTS_LIST = [
    {"key": "arithmetic",   "label": "Arithmetic",   "color": "#f59e0b", "icon": "➕"},
    {"key": "algebra",      "label": "Algebra",      "color": "#8b5cf6", "icon": "x²"},
    {"key": "geometry",     "label": "Geometry",     "color": "#10b981", "icon": "△"},
    {"key": "trigonometry", "label": "Trigonometry", "color": "#06b6d4", "icon": "sin"},
    {"key": "precalculus",  "label": "Pre-Calculus", "color": "#f97316", "icon": "f(x)"},
    {"key": "calculus",     "label": "Calculus",     "color": "#ec4899", "icon": "∫"},
    {"key": "statistics",   "label": "Statistics",   "color": "#84cc16", "icon": "σ"},
    {"key": "linear_algebra","label":"Linear Algebra","color": "#a78bfa", "icon": "[]"},
    {"key": "differential_equations","label":"Diff. Equations","color":"#fb923c","icon":"dy/dx"},
    {"key": "discrete_math","label": "Discrete Math","color": "#22d3ee", "icon": "{}"},
    {"key": "number_theory","label": "Number Theory","color": "#f43f5e", "icon": "ℕ"},
]


@router.get("/subjects")
async def list_subjects():
    return {"subjects": SUBJECTS_LIST}


@router.get("/parent-summary")
async def parent_summary(
    email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MathSession)
        .where(MathSession.user_id == user.id)
        .order_by(desc(MathSession.created_at))
        .limit(100)
    )
    sessions = result.scalars().all()
    subjects = {}
    for s in sessions:
        subj = s.subject.value if hasattr(s.subject, "value") else str(s.subject)
        subjects[subj] = subjects.get(subj, 0) + 1
    return {
        "total_sessions": len(sessions),
        "subjects_breakdown": subjects,
        "streak_days": min(len(sessions), 7),
        "recent": [SessionOut.from_orm_safe(s) for s in sessions[:5]],
    }


# ── Data analysis ─────────────────────────────────────────────────────────────

@router.post("/data/fetch")
async def data_fetch(
    req: DataFetchRequest,
    user: User = Depends(get_current_user),
):
    return {"source": req.source, "indicator": req.indicator, "data": [], "note": "Use /data/* endpoints directly."}


@router.post("/data/analyze")
async def data_analyze(
    req: DataAnalyzeRequest,
    user: User = Depends(get_current_user),
):
    data_summary = _json.dumps(req.data[:20], indent=2) if req.data else "[]"
    system = "You are an expert data analyst and mathematics educator."
    user_prompt = f"""Analyze this dataset and answer the question.

INDICATOR: {req.indicator_name or req.indicator or 'Unknown'}
LOCATION: {req.location or 'Unknown'}
UNIT: {req.unit or 'Unknown'}
QUESTION: {req.question or 'What are the key trends and insights?'}

DATA (first 20 points):
{data_summary}

Provide: 1) Key trend analysis 2) Statistical summary 3) Mathematical interpretation 4) Practical insights.
Use LaTeX for any mathematical expressions."""
    text, _, _ = await call_ai(system, user_prompt, req.model_name, 1000)
    return {"analysis": text, "model_used": req.model_name}
