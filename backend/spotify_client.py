"""
Spotify API client wrapper - handles data fetching with rate limiting
"""
import asyncio
from typing import Callable, Optional
from auth import get_spotify_client
from config import config
import store


async def fetch_all_liked_songs(
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> list[dict]:
    """
    Fetch all liked songs from Spotify API.
    Returns list of track data.
    """
    client = get_spotify_client()
    if not client:
        raise RuntimeError("Not authenticated with Spotify")

    offset = 0
    limit = 50
    total = None
    tracks = []

    while True:
        # Rate limiting
        await asyncio.sleep(config.SPOTIFY_REQUEST_DELAY_MS / 1000)

        results = client.current_user_saved_tracks(limit=limit, offset=offset)

        if total is None:
            total = results["total"]
            if progress_callback:
                progress_callback(0, total, "Fetching liked songs...")

        items = results.get("items", [])
        if not items:
            break

        for item in items:
            track = item["track"]
            if not track:  # Skip null tracks (can happen with removed songs)
                continue

            track_data = {
                "id": track["id"],
                "name": track["name"],
                "artist_ids": [a["id"] for a in track["artists"]],
                "artist_names": [a["name"] for a in track["artists"]],
                "album_name": track["album"]["name"],
                "album_image_url": track["album"]["images"][0]["url"] if track["album"].get("images") else None,
                "duration_ms": track["duration_ms"],
                "popularity": track["popularity"],
                "preview_url": track.get("preview_url"),
                "spotify_url": track["external_urls"]["spotify"],
                "added_at": item["added_at"],
            }
            tracks.append(track_data)
            store.add_track(track_data)

        offset += limit
        if progress_callback:
            progress_callback(min(offset, total), total, "Fetching liked songs...")

        if offset >= total:
            break

    return tracks


async def fetch_artist_genres(artist_ids: list[str]) -> dict[str, list[str]]:
    """
    Fetch genres for multiple artists (batch of up to 50)
    Returns dict mapping artist_id -> list of genres
    """
    client = get_spotify_client()
    if not client:
        raise RuntimeError("Not authenticated with Spotify")

    result = {}

    # Process in batches of 50 (Spotify API limit)
    for i in range(0, len(artist_ids), 50):
        batch = artist_ids[i:i + 50]
        await asyncio.sleep(config.SPOTIFY_REQUEST_DELAY_MS / 1000)

        try:
            artists = client.artists(batch)
            for artist in artists.get("artists", []):
                if artist:
                    result[artist["id"]] = artist.get("genres", [])
                    # Also cache the artist data
                    store.add_artist({
                        "id": artist["id"],
                        "name": artist["name"],
                        "genres": artist.get("genres", []),
                        "popularity": artist.get("popularity"),
                        "image_url": artist["images"][0]["url"] if artist.get("images") else None,
                    })
        except Exception as e:
            print(f"Error fetching artist batch: {e}")

    return result


async def fetch_audio_features(
    track_ids: list[str],
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> list[dict]:
    """
    Fetch audio features for multiple tracks (batch of up to 100)
    """
    client = get_spotify_client()
    if not client:
        raise RuntimeError("Not authenticated with Spotify")

    result = []
    total = len(track_ids)

    # Process in batches of 100 (Spotify API limit)
    for i in range(0, len(track_ids), 100):
        batch = track_ids[i:i + 100]
        await asyncio.sleep(config.SPOTIFY_REQUEST_DELAY_MS / 1000)

        if progress_callback:
            progress_callback(i, total, "Fetching audio features...")

        try:
            features = client.audio_features(batch)
            for feature in features:
                if feature:  # Can be None for some tracks
                    result.append(feature)
                    store.add_audio_features(feature)
        except Exception as e:
            print(f"Error fetching audio features batch: {e}")

    return result


async def fetch_recently_played(limit: int = 50) -> list[dict]:
    """
    Fetch recently played tracks (max 50 from Spotify API)
    """
    client = get_spotify_client()
    if not client:
        raise RuntimeError("Not authenticated with Spotify")

    results = client.current_user_recently_played(limit=limit)

    plays = []
    for item in results.get("items", []):
        track = item["track"]
        play_data = {
            "track_id": track["id"],
            "played_at": item["played_at"],
            "context_type": item["context"]["type"] if item.get("context") else None,
            "context_uri": item["context"]["uri"] if item.get("context") else None,
        }
        plays.append(play_data)
        store.add_recent_play(play_data)

        # Also ensure track is in our store
        track_data = {
            "id": track["id"],
            "name": track["name"],
            "artist_ids": [a["id"] for a in track["artists"]],
            "artist_names": [a["name"] for a in track["artists"]],
            "album_name": track["album"]["name"],
            "album_image_url": track["album"]["images"][0]["url"] if track["album"].get("images") else None,
            "duration_ms": track["duration_ms"],
            "popularity": track["popularity"],
            "preview_url": track.get("preview_url"),
            "spotify_url": track["external_urls"]["spotify"],
            "added_at": item["played_at"],  # Use played_at if not in liked songs
        }
        store.add_track(track_data)

    return plays


async def sync_all_data(progress_callback: Optional[Callable[[int, int, str], None]] = None) -> dict:
    """
    Full sync: fetch all liked songs, artist genres, and audio features.
    This is the initial data load operation.
    """
    # Step 1: Fetch all liked songs
    tracks = await fetch_all_liked_songs(progress_callback)
    track_ids = [t["id"] for t in tracks]

    # Collect unique artist IDs
    artist_ids_set = set()
    for t in tracks:
        artist_ids_set.update(t["artist_ids"])
    artist_ids = list(artist_ids_set)

    # Step 2: Fetch artist genres
    if progress_callback:
        progress_callback(0, len(artist_ids), "Fetching artist genres...")

    await fetch_artist_genres(artist_ids)

    # Step 3: Fetch audio features
    await fetch_audio_features(track_ids, progress_callback)

    # Save everything to cache
    store.mark_synced()

    return {
        "tracks": len(track_ids),
        "artists": len(artist_ids),
    }
