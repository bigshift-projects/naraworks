import os
import json
from datetime import datetime

def test_save_toc_logic():
    # Mock data for new schema
    overview_data = {"project_name": "테스트 프로젝트"}
    toc_items = [
        {
            "chapter_title": "I. 제안 개요",
            "sub_sections": [
                {
                    "title": "1. 사업의 목적",
                    "guideline": "본 사업의 추진 배경 및 필요성을 구체적으로 기술..."
                }
            ]
        }
    ]
    
    try:
        project_name = overview_data.get("project_name", "unknown_project")
        # Sanitize filename (same logic as in generate.py)
        safe_project_name = "".join([c if c.isalnum() or c in (" ", "_", "-") else "_" for c in project_name]).strip()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"toc_{safe_project_name}_{timestamp}.json"
        
        # In the script, we specify the path directly
        base_dir = os.getcwd()
        data_dir = os.path.join(base_dir, "data", "toc_json")
        os.makedirs(data_dir, exist_ok=True)
        
        filepath = os.path.join(data_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(toc_items, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully saved TOC JSON to {filepath}")
        
        # Verify content
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data == toc_items
            print("Content verification passed!")
            
        return filepath
    except Exception as e:
        print(f"Failed to save TOC JSON: {e}")
        return None

if __name__ == "__main__":
    test_save_toc_logic()
