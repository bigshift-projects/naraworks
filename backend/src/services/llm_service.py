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
    "generate_section_content": "gpt-5.2",   # 제안서 본문 작성 (플래그십 추론 모델)
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


def generate_section_content(section_title: str, rfp_context: str = "", toc: str = "") -> str:
    """
    Generates HTML content for a specific proposal section.
    """
    
    # Load company context from bigshift_info.md
    company_info_path = Path(__file__).resolve().parent.parent.parent / "data" / "빅시프트" / "bigshift_info.md"
    company_context = ""
    
    try:
        with open(company_info_path, 'r', encoding='utf-8') as f:
            company_context = f.read()
        logger.info(f"llm_service: generate_section_content: Loaded company context from {company_info_path}")
    except Exception as e:
        logger.warning(f"llm_service: generate_section_content: Could not load company context: {e}")
        company_context = ""

    # Parse and format rfp_context (JSON string) into narrative text
    formatted_rfp_context = rfp_context
    try:
        if rfp_context.strip().startswith("{"):
            rfp_data = json.loads(rfp_context)
            if isinstance(rfp_data, dict):
                summary = rfp_data.get("project_summary", "")
                budget = rfp_data.get("budget", "")
                period = rfp_data.get("period", "")
                
                parts = []
                if summary:
                    parts.append(summary)
                
                info_sentence = []
                if budget:
                    info_sentence.append(f"예산은 {budget}")
                if period:
                    info_sentence.append(f"기간은 {period}")
                
                if info_sentence:
                    parts.append(f"본 사업의 {'이며, '.join(info_sentence)}입니다.")
                
                if parts:
                    formatted_rfp_context = " ".join(parts)
    except Exception as e:
        logger.warning(f"llm_service: generate_section_content: Failed to format rfp_context: {e}")

    # Parse and format TOC (JSON string) into narrative text, and find specific guideline
    formatted_toc = toc
    target_guideline = ""
    try:
        if toc.strip().startswith("["):
            toc_data = json.loads(toc)
            if isinstance(toc_data, list):
                toc_lines = []
                for chapter in toc_data:
                    chapter_title = chapter.get("chapter_title", "")
                    if chapter_title:
                        toc_lines.append(chapter_title)
                    
                    sub_sections = chapter.get("sub_sections", [])
                    for sub in sub_sections:
                        sub_title = sub.get("title", "")
                        if sub_title:
                            toc_lines.append(sub_title)
                        
                        # Check if this is the target section to extract guideline
                        if sub_title == section_title:
                            target_guideline = sub.get("guideline", "")
                
                if toc_lines:
                    formatted_toc = "\n".join(toc_lines)
    except Exception as e:
        logger.warning(f"llm_service: generate_section_content: Failed to format TOC or find guideline: {e}")


    prompt_text = f"""
    당신은 나라장터(G2B) 기반의 공공/교육기관 AI 및 소프트웨어 용역 입찰에서 높은 기술 점수를 받아 낙찰되는걸 목표로 제안서를 작성하는 전문가입니다. 
    단순 요약이 아니라, 발주처의 문제를 해결하고 타사 대비 차별성을 강조하는 제안 내용을 생성해야 합니다.
    목차의 sub_section을 차례로 작성하고 있습니다.
    작성 가이드라인과 출력형식을 지켜서, 목차에서 "{section_title}"에 대해 구체적인 내용을 작성하세요. 

    1. 입력 데이터 (Context)
    - [사업 개요]: {formatted_rfp_context}
    - [전체 목차 구조]: {formatted_toc}

    2. 작성 가이드라인
    - 핵심 작성 지침: {target_guideline if target_guideline else "제안 요청서(RFP)의 요구사항을 충실히 반영하여 작성하세요."}
    - 구조화: 가독성을 위해 소제목, 불렛 포인트, 번호 매기기를 적극적으로 활용하세요.
    - 전문성: 기술적 용어를 정확하게 사용하고, 신뢰감을 주는 비즈니스 문체(명조체 기반의 개조식 또는 '~합니다'와 같은 정중한 문체)를 사용하세요.
    - 시각화 유도: 데이터나 프로세스를 설명할 때는 <table> 또는 <ul>, <li> 태그를 사용하여 구조화하세요.
    - 현실적 구체성: 추상적 표현 대신 "A 기술을 활용해 응답 속도를 1초 이내로 단축"과 같이 수치와 기술명을 구체적으로 명시하세요.
    - 평가 지표 기반: RFP상의 평가 배점 기준을 분석하여 점수가 부여되는 핵심 키워드를 반영하세요. 단, '발주사', '평가 핵심'과 같은 단어가 들어가면 안됩니다.
    - 분량: 공백 포함 약 1,300자 내외로 작성하세요.

    3. 추가 입력 데이터
    - [제안사(우리 회사) 강점 및 경험]: {company_context}

    4. 출력 형식
    - 결과물은 반드시 유효한 HTML 태그 형태로 출력하세요.
    - 사용 가능 태그: <h2>, <h3>, <h4>, <p>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>
    - <html>, <body>, <h1> 태그 및 마크다운 코드 블록(```html)은 포함하지 마세요.
    - 태그 외의 설명 문구(예: "네, 알겠습니다")는 생략하고 HTML 본문만 출력하세요.
    """
    logger.info(f"prompt_text: {prompt_text}")
    
    try:
        llm = get_llm("generate_section_content")
        response = llm.invoke(prompt_text)
        content = response.content.strip()
        
        # Clean up markdown code blocks (e.g., ```html ... ``` or just ``` ... ```)
        import re
        code_block_match = re.search(r"```(?:html)?\n?(.*?)\n?```", content, re.DOTALL)
        if code_block_match:
            content = code_block_match.group(1)
        else:
            # If no match from re.search, try stripping markers manually just in case
            if content.startswith("```"):
                content = re.sub(r"^```(?:html)?\n?", "", content)
                content = re.sub(r"\n?```$", "", content)
            
        return content.strip()
    except Exception as e:
        logger.error(f"Error generating section content: {e}")
        return f"<p>Error generating content: {str(e)}</p>"

