"""
Spotify OAuth authentication flow
"""
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from config import config

router = APIRouter()

# Store tokens in memory (for local single-user use)
# In production, you'd use a proper session store
_token_cache = {}


def get_spotify_oauth() -> SpotifyOAuth:
    """Create SpotifyOAuth instance"""
    return SpotifyOAuth(
        client_id=config.SPOTIFY_CLIENT_ID,
        client_secret=config.SPOTIFY_CLIENT_SECRET,
        redirect_uri=config.SPOTIFY_REDIRECT_URI,
        scope=" ".join(config.SPOTIFY_SCOPES),
        cache_path=".spotify_cache",
        show_dialog=True,
    )


def get_spotify_client() -> spotipy.Spotify | None:
    """Get authenticated Spotify client"""
    oauth = get_spotify_oauth()
    token_info = oauth.get_cached_token()

    if not token_info:
        return None

    # Check if token needs refresh
    if oauth.is_token_expired(token_info):
        token_info = oauth.refresh_access_token(token_info["refresh_token"])

    return spotipy.Spotify(auth=token_info["access_token"])


@router.get("/config-status")
async def config_status():
    """Check if Spotify credentials are configured"""
    configured = bool(config.SPOTIFY_CLIENT_ID and config.SPOTIFY_CLIENT_SECRET)
    return {
        "configured": configured,
        "client_id_set": bool(config.SPOTIFY_CLIENT_ID),
        "client_secret_set": bool(config.SPOTIFY_CLIENT_SECRET),
    }


@router.get("/login")
async def login():
    """Redirect to Spotify login"""
    if not config.SPOTIFY_CLIENT_ID or not config.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Spotify credentials not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env file.",
        )

    oauth = get_spotify_oauth()
    auth_url = oauth.get_authorize_url()
    return RedirectResponse(auth_url)


@router.get("/callback")
async def callback(code: str = None, error: str = None):
    """Handle Spotify OAuth callback"""
    if error:
        raise HTTPException(status_code=400, detail=f"Spotify auth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="No authorization code received")

    oauth = get_spotify_oauth()
    try:
        token_info = oauth.get_access_token(code)
        # Redirect to frontend with success
        return RedirectResponse("http://localhost:5173/?auth=success")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get token: {str(e)}")


@router.get("/status")
async def auth_status():
    """Check if user is authenticated"""
    client = get_spotify_client()
    if not client:
        return {"authenticated": False}

    try:
        user = client.current_user()
        return {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "display_name": user["display_name"],
                "email": user.get("email"),
                "image": user["images"][0]["url"] if user.get("images") else None,
            },
        }
    except Exception:
        return {"authenticated": False}


@router.post("/logout")
async def logout():
    """Clear cached tokens"""
    import os
    cache_path = ".spotify_cache"
    if os.path.exists(cache_path):
        os.remove(cache_path)
    return {"status": "logged_out"}
