from fastapi import APIRouter, HTTPException, Response, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid
from ..models.proposals import Proposal, ProposalCreate, ProposalUpdate, ProposalListItem, ProposalStatus
from ..services.supabase_client import supabase
from ..services.pdf_service import extract_text_from_pdf, extract_pages_from_pdf, get_overview_candidates, get_toc_candidates
from ..services.llm_service import (
    generate_section_content,
    analyze_rfp_overview,
    structure_toc_from_pages
)
from ..services.proposal_engine import run_sequential_generation

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

@router.get(
    "/", 
    response_model=List[ProposalListItem],
    summary="List all proposals (without content)",
    description="Fetch a list of all proposal drafts excluding their HTML content, ordered by creation date descending. Falls back to mock data if database is disconnected."
)
async def get_proposals():
    if not supabase:
        print("Returning mock proposals (DB disconnected)")
        return MOCK_PROPOSALS

    try:
        # Explicitly select columns to exclude 'content' for performance
        columns = "id, title, user_id, created_at, updated_at"
        response = supabase.table("naraworks_proposals").select(columns).order("created_at", desc=True).execute()
        # Supabase-py v2 returns a response object with .data
        return response.data
    except Exception as e:
        print(f"DB Error, falling back to mock: {e}")
        return MOCK_PROPOSALS


@router.post(
    "/parse-rfp",
    summary="Parse RFP and generate TOC",
    description="Upload an RFP PDF to generate an initial Table of Contents (TOC) and Project Overview."
)
async def parse_rfp(
    rfp: UploadFile = File(..., description="The RFP PDF file")
):
    # 1. Read file
    rfp_bytes = await rfp.read()
    
    # 2. Extract pages using new service
    pages = extract_pages_from_pdf(rfp_bytes)
    
    if not pages:
        raise HTTPException(status_code=400, detail="Could not extract text from uploaded PDF")
        
    # 3. Analyze Overview (First 15-20 pages)
    overview_pages = get_overview_candidates(pages, limit=15)
    overview_text = "\n".join([p.text for p in overview_pages])
    overview_data = analyze_rfp_overview(overview_text)
    
    # 4. Identify and Structure TOC
    toc_pages = get_toc_candidates(pages)
    if not toc_pages:
        # Fallback: Scan first 20 pages if no keywords found (unlikely for Korean RFP)
        toc_pages = pages[:20]
        
    toc_text = "\n".join([p.text for p in toc_pages])
    toc_data = structure_toc_from_pages(toc_text)
    
    # 5. Create a draft proposal and return info
    # In a real app, we might store the whole RFP text in a separate table or storage.
    # For simplicity, we just return the data.
    
    full_rfp_text = "\n".join([p.text for p in pages])
    
    return {
        "overview": overview_data,
        "toc": toc_data.get("toc", []),
        "rfp_text": full_rfp_text # Returning this to frontend to pass back for generation
    }

class GenerationRequest(BaseModel):
    title: str
    overview: Dict[str, Any]
    toc: List[Dict[str, Any]]
    rfp_text: str
    user_id: str = "00000000-0000-0000-0000-000000000000"

@router.post(
    "/generate-sequential",
    summary="Start sequential proposal generation",
    description="Creates a proposal record and starts the background task for sequential generation."
)
async def generate_sequential(req: GenerationRequest, background_tasks: BackgroundTasks):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database disconnected")

    # 1. Create Proposal record
    try:
        data = {
            "title": req.title,
            "toc": req.toc,
            "status": "generating_sections",
            "user_id": req.user_id,
        }
        response = supabase.table("naraworks_proposals").insert(data).execute()
        proposal = response.data[0]
        proposal_id = proposal["id"]
        
        # 2. Start background task
        background_tasks.add_task(
            run_sequential_generation,
            project_id=proposal_id,
            overview=req.overview,
            toc=req.toc,
            rfp_text=req.rfp_text,
            user_id=req.user_id
        )
        
        return proposal
    except Exception as e:
        print(f"Error starting generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{id}/generate-section",
    summary="Generate content for a specific section",
    description="Generate draft content for a specific section of the proposal using LLM."
)
async def generate_section(id: str, section_title: str):
    # In a real app, we would fetch the proposal to get the RFP context (if linked) 
    # or accept context in the request body.
    # For now, we will perform a simple generation. 
    # TODO: Fetch RFP text associated with this proposal if possible.
    
    content = generate_section_content(section_title)
    return {"content": content}

@router.post(
    "/", 
    response_model=Proposal, 
    status_code=201,
    summary="Create a new proposal",
    description="Manually create a new proposal draft with title and content."
)
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
            "user_id": proposal.user_id,
            "toc": proposal.toc,
            "status": proposal.status
        }
        response = supabase.table("naraworks_proposals").insert(data).execute()
        return response.data[0] if isinstance(response.data, list) and len(response.data) > 0 else response.data
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

@router.get(
    "/{id}", 
    response_model=Proposal,
    summary="Get proposal by ID",
    description="Fetch a specific proposal draft by its unique ID."
)
async def get_proposal_by_id(id: str):
    is_mock = not supabase or id.startswith("mock-")
    
    if is_mock:
        mock = next((p for p in MOCK_PROPOSALS if p["id"] == id), None)
        if mock:
            return mock
        raise HTTPException(status_code=404, detail="Proposal not found")

    try:
        response = supabase.table("naraworks_proposals").select("*").eq("id", id).single().execute()
        return response.data
    except Exception as e:
        print(f"DB Fetch Error, falling back to mock: {e}")
        mock = next((p for p in MOCK_PROPOSALS if p["id"] == id), None)
        if mock:
            return mock
        raise HTTPException(status_code=404, detail="Proposal not found")

@router.put(
    "/{id}", 
    response_model=Proposal,
    summary="Update an existing proposal",
    description="Update the title or content of an existing proposal draft."
)
async def update_proposal(id: str, proposal: ProposalUpdate):
    is_mock = not supabase or id.startswith("mock-")

    update_data = {}
    if proposal.title is not None:
        update_data["title"] = proposal.title
    if proposal.content is not None:
        update_data["content"] = proposal.content
    if proposal.toc is not None:
        update_data["toc"] = proposal.toc
    if proposal.status is not None:
        update_data["status"] = proposal.status
    
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
        response = supabase.table("naraworks_proposals").update(update_data).eq("id", id).execute()
        return response.data[0] if isinstance(response.data, list) and len(response.data) > 0 else response.data
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

@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete a proposal",
    description="Delete a proposal draft by its unique ID."
)
async def delete_proposal(id: str):
    is_mock = not supabase or id.startswith("mock-")

    if is_mock:
        # For mock data, we can't actually delete from the immutable list in memory permanently 
        # across restarts, but we can return success to simulate it.
        # In a real app with in-memory store, we would remove it from MOCK_PROPOSALS
        return Response(status_code=204)

    try:
        response = supabase.table("naraworks_proposals").delete().eq("id", id).execute()
        # count is not always returned in newer supabase-py versions directly in a standardized way 
        # that indicates 'not found' clearly without checking previous existence, 
        # but delete usually returns 204 or 200 even if nothing deleted.
        # However, to be safe and simple, we assume success if no exception.
        return Response(status_code=204)
    except Exception as e:
        print(f"DB Delete Error, falling back to mock success: {e}")
        return Response(status_code=204)
