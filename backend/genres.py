"""
Genre classification and hierarchy endpoints
"""
import json
from dataclasses import asdict
from fastapi import APIRouter, HTTPException
from anthropic import Anthropic
import store
from config import config
from llm_prompts import (
    ARTIST_GENRE_CLASSIFICATION_PROMPT,
    ARTIST_GENRE_WITH_TRACKS_PROMPT,
    VALID_PRIMARY_GENRES,
    LLM_MODEL,
    MAX_ARTISTS_PER_BATCH,
)

router = APIRouter()

# Super-genre mapping (coarse categories)
SUPER_GENRES = {
    "rock": ["rock", "indie", "alternative", "punk", "grunge", "emo", "post-punk", "shoegaze", "britpop", "garage rock"],
    "electronic": ["electronic", "edm", "house", "techno", "trance", "dubstep", "drum and bass", "dnb", "ambient", "idm", "electro", "synthwave", "synthpop", "industrial", "breakbeat", "downtempo", "trip hop"],
    "hip-hop": ["hip hop", "hip-hop", "rap", "trap", "drill", "boom bap", "grime", "crunk", "conscious hip hop"],
    "pop": ["pop", "dance pop", "electropop", "art pop", "indie pop", "k-pop", "j-pop", "teen pop", "bubblegum"],
    "r&b": ["r&b", "rnb", "soul", "neo soul", "funk", "motown", "gospel", "contemporary r&b"],
    "jazz": ["jazz", "bebop", "fusion", "smooth jazz", "acid jazz", "free jazz", "swing", "big band"],
    "classical": ["classical", "orchestra", "symphony", "chamber", "baroque", "romantic", "opera", "contemporary classical", "minimalism", "neoclassical"],
    "country": ["country", "americana", "bluegrass", "country rock", "outlaw country", "alt-country"],
    "latin": ["latin", "reggaeton", "salsa", "bachata", "cumbia", "bossa nova", "samba", "tango", "latin pop", "tropical"],
    "metal": ["metal", "heavy metal", "death metal", "black metal", "thrash metal", "doom metal", "progressive metal", "nu metal", "metalcore", "deathcore", "power metal"],
    "world": ["world", "afrobeat", "african", "celtic", "indian", "arabic", "asian", "caribbean", "reggae", "ska", "dub"],
    "blues": ["blues", "delta blues", "chicago blues", "electric blues", "blues rock"],
    "folk": ["folk", "traditional", "acoustic", "singer-songwriter", "new folk", "folk rock", "indie folk"],
    "punk": ["punk", "punk rock", "pop punk", "hardcore punk", "anarcho-punk", "skate punk", "post-hardcore"],
    "other": [],  # Fallback
}


def get_super_genre(genres: list[str]) -> str:
    """Map a list of genres to a super-genre category"""
    if not genres:
        return "other"

    # Check each genre against super-genre keywords
    for genre in genres:
        genre_lower = genre.lower()
        for super_genre, keywords in SUPER_GENRES.items():
            if super_genre == "other":
                continue
            if any(kw in genre_lower for kw in keywords) or super_genre in genre_lower:
                return super_genre

    return "other"


# Color palette for super-genres - refined for dark backgrounds
# Using slightly muted, harmonious colors that work well together
GENRE_COLORS = {
    "rock": "#e74c3c",       # Warm red
    "electronic": "#3498db", # Sky blue
    "hip-hop": "#f39c12",    # Amber/gold
    "pop": "#e91e9d",        # Magenta/pink
    "r&b": "#9b59b6",        # Amethyst purple
    "jazz": "#1abc9c",       # Teal
    "classical": "#bdc3c7",  # Silver
    "country": "#d35400",    # Burnt orange
    "latin": "#f1c40f",      # Sunflower yellow
    "metal": "#7f8c8d",      # Steel gray
    "world": "#27ae60",      # Emerald green
    "blues": "#2980b9",      # Deep blue
    "folk": "#a0522d",       # Sienna
    "punk": "#c0392b",       # Dark red
    "other": "#6c7a89",      # Slate gray
}


@router.get("/super-genres")
async def get_super_genres():
    """Get all super-genre categories with their colors"""
    return {
        "genres": [
            {"id": key, "name": key.replace("-", " ").title(), "color": GENRE_COLORS[key], "keywords": val}
            for key, val in SUPER_GENRES.items()
            if key != "other"
        ]
    }


