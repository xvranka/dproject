import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import VizModule from './VizModule.jsx'
import NodeDetail from './NodeDetail.jsx'
import Section from './Section.jsx'
import Search from './Search.jsx'
import Controls from './Controls.jsx'

const API_URL = '/api/data/ai-subfield-100k'

// ?minimal=true -> embeddable widget view: no sidebar, no orientation guide
const MINIMAL = new URLSearchParams(window.location.search).get('minimal') === 'true'

export default function VMController() {
  const [points, setPoints] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showGuide, setShowGuide] = useState(!MINIMAL)
  const vizRef = useRef(null)

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => setPoints(data))
      .catch((err) => console.error('Failed to fetch dataset:', err))
  }, [])

  const handlePointClick = useCallback((_point, index) => {
    setSelectedIndex(index)
  }, [])

  const indexById = useMemo(() => {
    const map = new Map()
    if (points) points.forEach((p, i) => map.set(p.id, i))
    return map
  }, [points])

  const handleSearchSelect = useCallback(
    (id) => {
      const index = indexById.get(id)
      if (index !== undefined) setSelectedIndex(index)
    },
    [indexById]
  )

  const handleClear = useCallback(() => setSelectedIndex(-1), [])
  const handleResetCamera = useCallback(() => vizRef.current?.resetCamera(), [])

  const selectedPoint = useMemo(
    () => (points && selectedIndex >= 0 ? points[selectedIndex] : null),
    [points, selectedIndex]
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      {!MINIMAL && (
      <aside
        style={{
          width: '320px',
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid #333',
        }}
      >
        <Section title="Search">
          <Search onSelect={handleSearchSelect} />
        </Section>
        <Section
          title="Node Detail"
          actions={
            selectedPoint && (
              <button
                onClick={handleClear}
                style={{
                  fontSize: '0.7rem',
                  background: 'none',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#ccc',
                  padding: '0.1rem 0.4rem',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )
          }
        >
          <NodeDetail point={selectedPoint} />
        </Section>
        <Section title="Controls">
          <Controls onResetCamera={handleResetCamera} showGuide={showGuide} onToggleGuide={setShowGuide} />
        </Section>
      </aside>
      )}
      <div style={{ flex: 1, height: '100%' }}>
        <VizModule ref={vizRef} showGuide={showGuide} points={points} selectedIndex={selectedIndex} onPointClick={handlePointClick} />
      </div>
    </div>
  )
}
