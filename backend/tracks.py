"""
Track-related API endpoints
"""
from dataclasses import asdict
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import store
import spotify_client as spotify

router = APIRouter()

# Track sync status
_sync_status = {
    "in_progress": False,
    "progress": 0,
    "total": 0,
    "stage": "",
    "error": None,
}


class SyncStatus(BaseModel):
    in_progress: bool
    progress: int
    total: int
    stage: str
    error: str | None


def track_to_dict(track: store.Track) -> dict:
    """Convert Track dataclass to dict"""
    return asdict(track)


@router.get("/count")
async def get_track_count():
    """Get number of cached tracks"""
    count = store.get_track_count()
    last_synced = store.get_last_synced()
    return {"count": count, "last_synced": last_synced}


@router.get("/search")
async def search_tracks(q: str, limit: int = 20):
    """Search tracks by name"""
    if not q or len(q) < 2:
        return {"tracks": []}

    tracks = store.search_tracks(q, limit)
    return {"tracks": [track_to_dict(t) for t in tracks]}


@router.get("/neighbors/{track_id}")
async def get_temporal_neighbors(track_id: str, count: int = 5):
    """Get tracks saved before and after a given track"""
    result = store.get_temporal_neighbors(track_id, count)

    return {
        "before": [track_to_dict(t) for t in result["before"]],
        "target": track_to_dict(result["target"]) if result["target"] else None,
        "after": [track_to_dict(t) for t in result["after"]],
    }


@router.get("/all")
async def get_all_tracks():
    """Get all tracks (for visualization)"""
    tracks = store.get_all_tracks()
    return {"tracks": [track_to_dict(t) for t in tracks], "total": len(tracks)}


@router.get("/with-features")
async def get_tracks_with_features():
    """Get all tracks with audio features (for clustering)"""
    tracks = store.get_tracks_with_features()
    return {"tracks": tracks, "total": len(tracks)}


@router.get("/recent")
async def get_recent_plays(limit: int = 50):
    """Get recently played tracks"""
    # First fetch from Spotify to update our cache
    try:
        await spotify.fetch_recently_played(limit)
    except Exception as e:
        print(f"Failed to fetch recent plays from Spotify: {e}")

    # Then return from cache
    plays = store.get_recent_plays(limit)
    return {"plays": plays}


def update_sync_progress(progress: int, total: int, stage: str = ""):
    """Callback for sync progress updates"""
    global _sync_status
    _sync_status["progress"] = progress
    _sync_status["total"] = total
    _sync_status["stage"] = stage


async def run_sync():
    """Background task to sync all Spotify data"""
    global _sync_status

    try:
        _sync_status["in_progress"] = True
        _sync_status["error"] = None

        result = await spotify.sync_all_data(update_sync_progress)

        _sync_status["stage"] = f"Complete! {result['tracks']} tracks, {result['artists']} artists"
    except Exception as e:
        _sync_status["error"] = str(e)
        raise
    finally:
        _sync_status["in_progress"] = False


@router.post("/sync")
async def start_sync(background_tasks: BackgroundTasks):
    """Start syncing liked songs from Spotify"""
    global _sync_status

    if _sync_status["in_progress"]:
        raise HTTPException(status_code=409, detail="Sync already in progress")

    _sync_status = {
        "in_progress": True,
        "progress": 0,
        "total": 0,
        "stage": "Starting...",
        "error": None,
    }

    background_tasks.add_task(run_sync)
    return {"status": "started"}


@router.get("/sync/status")
async def get_sync_status() -> SyncStatus:
    """Get current sync status"""
    return SyncStatus(**_sync_status)
