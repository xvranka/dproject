const KEY_MAPPINGS = [
  ['W / ↑', 'Move forward'],
  ['S / ↓', 'Move backward'],
  ['A / ←', 'Strafe left'],
  ['D / →', 'Strafe right'],
  ['E', 'Ascend'],
  ['Q', 'Descend'],
  ['Mouse drag', 'Look around'],
  ['Scroll', 'Move forward / back'],
]

const keyStyle = {
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  background: '#222',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: '4px',
  padding: '0.1rem 0.4rem',
  whiteSpace: 'nowrap',
}

export default function Controls({ onResetCamera, showGuide, onToggleGuide }) {
  return (
    <div>
      <button
        onClick={onResetCamera}
        style={{
          width: '100%',
          fontSize: '0.8rem',
          background: 'none',
          border: '1px solid #555',
          borderRadius: '4px',
          color: 'inherit',
          padding: '0.35rem 0.6rem',
          cursor: 'pointer',
        }}
      >
        Reset camera
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.7rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={showGuide} onChange={(e) => onToggleGuide(e.target.checked)} />
        Show orientation guide
      </label>
      <p style={{ fontSize: '0.7rem', color: '#888', margin: '0.8rem 0 0.4rem' }}>
        Click the canvas first so it has keyboard focus.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.8rem', alignItems: 'center' }}>
        {KEY_MAPPINGS.map(([key, action]) => (
          <div key={key} style={{ display: 'contents' }}>
            <span style={keyStyle}>{key}</span>
            <span style={{ fontSize: '0.8rem' }}>{action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
