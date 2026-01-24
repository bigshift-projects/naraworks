from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any
from ..services.supabase_client import supabase
from ..services.pdf_service import extract_pages_from_pdf, get_overview_candidates, get_toc_candidates
from ..services.llm_service import (
    generate_section_content,
    analyze_rfp_overview,
    structure_toc_from_pages
)
from ..services.proposal_engine import run_sequential_generation

router = APIRouter(
    prefix="/api/generation",
    tags=["proposal-generation"]
)

class GenerationRequest(BaseModel):
    title: str
    overview: Dict[str, Any]
    toc: List[Dict[str, Any]]
    rfp_text: str
    user_id: str = "00000000-0000-0000-0000-000000000000"

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


class SectionGenerationRequest(BaseModel):
    section_title: str

@router.post(
    "/{id}/generate-section",
    summary="Generate content for a specific section",
    description="Generate draft content for a specific section of the proposal using LLM."
)
async def generate_section(id: str, req: SectionGenerationRequest):
    # In a real app, we would fetch the proposal to get the RFP context (if linked) 
    # or accept context in the request body.
    # For now, we will perform a simple generation. 
    # TODO: Fetch RFP text associated with this proposal if possible.
    
    content = generate_section_content(req.section_title)
    return {"content": content}
