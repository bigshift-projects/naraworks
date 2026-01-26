import io
import fitz  # PyMuPDF
from typing import List, Dict, Any
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PDFPage:
    page_number: int
    text: str
    
def extract_pages_from_pdf(file_bytes: bytes) -> List[PDFPage]:
    """
    Extracts text from a PDF file content (bytes) using PyMuPDF.
    Returns a list of PDFPage objects with page number and text.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text()
            pages.append(PDFPage(page_number=page_num + 1, text=text))
        logger.info(f"pdf_service: extract_pages: Successfully extracted {len(pages)} pages.")
        return pages
    except Exception as e:
        logger.error(f"pdf_service: extract_pages: Error extracting pages from PDF: {e}")
        return []

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts all text from a PDF file content (bytes).
    Maintains backward compatibility.
    """
    pages = extract_pages_from_pdf(file_bytes)
    return "\n".join([p.text for p in pages]).strip()

def get_overview_candidates(pages: List[PDFPage], limit: int = 20) -> List[PDFPage]:
    """
    Returns the first few pages which usually contain the project overview.
    """
    return pages[:limit]

def get_toc_candidates(pages: List[PDFPage]) -> List[PDFPage]:
    """
    Identifies pages that likely contain the Table of Contents.
    """
    candidates = []
    # Keywords that suggest a TOC or Guidelines page
    # "목차", "차례" -> Standard TOC
    # "작성 지침", "작성 가이드" -> Writing Guidelines
    # "평가 항목", "배점" -> Evaluation Criteria (often mirrors the required structure)
    keywords = ["목차", "차례", "작성 지침", "작성 가이드", "목 차"]
    
    # Check first 50 pages usually, skipping first 3 pages
    start_page = 3
    scan_limit = min(len(pages), 50)
    
    candidate_indices = set()
    
    for i in range(start_page, scan_limit):
        page = pages[i]
        # Check if any keyword exists in the text
        text_lower = page.text.lower()
        if any(k in text_lower for k in keywords):
            logger.info(f"pdf_service: get_toc_candidates: Found keyword on page {page.page_number}")
            candidate_indices.add(i)
            # Also add the next 3 pages as they might be continuation pages
            for offset in range(1, 4):
                if i + offset < len(pages):
                    candidate_indices.add(i + offset)
    
    # Sort and return unique pages
    sorted_indices = sorted(list(candidate_indices))
    candidates = [pages[i] for i in sorted_indices]
            
    return candidates

