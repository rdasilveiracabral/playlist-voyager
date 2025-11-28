"""
Configuration management - loads from environment variables
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Spotify OAuth
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback")

    # Spotify scopes needed
    SPOTIFY_SCOPES = [
        "user-library-read",        # Read liked songs
        "user-read-recently-played", # Read play history
        "user-top-read",            # Read top artists/tracks
    ]

    # Anthropic (for LLM genre fallback)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

    # Database
    DATABASE_PATH = os.getenv("DATABASE_PATH", "data/spotify_cluster.db")

    # API rate limiting
    SPOTIFY_REQUEST_DELAY_MS = 100  # Delay between Spotify API calls


config = Config()
