"""
AI Mathematics Copilot™ — Administrative visibility endpoints.

Per the "Public AI Model Taxonomy, Capability Abstraction & Model Routing
Architecture" brief: learners select a stable, product-oriented public
capability (an "ai_mode"/"image_mode"), never a vendor model name — but
administrators and developers retain full visibility into the real
provider, model family, deployment id, capability class, status, and
cost/latency profile behind each public mode. This router is that admin
visibility surface; it exposes the Model Capability Registry™
(app/services/model_registry.py) verbatim, unabstracted.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.routers.auth import get_current_user
from app.models.user import User
from app.services.model_registry import all_deployments

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Role gate reused by every endpoint in this router — same
    current_user.role.value == "admin" check already used elsewhere in the
    app (e.g. math.py's parent_summary), just enforced as a dependency here
    since every route in this file is admin-only."""
    if current_user.role.value != "admin":
        raise HTTPException(403, "Admin access required.")
    return current_user


@router.get("/models")
async def list_models(current_user: User = Depends(require_admin)):
    """Full Model Capability Registry™ — every approved text and image
    deployment, with every admin field (provider, model family, deployment
    id, capability class, public mode + label, status, priority, cost/
    latency class, capability ratings). The real, un-abstracted view —
    this is what a learner's public AI mode selector never shows."""
    return {"deployments": all_deployments()}