@router.get("/hierarchy")
async def get_genre_hierarchy():
    """Get genre hierarchy for visualization"""
    artists = store.get_all_artists()

    # Build genre → counts mapping
    genre_counts = {}
    genre_to_super = {}

    for artist in artists:
        for genre in artist.genres:
            if genre not in genre_counts:
                genre_counts[genre] = 0
                genre_to_super[genre] = get_super_genre([genre])
            genre_counts[genre] += 1

    # Build hierarchical structure
    hierarchy = {}
    for super_genre in SUPER_GENRES.keys():
        hierarchy[super_genre] = {
            "name": super_genre.replace("-", " ").title(),
            "color": GENRE_COLORS[super_genre],
            "subgenres": [],
            "track_count": 0,
        }

    for genre, count in genre_counts.items():
        super_g = genre_to_super[genre]
        hierarchy[super_g]["subgenres"].append({
            "name": genre,
            "count": count,
        })
        hierarchy[super_g]["track_count"] += count

    # Sort subgenres by count
    for super_genre in hierarchy.values():
        super_genre["subgenres"].sort(key=lambda x: x["count"], reverse=True)

    return {"hierarchy": hierarchy}


@router.get("/tracks-by-genre/{genre}")
async def get_tracks_by_genre(genre: str):
    """Get all tracks belonging to a genre"""
    tracks = store.get_all_tracks()
    artists = {a.id: a for a in store.get_all_artists()}

    # Filter tracks by genre
    matching_tracks = []
    genre_lower = genre.lower()

    for track in tracks:
        # Check if any of the track's artists have this genre
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist and any(genre_lower in g.lower() for g in artist.genres):
                matching_tracks.append(asdict(track))
                break

    return {"tracks": matching_tracks, "total": len(matching_tracks)}


@router.get("/tracks-by-super-genre/{super_genre}")
async def get_tracks_by_super_genre(super_genre: str):
    """Get all tracks belonging to a super-genre category"""
    if super_genre not in SUPER_GENRES:
        raise HTTPException(status_code=404, detail=f"Unknown super-genre: {super_genre}")

    tracks = store.get_all_tracks()
    artists = {a.id: a for a in store.get_all_artists()}

    # Filter tracks by super-genre
    matching_tracks = []

    for track in tracks:
        # Check if any of the track's artists belong to this super-genre
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist and get_super_genre(artist.genres) == super_genre:
                matching_tracks.append(asdict(track))
                break

    return {"tracks": matching_tracks, "total": len(matching_tracks)}


