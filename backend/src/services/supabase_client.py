from typing import Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Optional[Client] = None

if not supabase_url or not supabase_key:
    print("⚠️ Missing Supabase URL or Key. Mock data will be used.")
else:
    try:
        supabase = create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"⚠️ Failed to initialize Supabase client: {e}")
        supabase = None
