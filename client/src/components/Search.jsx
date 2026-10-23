import { useState, useRef, useEffect } from 'react'

const API_URL = '/api/data/ai-subfield-100k/search'
const PAGE_SIZE = 20

export default function Search({ onSelect }) {
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const requestId = useRef(0)

  const fetchPage = async (kw, offset) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ keyword: kw, offset, limit: PAGE_SIZE })
      const res = await fetch(`${API_URL}?${params}`)
      const data = await res.json()
      if (id !== requestId.current) return
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults((prev) => (offset === 0 ? data.results : [...prev, ...data.results]))
      setTotal(data.total)
    } catch (err) {
      if (id === requestId.current) setError(err.message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const kw = input.trim()
    if (!kw) return
    setKeyword(kw)
    setSearched(true)
    setResults([])
    setTotal(0)
    fetchPage(kw, 0)
  }

  useEffect(() => () => { requestId.current++ }, [])

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search titles, press Enter"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.4rem 0.5rem',
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          color: 'inherit',
        }}
      />
      {error && <p style={{ color: '#e66', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>}
      {searched && !error && (
        <div style={{ fontSize: '0.75rem', color: '#888', margin: '0.5rem 0 0.25rem' }}>
          {loading && results.length === 0 ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
        </div>
      )}
      {results.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: '260px',
            overflowY: 'auto',
            border: '1px solid #333',
            borderRadius: '4px',
          }}
        >
          {results.map((r) => (
            <li
              key={r.id}
              onClick={() => onSelect(r.id)}
              style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>{r.title}</div>
              <div style={{ fontSize: '0.75rem', color: '#888', wordBreak: 'break-word' }}>
                {r.authors || 'Unknown author'}
              </div>
            </li>
          ))}
          {results.length < total && (
            <li style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
              <button
                onClick={() => fetchPage(keyword, results.length)}
                disabled={loading}
                style={{
                  fontSize: '0.75rem',
                  background: 'none',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#ccc',
                  padding: '0.2rem 0.6rem',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Loading…' : 'Show more results'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