@router.post("/classify-missing")
async def classify_missing_genres():
    """Use LLM to classify artists with no genre data"""
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY not set. Set it in .env to enable LLM genre classification."
        )

    artists_without_genres = store.get_artists_without_genres()

    if not artists_without_genres:
        return {"classified": 0, "message": "All artists already have genres"}

    client = Anthropic(api_key=config.ANTHROPIC_API_KEY)
    classified = 0

    for artist in artists_without_genres[:MAX_ARTISTS_PER_BATCH]:
        try:
            # Use configurable prompt from llm_prompts.py
            prompt = ARTIST_GENRE_CLASSIFICATION_PROMPT.format(artist_name=artist.name)

            response = client.messages.create(
                model=LLM_MODEL,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse response
            result_text = response.content[0].text.strip()
            result = json.loads(result_text)

            # Validate primary genre
            primary = result.get("primary_genre", "other")
            if primary not in VALID_PRIMARY_GENRES:
                primary = "other"

            # Update artist with LLM-classified genres
            genres = [primary] + result.get("subgenres", [])
            artist.genres = genres
            store.add_artist(asdict(artist))

            classified += 1

        except Exception as e:
            print(f"Error classifying {artist.name}: {e}")

    # Save after classification
    store.save_store()

    return {"classified": classified, "remaining": len(artists_without_genres) - classified}


@router.get("/graph-data")
async def get_graph_data():
    """Get data formatted for Cytoscape.js visualization"""
    tracks = store.get_all_tracks()
    artists = {a.id: a for a in store.get_all_artists()}

    # Count tracks per genre and collect sample tracks
    genre_data = {}

    for track in tracks:
        # Get all genres for this track's artists
        track_genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                track_genres.update(artist.genres)

        if not track_genres:
            track_genres = {"unknown"}

        # Add track to each genre
        for genre in track_genres:
            if genre not in genre_data:
                genre_data[genre] = {
                    "count": 0,
                    "super_genre": get_super_genre([genre]),
                    "sample_tracks": [],
                }
            genre_data[genre]["count"] += 1
            # Keep up to 10 sample tracks per genre (with album art)
            if len(genre_data[genre]["sample_tracks"]) < 10:
                genre_data[genre]["sample_tracks"].append({
                    "id": track.id,
                    "name": track.name,
                    "artists": track.artist_names,
                    "album_image": track.album_image_url,
                    "spotify_url": track.spotify_url,
                })

    # Build genre co-occurrence from tracks (genres that appear together on same track)
    # Note: Spotify provides genres at the artist level, not track level.
    # So a track's genres = union of all its artists' genres.
    genre_cooccurrence: dict[tuple[str, str], int] = {}
    super_genre_connections: dict[tuple[str, str], int] = {}

    for track in tracks:
        # Get all genres for this track's artists
        track_genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                track_genres.update(artist.genres)

        # Build co-occurrence edges between genres on this track
        if len(track_genres) >= 2:
            genres_list = list(track_genres)
            for i in range(len(genres_list)):
                for j in range(i + 1, len(genres_list)):
                    g1, g2 = genres_list[i], genres_list[j]
                    if g1 in genre_data and g2 in genre_data:
                        key = tuple(sorted([g1, g2]))
                        genre_cooccurrence[key] = genre_cooccurrence.get(key, 0) + 1

        # Build super-genre connections from tracks spanning multiple super-genres
        if track_genres:
            track_super_genres = set(get_super_genre([g]) for g in track_genres)
            if len(track_super_genres) >= 2:
                sg_list = list(track_super_genres)
                for i in range(len(sg_list)):
                    for j in range(i + 1, len(sg_list)):
                        key = tuple(sorted([sg_list[i], sg_list[j]]))
                        super_genre_connections[key] = super_genre_connections.get(key, 0) + 1

    # Build Cytoscape nodes
    nodes = []

    # Super-genre nodes (large, colored)
    super_genre_counts = {}
    super_genre_samples: dict[str, list] = {}
    for genre, data in genre_data.items():
        sg = data["super_genre"]
        super_genre_counts[sg] = super_genre_counts.get(sg, 0) + data["count"]
        # Collect sample tracks for super-genre
        if sg not in super_genre_samples:
            super_genre_samples[sg] = []
        if len(super_genre_samples[sg]) < 10:
            for track in data["sample_tracks"]:
                if len(super_genre_samples[sg]) < 10:
                    super_genre_samples[sg].append(track)

    for super_genre, count in super_genre_counts.items():
        if count > 0:
            nodes.append({
                "data": {
                    "id": f"super_{super_genre}",
                    "label": super_genre.replace("-", " ").title(),
                    "type": "super_genre",
                    "color": GENRE_COLORS.get(super_genre, "#9E9E9E"),
                    "count": count,
                    "sample_tracks": super_genre_samples.get(super_genre, []),
                }
            })

    # Genre nodes (smaller, connected to super-genre)
    # Skip fine genres that exactly match their super-genre name
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            nodes.append({
                "data": {
                    "id": f"genre_{genre}",
                    "label": genre,
                    "type": "genre",
                    "parent_id": f"super_{data['super_genre']}",
                    "color": GENRE_COLORS.get(data["super_genre"], "#9E9E9E"),
                    "count": data["count"],
                    "sample_tracks": data["sample_tracks"],
                }
            })

    # Build edges
    edges = []

    # 1. Genre -> super-genre edges (parent relationship)
    # Skip edges for fine genres that exactly match their super-genre
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            edges.append({
                "data": {
                    "id": f"edge_{genre}_{data['super_genre']}",
                    "source": f"genre_{genre}",
                    "target": f"super_{data['super_genre']}",
                    "type": "parent",
                }
            })

    # 2. Genre <-> genre edges (co-occurrence on same artist)
    # Only include edges with weight >= 2 to reduce clutter
    # Also skip edges involving genres that were filtered out (matching super-genre name)
    for (g1, g2), weight in genre_cooccurrence.items():
        if weight >= 2:
            # Skip if either genre was filtered out
            g1_super = genre_data[g1]["super_genre"]
            g2_super = genre_data[g2]["super_genre"]
            if g1.lower() == g1_super.lower() or g2.lower() == g2_super.lower():
                continue
            edges.append({
                "data": {
                    "id": f"edge_cooccur_{g1}_{g2}",
                    "source": f"genre_{g1}",
                    "target": f"genre_{g2}",
                    "type": "cooccurrence",
                    "weight": weight,
                }
            })

    # 3. Super-genre <-> super-genre edges (artists spanning categories)
    # Only include if at least 3 artists bridge these super-genres
    for (sg1, sg2), weight in super_genre_connections.items():
        if weight >= 3:
            edges.append({
                "data": {
                    "id": f"edge_super_{sg1}_{sg2}",
                    "source": f"super_{sg1}",
                    "target": f"super_{sg2}",
                    "type": "bridge",
                    "weight": weight,
                }
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_genres": len(genre_data),
            "total_tracks": len(tracks),
            "genre_connections": len([e for e in edges if e["data"].get("type") == "cooccurrence"]),
            "super_genre_bridges": len([e for e in edges if e["data"].get("type") == "bridge"]),
        },
    }


def gaussian_weight(distance: int, sigma: float = 5.0) -> float:
    """Compute Gaussian weight for temporal distance. distance=0 means adjacent track."""
    import math
    return math.exp(-(distance ** 2) / (2 * sigma ** 2))


@router.get("/graph-data/temporal")
async def get_temporal_graph_data():
    """Get graph data with edges based on temporal proximity of saved tracks.

    For each track, we look at the 10 tracks saved before and after it.
    Genres that appear together temporally get weighted connections,
    with a Gaussian falloff - adjacent tracks count most, distant tracks count less.
    """
    tracks = store.get_all_tracks()
    artists = {a.id: a for a in store.get_all_artists()}

    # Sort tracks by added_at date
    sorted_tracks = sorted(tracks, key=lambda t: t.added_at)

    # Build track -> genres mapping
    track_genres: dict[str, set[str]] = {}
    for track in sorted_tracks:
        genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                genres.update(artist.genres)
        if not genres:
            genres = {"unknown"}
        track_genres[track.id] = genres

    # Count tracks per genre and collect sample tracks (same as original)
    genre_data = {}
    for track in sorted_tracks:
        for genre in track_genres[track.id]:
            if genre not in genre_data:
                genre_data[genre] = {
                    "count": 0,
                    "super_genre": get_super_genre([genre]),
                    "sample_tracks": [],
                }
            genre_data[genre]["count"] += 1
            if len(genre_data[genre]["sample_tracks"]) < 10:
                genre_data[genre]["sample_tracks"].append({
                    "id": track.id,
                    "name": track.name,
                    "artists": track.artist_names,
                    "album_image": track.album_image_url,
                    "spotify_url": track.spotify_url,
                })

    # Build temporal genre affinity with Gaussian weighting
    # For each track, look at neighbors within window and weight genre co-occurrences
    window_size = 10  # Look at 10 tracks before and after
    temporal_affinity: dict[tuple[str, str], float] = {}
    temporal_super_affinity: dict[tuple[str, str], float] = {}

    for i, track in enumerate(sorted_tracks):
        track_g = track_genres[track.id]

        # Look at neighbors (before and after)
        for offset in range(-window_size, window_size + 1):
            if offset == 0:
                continue  # Skip self

            neighbor_idx = i + offset
            if 0 <= neighbor_idx < len(sorted_tracks):
                neighbor = sorted_tracks[neighbor_idx]
                neighbor_g = track_genres[neighbor.id]

                # Gaussian weight based on distance
                weight = gaussian_weight(abs(offset), sigma=5.0)

                # Add weighted affinity between all genre pairs
                for g1 in track_g:
                    for g2 in neighbor_g:
                        if g1 != g2 and g1 in genre_data and g2 in genre_data:
                            key = tuple(sorted([g1, g2]))
                            temporal_affinity[key] = temporal_affinity.get(key, 0) + weight

                # Super-genre affinity
                sg1_set = set(get_super_genre([g]) for g in track_g)
                sg2_set = set(get_super_genre([g]) for g in neighbor_g)
                for sg1 in sg1_set:
                    for sg2 in sg2_set:
                        if sg1 != sg2:
                            key = tuple(sorted([sg1, sg2]))
                            temporal_super_affinity[key] = temporal_super_affinity.get(key, 0) + weight

    # Build Cytoscape nodes (same structure as original)
    nodes = []

    super_genre_counts = {}
    super_genre_samples: dict[str, list] = {}
    for genre, data in genre_data.items():
        sg = data["super_genre"]
        super_genre_counts[sg] = super_genre_counts.get(sg, 0) + data["count"]
        # Collect sample tracks for super-genre
        if sg not in super_genre_samples:
            super_genre_samples[sg] = []
        if len(super_genre_samples[sg]) < 10:
            for track in data["sample_tracks"]:
                if len(super_genre_samples[sg]) < 10:
                    super_genre_samples[sg].append(track)

    for super_genre, count in super_genre_counts.items():
        if count > 0:
            nodes.append({
                "data": {
                    "id": f"super_{super_genre}",
                    "label": super_genre.replace("-", " ").title(),
                    "type": "super_genre",
                    "color": GENRE_COLORS.get(super_genre, "#9E9E9E"),
                    "count": count,
                    "sample_tracks": super_genre_samples.get(super_genre, []),
                }
            })

    # Skip fine genres that exactly match their super-genre name
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            nodes.append({
                "data": {
                    "id": f"genre_{genre}",
                    "label": genre,
                    "type": "genre",
                    "parent_id": f"super_{data['super_genre']}",
                    "color": GENRE_COLORS.get(data["super_genre"], "#9E9E9E"),
                    "count": data["count"],
                    "sample_tracks": data["sample_tracks"],
                }
            })

    # Build edges based on temporal affinity
    edges = []

    # Parent edges (genre -> super-genre)
    # Skip edges for fine genres that exactly match their super-genre
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            edges.append({
                "data": {
                    "id": f"edge_{genre}_{data['super_genre']}",
                    "source": f"genre_{genre}",
                    "target": f"super_{data['super_genre']}",
                    "type": "parent",
                }
            })

    # Temporal genre affinity edges
    # Normalize weights and filter low ones
    # Also skip edges involving genres that were filtered out (matching super-genre name)
    if temporal_affinity:
        max_weight = max(temporal_affinity.values())
        min_threshold = max_weight * 0.05  # Only show top 95% of connections

        for (g1, g2), weight in temporal_affinity.items():
            if weight >= min_threshold:
                # Skip if either genre was filtered out
                g1_super = genre_data[g1]["super_genre"]
                g2_super = genre_data[g2]["super_genre"]
                if g1.lower() == g1_super.lower() or g2.lower() == g2_super.lower():
                    continue
                normalized_weight = (weight / max_weight) * 20  # Scale to 0-20
                edges.append({
                    "data": {
                        "id": f"edge_temporal_{g1}_{g2}",
                        "source": f"genre_{g1}",
                        "target": f"genre_{g2}",
                        "type": "temporal",
                        "weight": round(normalized_weight, 2),
                    }
                })

    # Temporal super-genre affinity edges
    if temporal_super_affinity:
        max_sg_weight = max(temporal_super_affinity.values())
        min_sg_threshold = max_sg_weight * 0.1

        for (sg1, sg2), weight in temporal_super_affinity.items():
            if weight >= min_sg_threshold:
                normalized_weight = (weight / max_sg_weight) * 50  # Scale to 0-50
                edges.append({
                    "data": {
                        "id": f"edge_temporal_super_{sg1}_{sg2}",
                        "source": f"super_{sg1}",
                        "target": f"super_{sg2}",
                        "type": "temporal_bridge",
                        "weight": round(normalized_weight, 2),
                    }
                })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_genres": len(genre_data),
            "total_tracks": len(sorted_tracks),
            "genre_connections": len([e for e in edges if e["data"].get("type") == "temporal"]),
            "super_genre_bridges": len([e for e in edges if e["data"].get("type") == "temporal_bridge"]),
        },
    }


