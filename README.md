<p align="center">
  <img src="logo_big.png" alt="Playlist Voyager" width="400">
</p>

<p align="center">
  A visual explorer for your Spotify Liked Songs library.<br>
  Discover patterns in your music taste through temporal relationships and style clustering.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/python-3.11+-blue" alt="Python">
  <img src="https://img.shields.io/badge/react-18+-61dafb" alt="React">
</p>

## The Problem

If you're like me, your Spotify Liked Songs playlist has grown into a massive collection over the years—mine has **7,000+ songs**. I use it on shuffle to find and settle on a mood for the day, since my taste is pretty eclectic.

But here's the thing: **my song-saving pattern is bursty**. When I discover a new style or artist, I tend to save multiple songs in quick succession. This means my Liked Songs are *temporally consistent*—songs saved around the same time often share a vibe.

**The frustration?** When I find a song I love and want to hear what I saved around it, Spotify won't cooperate. With 7,000 songs, the playlist is too large to navigate—disabling shuffle doesn't help because Spotify seemingly can't load the full list. Creating a "radio" from a song gets close, but it pulls from all of Spotify, not *my* library.

I wanted something simple: **search for a song, see the 5 songs I saved before and after it**. And while we're at it, why not visualize the entire library by style? See the genres as a graph, zoom from broad categories (Rock, Electronic, Classical) down to specific subgenres (Dark Progressive House, Shoegaze, Baroque).

That's Playlist Voyager.

## Features

### Temporal Search
Find songs saved around the same time as any track in your library. Perfect for rediscovering those "music moods" when you saved multiple songs in the same style.

### Style Graph
Interactive visualization of your music organized by genre. Zoom from coarse categories (Rock, Electronic, Hip-Hop) down to fine-grained subgenres. Node sizes reflect how many of your songs belong to each genre.

### Session Path
Trace your recent listening sessions as a journey through time. See how your taste flows from track to track.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Spotify account
- [Spotify Developer credentials](https://developer.spotify.com/dashboard)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/playlist-voyager.git
cd playlist-voyager
```

### 2. Set up the backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Spotify credentials
Create a `.env` file in the `backend/` directory:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/auth/callback

# Optional: For LLM genre classification of unknown artists
ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Getting Spotify credentials:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add `http://127.0.0.1:8000/auth/callback` to Redirect URIs
4. Copy your Client ID and Client Secret

### 4. Set up the frontend
```bash
cd ../frontend
npm install
```

### 5. Run the app
In two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## How It Works

### Data Flow
1. **Login** - OAuth with Spotify grants access to your library
2. **Sync** - Fetches all your liked songs, artist genres, and audio features
3. **Cache** - Data is stored locally in `data/spotify_cache.json`
4. **Explore** - Navigate your library through the various views

### Genre Classification
Genres come from three sources:
1. **Spotify API** - Artist-level genres (~1700 unique genres)
2. **Super-genre mapping** - Groups fine genres into 15 coarse categories
3. **LLM fallback** - Optional: Uses Claude to classify artists with no Spotify genre data

The LLM prompt is configurable in `backend/llm_prompts.py`.

### Architecture
```
├── backend/
│   ├── main.py          # FastAPI app
│   ├── auth.py          # Spotify OAuth
│   ├── store.py         # In-memory data with JSON cache
│   ├── tracks.py        # Track endpoints
│   ├── genres.py        # Genre endpoints
│   └── llm_prompts.py   # Configurable LLM prompts
├── frontend/
│   ├── src/
│   │   ├── App.tsx      # Main app component
│   │   ├── components/  # React components
│   │   └── lib/api.ts   # API client
└── data/
    └── spotify_cache.json  # Your cached library data
```

## Configuration

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Your Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Your Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | No | OAuth callback URL (default: `http://127.0.0.1:8000/auth/callback`) |
| `ANTHROPIC_API_KEY` | No | For LLM genre classification |

### LLM Prompt Customization
Edit `backend/llm_prompts.py` to customize how unknown artists are classified:
- `ARTIST_GENRE_CLASSIFICATION_PROMPT` - Main classification prompt
- `VALID_PRIMARY_GENRES` - Allowed coarse genre categories
- `LLM_MODEL` - Which Claude model to use

## Privacy

**Your data stays local.**
- All data is stored on your machine in `data/spotify_cache.json`
- No external servers besides Spotify API (and optionally Anthropic for genre classification)
- The app never uploads your listening history anywhere

## Tech Stack

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Spotipy](https://spotipy.readthedocs.io/) - Spotify Web API wrapper
- [Anthropic](https://www.anthropic.com/) - LLM for genre classification (optional)

**Frontend:**
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) - Fast build tool
- [Cytoscape.js](https://js.cytoscape.org/) - Graph visualization
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide](https://lucide.dev/) - Icons

## API Reference

### Auth
- `GET /auth/login` - Redirect to Spotify login
- `GET /auth/callback` - OAuth callback
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Clear session

### Tracks
- `GET /tracks/count` - Get track count and last sync time
- `GET /tracks/search?q=...` - Search tracks by name
- `GET /tracks/neighbors/{id}` - Get temporal neighbors
- `GET /tracks/all` - Get all tracks
- `GET /tracks/with-features` - Get tracks with audio features
- `GET /tracks/recent` - Get recently played
- `POST /tracks/sync` - Start library sync
- `GET /tracks/sync/status` - Get sync progress

### Genres
- `GET /genres/super-genres` - Get coarse genre categories
- `GET /genres/hierarchy` - Get full genre hierarchy
- `GET /genres/graph-data` - Get Cytoscape.js graph data
- `GET /genres/tracks-by-genre/{genre}` - Get tracks for a genre
- `POST /genres/classify-missing` - Run LLM classification

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Genre taxonomy inspired by [Every Noise at Once](https://everynoise.com/) by Glenn McDonald
- Built with the [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Logos generated with [nano banana](https://gemini.google.com) and made transparent with [Pixelcut](https://www.pixelcut.ai)
