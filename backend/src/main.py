from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import proposals
import uvicorn
import os

app = FastAPI(title="Naraworks Backend")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(proposals.router)

@app.get("/")
async def root():
    return "Naraworks Backend is API Ready"

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
