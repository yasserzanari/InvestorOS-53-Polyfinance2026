"""Versioned HTTP/tool schemas. Keep browser and model data behind the same validation."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

PROFILE_FIELDS = frozenset(('objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'))

class TabItem(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(max_length=80)
    title: str = Field(max_length=2000)
    status: Literal['pending', 'active', 'done', 'failed', 'skipped'] = 'pending'
    url: str | None = Field(default=None, max_length=1000)

class WorkspaceTab(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    title: str = Field(min_length=1, max_length=80)
    kind: Literal['profile', 'note', 'tasks', 'agents', 'sources']
    content: str = Field(default='', max_length=16000)
    items: list[TabItem] = Field(default_factory=list, max_length=40)

class HistoryMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=12000)

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message: str = Field(min_length=1, max_length=8000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=30)
    profile: dict[str, str] = Field(default_factory=dict, max_length=8)
    tabs: list[WorkspaceTab] = Field(default_factory=list, max_length=12)
    accountId: Literal['amira', 'mateo', 'robert'] = 'mateo'
