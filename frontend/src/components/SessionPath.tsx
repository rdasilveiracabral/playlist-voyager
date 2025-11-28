import { useEffect, useState } from 'react';
import { Play, Clock, ExternalLink } from 'lucide-react';
import { getRecentPlays, type RecentPlay } from '../lib/api';

export function SessionPath() {
  const [plays, setPlays] = useState<RecentPlay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlays = async () => {
      try {
        const result = await getRecentPlays(50);
        setPlays(result.plays);
      } catch (err) {
        console.error('Failed to load recent plays:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPlays();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group plays by date
  const groupedPlays = plays.reduce((acc, play) => {
    const date = formatDate(play.played_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(play);
    return acc;
  }, {} as Record<string, RecentPlay[]>);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading recent plays...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Play className="w-6 h-6 text-[#1DB954]" />
          Session Path
        </h2>
        <p className="text-gray-400 text-sm">
          Your recent listening journey. See how your taste flows through time.
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(groupedPlays).map(([date, datePlays]) => (
          <div key={date} className="mb-8">
            {/* Date Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-[#1DB954]" />
              <h3 className="text-lg font-semibold">{date}</h3>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Plays */}
            <div className="ml-1.5 border-l-2 border-white/10 pl-6 space-y-1">
              {datePlays.map((play, index) => (
                <div
                  key={`${play.track_id}-${play.played_at}`}
                  className="relative group"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[29px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#333] group-hover:bg-[#1DB954] transition-colors" />

                  {/* Play card */}
                  <a
                    href={play.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {/* Album art */}
                    <div className="relative flex-shrink-0">
                      {play.album_image_url ? (
                        <img
                          src={play.album_image_url}
                          alt=""
                          className="w-12 h-12 rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#282828] flex items-center justify-center">
                          <Play className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      {/* Gradient connecting line for session visualization */}
                      {index < datePlays.length - 1 && (
                        <div
                          className="absolute -bottom-3 left-1/2 w-0.5 h-4"
                          style={{
                            background: `linear-gradient(to bottom, ${getColorForIndex(index, datePlays.length)}, ${getColorForIndex(index + 1, datePlays.length)})`,
                          }}
                        />
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{play.name}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {play.artist_names.join(', ')}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(play.played_at)}
                      </p>
                      {play.context_type && (
                        <p className="text-xs text-gray-500 capitalize">
                          {play.context_type}
                        </p>
                      )}
                    </div>

                    {/* Hover icon */}
                    <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-[#1DB954] transition-colors" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}

        {plays.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Play className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400">No recent plays found</p>
            <p className="text-gray-500 text-sm mt-1">
              Play some music on Spotify and check back!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate gradient colors for session path
function getColorForIndex(index: number, total: number): string {
  const hue = (index / total) * 120 + 120; // Green to cyan gradient
  return `hsl(${hue}, 70%, 50%)`;
}