@router.get("/graph-data/play-history")
async def get_play_history_graph_data():
    """Get graph data with edges based on actual listening sessions.

    Uses recent play history to build genre connections based on what
    genres the user actually listens to in sequence during sessions.
    Gaussian weighting - adjacent plays count most, distant plays count less.
    """
    all_tracks = store.get_all_tracks()
    tracks_by_id = {t.id: t for t in all_tracks}
    artists = {a.id: a for a in store.get_all_artists()}

    # Get recent plays (up to 500)
    recent_plays = store.get_recent_plays(500)

    if not recent_plays:
        # Return empty graph if no play history
        return {
            "nodes": [],
            "edges": [],
            "stats": {
                "total_genres": 0,
                "total_tracks": 0,
                "genre_connections": 0,
                "super_genre_bridges": 0,
            },
        }

    # Build track -> genres mapping for played tracks
    track_genres: dict[str, set[str]] = {}
    for play in recent_plays:
        track = tracks_by_id.get(play["track_id"])
        if not track:
            continue
        genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                genres.update(artist.genres)
        if not genres:
            genres = {"unknown"}
        track_genres[play["track_id"]] = genres

    # Count tracks per genre and collect sample tracks from play history
    genre_data = {}
    for play in recent_plays:
        if play["track_id"] not in track_genres:
            continue
        track = tracks_by_id.get(play["track_id"])
        if not track:
            continue
        for genre in track_genres[play["track_id"]]:
            if genre not in genre_data:
                genre_data[genre] = {
                    "count": 0,
                    "super_genre": get_super_genre([genre]),
                    "sample_tracks": [],
                }
            genre_data[genre]["count"] += 1
            if len(genre_data[genre]["sample_tracks"]) < 10:
                # Avoid duplicate sample tracks
                existing_ids = [t["id"] for t in genre_data[genre]["sample_tracks"]]
                if track.id not in existing_ids:
                    genre_data[genre]["sample_tracks"].append({
                        "id": track.id,
                        "name": track.name,
                        "artists": track.artist_names,
                        "album_image": track.album_image_url,
                        "spotify_url": track.spotify_url,
                    })

    # Build temporal genre affinity from play sequence with Gaussian weighting
    window_size = 10  # Look at 10 plays before and after
    play_affinity: dict[tuple[str, str], float] = {}
    play_super_affinity: dict[tuple[str, str], float] = {}

    for i, play in enumerate(recent_plays):
        if play["track_id"] not in track_genres:
            continue
        play_g = track_genres[play["track_id"]]

        # Look at neighbors in play history
        for offset in range(-window_size, window_size + 1):
            if offset == 0:
                continue  # Skip self

            neighbor_idx = i + offset
            if 0 <= neighbor_idx < len(recent_plays):
                neighbor_play = recent_plays[neighbor_idx]
                if neighbor_play["track_id"] not in track_genres:
                    continue
                neighbor_g = track_genres[neighbor_play["track_id"]]

                # Gaussian weight based on distance
                weight = gaussian_weight(abs(offset), sigma=5.0)

                # Add weighted affinity between all genre pairs
                for g1 in play_g:
                    for g2 in neighbor_g:
                        if g1 != g2 and g1 in genre_data and g2 in genre_data:
                            key = tuple(sorted([g1, g2]))
                            play_affinity[key] = play_affinity.get(key, 0) + weight

                # Super-genre affinity
                sg1_set = set(get_super_genre([g]) for g in play_g)
                sg2_set = set(get_super_genre([g]) for g in neighbor_g)
                for sg1 in sg1_set:
                    for sg2 in sg2_set:
                        if sg1 != sg2:
                            key = tuple(sorted([sg1, sg2]))
                            play_super_affinity[key] = play_super_affinity.get(key, 0) + weight

    # Build Cytoscape nodes
    nodes = []

    super_genre_counts = {}
    super_genre_samples: dict[str, list] = {}
    for genre, data in genre_data.items():
        sg = data["super_genre"]
        super_genre_counts[sg] = super_genre_counts.get(sg, 0) + data["count"]
        # Collect sample tracks for super-genre
        if sg not in super_genre_samples:
            super_genre_samples[sg] = []
        if len(super_genre_samples[sg]) < 10:
            for track in data["sample_tracks"]:
                if len(super_genre_samples[sg]) < 10:
                    super_genre_samples[sg].append(track)

    for super_genre, count in super_genre_counts.items():
        if count > 0:
            nodes.append({
                "data": {
                    "id": f"super_{super_genre}",
                    "label": super_genre.replace("-", " ").title(),
                    "type": "super_genre",
                    "color": GENRE_COLORS.get(super_genre, "#9E9E9E"),
                    "count": count,
                    "sample_tracks": super_genre_samples.get(super_genre, []),
                }
            })

    # Skip fine genres that exactly match their super-genre name
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            nodes.append({
                "data": {
                    "id": f"genre_{genre}",
                    "label": genre,
                    "type": "genre",
                    "parent_id": f"super_{data['super_genre']}",
                    "color": GENRE_COLORS.get(data["super_genre"], "#9E9E9E"),
                    "count": data["count"],
                    "sample_tracks": data["sample_tracks"],
                }
            })

    # Build edges
    edges = []

    # Parent edges (genre -> super-genre)
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            edges.append({
                "data": {
                    "id": f"edge_{genre}_{data['super_genre']}",
                    "source": f"genre_{genre}",
                    "target": f"super_{data['super_genre']}",
                    "type": "parent",
                }
            })

    # Play history genre affinity edges
    # Also skip edges involving genres that were filtered out (matching super-genre name)
    if play_affinity:
        max_weight = max(play_affinity.values())
        min_threshold = max_weight * 0.05

        for (g1, g2), weight in play_affinity.items():
            if weight >= min_threshold:
                # Skip if either genre was filtered out
                g1_super = genre_data[g1]["super_genre"]
                g2_super = genre_data[g2]["super_genre"]
                if g1.lower() == g1_super.lower() or g2.lower() == g2_super.lower():
                    continue
                normalized_weight = (weight / max_weight) * 20
                edges.append({
                    "data": {
                        "id": f"edge_play_{g1}_{g2}",
                        "source": f"genre_{g1}",
                        "target": f"genre_{g2}",
                        "type": "temporal",  # Reuse same styling
                        "weight": round(normalized_weight, 2),
                    }
                })

    # Play history super-genre affinity edges
    if play_super_affinity:
        max_sg_weight = max(play_super_affinity.values())
        min_sg_threshold = max_sg_weight * 0.1

        for (sg1, sg2), weight in play_super_affinity.items():
            if weight >= min_sg_threshold:
                normalized_weight = (weight / max_sg_weight) * 50
                edges.append({
                    "data": {
                        "id": f"edge_play_super_{sg1}_{sg2}",
                        "source": f"super_{sg1}",
                        "target": f"super_{sg2}",
                        "type": "temporal_bridge",  # Reuse same styling
                        "weight": round(normalized_weight, 2),
                    }
                })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_genres": len(genre_data),
            "total_tracks": len(recent_plays),
            "genre_connections": len([e for e in edges if e["data"].get("type") == "temporal"]),
            "super_genre_bridges": len([e for e in edges if e["data"].get("type") == "temporal_bridge"]),
        },
    }


