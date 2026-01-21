from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime

class ProposalBase(BaseModel):
    title: str = Field(..., description="The title of the proposal draft", example="2024 AI Voucher Project Proposal")
    content: Optional[Any] = Field(None, description="The HTML content of the proposal draft", example="<h1>Proposal</h1><p>Content goes here...</p>")
    user_id: str = Field(..., description="The ID of the user who owns the proposal", example="00000000-0000-0000-0000-000000000000")

class ProposalCreate(ProposalBase):
    pass

class ProposalUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Updated title of the proposal", example="Updated Proposal Title")
    content: Optional[Any] = Field(None, description="Updated HTML content of the proposal", example="<h2>Updated Content</h2>")

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
