import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL: {supabase_url}")
print(f"Key exists: {bool(supabase_key)}")

if not supabase_url or not supabase_key:
    print("❌ Missing credentials")
else:
    try:
        supabase = create_client(supabase_url, supabase_key)
        # Try to fetch from proposals table
        response = supabase.table("naraworks_proposals").select("*", count="exact").limit(1).execute()
        print("✅ Connection successful!")
        print(f"Data found: {len(response.data)} rows")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
