import os
from typing import List, Dict, Any, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from .llm_service import llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from .supabase_client import supabase

# --- State Definition ---

class ProposalState(TypedDict):
    project_id: str
    overview: Dict[str, Any]
    toc: List[Dict[str, Any]]
    current_section_index: int
    full_content: str
    rfp_text: str
    knowledge_context: str
    previous_section_summary: str

# --- Nodes ---

def section_generation_node(state: ProposalState):
    """Generates content for the current section."""
    current_index = state["current_section_index"]
    if current_index >= len(state["toc"]):
        return state

    current_section = state["toc"][current_index]
    section_title = current_section.get("title", "Untitled Section")
    section_desc = current_section.get("description", "")
    
    print(f"Generating content for section {current_index + 1}/{len(state['toc'])}: {section_title}")

    # Build Context
    # 1. Overview
    overview_str = f"Project: {state['overview'].get('project_name')}\n"
    overview_str += f"Objectives: {', '.join(state['overview'].get('key_objectives', []))}"
    
    # 2. RFP context (Simple truncation for now, ideally RAG)
    rfp_context = state["rfp_text"][:8000] # Simple window
    
    # 3. Knowledge context
    knowledge = state["knowledge_context"][:4000]

    system_prompt = f"""
    You are an expert proposal writer for B2G projects.
    Write a detailed, professional proposal section.
    
    [Project Overview]
    {overview_str}
    
    [Writing Guidelines for this Section]
    {section_desc}
    
    [Previous Section Context]
    {state['previous_section_summary'] or "This is the first section."}
    
    [Referenced RFP Requirements]
    {rfp_context}
    
    [Company Knowledge Base]
    {knowledge}
    
    Instructions:
    - Write in professional Korean.
    - Use HTML tags (h2, h3, p, ul, li) for structure.
    - Do NOT include <html> or <body> tags.
    - Ensure the content is specific to the RFP requirements.
    - Focus strictly on the section title: {section_title}
    """
    
    try:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Please write the content for '{section_title}'.")
        ]
        response = llm.invoke(messages)
        content = response.content
        
        # Summarize for next section context (Sliding window)
        summary_prompt = f"Summarize the following proposal section in 3-5 sentences for context: \n\n{content}"
        summary_response = llm.invoke(summary_prompt)
        
        # New merged content
        new_full_content = state["full_content"] + content
        
        # Update TOC status: Current -> done, Next -> generating (if exists)
        new_toc = list(state["toc"]) # Copy
        new_toc[current_index] = {**current_section, "status": "done"}
        
        next_index = current_index + 1
        if next_index < len(new_toc):
             new_toc[next_index] = {**new_toc[next_index], "status": "generating"}
        
        # --- Incremental DB Update ---
        if supabase:
            try:
                supabase.table("naraworks_proposals").update({
                    "content": new_full_content,
                    "toc": new_toc,
                    "updated_at": "now()"
                }).eq("id", state["project_id"]).execute()
            except Exception as e:
                print(f"Error updating DB incrementally: {e}")
        # -----------------------------
        
        # Update State
        return {
            "full_content": new_full_content,
            "toc": new_toc, # Important to pass updated TOC back to state
            "previous_section_summary": summary_response.content,
            "current_section_index": next_index
        }
    except Exception as e:
        print(f"Error in section generation: {e}")
        return {
            "current_section_index": current_index + 1
        }

def should_continue(state: ProposalState):
    """Determines if there are more sections to generate."""
    if state["current_section_index"] < len(state["toc"]):
        return "continue"
    else:
        return "end"

# --- Graph Creation ---

def create_proposal_engine():
    workflow = StateGraph(ProposalState)
    
    # Add nodes
    workflow.add_node("generate_section", section_generation_node)
    
    # Set entry point
    workflow.set_entry_point("generate_section")
    
    # Add conditional edge
    workflow.add_conditional_edges(
        "generate_section",
        should_continue,
        {
            "continue": "generate_section",
            "end": END
        }
    )
    
    return workflow.compile()

# --- Public Interface ---

async def run_sequential_generation(
    project_id: str,
    overview: Dict[str, Any],
    toc: List[Dict[str, Any]],
    rfp_text: str,
    user_id: str = "00000000-0000-0000-0000-000000000000"
):
    """
    Runs the full generation graph and updates the DB.
    """
    # Initialize Context (Knowledge Base)
    knowledge_context = ""
    if supabase:
        try:
            # Fetch all user knowledge for now (Simple MVP)
            # In production, this would be a Vector Search result.
            res = supabase.table("naraworks_knowledge").select("content").execute()
            knowledge_context = "\n---\n".join([r.get("content", "") for r in res.data])
        except Exception as e:
            print(f"Error fetching knowledge: {e}")

    initial_state = {
        "project_id": project_id,
        "overview": overview,
        "toc": toc,
        "current_section_index": 0,
        "full_content": "",
        "rfp_text": rfp_text,
        "knowledge_context": knowledge_context,
        "previous_section_summary": ""
    }
    
    engine = create_proposal_engine()
    final_state = await engine.ainvoke(initial_state)
    
    # Update Proposal in DB (or Mock)
    final_html = final_state["full_content"]
    
    if supabase:
        try:
            supabase.table("naraworks_proposals").update({
                "content": final_html,
                "status": "completed",
                "updated_at": "now()" # specific handling might be needed depending on supabase-py
            }).eq("id", project_id).execute()
        except Exception as e:
            print(f"Error updating proposal final content: {e}")
            
    return final_html
