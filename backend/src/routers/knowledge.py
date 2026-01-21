from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from ..services.supabase_client import supabase
from ..services.pdf_service import extract_text_from_pdf

router = APIRouter(
    prefix="/api/knowledge",
    tags=["knowledge"]
)

class KnowledgeItem(BaseModel):
    id: str
    filename: str
    content_preview: str
    created_at: str

@router.post(
    "/upload", 
    summary="Upload knowledge base document",
    description="Upload a PDF file to be added to the knowledge base context."
)
async def upload_knowledge(file: UploadFile = File(...)):
    content = ""
    filename = file.filename
    
    if filename.endswith(".pdf"):
        file_bytes = await file.read()
        content = extract_text_from_pdf(file_bytes)
    else:
        # Assume text for now
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8")
        
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # In a real app, we would split into chunks and generate embeddings.
    # For this MVP, we will save the raw text to a table 'naraworks_knowledge'.
    
    if not supabase:
        return {"message": "DB disconnected, mocked upload", "filename": filename}

    try:
        data = {
            "filename": filename,
            "content": content,
            "created_at": datetime.now().isoformat()
        }
        # Assuming table exists or we just fail gracefully. 
        # Ideally we strictly define schema, but this is an MVP step.
        response = supabase.table("naraworks_knowledge").insert(data).execute()
        return response.data[0] if isinstance(response.data, list) and len(response.data) > 0 else response.data
    except Exception as e:
        print(f"DB Error (Knowledge Upload): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/",
    response_model=List[KnowledgeItem],
    summary="List knowledge base items"
)
async def list_knowledge():
    if not supabase:
        return []

    try:
        # Fetch just id, filename, created_at, and substring of content
        response = supabase.table("naraworks_knowledge").select("id, filename, content, created_at").order("created_at", desc=True).execute()
        items = []
        for row in response.data:
            items.append({
                "id": str(row.get("id")),
                "filename": row.get("filename"),
                "content_preview": row.get("content", "")[:100] + "...",
                "created_at": row.get("created_at")
            })
        return items
    except Exception as e:
        print(f"DB Error (Knowledge List): {e}")
        return []
