import { useState, useEffect, useCallback } from 'react';
import { Search, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { searchTracks, getTemporalNeighbors, type Track, type TemporalNeighbors } from '../lib/api';
import { TrackCard } from './TrackCard';

export function TemporalSearch() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [neighbors, setNeighbors] = useState<TemporalNeighbors | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [neighborCount, setNeighborCount] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await searchTracks(query, 10);
        setSearchResults(result.tracks);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectTrack = useCallback(async (track: Track) => {
    setSelectedTrack(track);
    setSearchResults([]);
    setQuery('');
    setLoading(true);
    setNeighborCount(5);

    try {
      const result = await getTemporalNeighbors(track.id, 5);
      setNeighbors(result);
    } catch (err) {
      console.error('Failed to get neighbors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!selectedTrack) return;

    setLoadingMore(true);
    const newCount = neighborCount + 5;

    try {
      const result = await getTemporalNeighbors(selectedTrack.id, newCount);
      setNeighbors(result);
      setNeighborCount(newCount);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedTrack, neighborCount]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#1DB954]" />
          Temporal Search
        </h2>
        <p className="text-gray-400 text-sm">
          Find songs saved around the same time. Great for rediscovering music moods.
        </p>
      </div>

      {/* Search Input */}
      <div className="p-4 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song in your library..."
            className="search-input w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500"
          />
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-2 bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl z-50 max-h-80 overflow-y-auto">
            {searchResults.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track)}
                className="w-full text-left p-3 hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-3">
                  {track.album_image_url && (
                    <img
                      src={track.album_image_url}
                      alt=""
                      className="w-10 h-10 rounded"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{track.name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {track.artist_names.join(', ')}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : neighbors ? (
          <div className="space-y-6">
            {/* Before */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                Saved Before ({neighbors.before.length})
              </h3>
              <div className="space-y-2">
                {neighbors.before.length > 0 && neighbors.before.length === neighborCount && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-2 mb-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMore ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Load earlier tracks
                      </>
                    )}
                  </button>
                )}
                {neighbors.before.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    showAddedDate
                    size="sm"
                  />
                ))}
                {neighbors.before.length === 0 && (
                  <p className="text-gray-500 text-sm italic">No tracks saved before this one</p>
                )}
              </div>
            </div>

            {/* Selected Track */}
            {neighbors.target && (
              <div>
                <h3 className="text-sm font-semibold text-[#1DB954] uppercase tracking-wide mb-3">
                  Selected Track
                </h3>
                <TrackCard
                  track={neighbors.target}
                  showAddedDate
                  highlight
                  size="lg"
                />
              </div>
            )}

            {/* After */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                Saved After ({neighbors.after.length})
                <ChevronRight className="w-4 h-4" />
              </h3>
              <div className="space-y-2">
                {neighbors.after.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    showAddedDate
                    size="sm"
                  />
                ))}
                {neighbors.after.length === 0 && (
                  <p className="text-gray-500 text-sm italic">No tracks saved after this one</p>
                )}
                {neighbors.after.length > 0 && neighbors.after.length === neighborCount && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-2 mt-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMore ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Load later tracks
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Clock className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400">
              Search for a song to see what you saved around the same time
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
