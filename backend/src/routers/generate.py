from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
import logging
import json
import os
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any
from ..services.supabase_client import supabase
from ..services.pdf_service import extract_pages_from_pdf, get_overview_candidates, get_toc_candidates
from ..services.llm_service import (
    generate_section_content,
    analyze_rfp_overview,
    structure_toc_from_pages,
    classify_toc_page
)
from ..services.proposal_engine import run_sequential_generation

router = APIRouter(
    prefix="/api/generation",
    tags=["proposal-generation"]
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    logger.info(f"parse_rfp: Received file: {rfp.filename}")
    rfp_bytes = await rfp.read()
    logger.info(f"parse_rfp: File size: {len(rfp_bytes)} bytes")
    
    # 2. Extract pages using new service
    pages = extract_pages_from_pdf(rfp_bytes)
    logger.info(f"parse_rfp: Extracted {len(pages)} pages")
    
    if not pages:
        logger.error("parse_rfp: Could not extract text from uploaded PDF")
        raise HTTPException(status_code=400, detail="Could not extract text from uploaded PDF")
        
    # 3. Analyze Overview (First 10 pages)
    logger.info("parse_rfp: extract_overview: Starting analysis...")
    overview_pages = get_overview_candidates(pages, limit=10)
    overview_text = "\n".join([p.text for p in overview_pages])
    overview_data = analyze_rfp_overview(overview_text)
    logger.info(f"parse_rfp: extract_overview: Completed. Name: {overview_data.get('project_name')}")
    
    # 4. Identify and Structure TOC
    logger.info("parse_rfp: identify_toc: Starting search for TOC pages...")
    toc_candidates = get_toc_candidates(pages)
    
    verified_toc_pages = []
    if toc_candidates:
        logger.info(f"parse_rfp: identify_toc: Found {len(toc_candidates)} candidates. Classifying with LLM...")
        for p in toc_candidates:
            is_guide = classify_toc_page(p.text)
            if is_guide:
                verified_toc_pages.append(p)
                logger.info(f"parse_rfp: identify_toc: Page {p.page_number} VERIFIED as Proposal Guide.")
            else:
                logger.info(f"parse_rfp: identify_toc: Page {p.page_number} rejected by classifier.")
    
    if not verified_toc_pages:
        logger.warning("parse_rfp: identify_toc: No explicit TOC pages found/verified. Using fallback (pages 3-20).")
        # Fallback: Scan first 20 pages if no keywords found (unlikely for Korean RFP)
        verified_toc_pages = pages[3:20]
    else:
        page_nums = [p.page_number for p in verified_toc_pages]
        logger.info(f"parse_rfp: identify_toc: Final TOC source pages: {page_nums}")
        
    toc_text = "\n".join([p.text for p in verified_toc_pages])
    
    logger.info("parse_rfp: structure_toc: Starting LLM structuring...")
    toc_data = structure_toc_from_pages(toc_text)
    toc_items = toc_data.get("toc", [])
    logger.info(f"parse_rfp: structure_toc: Completed. Found {len(toc_items)} top-level items.")
    
    # 4.1 Save TOC JSON to local file
    try:
        project_name = overview_data.get("project_name", "unknown_project")
        # Sanitize filename
        safe_project_name = "".join([c if c.isalnum() or c in (" ", "_", "-") else "_" for c in project_name]).strip()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"toc_{safe_project_name}_{timestamp}.json"
        
        # Ensure data directory exists (relative to backend root)
        # Assuming we are in backend/src/routers
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        data_dir = os.path.join(base_dir, "data", "toc_json")
        os.makedirs(data_dir, exist_ok=True)
        
        filepath = os.path.join(data_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(toc_items, f, ensure_ascii=False, indent=2)
        
        logger.info(f"parse_rfp: Saved structured TOC JSON to {filepath}")
    except Exception as e:
        logger.error(f"parse_rfp: Failed to save TOC JSON: {e}")
    
    # 5. Create a draft proposal and return info
    # In a real app, we might store the whole RFP text in a separate table or storage.
    # For simplicity, we just return the data.
    
    full_rfp_text = "\n".join([p.text for p in pages])
    
    logger.info("parse_rfp: Process completed successfully.")
    
    return {
        "overview": overview_data,
        "toc": toc_items,
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
