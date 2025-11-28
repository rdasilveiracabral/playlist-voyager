# Playlist Voyager - Backlog

## Future Features

### Audio Features Visualization
2D scatter plot of tracks using Spotify's audio characteristics as axes.
- X/Y axes configurable: energy, danceability, valence, acousticness, tempo, instrumentalness, speechiness
- Each track appears as a point (or album cover thumbnail)
- Click to play preview / open in Spotify
- Component already implemented: `frontend/src/components/AudioFeatures.tsx`
- Backend endpoint exists: `GET /tracks/with-features`

**Why deferred:** Need to refine the visualization and interaction before shipping.

---

### Session Path on Style Graph
Draw the user's recent listening path as a trace through genre nodes on the Style Graph.
- Shows how taste "moves" through genres over a session
- Could use animation to replay the path

---

### MusicGenreDB Integration
Integrate the full 6,291-genre database from MusicGenreDB (archived from Every Noise at Once).
- Richer genre hierarchy than Spotify's built-in genres
- More accurate subgenre classification

---

### Spotify Extended Streaming History Import
Allow users to import their extended streaming history JSON from Spotify privacy data request.
- Much deeper history than the API's recent 50 tracks
- Could enable "on this day" nostalgia features

---

### Performance Optimization
For very large libraries (10,000+ songs):
- Virtual scrolling for long lists
- Lazy loading of album art
- Web workers for heavy computations
