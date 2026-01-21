import os
import json
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

class ProjectOverview(BaseModel):
    project_name: str = Field(description="The name of the project")
    budget: str = Field(description="The budget of the project")
    period: str = Field(description="The period of the project")
    key_objectives: List[str] = Field(description="List of key objectives or tasks")

class TOCItem(BaseModel):
    title: str = Field(description="Section title, e.g. '1. Introduction'")
    description: str = Field(description="Brief guideline or content description for this section")
    sub_sections: Optional[List['TOCItem']] = Field(default=None, description="Nested subsections")

class TOCStructure(BaseModel):
    toc: List[TOCItem] = Field(description="The list of top-level TOC items")

def analyze_rfp_overview(text_content: str) -> Dict[str, Any]:
    """
    Analyzes the beginning of an RFP to extract project overview.
    Returns a dictionary matching ProjectOverview model.
    """
    parser = PydanticOutputParser(pydantic_object=ProjectOverview)
    
    prompt = PromptTemplate(
        template="""
        You are an expert proposal manager. Analyze the provided text from a Request for Proposal (RFP).
        Extract the following key information:
        - Project Name
        - Project Budget (Approximate if not exact)
        - Project Period
        - Key Objectives (Summarize into 3-5 bullet points)
        
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
        result = chain.invoke({"text": text_content[:15000]})
        return result.model_dump()
    except Exception as e:
        print(f"Error extracting overview: {e}")
        return {
            "project_name": "Error extracting name",
            "budget": "Unknown",
            "period": "Unknown",
            "key_objectives": []
        }

def structure_toc_from_pages(text_content: str) -> Dict[str, Any]:
    """
    Parse text from TOC pages and structure it into JSON.
    """
    parser = PydanticOutputParser(pydantic_object=TOCStructure)
    
    prompt = PromptTemplate(
        template="""
        You are an expert proposal writer. The following text contains the 'Table of Contents' or 'Writing Guidelines' from an RFP.
        Your task is to structure this into a clean JSON format.
        
        Focus on the main structure (I, II, III or 1, 2, 3) and their subsections.
        If there are specific guidelines or descriptions for each section, include them.
        
        {format_instructions}
        
        [TOC Text]
        {text}
        """,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    
    try:
        result = chain.invoke({"text": text_content[:15000]})
        return result.model_dump()
    except Exception as e:
        print(f"Error structuring TOC: {e}")
        return {"toc": []}

def generate_proposal_draft(rfp_text: str, notice_text: str) -> dict:
    """
    Generates a proposal draft title and content based on RFP and Notice text.
    Returns a dict with 'title' and 'content'.
    DEPRECATED: Using simple generation. Future refactor will use sequential generation.
    """
    
    # Simple fallback using direct OpenAI for now, or could use LangChain
    # For backward compatibility with existing tests/frontend, we keep this simple logic.
    
    prompt = f"""
    You are an expert proposal writer.
    Based on the following RFP and Notice, write a simple proposal draft.
    Return JSON with 'title' and 'content' (HTML).
    
    [Notice]
    {notice_text[:2000]}
    
    [RFP]
    {rfp_text[:8000]}
    """
    
    try:
        response = llm.invoke(prompt)
        # Parse JSON from content (assuming model obeys)
        # A more robust way is using JsonOutputParser
        parser = JsonOutputParser()
        return parser.parse(response.content)
    except Exception as e:
        print(f"Error generating proposal with LLM: {e}")
        return {
            "title": "Error Generating Proposal",
            "content": f"<p>Failed to generate draft. Error: {str(e)}</p>"
        }

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
        parser = JsonOutputParser()
        prompt = PromptTemplate(
            template="{system_prompt}\n\n{user_message}",
            input_variables=["system_prompt", "user_message"]
        )
        chain = prompt | llm | parser
        return chain.invoke({"system_prompt": system_prompt, "user_message": user_message})
    except Exception as e:
        print(f"Error generating TOC with LLM: {e}")
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

