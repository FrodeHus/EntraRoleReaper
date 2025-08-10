import { useEffect, useState } from 'react'

export type DirectoryItem = { id: string; displayName: string; type: 'user' | 'group' }

export function SearchUsers({ accessToken, selected, onChange }: { accessToken: string | null, selected: DirectoryItem[], onChange: (v: DirectoryItem[]) => void }) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [includeGroups, setIncludeGroups] = useState(true)
  const [results, setResults] = useState<DirectoryItem[]>([])

  // Debounce the query to avoid excessive API calls while typing
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(handle)
  }, [q])

  useEffect(() => {
    const ctrl = new AbortController()
    let canceled = false
    const run = async () => {
      if (!accessToken || debouncedQ.trim().length < 2) { setResults([]); return }
      const url = new URL('/api/search', import.meta.env.VITE_API_URL)
      url.searchParams.set('q', debouncedQ)
      url.searchParams.set('includeGroups', String(includeGroups))
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal })
      if (!res.ok) return
      const data = await res.json()
      if (!canceled) setResults(data)
    }
    run();
    return () => { canceled = true; ctrl.abort() }
  }, [debouncedQ, includeGroups, accessToken])

  const add = (item: DirectoryItem) => {
    if (selected.some(s => s.id === item.id && s.type === item.type)) return
    onChange([...selected, item])
  }
  const remove = (id: string, type: 'user' | 'group') => onChange(selected.filter(s => !(s.id === id && s.type === type)))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users or groups" className="border px-3 py-2 rounded w-96" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeGroups} onChange={e => setIncludeGroups(e.target.checked)} /> Include groups
        </label>
      </div>
      {results.length > 0 && (
        <div className="border rounded p-2 max-w-xl">
          {results.map(r => (
            <div key={r.id} className="flex justify-between items-center py-1">
              <div>
                <span className="font-medium">{r.displayName}</span>
                <span className="ml-2 text-xs text-gray-500">{r.type}</span>
              </div>
              <button className="text-sm px-2 py-1 border rounded" onClick={() => add(r)}>Add</button>
            </div>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Selected</h3>
          <div className="flex flex-wrap gap-2">
            {selected.map(s => (
              <span key={`${s.type}:${s.id}`} className="px-2 py-1 bg-gray-100 rounded text-sm">
                {s.displayName}
                <button className="ml-2" onClick={() => remove(s.id, s.type)}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
