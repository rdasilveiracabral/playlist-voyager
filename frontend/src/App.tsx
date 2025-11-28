import { useState, useEffect } from 'react';
import { Clock, GitBranch, Play, LogOut, RefreshCw, Music, Settings, ExternalLink, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { getAuthStatus, getTrackCount, startSync, getSyncStatus, getLoginUrl, logout, getConfigStatus, type AuthStatus, type SyncStatus, type ConfigStatus } from './lib/api';
import { TemporalSearch } from './components/TemporalSearch';
import { StyleGraph } from './components/StyleGraph';
import { SessionPath } from './components/SessionPath';
import './index.css';

type TabId = 'search' | 'graph' | 'session';

const TABS: { id: TabId; label: string; icon: typeof Clock }[] = [
  { id: 'search', label: 'Temporal Search', icon: Clock },
  { id: 'graph', label: 'Style Graph', icon: GitBranch },
  { id: 'session', label: 'Session Path', icon: Play },
];

function SetupScreen() {
  const [copied, setCopied] = useState(false);
  const redirectUri = 'http://127.0.0.1:8000/auth/callback';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-spotify flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo_big.png"
            alt="Playlist Voyager"
            className="w-64 mx-auto mb-4"
          />
          <p className="text-gray-400">
            Explore your music library through time and style
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-[#141414] rounded-2xl p-8 border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Setup Required</h2>
              <p className="text-gray-400 text-sm">Configure your Spotify API credentials</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Create a Spotify App</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Go to the Spotify Developer Dashboard and create a new application.
                </p>
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#1DB954] hover:underline text-sm"
                >
                  Open Spotify Developer Dashboard
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Add Redirect URI</h3>
                <p className="text-gray-400 text-sm mb-3">
                  In your Spotify app settings, add this redirect URI:
                </p>
                <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg p-3 font-mono text-sm">
                  <code className="flex-1 text-[#1DB954]">{redirectUri}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Configure Environment Variables</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Create a <code className="bg-[#0a0a0a] px-1.5 py-0.5 rounded">.env</code> file in the <code className="bg-[#0a0a0a] px-1.5 py-0.5 rounded">backend/</code> folder with your credentials:
                </p>
                <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-gray-500"># backend/.env</div>
                  <div><span className="text-purple-400">SPOTIFY_CLIENT_ID</span>=<span className="text-green-400">your_client_id</span></div>
                  <div><span className="text-purple-400">SPOTIFY_CLIENT_SECRET</span>=<span className="text-green-400">your_client_secret</span></div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-bold text-sm">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Restart & Refresh</h3>
                <p className="text-gray-400 text-sm">
                  After saving your <code className="bg-[#0a0a0a] px-1.5 py-0.5 rounded">.env</code> file, the backend will auto-reload. Then refresh this page.
                </p>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold py-3 px-6 rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              I've configured my credentials - Refresh
            </button>
          </div>
        </div>

        {/* Help link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Need help? Check the{' '}
          <a
            href="https://github.com/yourusername/playlist-voyager#quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1DB954] hover:underline"
          >
            README
          </a>
          {' '}for detailed instructions.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [trackCount, setTrackCount] = useState<{ count: number; last_synced: string | null } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check config and auth status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // First check if configured
        const config = await getConfigStatus();
        setConfigStatus(config);

        if (!config.configured) {
          setLoading(false);
          return;
        }

        // Then check auth
        const authStatus = await getAuthStatus();
        setAuth(authStatus);
        if (authStatus.authenticated) {
          const count = await getTrackCount();
          setTrackCount(count);
        }
      } catch (err) {
        console.error('Status check failed:', err);
        setError('Failed to connect to backend. Is the server running?');
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  // Poll sync status when syncing
  useEffect(() => {
    if (!syncStatus?.in_progress) return;

    const interval = setInterval(async () => {
      try {
        const status = await getSyncStatus();
        setSyncStatus(status);
        if (!status.in_progress) {
          // Refresh track count after sync
          const count = await getTrackCount();
          setTrackCount(count);
        }
      } catch (err) {
        console.error('Failed to get sync status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [syncStatus?.in_progress]);

  const handleSync = async () => {
    try {
      await startSync();
      setSyncStatus({ in_progress: true, progress: 0, total: 0, stage: 'Starting...', error: null });
    } catch (err) {
      console.error('Failed to start sync:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuth({ authenticated: false });
      setTrackCount(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 text-[#1DB954] mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state (backend not reachable)
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="bg-[#141414] rounded-xl p-4 text-left text-sm font-mono mb-6">
            <p className="text-gray-400 mb-2"># Start the backend:</p>
            <p className="text-[#1DB954]">cd backend</p>
            <p className="text-[#1DB954]">source venv/bin/activate</p>
            <p className="text-[#1DB954]">uvicorn main:app --reload</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold py-3 px-6 rounded-full transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Setup screen (not configured)
  if (!configStatus?.configured) {
    return <SetupScreen />;
  }

  // Login screen
  if (!auth?.authenticated) {
    return (
      <div className="min-h-screen bg-gradient-spotify flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo_big.png"
              alt="Playlist Voyager"
              className="w-64 mx-auto mb-4"
            />
            <p className="text-gray-400">
              Explore your music library through time and style
            </p>
          </div>

          {/* Login Card */}
          <div className="gradient-border p-8">
            <h2 className="text-xl font-semibold mb-4">Connect Your Spotify</h2>
            <p className="text-gray-400 text-sm mb-6">
              We'll access your liked songs, listening history, and audio features to create beautiful visualizations of your music taste.
            </p>
            <a
              href={getLoginUrl()}
              className="block w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold py-3 px-6 rounded-full text-center transition-colors"
            >
              Login with Spotify
            </a>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Your data stays local. We never upload your information.
            </p>
          </div>

          {/* Features Preview */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            {TABS.map(({ id, label, icon: Icon }) => (
              <div key={id} className="bg-[#141414] rounded-xl p-4 border border-white/5">
                <Icon className="w-6 h-6 text-[#1DB954] mb-2" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo_mini.png" alt="Playlist Voyager" className="h-9" />
            <img src="/logo_text.png" alt="Playlist Voyager" className="h-6 hidden sm:block" />
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`nav-tab px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  activeTab === id
                    ? 'bg-white/10 text-white active'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Sync Button / Status */}
            {syncStatus?.in_progress ? (
              <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-full px-4 py-2 sync-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-[#1DB954]" />
                <span className="text-sm">
                  {syncStatus.progress}/{syncStatus.total || '?'}
                </span>
              </div>
            ) : (
              <button
                onClick={handleSync}
                className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#282828] rounded-full px-4 py-2 transition-colors"
                title="Sync library"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">
                  {trackCount?.count ? `${trackCount.count} tracks` : 'Sync'}
                </span>
              </button>
            )}

            {/* User */}
            {auth.user && (
              <div className="flex items-center gap-2">
                {auth.user.image && (
                  <img
                    src={auth.user.image}
                    alt={auth.user.display_name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sync Progress Bar */}
        {syncStatus?.in_progress && syncStatus.total > 0 && (
          <div className="h-1 bg-[#1a1a1a]">
            <div
              className="h-full bg-[#1DB954] transition-all duration-300"
              style={{ width: `${(syncStatus.progress / syncStatus.total) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!trackCount?.count ? (
          // Empty state - need to sync
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Welcome, {auth.user?.display_name}!</h2>
              <p className="text-gray-400 mb-6">
                Let's sync your liked songs to get started. This will fetch your library and analyze audio features.
              </p>
              <button
                onClick={handleSync}
                disabled={syncStatus?.in_progress}
                className="bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-semibold py-3 px-8 rounded-full transition-colors inline-flex items-center gap-2"
              >
                {syncStatus?.in_progress ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Syncing... {syncStatus.stage}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Sync Library
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          // Tab content
          <div className="h-full">
            {activeTab === 'search' && <TemporalSearch />}
            {activeTab === 'graph' && <StyleGraph />}
            {activeTab === 'session' && <SessionPath />}
          </div>
        )}
      </main>
    </div>
  );
}
