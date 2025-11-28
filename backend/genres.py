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

    # Build genre co-occurrence from artists (genres that appear together on same artist)
    genre_cooccurrence: dict[tuple[str, str], int] = {}
    for artist in artists.values():
        if len(artist.genres) >= 2:
            # Create edges between all pairs of genres on this artist
            genres_list = list(artist.genres)
            for i in range(len(genres_list)):
                for j in range(i + 1, len(genres_list)):
                    g1, g2 = genres_list[i], genres_list[j]
                    # Only include genres that are in our data
                    if g1 in genre_data and g2 in genre_data:
                        key = tuple(sorted([g1, g2]))
                        genre_cooccurrence[key] = genre_cooccurrence.get(key, 0) + 1

    # Build super-genre connections from artists spanning multiple super-genres
    super_genre_connections: dict[tuple[str, str], int] = {}
    for artist in artists.values():
        if artist.genres:
            # Get unique super-genres for this artist
            artist_super_genres = set(get_super_genre([g]) for g in artist.genres)
            if len(artist_super_genres) >= 2:
                sg_list = list(artist_super_genres)
                for i in range(len(sg_list)):
                    for j in range(i + 1, len(sg_list)):
                        key = tuple(sorted([sg_list[i], sg_list[j]]))
                        super_genre_connections[key] = super_genre_connections.get(key, 0) + 1

    # Build Cytoscape nodes
    nodes = []

    # Super-genre nodes (large, colored)
    super_genre_counts = {}
    for genre, data in genre_data.items():
        sg = data["super_genre"]
        super_genre_counts[sg] = super_genre_counts.get(sg, 0) + data["count"]

    for super_genre, count in super_genre_counts.items():
        if count > 0:
            nodes.append({
                "data": {
                    "id": f"super_{super_genre}",
                    "label": super_genre.replace("-", " ").title(),
                    "type": "super_genre",
                    "color": GENRE_COLORS.get(super_genre, "#9E9E9E"),
                    "count": count,
                }
            })

    # Genre nodes (smaller, connected to super-genre)
    for genre, data in genre_data.items():
        if data["count"] > 0:
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
    for genre, data in genre_data.items():
        if data["count"] > 0:
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
    for (g1, g2), weight in genre_cooccurrence.items():
        if weight >= 2:
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
