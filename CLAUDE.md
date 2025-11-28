# Playlist Voyager - Claude Code Guidelines

## Project Overview
A visual explorer for Spotify Liked Songs libraries with temporal search, style graph visualization, and audio feature analysis.

## Tech Stack
- Backend: Python 3.11+, FastAPI, Spotipy
- Frontend: React 18+, TypeScript, Vite, Cytoscape.js, TailwindCSS
- Data: In-memory with JSON file caching (no database)

## Key Conventions

### Backend
- Use async functions for all API endpoints
- Store data in `store.py` (in-memory with JSON persistence)
- Keep Spotify API calls in `spotify_client.py`
- Configurable LLM prompts go in `llm_prompts.py`

### Frontend
- Components in `src/components/`
- API client functions in `src/lib/api.ts`
- Use Lucide icons
- Dark theme with Spotify green (#1DB954) accent

### Code Style
- Python: Follow PEP 8, use type hints
- TypeScript: Strict mode, prefer interfaces over types
- CSS: Use Tailwind utilities, custom styles in index.css

## Development Journal
**MANDATORY: Keep a development journal in `/journal/` folder.**
- Create dated entries (YYYY-MM-DD.md) for each session
- **Update the journal proactively** - don't wait to be asked
- After every significant change (feature, bug fix, refactor), add an entry
- Before ending a session or committing, ensure journal is current
- Document: what was implemented, user prompts, decisions made, git commits
- Reference this journal when resuming work after a crash or new session

## File Structure
```
├── backend/           # FastAPI backend
│   ├── main.py        # FastAPI app with CORS
│   ├── auth.py        # Spotify OAuth flow
│   ├── config.py      # Environment variables
│   ├── store.py       # In-memory data store + JSON persistence
│   ├── spotify_client.py  # Spotify API wrapper
│   ├── tracks.py      # Track endpoints
│   ├── genres.py      # Genre hierarchy and graph data
│   └── llm_prompts.py # Configurable LLM prompts
├── frontend/          # React frontend
│   └── src/
│       ├── App.tsx            # Main app with auth flow
│       ├── components/
│       │   ├── TemporalSearch.tsx   # Search + temporal neighbors
│       │   ├── StyleGraph.tsx       # Cytoscape.js genre graph
│       │   ├── SessionPath.tsx      # Recent plays timeline
│       │   ├── AudioFeatures.tsx    # 2D audio feature scatter
│       │   └── TrackCard.tsx        # Reusable track display
│       └── lib/api.ts         # API client
├── journal/           # Development journal entries
├── data/              # Cached data (gitignored)
└── README.md
```

## Running the App
```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

## Important Notes
- Every Noise at Once data is frozen (Glenn McDonald laid off Dec 2023)
- MusicGenreDB on GitHub preserved all 6,291 genres
- Spotify API rate limit: ~10-20 requests/second, implement backoff on 429
