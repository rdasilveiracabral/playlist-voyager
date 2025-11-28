"""
In-memory data store with JSON file caching.

Simpler than SQLite - just keeps data in memory and persists to JSON.
On startup, loads from JSON cache. On sync, updates cache.
"""
import json
import os
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional

CACHE_DIR = "data"
CACHE_FILE = os.path.join(CACHE_DIR, "spotify_cache.json")
HISTORY_FILE = os.path.join(CACHE_DIR, "historical_plays.json")

# Search index for fast lookups
_search_index: list[tuple[str, str, "Track"]] = []  # (search_text, track_id, track)


@dataclass
class Track:
    id: str
    name: str
    artist_ids: list[str]
    artist_names: list[str]
    album_name: str
    album_image_url: Optional[str]
    duration_ms: int
    popularity: int
    preview_url: Optional[str]
    spotify_url: str
    added_at: str  # ISO timestamp of when user saved the track


@dataclass
class Artist:
    id: str
    name: str
    genres: list[str]
    popularity: Optional[int] = None
    image_url: Optional[str] = None


@dataclass
class AudioFeatures:
    track_id: str
    danceability: float
    energy: float
    key: int
    loudness: float
    mode: int
    speechiness: float
    acousticness: float
    instrumentalness: float
    liveness: float
    valence: float
    tempo: float
    time_signature: int


@dataclass
class RecentPlay:
    track_id: str
    played_at: str
    context_type: Optional[str] = None
    context_uri: Optional[str] = None


@dataclass
class HistoricalPlay:
    """Play record from Spotify Extended Streaming History export"""
    track_id: Optional[str]  # May be None if track was removed from Spotify
    played_at: str  # ISO timestamp
    ms_played: int
    track_name: str
    artist_name: str
    album_name: Optional[str] = None
    skipped: bool = False


@dataclass
class Store:
    """In-memory data store"""
    tracks: dict[str, Track] = field(default_factory=dict)
    artists: dict[str, Artist] = field(default_factory=dict)
    audio_features: dict[str, AudioFeatures] = field(default_factory=dict)
    recent_plays: list[RecentPlay] = field(default_factory=list)
    last_synced: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "tracks": {k: asdict(v) for k, v in self.tracks.items()},
            "artists": {k: asdict(v) for k, v in self.artists.items()},
            "audio_features": {k: asdict(v) for k, v in self.audio_features.items()},
            "recent_plays": [asdict(p) for p in self.recent_plays],
            "last_synced": self.last_synced,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Store":
        store = cls()
        store.tracks = {k: Track(**v) for k, v in data.get("tracks", {}).items()}
        store.artists = {k: Artist(**v) for k, v in data.get("artists", {}).items()}
        store.audio_features = {k: AudioFeatures(**v) for k, v in data.get("audio_features", {}).items()}
        store.recent_plays = [RecentPlay(**p) for p in data.get("recent_plays", [])]
        store.last_synced = data.get("last_synced")
        return store


# Global store instance
_store: Optional[Store] = None

# Historical plays (kept separate due to potentially large size)
_historical_plays: list[HistoricalPlay] = []
_historical_plays_loaded: bool = False


def get_store() -> Store:
    """Get the global store instance"""
    global _store
    if _store is None:
        _store = load_store()
    return _store


def load_store() -> Store:
    """Load store from JSON cache file"""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                data = json.load(f)
            print(f"Loaded cache: {len(data.get('tracks', {}))} tracks")
            return Store.from_dict(data)
        except Exception as e:
            print(f"Failed to load cache: {e}")
    return Store()


def save_store():
    """Save store to JSON cache file"""
    global _store
    if _store is None:
        return

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(_store.to_dict(), f)
    print(f"Saved cache: {len(_store.tracks)} tracks")


# ============ Track Operations ============

def add_track(track_data: dict) -> Track:
    """Add or update a track"""
    store = get_store()
    track = Track(
        id=track_data["id"],
        name=track_data["name"],
        artist_ids=track_data["artist_ids"],
        artist_names=track_data["artist_names"],
        album_name=track_data.get("album_name", ""),
        album_image_url=track_data.get("album_image_url"),
        duration_ms=track_data.get("duration_ms", 0),
        popularity=track_data.get("popularity", 0),
        preview_url=track_data.get("preview_url"),
        spotify_url=track_data.get("spotify_url", ""),
        added_at=track_data["added_at"],
    )
    store.tracks[track.id] = track
    return track


def get_track(track_id: str) -> Optional[Track]:
    """Get a track by ID"""
    return get_store().tracks.get(track_id)


def get_all_tracks() -> list[Track]:
    """Get all tracks sorted by added_at (newest first)"""
    store = get_store()
    return sorted(store.tracks.values(), key=lambda t: t.added_at, reverse=True)


