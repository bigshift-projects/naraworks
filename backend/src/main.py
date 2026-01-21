from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import proposals
import uvicorn
import os

app = FastAPI(
    title="Naraworks API",
    description="""
Naraworks Backend API for B2G Proposal Generation and Management.
This API provides endpoints for:
*   Listing and managing proposal drafts.
*   Generating new proposal drafts using LLM from PDF inputs (RFP and Notice).
""",
    version="1.0.0",
    contact={
        "name": "Naraworks Support",
        "email": "support@naraworks.com",
    },
    openapi_tags=[
        {
            "name": "proposals",
            "description": "Operations with proposal drafts, including generation and management.",
        }
    ]
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trust Proxy Headers (for HTTPS on Railway)
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# Include Routers
app.include_router(proposals.router)

@app.get("/")
async def root():
    return "Naraworks Backend is API Ready"

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
