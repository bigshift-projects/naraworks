import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser, PydanticOutputParser
from pydantic import BaseModel, Field

# Ensure models are imported if needed, or define local Pydantic models for extraction
# from ..models.proposals import ...

# Load .env from backend root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize ChatOpenAI
llm = ChatOpenAI(model="gpt-4o", temperature=0)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProjectOverview(BaseModel):
    project_name: str = Field(description="The name of the project")
    budget: str = Field(description="The budget of the project")
    period: str = Field(description="The period of the project")
    key_objectives: List[str] = Field(description="List of key objectives or tasks")
    project_summary: str = Field(description="A 10-line summary of the project background and purpose")

class SubsectionItem(BaseModel):
    title: str = Field(description="Subsection title, e.g. '1. 사업의 목적'")
    guideline: str = Field(description="Writing guideline for this subsection")

class ChapterItem(BaseModel):
    chapter_title: str = Field(description="Chapter title, e.g. 'I. 제안 개요'")
    sub_sections: List[SubsectionItem] = Field(description="List of sub-sections")

class TOCStructure(BaseModel):
    toc: List[ChapterItem] = Field(description="The list of chapters")

class ClassificationResult(BaseModel):
    is_proposal_guide: bool = Field(description="True if the page contains proposal writing guidelines or proposal TOC")
    reason: str = Field(description="Reasoning for the classification")

