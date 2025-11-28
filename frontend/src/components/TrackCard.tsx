import { ExternalLink, Play } from 'lucide-react';
import type { Track } from '../lib/api';

interface TrackCardProps {
  track: Track;
  showAddedDate?: boolean;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function TrackCard({ track, showAddedDate = false, highlight = false, size = 'md' }: TrackCardProps) {
  const sizeClasses = {
    sm: 'p-2 gap-2',
    md: 'p-3 gap-3',
    lg: 'p-4 gap-4',
  };

  const imageSize = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div
      className={`track-card rounded-xl flex items-center ${sizeClasses[size]} ${
        highlight ? 'ring-2 ring-[#1DB954] glow-green' : ''
      }`}
    >
      {/* Album Art */}
      <a
        href={track.spotify_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex-shrink-0"
      >
        {track.album_image_url ? (
          <img
            src={track.album_image_url}
            alt={track.album_name}
            className={`${imageSize[size]} rounded-lg album-art object-cover`}
          />
        ) : (
          <div className={`${imageSize[size]} rounded-lg bg-[#282828] flex items-center justify-center`}>
            <Play className="w-6 h-6 text-gray-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
          <Play className="w-6 h-6 text-white fill-white" />
        </div>
      </a>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold truncate ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
          {track.name}
        </h3>
        <p className={`text-gray-400 truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {track.artist_names.join(', ')}
        </p>
        {showAddedDate && (
          <p className="text-xs text-gray-500 mt-1">
            Added {formatDate(track.added_at)}
          </p>
        )}
      </div>

      {/* Spotify Link */}
      <a
        href={track.spotify_url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-gray-400 hover:text-[#1DB954] transition-colors"
        title="Open in Spotify"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
