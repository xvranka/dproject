import { useState } from 'react'

export default function Section({ title, children, defaultOpen = true, actions }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ borderBottom: '1px solid #333' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} onClick={(e) => e.stopPropagation()}>
          {actions}
          <span
            onClick={() => setOpen((o) => !o)}
            style={{ fontSize: '0.7rem', color: '#888', cursor: 'pointer' }}
          >
            {open ? '▾' : '▸'}
          </span>
        </div>
      </div>
      {open && <div style={{ padding: '0 1rem 1rem' }}>{children}</div>}
    </div>
  )
}
