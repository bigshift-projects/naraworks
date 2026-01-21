from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class ProposalBase(BaseModel):
    title: str
    content: Optional[Any] = None
    user_id: str  # Using str to support both UUIDs and potential mock IDs if needed, though usually UUID

class ProposalCreate(ProposalBase):
    pass

class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[Any] = None

class Proposal(ProposalBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
