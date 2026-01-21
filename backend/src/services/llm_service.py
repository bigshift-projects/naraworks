import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_proposal_draft(rfp_text: str, notice_text: str) -> dict:
    """
    Generates a proposal draft title and content based on RFP and Notice text.
    Returns a dict with 'title' and 'content'.
    """
    
    system_prompt = """
    You are an expert proposal writer for Korean B2G (Business to Government) projects.
    Your task is to write a high-quality proposal draft based on the provided 'Request for Proposal (RFP)' text and 'Public Notice' text.
    
    Output Format:
    Return valid HTML for the content section.
    The response should be strictly just the content HTML, but since I need a title as well, 
    I will ask you to format your response as a JSON object (or similar structured text) so I can parse 'title' and 'content'.
    
    However, for simplicity in this function, return a JSON object with:
    {
      "title": "Suggested Proposal Title",
      "content": "<h1>1. Overview</h1><p>...</p>"
    }
    The content should be detailed, professional, and structured with H1, H2, p, ul, li tags.
    Escape any characters that might break JSON if necessary, but using the standard API response format is usually fine.
    """

    user_message = f"""
    [Public Notice Info]
    {notice_text[:3000]} 

    [RFP content]
    {rfp_text[:10000]}
    
    Based on the above, write a proposal draft.
    1. Title: Create a professional title for this proposal.
    2. Content: Write the initial draft of the proposal in HTML format.
       - Include an Executive Summary.
       - Include Understanding of the Project.
       - Include Proposed Methodology.
       - Include Expected Outcomes.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": system_prompt + "\n\n" + user_message}
            ],
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content
        import json
        return json.loads(result)
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
        response = client.chat.completions.create(
            model="gpt-4o", # Using a capable model for structure
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": system_prompt + "\n\n" + user_message}
            ],
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content
        import json
        return json.loads(result)
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
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating section content: {e}")
        return f"<p>Error generating content: {str(e)}</p>"