@router.get("/graph-data/play-history-by-date/{date}")
async def get_play_history_graph_by_date(date: str):
    """Get graph data for a specific date's listening session.

    Shows genre connections based on what was played on that date.
    """
    all_tracks = store.get_all_tracks()
    tracks_by_id = {t.id: t for t in all_tracks}
    artists = {a.id: a for a in store.get_all_artists()}

    # Get all plays and filter to requested date
    all_plays = store.get_all_plays()
    day_plays = [p for p in all_plays if p["played_at"].startswith(date)]
    day_plays.sort(key=lambda p: p["played_at"])  # Sort chronologically

    if not day_plays:
        # Return empty graph if no plays on this date
        return {
            "nodes": [],
            "edges": [],
            "stats": {
                "total_genres": 0,
                "total_tracks": 0,
                "genre_connections": 0,
                "super_genre_bridges": 0,
                "date": date,
            },
        }

    # Build track -> genres mapping for played tracks
    track_genres: dict[str, set[str]] = {}
    for play in day_plays:
        track_id = play.get("track_id")
        if not track_id:
            continue
        track = tracks_by_id.get(track_id)
        if not track:
            # For historical plays without track in library, use "unknown"
            track_genres[track_id] = {"unknown"}
            continue
        genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                genres.update(artist.genres)
        if not genres:
            genres = {"unknown"}
        track_genres[track_id] = genres

    # Count plays per genre and collect sample tracks
    genre_data = {}
    for play in day_plays:
        track_id = play.get("track_id")
        if not track_id or track_id not in track_genres:
            continue
        track = tracks_by_id.get(track_id)
        for genre in track_genres[track_id]:
            if genre not in genre_data:
                genre_data[genre] = {
                    "count": 0,
                    "super_genre": get_super_genre([genre]),
                    "sample_tracks": [],
                }
            genre_data[genre]["count"] += 1
            if len(genre_data[genre]["sample_tracks"]) < 10 and track:
                existing_ids = [t["id"] for t in genre_data[genre]["sample_tracks"]]
                if track.id not in existing_ids:
                    genre_data[genre]["sample_tracks"].append({
                        "id": track.id,
                        "name": track.name,
                        "artists": track.artist_names,
                        "album_image": track.album_image_url,
                        "spotify_url": track.spotify_url,
                    })

    # Build temporal affinity from the day's play sequence
    # Use smaller window since we're looking at a single day
    window_size = 5
    play_affinity: dict[tuple[str, str], float] = {}
    play_super_affinity: dict[tuple[str, str], float] = {}

    for i, play in enumerate(day_plays):
        track_id = play.get("track_id")
        if not track_id or track_id not in track_genres:
            continue
        play_g = track_genres[track_id]

        for offset in range(-window_size, window_size + 1):
            if offset == 0:
                continue

            neighbor_idx = i + offset
            if 0 <= neighbor_idx < len(day_plays):
                neighbor_play = day_plays[neighbor_idx]
                neighbor_id = neighbor_play.get("track_id")
                if not neighbor_id or neighbor_id not in track_genres:
                    continue
                neighbor_g = track_genres[neighbor_id]

                weight = gaussian_weight(abs(offset), sigma=3.0)

                for g1 in play_g:
                    for g2 in neighbor_g:
                        if g1 != g2 and g1 in genre_data and g2 in genre_data:
                            key = tuple(sorted([g1, g2]))
                            play_affinity[key] = play_affinity.get(key, 0) + weight

                sg1_set = set(get_super_genre([g]) for g in play_g)
                sg2_set = set(get_super_genre([g]) for g in neighbor_g)
                for sg1 in sg1_set:
                    for sg2 in sg2_set:
                        if sg1 != sg2:
                            key = tuple(sorted([sg1, sg2]))
                            play_super_affinity[key] = play_super_affinity.get(key, 0) + weight

    # Build Cytoscape nodes
    nodes = []

    super_genre_counts = {}
    super_genre_samples: dict[str, list] = {}
    for genre, data in genre_data.items():
        sg = data["super_genre"]
        super_genre_counts[sg] = super_genre_counts.get(sg, 0) + data["count"]
        if sg not in super_genre_samples:
            super_genre_samples[sg] = []
        if len(super_genre_samples[sg]) < 10:
            for track in data["sample_tracks"]:
                if len(super_genre_samples[sg]) < 10:
                    super_genre_samples[sg].append(track)

    for super_genre, count in super_genre_counts.items():
        if count > 0:
            nodes.append({
                "data": {
                    "id": f"super_{super_genre}",
                    "label": super_genre.replace("-", " ").title(),
                    "type": "super_genre",
                    "color": GENRE_COLORS.get(super_genre, "#9E9E9E"),
                    "count": count,
                    "sample_tracks": super_genre_samples.get(super_genre, []),
                }
            })

    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            nodes.append({
                "data": {
                    "id": f"genre_{genre}",
                    "label": genre,
                    "type": "genre",
                    "parent_id": f"super_{data['super_genre']}",
                    "color": GENRE_COLORS.get(data["super_genre"], "#9E9E9E"),
                    "count": data["count"],
                    "sample_tracks": data["sample_tracks"],
                }
            })

    # Build edges
    edges = []

    # Parent edges
    for genre, data in genre_data.items():
        if data["count"] > 0 and genre.lower() != data["super_genre"].lower():
            edges.append({
                "data": {
                    "id": f"edge_{genre}_{data['super_genre']}",
                    "source": f"genre_{genre}",
                    "target": f"super_{data['super_genre']}",
                    "type": "parent",
                }
            })

    # Play affinity edges
    if play_affinity:
        max_weight = max(play_affinity.values())
        min_threshold = max_weight * 0.1  # Higher threshold for single day

        for (g1, g2), weight in play_affinity.items():
            if weight >= min_threshold:
                g1_super = genre_data[g1]["super_genre"]
                g2_super = genre_data[g2]["super_genre"]
                if g1.lower() == g1_super.lower() or g2.lower() == g2_super.lower():
                    continue
                normalized_weight = (weight / max_weight) * 20
                edges.append({
                    "data": {
                        "id": f"edge_play_{g1}_{g2}",
                        "source": f"genre_{g1}",
                        "target": f"genre_{g2}",
                        "type": "temporal",
                        "weight": round(normalized_weight, 2),
                    }
                })

    if play_super_affinity:
        max_sg_weight = max(play_super_affinity.values())
        min_sg_threshold = max_sg_weight * 0.15

        for (sg1, sg2), weight in play_super_affinity.items():
            if weight >= min_sg_threshold:
                normalized_weight = (weight / max_sg_weight) * 50
                edges.append({
                    "data": {
                        "id": f"edge_play_super_{sg1}_{sg2}",
                        "source": f"super_{sg1}",
                        "target": f"super_{sg2}",
                        "type": "temporal_bridge",
                        "weight": round(normalized_weight, 2),
                    }
                })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_genres": len(genre_data),
            "total_tracks": len(day_plays),
            "genre_connections": len([e for e in edges if e["data"].get("type") == "temporal"]),
            "super_genre_bridges": len([e for e in edges if e["data"].get("type") == "temporal_bridge"]),
            "date": date,
        },
    }


