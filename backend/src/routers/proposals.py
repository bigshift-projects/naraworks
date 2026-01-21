from fastapi import APIRouter, HTTPException, Response
from typing import List
from datetime import datetime, timedelta
import uuid
from ..models.proposals import Proposal, ProposalCreate, ProposalUpdate
from ..services.supabase_client import supabase

router = APIRouter(
    prefix="/api/proposals",
    tags=["proposals"]
)

MOCK_PROPOSALS = [
    {
        "id": "mock-1",
        "title": "[목업] 2024년도 AI 바우처 지원사업 제안서",
        "content": "<h1>AI 바우처 지원사업</h1><p>본 제안서는 AI 기술 도입을 통한 성과 창출을 목표로 합니다.</p>",
        "user_id": "00000000-0000-0000-0000-000000000000",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
    {
        "id": "mock-2",
        "title": "[목업] 공공 클라우드 전환 컨설팅 사업 제안서",
        "content": "<h1>공공 클라우드 전환</h1><p>지자체 및 공공기관의 인프라를 클라우드로 안전하게 전환하기 위한 컨설팅 제안입니다.</p>",
        "user_id": "00000000-0000-0000-0000-000000000000",
        "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
        "updated_at": (datetime.now() - timedelta(days=1)).isoformat(),
    },
]

@router.get("/", response_model=List[Proposal])
async def get_proposals():
    if not supabase:
        print("Returning mock proposals (DB disconnected)")
        return MOCK_PROPOSALS

    try:
        response = supabase.table("proposals").select("*").order("created_at", desc=True).execute()
        # Supabase-py v2 returns a response object with .data
        return response.data
    except Exception as e:
        print(f"DB Error, falling back to mock: {e}")
        return MOCK_PROPOSALS

@router.post("/", response_model=Proposal, status_code=201)
async def create_proposal(proposal: ProposalCreate):
    if not supabase:
        new_mock = {
            "id": f"mock-{int(datetime.now().timestamp() * 1000)}",
            "title": proposal.title,
            "content": proposal.content,
            "user_id": proposal.user_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        return new_mock

    try:
        data = {
            "title": proposal.title,
            "content": proposal.content,
            "user_id": proposal.user_id
        }
        response = supabase.table("proposals").insert(data).select().single().execute()
        return response.data
    except Exception as e:
        print(f"DB Create Error, falling back to mock success: {e}")
        new_mock = {
            "id": f"mock-{int(datetime.now().timestamp() * 1000)}",
            "title": proposal.title,
            "content": proposal.content,
            "user_id": proposal.user_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        return new_mock

@router.get("/{id}", response_model=Proposal)
async def get_proposal_by_id(id: str):
    is_mock = not supabase or id.startswith("mock-")
    
    if is_mock:
        mock = next((p for p in MOCK_PROPOSALS if p["id"] == id), None)
        if mock:
            return mock
        raise HTTPException(status_code=404, detail="Proposal not found")

    try:
        response = supabase.table("proposals").select("*").eq("id", id).single().execute()
        return response.data
    except Exception as e:
        print(f"DB Fetch Error, falling back to mock: {e}")
        mock = next((p for p in MOCK_PROPOSALS if p["id"] == id), None)
        if mock:
            return mock
        raise HTTPException(status_code=404, detail="Proposal not found")

@router.put("/{id}", response_model=Proposal)
async def update_proposal(id: str, proposal: ProposalUpdate):
    is_mock = not supabase or id.startswith("mock-")

    update_data = {}
    if proposal.title is not None:
        update_data["title"] = proposal.title
    if proposal.content is not None:
        update_data["content"] = proposal.content
    
    if is_mock:
        # In a real mock scenario we might update the in-memory list, but for now just return the echo
        # mirroring the node implementation which just returned the data
        return {
            "id": id,
            "title": proposal.title or "Unknown Title", # Fallback if not provided in update
            "content": proposal.content,
            "user_id": "00000000-0000-0000-0000-000000000000", # Dummy
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            **update_data
        }

    try:
        update_data["updated_at"] = datetime.now().isoformat()
        response = supabase.table("proposals").update(update_data).eq("id", id).select().single().execute()
        return response.data
    except Exception as e:
        print(f"DB Update Error, falling back to mock success: {e}")
        return {
            "id": id,
             "title": proposal.title or "Unknown Title",
            "content": proposal.content,
             "user_id": "00000000-0000-0000-0000-000000000000",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            **update_data
        }
