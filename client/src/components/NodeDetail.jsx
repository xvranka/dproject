const FIELDS = [
  ['publication_year', 'Year'],
  ['language', 'Language'],
  ['cited_by_count', 'Citations'],
  ['domain', 'Domain'],
  ['field_name', 'Field'],
  ['subfield', 'Subfield'],
  ['topics', 'Topics'],
]

export default function NodeDetail({ point }) {
  if (!point) {
    return <p style={{ color: '#888', margin: 0 }}>Select a node to see its details.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: point.color,
            flexShrink: 0,
          }}
        />
        <h2 style={{ fontSize: '1.05rem', margin: 0, wordBreak: 'break-word' }}>{point.title}</h2>
      </div>
      <dl style={{ margin: 0 }}>
        {FIELDS.map(([key, label]) => (
          <div key={key} style={{ marginBottom: '0.5rem' }}>
            <dt style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888' }}>{label}</dt>
            <dd style={{ margin: 0 }}>{point[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
