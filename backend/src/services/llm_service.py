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
