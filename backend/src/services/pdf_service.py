import io
import fitz  # PyMuPDF
from typing import List, Dict, Any
from dataclasses import dataclass

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
        return pages
    except Exception as e:
        print(f"Error extracting pages from PDF: {e}")
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
    # Keywords that suggest a TOC page
    keywords = ["목차", "차례", "contents", "table of contents", "순서"]
    
    # Check first 30 pages usually
    scan_limit = min(len(pages), 30)
    
    for i in range(scan_limit):
        page = pages[i]
        # Check if any keyword exists in the first few lines or strictly in the page
        # Simple heuristic: if "목차" is in the page and page has lines.
        # We can refine this to check line density or specific headers.
        text_lower = page.text.lower()
        if any(k in text_lower for k in keywords):
            # Additional heuristic: TOC pages usually have lines ending with numbers or dots
            # For now, we trust the keyword but limit the scope.
            candidates.append(page)
            
    return candidates

