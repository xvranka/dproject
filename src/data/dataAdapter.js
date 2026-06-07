/**
 * @file dataAdapter.js
 * Converts an array of Paper objects (schema.js) into the typed-array scene format
 * expected by VizModule.
 *
 * Layout strategy
 * ───────────────
 * Papers are grouped by subfield and placed around a subfield-specific cluster
 * centre in 3D space. A small seeded offset is added per paper so overlapping
 * nodes spread out visually. Colours are assigned per subfield.
 *
 * Edge strategy
 * ─────────────
 * A directed citation (paper A lists paper B's id in references_full) becomes
 * an undirected edge between the two nodes. Only edges where both endpoints
 * are present in the supplied papers array are created.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function makePRNG(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Subfield colour palette (RGB in [0,1]) ───────────────────────────────────

const SUBFIELD_STYLES = {
  'Natural Language Processing': { r: 0.25, g: 0.55, b: 1.00, cx:  -3.5, cy:  1.5, cz:  0.0 },
  'Computer Vision':             { r: 1.00, g: 0.45, b: 0.20, cx:   3.5, cy: -1.0, cz:  0.0 },
  'Machine Learning':            { r: 0.45, g: 0.90, b: 0.55, cx:   0.0, cy: -2.5, cz:  2.5 },
  'Reinforcement Learning':      { r: 0.90, g: 0.30, b: 0.80, cx:  -1.5, cy:  3.0, cz: -2.0 },
};

const DEFAULT_STYLE = { r: 0.70, g: 0.70, b: 0.70, cx: 0.0, cy: 0.0, cz: 0.0 };

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Converts an array of Paper objects into VizModule-ready typed arrays.
 *
 * @param {import('./schema').Paper[]} papers
 * @returns {{
 *   vertices:     Float32Array,
 *   indices:      Uint32Array,
 *   nodeCount:    number,
 *   edgeCount:    number,
 *   indexToPaper: Map<number, import('./schema').Paper>
 * }}
 */
export function papersToScene(papers) {
  const rng   = makePRNG(0xcafebabe);
  const idMap = new Map(papers.map((p, i) => [p.id, i]));

  // ── Vertices ────────────────────────────────────────────────────────────────
  // interleaved Float32Array: [x, y, z, r, g, b] per node — 6 floats, 24 bytes stride
  const vertices = new Float32Array(papers.length * 6);

  papers.forEach((paper, i) => {
    const style = SUBFIELD_STYLES[paper.subfield] ?? DEFAULT_STYLE;

    const x = style.cx + (rng() - 0.5) * 2.5;
    const y = style.cy + (rng() - 0.5) * 2.5;
    const z = style.cz + (rng() - 0.5) * 2.5;
    const r = Math.min(1, style.r + (rng() - 0.5) * 0.2);
    const g = Math.min(1, style.g + (rng() - 0.5) * 0.2);
    const b = Math.min(1, style.b + (rng() - 0.5) * 0.2);

    const off       = i * 6;
    vertices[off]   = x;  vertices[off+1] = y;  vertices[off+2] = z;
    vertices[off+3] = r;  vertices[off+4] = g;  vertices[off+5] = b;
  });

  // ── Edges ───────────────────────────────────────────────────────────────────
  const edgeSet  = new Set();
  const edgePairs = [];

  for (const paper of papers) {
    const fromIdx = idMap.get(paper.id);
    if (fromIdx === undefined) continue;

    let refs = [];
    try { refs = JSON.parse(paper.references_full ?? '[]'); } catch { /* skip malformed JSON */ }

    for (const refId of refs) {
      const toIdx = idMap.get(refId);
      if (toIdx === undefined) continue;

      const key = fromIdx < toIdx ? `${fromIdx}-${toIdx}` : `${toIdx}-${fromIdx}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edgePairs.push(fromIdx, toIdx);
      }
    }
  }

  // ── Index → Paper lookup (used by controller to resolve GPU pick results) ────
  const indexToPaper = new Map(papers.map((p, i) => [i, p]));

  return {
    vertices,
    indices:     new Uint32Array(edgePairs),
    nodeCount:   papers.length,
    edgeCount:   edgePairs.length / 2,
    indexToPaper,
  };
}