def analyze_rfp_overview(text_content: str) -> Dict[str, Any]:
    """
    Analyzes the beginning of an RFP to extract project overview.
    Returns a dictionary matching ProjectOverview model.
    """
    parser = PydanticOutputParser(pydantic_object=ProjectOverview)
    
    prompt = PromptTemplate(
        template="""
        You are an expert proposal manager. Analyze the provided text from a Request for Proposal (RFP).
        Extract the following key information. ALL OUTPUT MUST BE IN KOREAN.

        - Project Name (사업명)
        - Project Budget (사업 예산 - Approximate if not exact)
        - Project Period (사업 기간)
        - Key Objectives (주요 과업 - Summarize into 3-5 bullet points in Korean)
        - Project Summary (사업 개요 요약 - Summarize the project background and purpose in about 10 lines in Korean)
        
        {format_instructions}
        
        [RFP Content Start]
        {text}
        [RFP Content End]
        """,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    
    try:
        # Limit text to avoid token limits, though overview is usually at the start
        logger.info("llm_service: analyze_rfp_overview: Sending request to LLM...")
        result = chain.invoke({"text": text_content[:15000]})
        logger.info("llm_service: analyze_rfp_overview: LLM response received.")
        return result.model_dump()
    except Exception as e:
        logger.error(f"llm_service: analyze_rfp_overview: Error: {e}")
        return {
            "project_name": "Error extracting name",
            "budget": "Unknown",
            "period": "Unknown",
            "key_objectives": [],
            "project_summary": "Error extracting summary"
        }

def classify_toc_page(text_content: str) -> bool:
    """
    Classifies if a page contains Proposal Writing Guidelines or Proposal TOC.
    """
    parser = PydanticOutputParser(pydantic_object=ClassificationResult)
    
    prompt = PromptTemplate(
        template="""
        You are an expert proposal manager. Analyze the provided text from a Request for Proposal (RFP) page.
        Determine if this page contains the **Proposal Writing Guidelines** (제안서 작성 지침/요령) or **Proposal Table of Contents** (제안서 작성 목차).
        
        The RFP document itself has a Table of Contents (usually at the beginning). WE DO NOT WANT THAT.
        We want the section that tells the *supplier* how to structure their proposal.
        
        Keywords to look for:
        - "제안서 목차" (Proposal Table of Contents)
        - "작성 지침" (Writing Guidelines)
        - "평가 항목" (Evaluation Criteria - often mirrors the required structure)
        - "목차 및 주요내용"
        
        Important:
        - The TOC often spans multiple pages.
        - If this page looks like a **continuation** of a list or table from a previous page (e.g., starts with item "3.", "4.", or "IV."), MARK IT AS TRUE.
        - Even if it doesn't have the title "TOC", if it contains the *content* of the proposal structure, it is valid.
        
        Answer TRUE only if it defines how the supplier should write the proposal (or is a valid continuation).
        Answer FALSE if it is just the RFP's own table of contents, legal terms, or unrelated text.
        
        {format_instructions}
        
        [Page Text]
        {text}
        """,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    
    try:
        # Limit text to 2000 chars for classification to save cost/time
        result = chain.invoke({"text": text_content[:4000]})
        logger.info(f"llm_service: classify_toc_page: Result: {result.is_proposal_guide}, Reason: {result.reason}")
        return result.is_proposal_guide
    except Exception as e:
        logger.error(f"llm_service: classify_toc_page: Error: {e}")
        return False

def structure_toc_from_pages(text_content: str) -> Dict[str, Any]:
    """
    Parse text from TOC pages and structure it into JSON.
    """
    parser = PydanticOutputParser(pydantic_object=TOCStructure)
    
    prompt = PromptTemplate(
        template="""
        You are an expert proposal writer. The following text contains the 'Proposal Writing Guidelines' or 'Proposal Table of Contents' extracted from an RFP.
        Your task is to structure this into a clean, hierarchical JSON format.
        
        **CRITICAL INSTRUCTIONS:**
        1. **Ignore RFP's own TOC**: If the text contains the RFP's document outline (e.g. "1. Project Overview... 2. Current Status..."), IGNORE IT. Only extract the structure required for the *Proposal Response*.
        2. **Hierarchy**: transform the flat text into a nested structure (Chapter -> Sub-sections).
           - Big Chapters (e.g., I, II, III... or 1, 2, 3...) should be mapped to 'chapter_title'.
           - Sections under them (e.g., 1, 2, 3... or 가, 나, 다...) should be mapped to 'sub_sections' list with 'title'.
        3. **Guidelines**: If there are specific requirements or evaluation criteria associated with a section, include them in the 'guideline' field.
        4. **Exhaustiveness**: Extract ALL chapters and sections found in the text. Do not skip any items.
        
        {format_instructions}
        
        [Extracted Text]
        {text}
        """,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    # Use GPT-4o for complex structuring
    chain = prompt | llm | parser
    
    try:
        logger.info("llm_service: structure_toc: Sending request to LLM...")
        logger.info(f"llm_service: structure_toc: Input Text Preview (first 500 chars):\n{text_content[:500]}...")
        result = chain.invoke({"text": text_content[:25000]}) # Increased context limit for gathered pages
        logger.info("llm_service: structure_toc: LLM response received.")
        return result.model_dump()
    except Exception as e:
        logger.error(f"llm_service: structure_toc: Error: {e}")
        return {"toc": []}


def generate_toc(rfp_text: str) -> dict:
    """
    Generates a Table of Contents (TOC) based on RFP text.
    Returns a dict with 'toc', which is a list of sections.
    """
    
    system_prompt = """
    You are an expert proposal writer. 
    Analyze the provided Request for Proposal (RFP) text and create a structured Table of Contents (TOC).
    
    Output Format:
    Return a JSON object with a "toc" key.
    "toc" should be a list of objects, each having:
    - "title": The section title (e.g., "1. Project Overview")
    - "description": A brief description of what should go in this section.
    
    Example:
    {
      "toc": [
        {"title": "1. 제안 개요", "description": "사업 배경 및 목적, 추진 전략"},
        {"title": "2. 제안 업체 현황", "description": "일반 현황, 조직 및 인원, 주요 사업 실적"}
      ]
    }
    """

    user_message = f"""
    [RFP content]
    {rfp_text[:15000]}
    
    Based on the RFP above, suggest a comprehensive Table of Contents for the proposal.
    """

    try:
        logger.info("llm_service: generate_toc: Sending request to LLM...")
        parser = JsonOutputParser()
        prompt = PromptTemplate(
            template="{system_prompt}\n\n{user_message}",
            input_variables=["system_prompt", "user_message"]
        )
        chain = prompt | llm | parser
        result = chain.invoke({"system_prompt": system_prompt, "user_message": user_message})
        logger.info("llm_service: generate_toc: LLM response received.")
        return result
    except Exception as e:
        logger.error(f"llm_service: generate_toc: Error: {e}")
        return {
            "toc": [
                {"title": "Error Generating TOC", "description": str(e)}
            ]
        }

def generate_section_content(section_title: str, rfp_context: str = "") -> str:
    """
    Generates HTML content for a specific proposal section.
    """
    
    system_prompt = """
    You are an expert proposal writer.
    Write the content for a specific section of a proposal based on the RFP.
    
    Output Format:
    Return valid HTML for the section content. 
    Use appropriate tags (h2, h3, p, ul, li).
    Do not include the main h1 title or <html>/<body> tags.
    Target the content specifically for the given section title.
    """
    
    user_message = f"""
    [Section Title]
    {section_title}
    
    [RFP Context]
    {rfp_context[:5000]}
    
    Write the detailed content for this section.
    """
    
    try:
        response = llm.invoke(f"{system_prompt}\n\n{user_message}")
        return response.content
    except Exception as e:
        print(f"Error generating section content: {e}")
        return f"<p>Error generating content: {str(e)}</p>"

