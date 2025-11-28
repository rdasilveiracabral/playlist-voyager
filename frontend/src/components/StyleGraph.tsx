import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, Info, GitBranch, Clock, ListMusic } from 'lucide-react';
import { getGraphData, getTemporalGraphData, getPlayHistoryGraphData, type GraphData, type GraphNode } from '../lib/api';

type ViewMode = 'artist' | 'playlist' | 'temporal';

export function StyleGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode['data'] | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('artist');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; count: number } | null>(null);
  const [connectedGenres, setConnectedGenres] = useState<{ id: string; label: string; color: string; count: number }[]>([]);

  // Load graph data based on view mode
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let data: GraphData;
        if (viewMode === 'artist') {
          data = await getGraphData();
        } else if (viewMode === 'playlist') {
          data = await getTemporalGraphData();
        } else {
          data = await getPlayHistoryGraphData();
        }
        setGraphData(data);
        setSelectedNode(null);
      } catch (err) {
        console.error('Failed to load graph data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [viewMode]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...graphData.nodes, ...graphData.edges],
      style: [
        // Super-genre nodes (large)
        {
          selector: 'node[type="super_genre"]',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'width': 'mapData(count, 0, 5000, 80, 200)',
            'height': 'mapData(count, 0, 5000, 80, 200)',
            'font-size': '16px',
            'font-weight': 'bold',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'border-width': 3,
            'border-color': '#ffffff',
            'border-opacity': 0.4,
            'text-outline-color': '#000000',
            'text-outline-width': 2,
          },
        },
        // Genre nodes (smaller)
        {
          selector: 'node[type="genre"]',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.8,
            'label': 'data(label)',
            'width': 'mapData(count, 1, 600, 15, 60)',
            'height': 'mapData(count, 1, 600, 15, 60)',
            'font-size': '9px',
            'color': '#ffffff',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'text-opacity': 0,
            'text-outline-color': '#000000',
            'text-outline-width': 1,
          },
        },
        // Show genre labels on hover/zoom
        {
          selector: 'node[type="genre"]:selected, node[type="genre"].hover',
          style: {
            'text-opacity': 1,
            'background-opacity': 1,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        // Highlighted nodes (connected to hovered node)
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#1DB954',
            'background-opacity': 1,
          },
        },
        // Dimmed nodes (not connected to hovered node)
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.2,
          },
        },
        // Parent edges (genre -> super-genre)
        {
          selector: 'edge[type="parent"]',
          style: {
            'width': 1,
            'line-color': '#555555',
            'opacity': 0.3,
            'curve-style': 'bezier',
          },
        },
        // Co-occurrence edges (genre <-> genre, same artist)
        {
          selector: 'edge[type="cooccurrence"]',
          style: {
            'width': 'mapData(weight, 2, 20, 1, 3)',
            'line-color': '#666666',
            'opacity': 'mapData(weight, 2, 20, 0.3, 0.6)',
            'curve-style': 'bezier',
          },
        },
        // Bridge edges (super-genre <-> super-genre)
        {
          selector: 'edge[type="bridge"]',
          style: {
            'width': 'mapData(weight, 3, 50, 2, 6)',
            'line-color': '#777777',
            'opacity': 'mapData(weight, 3, 50, 0.4, 0.7)',
            'curve-style': 'bezier',
          },
        },
        // Temporal edges (genre <-> genre based on save time proximity)
        {
          selector: 'edge[type="temporal"]',
          style: {
            'width': 'mapData(weight, 0, 20, 1, 4)',
            'line-color': '#666666',
            'opacity': 'mapData(weight, 0, 20, 0.2, 0.6)',
            'curve-style': 'bezier',
          },
        },
        // Temporal bridge edges (super-genre <-> super-genre)
        {
          selector: 'edge[type="temporal_bridge"]',
          style: {
            'width': 'mapData(weight, 0, 50, 2, 8)',
            'line-color': '#777777',
            'opacity': 'mapData(weight, 0, 50, 0.3, 0.7)',
            'curve-style': 'bezier',
          },
        },
        // Highlighted edges
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#1DB954',
            'opacity': 0.9,
            'width': 3,
          },
        },
        // Dimmed edges
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.05,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 150,
        nodeOverlap: 20,
        refresh: 20,
        fit: false,
        padding: 50,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
      zoom: 1.5,
    });

    // Center after layout completes
    cy.on('layoutstop', () => {
      cy.center();
    });

    cyRef.current = cy;

    // Event handlers - use function refs to avoid stale closure
    const handleNodeTap = (evt: cytoscape.EventObject) => {
      const node = evt.target as NodeSingular;
      const data = node.data();
      console.log('Node clicked:', data);
      setSelectedNode({ ...data });

      // Get connected genres (excluding parent edges for genre nodes)
      const connectedEdges = node.connectedEdges().filter((edge) => {
        const edgeType = edge.data('type');
        return edgeType !== 'parent';
      });
      const connectedNodes = connectedEdges.connectedNodes().filter((n) => n.id() !== node.id());
      const connected = connectedNodes.map((n) => ({
        id: n.id(),
        label: n.data('label'),
        color: n.data('color'),
        count: n.data('count'),
      }));
      // Sort by count descending
      connected.sort((a, b) => b.count - a.count);
      setConnectedGenres(connected);
    };

    const handleBackgroundTap = (evt: cytoscape.EventObject) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setConnectedGenres([]);
      }
    };

    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', handleBackgroundTap);

    // Hover handlers for highlighting and tooltip
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      node.addClass('hover');

      // Show tooltip
      const data = node.data();
      const pos = node.renderedPosition();
      setTooltip({
        x: pos.x,
        y: pos.y - 40,
        label: data.label,
        count: data.count,
      });

      // Highlight connected nodes and edges
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();

      // Dim all, then highlight connected
      cy.elements().addClass('dimmed');
      node.removeClass('dimmed').addClass('highlighted');
      connectedNodes.removeClass('dimmed').addClass('highlighted');
      connectedEdges.removeClass('dimmed').addClass('highlighted');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      node.removeClass('hover');

      // Hide tooltip
      setTooltip(null);

      // Remove all highlighting
      cy.elements().removeClass('dimmed highlighted');
    });

    cy.on('zoom', () => {
      setZoomLevel(cy.zoom());
      // Show genre labels at higher zoom levels
      const zoom = cy.zoom();
      cy.nodes('[type="genre"]').forEach((node) => {
        if (zoom > 1.2) {
          node.style('text-opacity', 1);
        } else {
          node.style('text-opacity', 0);
        }
      });
    });

    return () => {
      cy.destroy();
    };
  }, [graphData]);

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
    cyRef.current?.center();
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
    cyRef.current?.center();
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  // Navigate to a connected genre
  const navigateToGenre = useCallback((genreId: string) => {
    const cy = cyRef.current;
    if (!cy) return;

    const node = cy.getElementById(genreId);
    if (node.length > 0) {
      // Trigger the tap event programmatically
      const data = node.data();
      setSelectedNode({ ...data });

      // Get connected genres
      const connectedEdges = node.connectedEdges().filter((edge) => {
        const edgeType = edge.data('type');
        return edgeType !== 'parent';
      });
      const connectedNodes = connectedEdges.connectedNodes().filter((n) => n.id() !== genreId);
      const connected = connectedNodes.map((n) => ({
        id: n.id(),
        label: n.data('label'),
        color: n.data('color'),
        count: n.data('count'),
      }));
      connected.sort((a, b) => b.count - a.count);
      setConnectedGenres(connected);

      // Center on the node
      cy.animate({
        center: { eles: node },
        duration: 300,
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading genre graph...</p>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Info className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No data available. Sync your library first!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Graph Container */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full cytoscape-container" />

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-[#282828] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-[#282828] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleFit}
            className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-[#282828] transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & View Toggle */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
          {/* View Toggle */}
          <div className="bg-[#1a1a1a]/90 backdrop-blur rounded-lg p-1 inline-flex gap-1">
            <button
              onClick={() => setViewMode('artist')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                viewMode === 'artist'
                  ? 'bg-[#1DB954] text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Genres connected by shared artists"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Artist
            </button>
            <button
              onClick={() => setViewMode('playlist')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                viewMode === 'playlist'
                  ? 'bg-[#1DB954] text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Genres saved around the same time"
            >
              <ListMusic className="w-3.5 h-3.5" />
              Playlist
            </button>
            <button
              onClick={() => setViewMode('temporal')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                viewMode === 'temporal'
                  ? 'bg-[#1DB954] text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Genres played together in sessions"
            >
              <Clock className="w-3.5 h-3.5" />
              Temporal
            </button>
          </div>

          {/* Stats */}
          <div className="bg-[#1a1a1a]/80 backdrop-blur rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-400">Genres: </span>
            <span className="text-white font-semibold">{graphData.stats.total_genres}</span>
            <span className="text-gray-600 mx-2">|</span>
            <span className="text-gray-400">Tracks: </span>
            <span className="text-white font-semibold">{graphData.stats.total_tracks}</span>
            {graphData.stats.genre_connections !== undefined && (
              <>
                <span className="text-gray-600 mx-2">|</span>
                <span className="text-[#1DB954]">{graphData.stats.genre_connections}</span>
                <span className="text-gray-400"> connections</span>
              </>
            )}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-[#1a1a1a]/95 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-sm z-50 transform -translate-x-1/2"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-semibold text-white">{tooltip.label}</p>
            <p className="text-[#1DB954]">{tooltip.count.toLocaleString()} tracks</p>
          </div>
        )}

        {/* Zoom indicator */}
        <div className="absolute top-4 right-4 bg-[#1a1a1a]/80 backdrop-blur rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-400">Zoom: </span>
          <span className="text-white font-semibold">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedNode ? (
        <div className="w-80 bg-[#141414] border-l border-white/5 overflow-y-auto">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedNode.color }}
              />
              <h3 className="text-lg font-bold truncate">{selectedNode.label}</h3>
            </div>

            {/* Count */}
            <p className="text-gray-400 text-sm mb-4">
              <span className="text-xl font-bold text-white">{selectedNode.count.toLocaleString()}</span> tracks
            </p>

            {/* Connected Genres */}
            {connectedGenres.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Connected ({connectedGenres.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {connectedGenres.slice(0, 12).map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => navigateToGenre(genre.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: genre.color }}
                      />
                      <span className="truncate max-w-[100px]">{genre.label}</span>
                    </button>
                  ))}
                  {connectedGenres.length > 12 && (
                    <span className="px-2 py-1 text-xs text-gray-500">
                      +{connectedGenres.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tracks */}
            {selectedNode.sample_tracks && selectedNode.sample_tracks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Tracks
                </h4>
                <div className="space-y-1">
                  {selectedNode.sample_tracks.map((track) => (
                    <a
                      key={track.id}
                      href={track.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 transition-colors group"
                    >
                      {track.album_image && (
                        <img
                          src={track.album_image}
                          alt=""
                          className="w-8 h-8 rounded flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate group-hover:text-[#1DB954]">{track.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {track.artists.join(', ')}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-80 bg-[#141414] border-l border-white/5 flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center px-4">Click a node to see details</p>
        </div>
      )}
    </div>
  );
}