@router.get("/graph-data/active-edges-by-date/{date}")
async def get_active_edges_by_date(date: str):
    """Get the set of active edges representing sequential genre transitions for a date.

    This highlights only the edges that represent actual song-to-song transitions,
    not all possible edges between genres played that day.
    """
    all_tracks = store.get_all_tracks()
    tracks_by_id = {t.id: t for t in all_tracks}
    artists = {a.id: a for a in store.get_all_artists()}

    # Get all plays and filter to requested date
    all_plays = store.get_all_plays()
    day_plays = [p for p in all_plays if p["played_at"].startswith(date)]
    day_plays.sort(key=lambda p: p["played_at"])  # Sort chronologically

    if not day_plays:
        return {
            "active_node_ids": [],
            "active_super_genre_ids": [],
            "active_edge_pairs": [],
            "play_count": 0,
            "date": date,
        }

    # Build track -> genres mapping
    def get_track_genres(track_id: str) -> tuple[set[str], set[str]]:
        """Returns (genre_ids, super_genre_ids) for a track"""
        track = tracks_by_id.get(track_id)
        if not track:
            return set(), set()

        genres = set()
        super_genres = set()
        for artist_id in track.artist_ids:
            artist = artists.get(artist_id)
            if artist:
                for genre in artist.genres:
                    sg = get_super_genre([genre])
                    if genre.lower() != sg.lower():
                        genres.add(f"genre_{genre}")
                    super_genres.add(f"super_{sg}")
        return genres, super_genres

    # Build sequential transitions between adjacent plays
    active_genres: set[str] = set()
    active_super_genres: set[str] = set()
    active_edge_pairs: set[tuple[str, str]] = set()

    prev_genres: set[str] = set()
    prev_super_genres: set[str] = set()

    for play in day_plays:
        track_id = play.get("track_id")
        if not track_id:
            continue

        curr_genres, curr_super_genres = get_track_genres(track_id)
        if not curr_genres and not curr_super_genres:
            continue

        # Add current nodes as active
        active_genres.update(curr_genres)
        active_super_genres.update(curr_super_genres)

        # Create edges between previous and current track's genres
        if prev_genres or prev_super_genres:
            # Genre-to-genre edges (only between different genres)
            for g1 in prev_genres:
                for g2 in curr_genres:
                    if g1 != g2:
                        # Store as sorted tuple so edge direction doesn't matter
                        edge = tuple(sorted([g1, g2]))
                        active_edge_pairs.add(edge)

            # Super-genre-to-super-genre edges (only between different super-genres)
            for sg1 in prev_super_genres:
                for sg2 in curr_super_genres:
                    if sg1 != sg2:
                        edge = tuple(sorted([sg1, sg2]))
                        active_edge_pairs.add(edge)

            # Parent edges (genre to its super-genre) for current track
            for g in curr_genres:
                # Find the super-genre for this genre
                genre_name = g.replace("genre_", "")
                sg = get_super_genre([genre_name])
                sg_id = f"super_{sg}"
                if sg_id in curr_super_genres:
                    edge = tuple(sorted([g, sg_id]))
                    active_edge_pairs.add(edge)

        # Update previous for next iteration
        prev_genres = curr_genres
        prev_super_genres = curr_super_genres

    return {
        "active_node_ids": list(active_genres),
        "active_super_genre_ids": list(active_super_genres),
        "active_edge_pairs": [list(pair) for pair in active_edge_pairs],
        "play_count": len(day_plays),
        "date": date,
    }
