from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from enum import Enum
from datetime import datetime

class ProposalStatus(str, Enum):
    DRAFT = "draft"
    GENERATING_TOC = "generating_toc"
    TOC_GENERATED = "toc_generated"
    TOC_CONFIRMED = "toc_confirmed"
    GENERATING_SECTIONS = "generating_sections"
    COMPLETED = "completed"

class ProposalBase(BaseModel):
    title: str = Field(..., description="The title of the proposal draft", example="2024 AI Voucher Project Proposal")
    content: Optional[Any] = Field(None, description="The HTML content of the proposal draft", example="<h1>Proposal</h1><p>Content goes here...</p>")
    toc: Optional[List[Dict[str, Any]]] = Field(None, description="The table of contents for the proposal", example=[{"title": "1. Introduction", "status": "pending"}])
    overview: Optional[Dict[str, Any]] = Field(None, description="The extracted project overview")
    status: ProposalStatus = Field(ProposalStatus.DRAFT, description="The current status of the proposal workflow")
    user_id: str = Field(..., description="The ID of the user who owns the proposal", example="00000000-0000-0000-0000-000000000000")

class ProposalCreate(ProposalBase):
    pass

class ProposalUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Updated title of the proposal", example="Updated Proposal Title")
    content: Optional[Any] = Field(None, description="Updated HTML content of the proposal", example="<h2>Updated Content</h2>")
    toc: Optional[List[Dict[str, Any]]] = Field(None, description="Updated table of contents")
    overview: Optional[Dict[str, Any]] = Field(None, description="Updated project overview")
    status: Optional[ProposalStatus] = Field(None, description="Updated status of the proposal")

class Proposal(ProposalBase):
    id: str = Field(..., description="Unique identifier for the proposal", example="mock-1")
    created_at: datetime = Field(..., description="The timestamp when the proposal was created")
    updated_at: datetime = Field(..., description="The timestamp when the proposal was last updated")

    class Config:
        from_attributes = True

class ProposalListItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the proposal", example="mock-1")
    title: str = Field(..., description="The title of the proposal draft", example="2024 AI Voucher Project Proposal")
    user_id: str = Field(..., description="The ID of the user who owns the proposal", example="00000000-0000-0000-0000-000000000000")
    created_at: datetime = Field(..., description="The timestamp when the proposal was created")
    updated_at: datetime = Field(..., description="The timestamp when the proposal was last updated")

    class Config:
        from_attributes = True
