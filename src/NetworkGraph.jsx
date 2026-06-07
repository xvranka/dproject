import { useRef, useMemo, useState } from 'react';
import VizModule from './vizmodule';
import { papersToScene } from './data/dataAdapter';

// controller layer — owns domain data, preprocesses it, and drives VizModule
// VizModule has no knowledge of papers; this component resolves indices to Paper objects
export default function NetworkGraph({ papers }) {
  const vizRef = useRef(null);
  const [selectedPaper, setSelectedPaper] = useState(null);

  // convert papers to typed arrays once — stable reference prevents unnecessary GPU re-uploads
  const scene = useMemo(() => papersToScene(papers), [papers]);

  function handleNodeClick(index) {
    const paper = scene.indexToPaper.get(index);
    if (!paper) return;
    setSelectedPaper(paper);
    // TODO: fetch full paper detail here using paper.id
  }

  function handleZoomChange(radius) {
    // TODO: drive LOD or data density decisions based on zoom level
  }

  function handleViewportStats({ visible, total }) {
    // TODO: use for render optimisations (culling, clustering)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      <VizModule
        ref={vizRef}
        vertices={scene.vertices}
        indices={scene.indices}
        nodeCount={scene.nodeCount}
        edgeCount={scene.edgeCount}
        onNodeClick={handleNodeClick}
        onZoomChange={handleZoomChange}
        onViewportStats={handleViewportStats}
      />

      {selectedPaper && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(10,10,20,0.88)', color: '#fff',
          padding: '14px 18px', borderRadius: 8, maxWidth: 300,
          fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.5,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedPaper.title}</div>
          <div style={{ opacity: 0.65, marginBottom: 4 }}>{selectedPaper.authors}</div>
          <div style={{ opacity: 0.45, fontSize: 11 }}>
            {selectedPaper.publication_year} · {selectedPaper.subfield}
          </div>
          <button
            onClick={() => setSelectedPaper(null)}
            style={{
              marginTop: 10, background: 'none',
              border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            }}
          >
            close
          </button>
        </div>
      )}

    </div>
  );
}