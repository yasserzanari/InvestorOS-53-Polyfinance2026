"""Server-owned mapping from the three public demo personas to fixed DynamoDB keys."""
import json
import os
from typing import Literal, TypedDict

from fastapi import HTTPException

PersonaId = Literal["amira", "mateo", "robert"]


class DemoContext(TypedDict):
    account_id: str
    profile_id: str
    portfolio_id: str


PERSONAS = ("amira", "mateo", "robert")


def context_for(persona: PersonaId) -> DemoContext:
    """Resolve a persona through deployment config; never use browser input as a DB key."""
    encoded = os.getenv("DEMO_CONTEXTS", "")
    if encoded:
        try:
            configured = json.loads(encoded)
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=503, detail="Demo contexts are invalid") from error
        context = configured.get(persona) if isinstance(configured, dict) else None
        if not isinstance(context, dict) or any(
            not isinstance(context.get(key), str) or not context[key]
            for key in ("account_id", "profile_id", "portfolio_id")
        ):
            raise HTTPException(status_code=404, detail="Demo persona is not configured")
        return {
            "account_id": context["account_id"],
            "profile_id": context["profile_id"],
            "portfolio_id": context["portfolio_id"],
        }

    # Existing single-persona deployments continue serving the configured Mateo fixture.
    if persona == "mateo":
        legacy = {
            "account_id": os.getenv("DEMO_ACCOUNT_ID", ""),
            "profile_id": os.getenv("DEMO_PROFILE_ID", ""),
            "portfolio_id": os.getenv("DEMO_PORTFOLIO_ID", ""),
        }
        if all(legacy.values()):
            return legacy
    raise HTTPException(status_code=503, detail="Demo persona is not configured")
