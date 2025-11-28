"""
Track-related API endpoints
"""
import json
from dataclasses import asdict
from typing import List
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
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


@router.get("/listening-stats")
async def get_listening_stats():
    """Get listening statistics for calendar and hourly patterns"""
    # Get all plays (recent + historical)
    plays = store.get_all_plays()

    # Group by date for calendar
    daily_counts: dict[str, int] = {}

    # Group by hour for pattern
    hourly_pattern = [0] * 24

    for play in plays:
        played_at = play["played_at"]
        date = played_at[:10]  # YYYY-MM-DD
        try:
            hour = int(played_at[11:13])  # HH
        except (ValueError, IndexError):
            hour = 0

        daily_counts[date] = daily_counts.get(date, 0) + 1
        hourly_pattern[hour] += 1

    return {
        "daily_counts": daily_counts,
        "hourly_pattern": hourly_pattern,
        "total_plays": len(plays),
        "date_range": {
            "start": min(daily_counts.keys()) if daily_counts else None,
            "end": max(daily_counts.keys()) if daily_counts else None,
        },
    }


@router.get("/plays-by-date/{date}")
async def get_plays_by_date(date: str):
    """Get plays for a specific date (YYYY-MM-DD)"""
    plays = store.get_all_plays()
    filtered = [p for p in plays if p["played_at"].startswith(date)]
    # Sort by time within the day
    filtered.sort(key=lambda p: p["played_at"])
    return {"plays": filtered, "date": date, "count": len(filtered)}


@router.post("/import-history")
async def import_streaming_history(files: List[UploadFile] = File(...)):
    """Import Spotify Extended Streaming History JSON files"""
    imported = 0
    skipped = 0
    errors = []

    for file in files:
        try:
            content = await file.read()
            data = json.loads(content)

            for entry in data:
                # Skip very short plays (< 30 seconds) - likely skips
                ms_played = entry.get("ms_played", 0)
                if ms_played < 30000:
                    skipped += 1
                    continue

                # Extract track_id from URI if available
                uri = entry.get("spotify_track_uri", "")
                track_id = uri.split(":")[-1] if uri and ":" in uri else None

                # Get timestamp - Spotify uses "ts" field
                played_at = entry.get("ts", "")
                if not played_at:
                    skipped += 1
                    continue

                play = {
                    "track_id": track_id,
                    "played_at": played_at,
                    "ms_played": ms_played,
                    "track_name": entry.get("master_metadata_track_name", ""),
                    "artist_name": entry.get("master_metadata_album_artist_name", ""),
                    "album_name": entry.get("master_metadata_album_album_name"),
                    "skipped": entry.get("skipped", False),
                }

                # Skip entries without track name
                if not play["track_name"]:
                    skipped += 1
                    continue

                store.add_historical_play(play)
                imported += 1

        except json.JSONDecodeError as e:
            errors.append(f"{file.filename}: Invalid JSON - {str(e)}")
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    # Save after all files processed
    if imported > 0:
        store.save_historical_plays()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_historical": store.get_historical_play_count(),
    }


@router.get("/history-stats")
async def get_history_stats():
    """Get statistics about imported historical data"""
    return {
        "historical_count": store.get_historical_play_count(),
        "recent_count": len(store.get_store().recent_plays),
    }


@router.delete("/history")
async def clear_history():
    """Clear all imported historical data"""
    store.clear_historical_plays()
    return {"status": "cleared"}


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