def build_search_index():
    """Build search index for fast lookups. Call after sync or load."""
    global _search_index
    store = get_store()
    _search_index = []

    for track in store.tracks.values():
        # Combine track name and artist names for searchability
        search_text = f"{track.name} {' '.join(track.artist_names)}".lower()
        _search_index.append((search_text, track.id, track))

    # Pre-sort by popularity for consistent results
    _search_index.sort(key=lambda x: x[2].popularity, reverse=True)
    print(f"Built search index: {len(_search_index)} tracks")


def search_tracks(query: str, limit: int = 20) -> list[Track]:
    """Search tracks by name or artist (case-insensitive)"""
    global _search_index

    # Build index if not yet built
    if not _search_index:
        build_search_index()

    query_lower = query.lower()
    matches = [
        track for search_text, track_id, track in _search_index
        if query_lower in search_text
    ]
    return matches[:limit]


def get_temporal_neighbors(track_id: str, count: int = 5) -> dict:
    """Get tracks saved before and after a given track"""
    store = get_store()
    target = store.tracks.get(track_id)

    if not target:
        return {"before": [], "target": None, "after": []}

    # Sort all tracks by added_at
    sorted_tracks = sorted(store.tracks.values(), key=lambda t: t.added_at)

    # Find target index
    target_idx = None
    for i, t in enumerate(sorted_tracks):
        if t.id == track_id:
            target_idx = i
            break

    if target_idx is None:
        return {"before": [], "target": None, "after": []}

    before = sorted_tracks[max(0, target_idx - count):target_idx]
    after = sorted_tracks[target_idx + 1:target_idx + 1 + count]

    return {
        "before": before,
        "target": target,
        "after": after,
    }


def get_track_count() -> int:
    """Get total number of tracks"""
    return len(get_store().tracks)


# ============ Artist Operations ============

def add_artist(artist_data: dict) -> Artist:
    """Add or update an artist"""
    store = get_store()
    artist = Artist(
        id=artist_data["id"],
        name=artist_data["name"],
        genres=artist_data.get("genres", []),
        popularity=artist_data.get("popularity"),
        image_url=artist_data.get("image_url"),
    )
    store.artists[artist.id] = artist
    return artist


def get_artist(artist_id: str) -> Optional[Artist]:
    """Get an artist by ID"""
    return get_store().artists.get(artist_id)


def get_all_artists() -> list[Artist]:
    """Get all artists"""
    return list(get_store().artists.values())


def get_artists_without_genres() -> list[Artist]:
    """Get artists that have no genre data"""
    return [a for a in get_store().artists.values() if not a.genres]


# ============ Audio Features Operations ============

def add_audio_features(features_data: dict) -> AudioFeatures:
    """Add or update audio features for a track"""
    store = get_store()
    features = AudioFeatures(
        track_id=features_data["id"],
        danceability=features_data.get("danceability", 0),
        energy=features_data.get("energy", 0),
        key=features_data.get("key", 0),
        loudness=features_data.get("loudness", 0),
        mode=features_data.get("mode", 0),
        speechiness=features_data.get("speechiness", 0),
        acousticness=features_data.get("acousticness", 0),
        instrumentalness=features_data.get("instrumentalness", 0),
        liveness=features_data.get("liveness", 0),
        valence=features_data.get("valence", 0),
        tempo=features_data.get("tempo", 0),
        time_signature=features_data.get("time_signature", 4),
    )
    store.audio_features[features.track_id] = features
    return features


def get_audio_features(track_id: str) -> Optional[AudioFeatures]:
    """Get audio features for a track"""
    return get_store().audio_features.get(track_id)


def get_tracks_with_features() -> list[dict]:
    """Get all tracks with their audio features"""
    store = get_store()
    result = []
    for track in store.tracks.values():
        track_dict = asdict(track)
        features = store.audio_features.get(track.id)
        if features:
            track_dict.update({
                "danceability": features.danceability,
                "energy": features.energy,
                "acousticness": features.acousticness,
                "valence": features.valence,
                "tempo": features.tempo,
                "instrumentalness": features.instrumentalness,
                "speechiness": features.speechiness,
            })
        result.append(track_dict)
    return result


# ============ Recent Plays Operations ============

def add_recent_play(play_data: dict) -> RecentPlay:
    """Add a recent play record"""
    store = get_store()
    play = RecentPlay(
        track_id=play_data["track_id"],
        played_at=play_data["played_at"],
        context_type=play_data.get("context_type"),
        context_uri=play_data.get("context_uri"),
    )

    # Avoid duplicates
    existing = [p for p in store.recent_plays if p.track_id == play.track_id and p.played_at == play.played_at]
    if not existing:
        store.recent_plays.append(play)
        # Keep sorted by played_at (newest first)
        store.recent_plays.sort(key=lambda p: p.played_at, reverse=True)
        # Limit to 500 recent plays
        store.recent_plays = store.recent_plays[:500]

    return play


