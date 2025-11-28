"""
LLM Prompt Templates for Genre Classification

Edit these prompts to customize how the LLM classifies unknown artists.
The prompts use Python string formatting - {variable} will be replaced with actual values.
"""

# Main genre classification prompt
# Variables available: {artist_name}
ARTIST_GENRE_CLASSIFICATION_PROMPT = """Classify this music artist's genre. Return ONLY valid JSON, no other text.

Artist: {artist_name}

Return JSON format:
{{"primary_genre": "one of: rock, pop, electronic, hip-hop, r&b, jazz, classical, country, latin, metal, world, blues, folk, punk, other", "subgenres": ["up to 3 specific subgenres like 'indie rock', 'dark techno', 'trap'"], "confidence": "high/medium/low"}}

Guidelines:
- primary_genre must be one of the listed options
- subgenres should be specific (e.g., "synthwave" not just "electronic")
- confidence should reflect how well-known the artist is
- If truly unknown, use "other" with low confidence"""

# Enhanced prompt when we have track names available
# Variables available: {artist_name}, {track_names}
ARTIST_GENRE_WITH_TRACKS_PROMPT = """Classify this music artist's genre based on their name and songs. Return ONLY valid JSON, no other text.

Artist: {artist_name}
Known tracks: {track_names}

Return JSON format:
{{"primary_genre": "one of: rock, pop, electronic, hip-hop, r&b, jazz, classical, country, latin, metal, world, blues, folk, punk, other", "subgenres": ["up to 3 specific subgenres like 'indie rock', 'dark techno', 'trap'"], "confidence": "high/medium/low"}}

Guidelines:
- Consider the track names as hints about the artist's style
- primary_genre must be one of the listed options
- subgenres should be specific and descriptive
- confidence should reflect how certain you are"""

# List of valid primary genres (used for validation)
VALID_PRIMARY_GENRES = [
    "rock",
    "pop",
    "electronic",
    "hip-hop",
    "r&b",
    "jazz",
    "classical",
    "country",
    "latin",
    "metal",
    "world",
    "blues",
    "folk",
    "punk",
    "other",
]

# LLM model to use for classification
# claude-3-haiku is fast and cheap, good for batch classification
# claude-3-sonnet is more accurate but slower/costlier
LLM_MODEL = "claude-3-haiku-20240307"

# Maximum artists to classify per API call (to avoid rate limits)
MAX_ARTISTS_PER_BATCH = 50
