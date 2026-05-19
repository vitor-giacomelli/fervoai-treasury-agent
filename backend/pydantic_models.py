from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GrantOpportunity(BaseModel):
    title: str = Field(..., max_length=300)
    opportunity_number: str = Field(..., max_length=80)
    agency: str = Field(default="Unknown", max_length=200)
    description: str = Field(default="", max_length=3000)
    award_ceiling: str = Field(default="Not specified", max_length=80)
    award_floor: str = Field(default="Not specified", max_length=80)
    close_date: str = Field(default="Not specified", max_length=80)
    post_date: str = Field(default="Not specified", max_length=80)
    recipient_email: str = Field(default="", max_length=320)
    url: str = Field(default="", max_length=600)
    category: str = Field(default="Other", max_length=120)
    source: str = Field(default="grants_gov", max_length=60)


class PitchResult(BaseModel):
    pitch_draft: str
    model_used: str
    status: str


class SwarmNode(BaseModel):
    name: str = Field(..., max_length=120)
    role: str = Field(..., max_length=120)
    domain: str = Field(..., max_length=400)


class CompanyState(BaseModel):
    ecosystem: str = Field(..., max_length=120)
    core_infrastructure: str = Field(..., max_length=600)
    runway_preference: str = Field(..., max_length=600)
    swarm_nodes: list[SwarmNode] = Field(default_factory=list)


class StreamEnvelope(BaseModel):
    type: str
    text: str | None = None
    payload: dict[str, Any] | None = None
