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

# LLM Model Configuration
# 각 함수별로 사용할 모델을 여기서 정의합니다.
MODEL_CONFIG = {
    "default": "gpt-5.1",
    "analyze_rfp_overview": "gpt-5.1",   # 사업 개요 작성
    "classify_toc_page": "gpt-5.1",   # 목차 페이지 분류
    "structure_toc_from_pages": "gpt-5.1",   # 목차 구조화
    "generate_section_content": "gpt-5.2",   # 제안서 본문 작성
}

def get_llm(task_name: str = "default", temperature: float = 0) -> ChatOpenAI:
    """
    Returns a ChatOpenAI instance based on the task name configuration.
    """
    model_name = MODEL_CONFIG.get(task_name, MODEL_CONFIG["default"])
    return ChatOpenAI(model=model_name, temperature=temperature)

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
    
    llm = get_llm("analyze_rfp_overview")
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
    
    llm = get_llm("classify_toc_page")
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
    llm = get_llm("structure_toc_from_pages")
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


def generate_section_content(section_title: str, rfp_context: str = "") -> str:
    """
    Generates HTML content for a specific proposal section.
    """
    
    system_prompt = """
    너는 공공기관 및 교육기관 입찰용 제안서 작성 전문가야. 
    나라장터 B2G 정부 입찰공고에서 AI 및 소프트웨어 용역에 참가해 낙찰받으려고 제안서를 만들거야. 
    참여하려는 사업 개요는 아래와 같아.

    [사업 개요]
    {rfp_context}

    작성해야하는 제안서 목차는 아래와 같아. 중분류 목차를 차례로 하나씩 내용을 작성할 거야.

    [제안서 목차]
    {toc}

    제안서 목차에서 "{section_title}"의 내용에 대해 구체적인 내용을 작성해줘.
    작성 가이드라인과 출력형식을 지켜서 작성해줘.

    [작성 가이드라인]
    - (제안서 목차의 지침)
    - 글자수 1,500자 이내로 작성해줘.
    - 표나 차트를 넣어도 좋아.
    - 구조화: 가독성을 위해 소제목, 불렛 포인트, 번호 매기기를 적극적으로 활용해줘.
    - RFP 준수: 반드시 제안요청서에 명시된 요구사항과 핵심 키워드를 반영해야 해.
    - 첨부한 제안요청서 pdf파일을 참고해.
    - 필요시, 첨부한 회사소개서 pdf파일을 참고해.
    - 필요시, 첨부한 제안서 pdf 파일을 참고해. 단, 프로젝트 세부 내용이 다르니 주의해.
    - 전문성: 기술적 용어를 정확하게 사용하고, 신뢰감을 주는 비즈니스 문체(~함, ~임 등 명조체 기반의 개조식 또는 정중한 평어체)를 사용해줘.
    

    [출력 형식]
    - 해당 섹션의 내용을 유효한 HTML 태그로 작성해줘.
    - <h2>, <h3>, <p>, <ul>, <li> 등의 태그를 사용하되, 문서 전체 제목인 <h1>이나 <html>, <body> 태그는 포함하지 마.
    - 바로 웹페이지나 제안서 툴에 삽입할 수 있는 순수 섹션 콘텐츠만 출력해줘.
    """
    
    try:
        llm = get_llm("generate_section_content")
        response = llm.invoke(f"{system_prompt}\n\n{user_message}")
        return response.content
    except Exception as e:
        print(f"Error generating section content: {e}")
        return f"<p>Error generating content: {str(e)}</p>"

