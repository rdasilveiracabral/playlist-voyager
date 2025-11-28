/**
 * API client for the Playlist Voyager backend
 */

const API_BASE = '/api';

// ============ Types ============

export interface Track {
  id: string;
  name: string;
  artist_ids: string[];
  artist_names: string[];
  album_name: string;
  album_image_url: string | null;
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  spotify_url: string;
  added_at: string;
}

export interface TrackWithFeatures extends Track {
  danceability?: number;
  energy?: number;
  acousticness?: number;
  valence?: number;
  tempo?: number;
  instrumentalness?: number;
  speechiness?: number;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: {
    id: string;
    display_name: string;
    email?: string;
    image?: string;
  };
}

export interface SyncStatus {
  in_progress: boolean;
  progress: number;
  total: number;
  stage: string;
  error: string | null;
}

export interface TemporalNeighbors {
  before: Track[];
  target: Track | null;
  after: Track[];
}

export interface SuperGenre {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}

export interface GenreHierarchy {
  [superGenre: string]: {
    name: string;
    color: string;
    subgenres: { name: string; count: number }[];
    track_count: number;
  };
}

export interface GraphNode {
  data: {
    id: string;
    label: string;
    type: 'super_genre' | 'genre';
    color: string;
    count: number;
    parent_id?: string;
    sample_tracks?: {
      id: string;
      name: string;
      artists: string[];
      album_image: string | null;
      spotify_url: string;
    }[];
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    total_genres: number;
    total_tracks: number;
  };
}

export interface RecentPlay {
  track_id: string;
  played_at: string;
  context_type: string | null;
  name: string;
  artist_names: string[];
  album_image_url: string | null;
  spotify_url: string;
}

// ============ API Functions ============

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Config
export interface ConfigStatus {
  configured: boolean;
  client_id_set: boolean;
  client_secret_set: boolean;
}
export const getConfigStatus = () => fetchJson<ConfigStatus>('/auth/config-status');

// Auth
export const getAuthStatus = () => fetchJson<AuthStatus>('/auth/status');
export const logout = () => fetchJson<{ status: string }>('/auth/logout', { method: 'POST' });
export const getLoginUrl = () => `${API_BASE}/auth/login`;

// Tracks
export const getTrackCount = () => fetchJson<{ count: number; last_synced: string | null }>('/tracks/count');
export const searchTracks = (query: string, limit = 20) =>
  fetchJson<{ tracks: Track[] }>(`/tracks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
export const getTemporalNeighbors = (trackId: string, count = 5) =>
  fetchJson<TemporalNeighbors>(`/tracks/neighbors/${trackId}?count=${count}`);
export const getAllTracks = () => fetchJson<{ tracks: Track[]; total: number }>('/tracks/all');
export const getTracksWithFeatures = () =>
  fetchJson<{ tracks: TrackWithFeatures[]; total: number }>('/tracks/with-features');
export const getRecentPlays = (limit = 50) =>
  fetchJson<{ plays: RecentPlay[] }>(`/tracks/recent?limit=${limit}`);

// Sync
export const startSync = () => fetchJson<{ status: string }>('/tracks/sync', { method: 'POST' });
export const getSyncStatus = () => fetchJson<SyncStatus>('/tracks/sync/status');

// Genres
export const getSuperGenres = () => fetchJson<{ genres: SuperGenre[] }>('/genres/super-genres');
export const getGenreHierarchy = () => fetchJson<{ hierarchy: GenreHierarchy }>('/genres/hierarchy');
export const getTracksByGenre = (genre: string) =>
  fetchJson<{ tracks: Track[]; total: number }>(`/genres/tracks-by-genre/${encodeURIComponent(genre)}`);
export const getTracksBySuperGenre = (superGenre: string) =>
  fetchJson<{ tracks: Track[]; total: number }>(`/genres/tracks-by-super-genre/${encodeURIComponent(superGenre)}`);
export const classifyMissingGenres = () =>
  fetchJson<{ classified: number; remaining: number }>('/genres/classify-missing', { method: 'POST' });
export const getGraphData = () => fetchJson<GraphData>('/genres/graph-data');
