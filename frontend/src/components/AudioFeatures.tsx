import { useEffect, useState, useMemo } from 'react';
import { Activity, Zap, Music, Smile, Mic2 } from 'lucide-react';
import { getTracksWithFeatures, type TrackWithFeatures } from '../lib/api';

type FeatureAxis = 'energy' | 'danceability' | 'valence' | 'acousticness' | 'tempo' | 'instrumentalness';

const FEATURE_INFO: Record<FeatureAxis, { label: string; icon: typeof Activity; color: string; description: string }> = {
  energy: { label: 'Energy', icon: Zap, color: '#FF6B6B', description: 'Intensity and activity' },
  danceability: { label: 'Danceability', icon: Activity, color: '#4ECDC4', description: 'Rhythm suitability' },
  valence: { label: 'Valence', icon: Smile, color: '#FFE66D', description: 'Musical positiveness' },
  acousticness: { label: 'Acousticness', icon: Music, color: '#95E1D3', description: 'Acoustic confidence' },
  tempo: { label: 'Tempo', icon: Activity, color: '#F38181', description: 'Speed (BPM)' },
  instrumentalness: { label: 'Instrumental', icon: Mic2, color: '#AA96DA', description: 'No vocals prediction' },
};

export function AudioFeatures() {
  const [tracks, setTracks] = useState<TrackWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [xAxis, setXAxis] = useState<FeatureAxis>('energy');
  const [yAxis, setYAxis] = useState<FeatureAxis>('valence');
  const [hoveredTrack, setHoveredTrack] = useState<TrackWithFeatures | null>(null);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const result = await getTracksWithFeatures();
        setTracks(result.tracks.filter(t => t.energy !== undefined));
      } catch (err) {
        console.error('Failed to load tracks:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTracks();
  }, []);

  const normalizedTracks = useMemo(() => {
    return tracks.map(track => {
      const getVal = (feature: FeatureAxis) => {
        const val = track[feature] ?? 0;
        // Normalize tempo (typically 50-200 BPM) to 0-1
        if (feature === 'tempo') return Math.min(1, Math.max(0, (val - 50) / 150));
        return val;
      };

      return {
        ...track,
        x: getVal(xAxis),
        y: getVal(yAxis),
      };
    });
  }, [tracks, xAxis, yAxis]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading audio features...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#1DB954]" />
          Audio Features
        </h2>
        <p className="text-gray-400 text-sm">
          Explore your library by audio characteristics. Each dot is a song.
        </p>
      </div>

      {/* Axis Selectors */}
      <div className="p-4 border-b border-white/5 flex gap-6">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">X Axis:</span>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value as FeatureAxis)}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-sm"
          >
            {Object.entries(FEATURE_INFO).map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Y Axis:</span>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value as FeatureAxis)}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-sm"
          >
            {Object.entries(FEATURE_INFO).map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scatter Plot */}
      <div className="flex-1 relative p-4">
        <div className="w-full h-full bg-[#0a0a0a] rounded-xl border border-white/5 relative overflow-hidden">
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {[0.25, 0.5, 0.75].map(v => (
              <g key={v}>
                <line
                  x1={`${v * 100}%`}
                  y1="0"
                  x2={`${v * 100}%`}
                  y2="100%"
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="4"
                />
                <line
                  x1="0"
                  y1={`${v * 100}%`}
                  x2="100%"
                  y2={`${v * 100}%`}
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="4"
                />
              </g>
            ))}
          </svg>

          {/* Data points */}
          {normalizedTracks.map((track) => (
            <a
              key={track.id}
              href={track.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150 group"
              style={{
                left: `${track.x * 100}%`,
                top: `${(1 - track.y) * 100}%`,
              }}
              onMouseEnter={() => setHoveredTrack(track)}
              onMouseLeave={() => setHoveredTrack(null)}
            >
              {track.album_image_url ? (
                <img
                  src={track.album_image_url}
                  alt=""
                  className="w-4 h-4 rounded-sm opacity-70 group-hover:opacity-100 group-hover:w-10 group-hover:h-10 group-hover:z-10 transition-all duration-150 group-hover:shadow-lg"
                />
              ) : (
                <div
                  className="w-3 h-3 rounded-full opacity-60 group-hover:opacity-100 group-hover:w-4 group-hover:h-4 transition-all"
                  style={{
                    backgroundColor: FEATURE_INFO[xAxis].color,
                  }}
                />
              )}
            </a>
          ))}

          {/* Axis Labels */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400 flex items-center gap-1">
            {(() => {
              const Icon = FEATURE_INFO[xAxis].icon;
              return <Icon className="w-3 h-3" />;
            })()}
            {FEATURE_INFO[xAxis].label}
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap">
            {(() => {
              const Icon = FEATURE_INFO[yAxis].icon;
              return <Icon className="w-3 h-3" />;
            })()}
            {FEATURE_INFO[yAxis].label}
          </div>

          {/* Quadrant labels */}
          <div className="absolute top-2 left-2 text-[10px] text-gray-600">Low {FEATURE_INFO[xAxis].label}, High {FEATURE_INFO[yAxis].label}</div>
          <div className="absolute top-2 right-2 text-[10px] text-gray-600 text-right">High {FEATURE_INFO[xAxis].label}, High {FEATURE_INFO[yAxis].label}</div>
          <div className="absolute bottom-8 left-2 text-[10px] text-gray-600">Low {FEATURE_INFO[xAxis].label}, Low {FEATURE_INFO[yAxis].label}</div>
          <div className="absolute bottom-8 right-2 text-[10px] text-gray-600 text-right">High {FEATURE_INFO[xAxis].label}, Low {FEATURE_INFO[yAxis].label}</div>
        </div>

        {/* Hovered Track Info */}
        {hoveredTrack && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-xl flex items-center gap-4 max-w-md">
            {hoveredTrack.album_image_url && (
              <img
                src={hoveredTrack.album_image_url}
                alt=""
                className="w-16 h-16 rounded-lg"
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{hoveredTrack.name}</p>
              <p className="text-sm text-gray-400 truncate">
                {hoveredTrack.artist_names.join(', ')}
              </p>
              <div className="flex gap-4 mt-2 text-xs">
                <span style={{ color: FEATURE_INFO[xAxis].color }}>
                  {FEATURE_INFO[xAxis].label}: {((hoveredTrack[xAxis] ?? 0) * (xAxis === 'tempo' ? 1 : 100)).toFixed(0)}{xAxis === 'tempo' ? ' BPM' : '%'}
                </span>
                <span style={{ color: FEATURE_INFO[yAxis].color }}>
                  {FEATURE_INFO[yAxis].label}: {((hoveredTrack[yAxis] ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Track count */}
        <div className="absolute top-6 right-6 bg-[#1a1a1a]/80 backdrop-blur rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-400">Tracks: </span>
          <span className="text-white font-semibold">{normalizedTracks.length}</span>
        </div>
      </div>
    </div>
  );
}
