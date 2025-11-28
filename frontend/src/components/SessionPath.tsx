import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
import {
  Play,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Upload,
  ZoomIn,
  ZoomOut,
  Scan,
  Calendar as CalendarIcon,
  BarChart3,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  getListeningStats,
  getPlaysByDate,
  getPlayHistoryGraphData,
  getActiveEdgesByDate,
  importHistory,
  getHistoryStats,
  type ListeningStats,
  type AllPlay,
  type GraphData,
  type GraphNode,
  type ActiveEdges,
} from '../lib/api';

// ============ CalendarWidget ============
function CalendarWidget({
  dailyCounts,
  selectedDate,
  onSelectDate,
}: {
  dailyCounts: Record<string, number>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const maxCount = Math.max(...Object.values(dailyCounts), 1);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewMonth.year, viewMonth.month);
  const firstDay = getFirstDayOfMonth(viewMonth.year, viewMonth.month);

  const prevMonth = () => {
    setViewMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleString('en-US', { month: 'short' });

  // Build calendar grid
  const weeks: (number | null)[][] = [];
  let currentDay = 1;
  for (let week = 0; week < 6; week++) {
    const days: (number | null)[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if (week === 0 && dow < firstDay) {
        days.push(null);
      } else if (currentDay > daysInMonth) {
        days.push(null);
      } else {
        days.push(currentDay);
        currentDay++;
      }
    }
    weeks.push(days);
    if (currentDay > daysInMonth) break;
  }

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">
          {monthName} {viewMonth.year}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, i) => {
          if (day === null) return <div key={i} />;

          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = dailyCounts[dateStr] || 0;
          const isSelected = dateStr === selectedDate;
          const dotScale = count > 0 ? Math.min(count / maxCount, 1) : 0;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className={`relative w-6 h-6 text-[10px] rounded flex items-center justify-center transition-colors
                ${isSelected ? 'bg-[#1DB954] text-black font-bold' : 'hover:bg-white/10'}`}
            >
              {day}
              {count > 0 && !isSelected && (
                <div
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[#1DB954]"
                  style={{
                    width: 3 + dotScale * 3,
                    height: 3 + dotScale * 3,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ HourlyPatternChart ============
function HourlyPatternChart({ hourlyPattern }: { hourlyPattern: number[] }) {
  const maxCount = Math.max(...hourlyPattern, 1);

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-[#1DB954]" />
        <span className="text-sm font-semibold">Daily Pattern</span>
      </div>
      <div className="flex items-end gap-0.5 h-16">
        {hourlyPattern.map((count, hour) => (
          <div
            key={hour}
            className="flex-1 bg-[#1DB954]/70 rounded-t hover:bg-[#1DB954] transition-colors group relative"
            style={{ height: `${Math.max((count / maxCount) * 100, 2)}%` }}
            title={`${hour}:00 - ${count} plays`}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/90 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {hour}:00 ({count})
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-gray-500">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
    </div>
  );
}

// ============ ImportHistoryModal ============
function ImportHistoryModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setImporting(true);
    try {
      const res = await importHistory(files);
      setResult(res);
      if (res.imported > 0) {
        onSuccess();
      }
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [(err as Error).message] });
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Import Listening History</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Upload your Spotify Extended Streaming History JSON files. You can request this data from your{' '}
          <a
            href="https://www.spotify.com/account/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1DB954] hover:underline"
          >
            Spotify Privacy Settings
          </a>
          .
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-[#1DB954]/50 transition-colors mb-4"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-400">
            {files.length > 0
              ? `${files.length} file(s) selected`
              : 'Click to select JSON files'}
          </p>
        </button>

        {files.length > 0 && (
          <div className="mb-4 text-sm text-gray-400">
            {files.map((f, i) => (
              <div key={i} className="truncate">
                {f.name}
              </div>
            ))}
          </div>
        )}

        {result && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              result.errors.length > 0 ? 'bg-red-500/20' : 'bg-green-500/20'
            }`}
          >
            {result.errors.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Import had errors
                </div>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-red-300 text-xs">
                    {e}
                  </div>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <Check className="w-4 h-4" />
                Imported {result.imported.toLocaleString()} plays
                {result.skipped > 0 && ` (${result.skipped.toLocaleString()} skipped)`}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={files.length === 0 || importing}
            className="flex-1 px-4 py-2 bg-[#1DB954] text-black font-semibold rounded-lg hover:bg-[#1ed760] transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ ListeningTimeline ============
function ListeningTimeline({ plays, selectedDate }: { plays: AllPlay[]; selectedDate: string }) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const displayDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (plays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Play className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No plays on this date</p>
        <p className="text-gray-500 text-xs mt-1">
          Import your Spotify history or play music to see data here
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold">{displayDate}</h3>
        <p className="text-xs text-gray-500">{plays.length} plays</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {plays.map((play, index) => (
            <a
              key={`${play.track_id || play.track_name}-${play.played_at}-${index}`}
              href={play.spotify_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group ${
                !play.spotify_url ? 'pointer-events-none' : ''
              }`}
            >
              {/* Album art */}
              {play.album_image_url ? (
                <img src={play.album_image_url} alt="" className="w-10 h-10 rounded flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-[#282828] flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 text-gray-500" />
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-[#1DB954]">{play.track_name}</p>
                <p className="text-xs text-gray-500 truncate">{play.artist_name}</p>
              </div>

              {/* Time */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(play.played_at)}
                </p>
                {play.source === 'historical' && (
                  <p className="text-[9px] text-gray-600">imported</p>
                )}
              </div>

              {play.spotify_url && (
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[#1DB954] flex-shrink-0" />
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ MiniGenreGraph ============
function MiniGenreGraph({ selectedDate }: { selectedDate: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode['data'] | null>(null);
  const [fullGraphData, setFullGraphData] = useState<GraphData | null>(null);
  const [activeEdges, setActiveEdges] = useState<ActiveEdges | null>(null);
  const [loading, setLoading] = useState(true);

  // Load full graph data once on mount
  useEffect(() => {
    const loadFullGraph = async () => {
      try {
        const data = await getPlayHistoryGraphData();
        setFullGraphData(data);
      } catch (err) {
        console.error('Failed to load full graph data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFullGraph();
  }, []);

  // Load active edges when date changes
  useEffect(() => {
    const loadActiveEdges = async () => {
      try {
        const data = await getActiveEdgesByDate(selectedDate);
        setActiveEdges(data);
      } catch (err) {
        console.error('Failed to load active edges:', err);
        setActiveEdges(null);
      }
    };
    loadActiveEdges();
  }, [selectedDate]);

  // Initialize Cytoscape once when full graph data is loaded
  useEffect(() => {
    if (!containerRef.current || !fullGraphData || fullGraphData.nodes.length === 0) return;

    // Calculate dynamic ranges
    const superGenreNodes = fullGraphData.nodes.filter((n) => n.data.type === 'super_genre');
    const genreNodes = fullGraphData.nodes.filter((n) => n.data.type === 'genre');

    const superGenreCounts = superGenreNodes.map((n) => n.data.count);
    const genreCounts = genreNodes.map((n) => n.data.count);

    const superMin = Math.min(...superGenreCounts, 1);
    const superMax = Math.max(...superGenreCounts, 1);
    const genreMin = Math.min(...genreCounts, 1);
    const genreMax = Math.max(...genreCounts, 1);

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...fullGraphData.nodes, ...fullGraphData.edges],
      style: [
        {
          selector: 'node[type="super_genre"]',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.4,
            label: 'data(label)',
            width: `mapData(count, ${superMin}, ${superMax}, 50, 120)`,
            height: `mapData(count, ${superMin}, ${superMax}, 50, 120)`,
            'font-size': '12px',
            'font-weight': 'bold',
            color: '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.2,
            'text-outline-color': '#000000',
            'text-outline-width': 1,
            'text-opacity': 0.5,
          },
        },
        {
          selector: 'node[type="super_genre"].active',
          style: {
            'background-opacity': 1,
            'border-opacity': 0.5,
            'text-opacity': 1,
          },
        },
        {
          selector: 'node[type="genre"]',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.3,
            label: 'data(label)',
            width: `mapData(count, ${genreMin}, ${genreMax}, 12, 40)`,
            height: `mapData(count, ${genreMin}, ${genreMax}, 12, 40)`,
            'font-size': '8px',
            color: '#ffffff',
            'text-valign': 'bottom',
            'text-margin-y': 3,
            'text-opacity': 0,
            'text-outline-color': '#000000',
            'text-outline-width': 1,
          },
        },
        {
          selector: 'node[type="genre"].active',
          style: {
            'background-opacity': 1,
            'text-opacity': 1,
            'border-width': 2,
            'border-color': '#1DB954',
          },
        },
        {
          selector: 'node[type="genre"]:selected, node[type="genre"].hover',
          style: {
            'text-opacity': 1,
            'background-opacity': 1,
            'border-width': 2,
            'border-color': '#1DB954',
          },
        },
        {
          selector: 'edge[type="parent"]',
          style: {
            width: 1,
            'line-color': '#333333',
            opacity: 0.15,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge[type="parent"].active',
          style: {
            'line-color': '#1DB954',
            opacity: 0.6,
            width: 2,
          },
        },
        {
          selector: 'edge[type="temporal"]',
          style: {
            width: 2,
            'line-color': '#333333',
            opacity: 0.15,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge[type="temporal"].active',
          style: {
            'line-color': '#1DB954',
            opacity: 0.9,
            width: 3,
          },
        },
        {
          selector: 'edge[type="temporal_bridge"]',
          style: {
            width: 3,
            'line-color': '#333333',
            opacity: 0.15,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge[type="temporal_bridge"].active',
          style: {
            'line-color': '#1DB954',
            opacity: 0.9,
            width: 4,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 80,
        nodeOverlap: 15,
        fit: true,
        padding: 20,
        randomize: false,
        componentSpacing: 60,
        nodeRepulsion: 200000,
        edgeElasticity: 80,
        nestingFactor: 5,
        gravity: 60,
        numIter: 500,
      },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;

    // Click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      setSelectedNode({ ...node.data() });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    // Hover - show labels
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      node.addClass('hover');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      node.removeClass('hover');
    });

    return () => {
      cy.destroy();
    };
  }, [fullGraphData]);

  // Update highlighting when active edges change
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !activeEdges) return;

    // Remove all active classes
    cy.elements().removeClass('active');

    // Build set of active node IDs
    const activeNodeIds = new Set([
      ...activeEdges.active_node_ids,
      ...activeEdges.active_super_genre_ids,
    ]);

    // Highlight active nodes
    activeNodeIds.forEach((nodeId) => {
      cy.getElementById(nodeId).addClass('active');
    });

    // Build set of active edge pairs (as "node1|node2" strings for fast lookup)
    const activeEdgePairs = new Set(
      activeEdges.active_edge_pairs.map((pair) => {
        const sorted = [...pair].sort();
        return `${sorted[0]}|${sorted[1]}`;
      })
    );

    // Highlight only edges that match the sequential transition pairs
    cy.edges().forEach((edge) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const sorted = [sourceId, targetId].sort();
      const edgeKey = `${sorted[0]}|${sorted[1]}`;

      if (activeEdgePairs.has(edgeKey)) {
        edge.addClass('active');
      }
    });

    // Fit to active nodes if there are any
    const activeNodes = cy.nodes('.active');
    if (activeNodes.length > 0) {
      cy.fit(activeNodes, 40);
    }
  }, [activeEdges]);

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
    cyRef.current?.center();
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
    cyRef.current?.center();
  }, []);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const activeNodes = cy.nodes('.active');
    if (activeNodes.length > 0) {
      cy.fit(activeNodes, 40);
    } else {
      cy.fit(undefined, 20);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!fullGraphData || fullGraphData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-4">
          <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No genre data available</p>
          <p className="text-gray-500 text-xs mt-1">
            Sync your library to see genre connections
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Genre Flow</h3>
          <p className="text-xs text-gray-500">
            {activeEdges?.play_count || 0} plays on this day
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleFit} className="p-1.5 hover:bg-white/10 rounded" title="Fit">
            <Scan className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full bg-[#0a0a0a]" />

        {/* Node detail popup */}
        {selectedNode && (
          <div className="absolute bottom-2 left-2 right-2 bg-[#1a1a1a]/95 backdrop-blur rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }} />
              <span className="font-semibold text-sm">{selectedNode.label}</span>
              <span className="text-xs text-gray-400 ml-auto">{selectedNode.count} plays</span>
            </div>
            {selectedNode.sample_tracks && selectedNode.sample_tracks.length > 0 && (
              <div className="space-y-1">
                {selectedNode.sample_tracks.slice(0, 3).map((track) => (
                  <a
                    key={track.id}
                    href={track.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs hover:text-[#1DB954] truncate"
                  >
                    {track.album_image && <img src={track.album_image} alt="" className="w-5 h-5 rounded" />}
                    <span className="truncate">{track.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main SessionPath Component ============
export function SessionPath() {
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [dayPlays, setDayPlays] = useState<AllPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [historyStats, setHistoryStats] = useState<{ historical: number; recent: number }>({
    historical: 0,
    recent: 0,
  });

  // Load initial stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([getListeningStats(), getHistoryStats()]);
        setStats(statsRes);
        setHistoryStats({ historical: historyRes.historical_count, recent: historyRes.recent_count });

        // Select most recent day with plays
        if (statsRes.date_range.end) {
          setSelectedDate(statsRes.date_range.end);
        }
      } catch (err) {
        console.error('Failed to load listening stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // Load day plays when date changes
  useEffect(() => {
    const loadDayPlays = async () => {
      try {
        const playsRes = await getPlaysByDate(selectedDate);
        setDayPlays(playsRes.plays);
      } catch (err) {
        console.error('Failed to load day plays:', err);
        setDayPlays([]);
      }
    };
    loadDayPlays();
  }, [selectedDate]);

  const handleImportSuccess = async () => {
    // Reload stats
    const [statsRes, historyRes] = await Promise.all([getListeningStats(), getHistoryStats()]);
    setStats(statsRes);
    setHistoryStats({ historical: historyRes.historical_count, recent: historyRes.recent_count });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading listening data...</p>
        </div>
      </div>
    );
  }

  const hasData = stats && Object.keys(stats.daily_counts).length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Play className="w-5 h-5 text-[#1DB954]" />
            Session Path
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {historyStats.historical > 0
              ? `${historyStats.historical.toLocaleString()} imported + ${historyStats.recent} recent plays`
              : `${historyStats.recent} recent plays`}
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import History
        </button>
      </div>

      {hasData ? (
        <>
          {/* Top row: Calendar + Hourly Pattern */}
          <div className="p-4 border-b border-white/5 flex gap-4">
            <div className="flex-shrink-0">
              <CalendarWidget
                dailyCounts={stats.daily_counts}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
            <div className="flex-1 min-w-0">
              <HourlyPatternChart hourlyPattern={stats.hourly_pattern} />
            </div>
          </div>

          {/* Bottom row: Timeline + Graph */}
          <div className="flex-1 flex min-h-0">
            {/* Left: Timeline */}
            <div className="w-1/2 border-r border-white/5">
              <ListeningTimeline plays={dayPlays} selectedDate={selectedDate} />
            </div>

            {/* Right: Graph */}
            <div className="w-1/2">
              <MiniGenreGraph selectedDate={selectedDate} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <CalendarIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Listening History</h3>
            <p className="text-gray-400 text-sm mb-4">
              Import your Spotify Extended Streaming History to see your listening patterns over time, or play music
              on Spotify to start collecting data.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-black font-semibold rounded-lg hover:bg-[#1ed760] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Spotify History
            </button>
          </div>
        </div>
      )}

      <ImportHistoryModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}

// Re-export helper for gradient colors used elsewhere
export function getColorForIndex(index: number, total: number): string {
  const hue = (index / total) * 120 + 120;
  return `hsl(${hue}, 70%, 50%)`;
}
