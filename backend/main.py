"""
Playlist Voyager - Backend API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from tracks import router as tracks_router
from genres import router as genres_router

app = FastAPI(
    title="Playlist Voyager",
    description="Explore your Spotify Liked Songs through temporal search and style clustering",
    version="0.1.0",
)

# Allow local frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(tracks_router, prefix="/tracks", tags=["Tracks"])
app.include_router(genres_router, prefix="/genres", tags=["Genres"])


@app.get("/")
async def root():
    return {
        "message": "Playlist Voyager API",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
