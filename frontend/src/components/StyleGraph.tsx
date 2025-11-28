import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, Info } from 'lucide-react';
import { getGraphData, type GraphData, type GraphNode } from '../lib/api';

export function StyleGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode['data'] | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Load graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getGraphData();
        setGraphData(data);
      } catch (err) {
        console.error('Failed to load graph data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
            'width': 'mapData(count, 0, 1000, 60, 150)',
            'height': 'mapData(count, 0, 1000, 60, 150)',
            'font-size': '14px',
            'font-weight': 'bold',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'border-width': 3,
            'border-color': '#ffffff',
            'border-opacity': 0.3,
            'text-outline-color': '#000000',
            'text-outline-width': 2,
          },
        },
        // Genre nodes (smaller)
        {
          selector: 'node[type="genre"]',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.7,
            'label': 'data(label)',
            'width': 'mapData(count, 1, 100, 20, 50)',
            'height': 'mapData(count, 1, 100, 20, 50)',
            'font-size': '10px',
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
        // Edges
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#333333',
            'opacity': 0.3,
            'curve-style': 'bezier',
          },
        },
        // Highlighted edges
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#1DB954',
            'opacity': 0.8,
            'width': 2,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 150,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
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
    });

    cyRef.current = cy;

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      setSelectedNode(node.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cy.on('mouseover', 'node[type="genre"]', (evt) => {
      const node = evt.target as NodeSingular;
      node.addClass('hover');
    });

    cy.on('mouseout', 'node[type="genre"]', (evt) => {
      const node = evt.target as NodeSingular;
      node.removeClass('hover');
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

        {/* Stats */}
        <div className="absolute top-4 left-4 bg-[#1a1a1a]/80 backdrop-blur rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-400">Genres: </span>
          <span className="text-white font-semibold">{graphData.stats.total_genres}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-400">Tracks: </span>
          <span className="text-white font-semibold">{graphData.stats.total_tracks}</span>
        </div>

        {/* Zoom indicator */}
        <div className="absolute top-4 right-4 bg-[#1a1a1a]/80 backdrop-blur rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-400">Zoom: </span>
          <span className="text-white font-semibold">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="w-80 bg-[#141414] border-l border-white/5 overflow-y-auto">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedNode.color }}
              />
              <h3 className="text-xl font-bold">{selectedNode.label}</h3>
            </div>

            {/* Count */}
            <p className="text-gray-400 mb-4">
              <span className="text-2xl font-bold text-white">{selectedNode.count}</span> tracks
            </p>

            {/* Sample Tracks */}
            {selectedNode.sample_tracks && selectedNode.sample_tracks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Sample Tracks
                </h4>
                <div className="space-y-2">
                  {selectedNode.sample_tracks.map((track) => (
                    <a
                      key={track.id}
                      href={track.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {track.album_image && (
                        <img
                          src={track.album_image}
                          alt=""
                          className="w-10 h-10 rounded"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-gray-400 truncate">
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
      )}
    </div>
  );
}
