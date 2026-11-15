from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from investoros_api.demo_contexts import PersonaId


class ResearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(min_length=12, max_length=2400)
    persona: PersonaId = "mateo"
    x_url: str | None = Field(default=None, max_length=600)
    x_text: str | None = Field(default=None, max_length=2000)
    source_ids: list[str] | None = Field(default=None, min_length=1, max_length=12)


class SourcePolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    enabled: bool
    trust_level: Literal["primary", "institutional", "independent", "provided_dataset", "discovery", "blocked"]
    rationale: str = Field(min_length=8, max_length=600)


class ResearchEvent(BaseModel):
    event_id: str
    analysis_id: str
    type: str
    at: str
    room_id: str | None = None
    agent_id: str | None = None
    source_id: str | None = None
    title: str
    detail: str = ""
    status: str = "info"
    data: dict = Field(default_factory=dict)