def get_recent_plays(limit: int = 50) -> list[dict]:
    """Get recent plays with track info"""
    store = get_store()
    result = []
    for play in store.recent_plays[:limit]:
        track = store.tracks.get(play.track_id)
        if track:
            result.append({
                "track_id": play.track_id,
                "played_at": play.played_at,
                "context_type": play.context_type,
                "name": track.name,
                "artist_names": track.artist_names,
                "album_image_url": track.album_image_url,
                "spotify_url": track.spotify_url,
            })
    return result


def mark_synced():
    """Mark the store as synced and rebuild search index"""
    store = get_store()
    store.last_synced = datetime.utcnow().isoformat()
    save_store()
    # Rebuild search index after sync completes
    build_search_index()


def get_last_synced() -> Optional[str]:
    """Get the last sync timestamp"""
    return get_store().last_synced


# ============ Historical Plays Operations ============

def load_historical_plays():
    """Load historical plays from JSON file"""
    global _historical_plays, _historical_plays_loaded
    if _historical_plays_loaded:
        return

    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                data = json.load(f)
            _historical_plays = [HistoricalPlay(**p) for p in data]
            print(f"Loaded historical plays: {len(_historical_plays)} entries")
        except Exception as e:
            print(f"Failed to load historical plays: {e}")
            _historical_plays = []

    _historical_plays_loaded = True


def save_historical_plays():
    """Save historical plays to JSON file"""
    global _historical_plays
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump([asdict(p) for p in _historical_plays], f)
    print(f"Saved historical plays: {len(_historical_plays)} entries")


def add_historical_play(play_data: dict) -> HistoricalPlay:
    """Add a historical play record (from import)"""
    global _historical_plays
    load_historical_plays()

    play = HistoricalPlay(
        track_id=play_data.get("track_id"),
        played_at=play_data["played_at"],
        ms_played=play_data.get("ms_played", 0),
        track_name=play_data.get("track_name", ""),
        artist_name=play_data.get("artist_name", ""),
        album_name=play_data.get("album_name"),
        skipped=play_data.get("skipped", False),
    )

    # Avoid duplicates by checking track_name + played_at
    existing = [
        p for p in _historical_plays
        if p.track_name == play.track_name and p.played_at == play.played_at
    ]
    if not existing:
        _historical_plays.append(play)

    return play


def get_historical_plays() -> list[HistoricalPlay]:
    """Get all historical plays"""
    load_historical_plays()
    return _historical_plays


def get_historical_play_count() -> int:
    """Get count of historical plays"""
    load_historical_plays()
    return len(_historical_plays)


def clear_historical_plays():
    """Clear all historical plays"""
    global _historical_plays
    _historical_plays = []
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)


def get_all_plays(limit: Optional[int] = None) -> list[dict]:
    """Get all plays (recent + historical) sorted by timestamp, newest first"""
    store = get_store()
    load_historical_plays()

    all_plays = []

    # Add recent plays
    for play in store.recent_plays:
        track = store.tracks.get(play.track_id)
        all_plays.append({
            "track_id": play.track_id,
            "played_at": play.played_at,
            "track_name": track.name if track else "Unknown",
            "artist_name": ", ".join(track.artist_names) if track else "Unknown",
            "album_name": track.album_name if track else None,
            "album_image_url": track.album_image_url if track else None,
            "spotify_url": track.spotify_url if track else None,
            "ms_played": None,
            "source": "recent",
        })

    # Add historical plays
    for play in _historical_plays:
        # Try to get album art from tracks if we have the track_id
        track = store.tracks.get(play.track_id) if play.track_id else None
        all_plays.append({
            "track_id": play.track_id,
            "played_at": play.played_at,
            "track_name": play.track_name,
            "artist_name": play.artist_name,
            "album_name": play.album_name,
            "album_image_url": track.album_image_url if track else None,
            "spotify_url": f"https://open.spotify.com/track/{play.track_id}" if play.track_id else None,
            "ms_played": play.ms_played,
            "source": "historical",
        })

    # Sort by played_at descending and deduplicate
    all_plays.sort(key=lambda p: p["played_at"], reverse=True)

    # Deduplicate by track_name + played_at (in case same play in both sources)
    seen = set()
    unique_plays = []
    for play in all_plays:
        key = (play["track_name"], play["played_at"][:16])  # Truncate to minute
        if key not in seen:
            seen.add(key)
            unique_plays.append(play)

    if limit:
        return unique_plays[:limit]
    return unique_plays
