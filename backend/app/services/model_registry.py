"""Model Capability Registry™

Single source of truth for every approved AI model deployment on the
platform, both text (LLM) and image-generation. This replaces three
previously-scattered, occasionally-drifted dicts that lived in
app/routers/math.py (MODEL_PROVIDER_MAP, ANTHROPIC_MODEL_MAP,
GEMINI_MODEL_MAP) plus a fourth, independently-drifted copy that used to
live inline in app/routers/mentor.py.

Per the "AI Mathematics Copilot™ Public AI Model Taxonomy, Capability
Abstraction & Model Routing Architecture" brief: learners select a stable,
product-oriented public capability (a "public_mode", e.g. "smart"), never a
vendor model name. Administrators/developers see everything — provider,
model family, the real deployment id sent to the provider SDK, capability
class, status, priority, cost/latency class, and capability ratings.

    Public Product Capability -> AI Mode -> Model Router -> Approved Backend
    Model -> Provider / API

`resolve_text_mode()` / `resolve_image_mode()` are the router: given
whatever string a client sends, they return the ModelDeployment to use.
They try, in order: (1) an exact public_mode match, (2) a legacy internal
`id` match (so a request carrying an old raw model id, or a stale cached
frontend value, still resolves instead of hard-failing), (3) the
registry's designated default. This fallback matters because this
registry is the resolution point for essentially every AI-calling
endpoint on the platform.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class ModelDeployment:
    id: str                      # stable internal id (e.g. "gpt-4o") — unchanged from
                                  # the pre-registry client-facing ids, so historical
                                  # MathSession.model_name values stay meaningful.
    provider: str                 # "openai" | "anthropic" | "google"
    model_family: str             # "gpt-4o" | "claude" | "gemini" | "image-generation"
    deployment_id: str            # the actual string sent to the provider SDK.
    capability_class: str         # "general_llm" | "fast_llm" | "reasoning_llm" | "vlm" | "image_generation"
    public_mode: Optional[str]    # stable public-facing key, or None if not publicly exposed
    public_label: Optional[str]   # learner-facing display string, or None if not publicly exposed
    status: str                   # "active" | "limited" | "disabled" | "testing"
    priority: str                 # "primary" | "secondary" | "fallback" | "experimental"
    cost_class: str               # "low" | "medium" | "high"
    latency_class: str            # "low" | "medium" | "high"
    capability_ratings: dict = field(default_factory=dict)


# ── Text (LLM) deployments ───────────────────────────────────────────────────
#
# The 6 entries with a public_mode are exactly today's 6 selectable models,
# each keeping its existing badge word (Smart/Fast/Reasoned→Reason/Concise/
# Multimodal→Vision/Speed) as its public mode, brand-prefixed for display.
# The 3 entries with public_mode=None (gpt-4-turbo, claude-opus-4,
# claude-3-5-sonnet) were present in the old MODEL_PROVIDER_MAP but never
# exposed by any selector — preserved here as approved-but-not-public
# deployments rather than silently dropped.

TEXT_MODEL_REGISTRY: list[ModelDeployment] = [
    ModelDeployment(
        id="gpt-4o", provider="openai", model_family="gpt-4o", deployment_id="gpt-4o",
        capability_class="general_llm", public_mode="smart", public_label="Maths Copilot Smart™",
        status="active", priority="primary", cost_class="medium", latency_class="medium",
        capability_ratings={"math_reasoning": "high", "symbolic_math": "medium", "vision": False,
                             "long_context": False, "educational_explanation": "high"},
    ),
    ModelDeployment(
        id="gpt-4o-mini", provider="openai", model_family="gpt-4o", deployment_id="gpt-4o-mini",
        capability_class="fast_llm", public_mode="fast", public_label="Maths Copilot Fast™",
        status="active", priority="primary", cost_class="low", latency_class="low",
        capability_ratings={"math_reasoning": "medium", "symbolic_math": "low", "vision": False,
                             "long_context": False, "educational_explanation": "medium"},
    ),
    ModelDeployment(
        id="claude-sonnet-4", provider="anthropic", model_family="claude", deployment_id="claude-sonnet-4-5",
        capability_class="reasoning_llm", public_mode="reason", public_label="Maths Copilot Reason™",
        status="active", priority="primary", cost_class="medium", latency_class="medium",
        capability_ratings={"math_reasoning": "high", "symbolic_math": "high", "vision": False,
                             "long_context": True, "educational_explanation": "high"},
    ),
    ModelDeployment(
        id="claude-haiku-4", provider="anthropic", model_family="claude", deployment_id="claude-haiku-4-5",
        capability_class="fast_llm", public_mode="concise", public_label="Maths Copilot Concise™",
        status="active", priority="primary", cost_class="low", latency_class="low",
        capability_ratings={"math_reasoning": "medium", "symbolic_math": "medium", "vision": False,
                             "long_context": False, "educational_explanation": "medium"},
    ),
    ModelDeployment(
        id="gemini-1.5-pro", provider="google", model_family="gemini", deployment_id="gemini-1.5-pro",
        capability_class="vlm", public_mode="vision", public_label="Maths Copilot Vision™",
        status="active", priority="primary", cost_class="medium", latency_class="medium",
        capability_ratings={"math_reasoning": "medium", "symbolic_math": "medium", "vision": True,
                             "long_context": True, "educational_explanation": "medium"},
    ),
    ModelDeployment(
        id="gemini-1.5-flash", provider="google", model_family="gemini", deployment_id="gemini-1.5-flash",
        capability_class="fast_llm", public_mode="speed", public_label="Maths Copilot Speed™",
        status="active", priority="primary", cost_class="low", latency_class="low",
        capability_ratings={"math_reasoning": "low", "symbolic_math": "low", "vision": True,
                             "long_context": False, "educational_explanation": "low"},
    ),
    # Approved but not publicly exposed today — kept resolvable by legacy id only.
    ModelDeployment(
        id="gpt-4-turbo", provider="openai", model_family="gpt-4o", deployment_id="gpt-4-turbo",
        capability_class="general_llm", public_mode=None, public_label=None,
        status="limited", priority="experimental", cost_class="high", latency_class="medium",
        capability_ratings={"math_reasoning": "high", "symbolic_math": "medium"},
    ),
    ModelDeployment(
        id="claude-opus-4", provider="anthropic", model_family="claude", deployment_id="claude-opus-4-5",
        capability_class="reasoning_llm", public_mode=None, public_label=None,
        status="limited", priority="experimental", cost_class="high", latency_class="high",
        capability_ratings={"math_reasoning": "high", "symbolic_math": "high", "long_context": True},
    ),
    ModelDeployment(
        id="claude-3-5-sonnet", provider="anthropic", model_family="claude", deployment_id="claude-sonnet-4-6",
        capability_class="reasoning_llm", public_mode=None, public_label=None,
        status="limited", priority="experimental", cost_class="medium", latency_class="medium",
        capability_ratings={"math_reasoning": "high", "symbolic_math": "high"},
    ),
]

DEFAULT_TEXT_MODE = "smart"

# ── Image-generation deployments ─────────────────────────────────────────────

IMAGE_MODEL_REGISTRY: list[ModelDeployment] = [
    ModelDeployment(
        id="gpt-image-1", provider="openai", model_family="image-generation", deployment_id="gpt-image-1",
        capability_class="image_generation", public_mode="diagram", public_label="Diagram™",
        status="active", priority="primary", cost_class="medium", latency_class="medium",
        capability_ratings={"image_generation": "high", "instructional_precision": "high"},
    ),
    ModelDeployment(
        id="dall-e-3", provider="openai", model_family="image-generation", deployment_id="dall-e-3",
        capability_class="image_generation", public_mode="creative", public_label="Creative™",
        status="active", priority="primary", cost_class="medium", latency_class="medium",
        capability_ratings={"image_generation": "high", "artistic_range": "high"},
    ),
]

DEFAULT_IMAGE_MODE = "diagram"


# ── Resolution helpers ───────────────────────────────────────────────────────

def _resolve(registry: list[ModelDeployment], key: Optional[str], default_mode: str) -> ModelDeployment:
    """Try an exact public_mode match, then a legacy internal-id match, then
    the registry's default public mode. Never raises — always resolves to
    some active deployment, since this sits on the request path for
    essentially every AI-calling endpoint on the platform."""
    if key:
        for entry in registry:
            if entry.public_mode == key:
                return entry
        for entry in registry:
            if entry.id == key:
                return entry
    for entry in registry:
        if entry.public_mode == default_mode:
            return entry
    return registry[0]


def resolve_text_mode(ai_mode: Optional[str]) -> ModelDeployment:
    return _resolve(TEXT_MODEL_REGISTRY, ai_mode, DEFAULT_TEXT_MODE)


def resolve_image_mode(image_mode: Optional[str]) -> ModelDeployment:
    return _resolve(IMAGE_MODEL_REGISTRY, image_mode, DEFAULT_IMAGE_MODE)


def get_deployment_id(internal_id: str) -> str:
    """Look up the real provider-SDK model string for a stable internal id
    (e.g. "claude-sonnet-4" -> "claude-sonnet-4-5"). Used by call_anthropic/
    call_gemini in app/routers/math.py, which still operate on internal ids
    once dispatch() has already resolved a public mode down to one. Falls
    back to the id itself if not found (safe passthrough — matches the old
    per-provider dicts' `.get(model, model)`-style default)."""
    for entry in TEXT_MODEL_REGISTRY:
        if entry.id == internal_id:
            return entry.deployment_id
    return internal_id


def all_deployments() -> list[dict]:
    """Full admin-visible registry (text + image), every field, as plain
    dicts — the data source for GET /admin/models."""
    return [
        {**entry.__dict__, "kind": "text"} for entry in TEXT_MODEL_REGISTRY
    ] + [
        {**entry.__dict__, "kind": "image"} for entry in IMAGE_MODEL_REGISTRY
    ]
