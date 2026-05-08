import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../pages/Admin.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Staging Tab — Review and promote staged state_programs changes
// ─────────────────────────────────────────────────────────────────────────────

export default function StagingTab() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [acting, setActing] = useState(null) // id being approved/rejected

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not authenticated'); setLoading(false); return }
      const resp = await fetch(`/api/data-health?action=staging&status=${filter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      setRecords(json.records || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAction = async (record, action) => {
    const key = `${record.id}:${record.submitted_at}`
    setActing(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired — please log in again')
      const resp = await fetch('/api/data-health?action=staging', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: record.id, submitted_at: record.submitted_at, action }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading staging records...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Scrapers and bulk imports write here. Review changes before promoting to live data.
        </p>
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                filter === s
                  ? 'text-white' /* navy active state */ + ' bg-brand border-brand'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {records.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">No {filter} staging records.</p>
          {filter === 'pending' && (
            <p className="text-xs text-gray-300 mt-1">Records will appear here when scrapers or bulk imports submit changes.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const key = `${r.id}:${r.submitted_at}`
            const isActing = acting === key
            return (
              <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-bold text-gray-900">{r.id}</span>
                    <span className="text-sm text-gray-400 ml-2">{r.live_name || r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      {r.submitted_by && <span className="mr-1">by {r.submitted_by}</span>}
                      {new Date(r.submitted_at).toLocaleDateString()}
                    </span>
                    <Badge color={r.review_status === 'approved' ? 'green' : r.review_status === 'rejected' ? 'red' : 'yellow'}>
                      {r.review_status}
                    </Badge>
                  </div>
                </div>

                {r.diffs && r.diffs.length > 0 ? (
                  <div className="border border-gray-100 rounded-lg overflow-hidden mb-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="text-left px-3 py-1.5 font-semibold">Field</th>
                          <th className="text-left px-3 py-1.5 font-semibold">Current</th>
                          <th className="text-left px-3 py-1.5 font-semibold">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.diffs.map((d) => (
                          <tr key={d.field} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 font-medium text-gray-700">{d.field}</td>
                            <td className="px-3 py-1.5 text-red-400">{d.old != null ? String(d.old) : '—'}</td>
                            <td className="px-3 py-1.5 text-emerald-600 font-medium">{String(d.new)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">No field differences detected.</p>
                )}

                {r.diff_summary && (
                  <p className="text-xs text-gray-500 mb-3 italic">{r.diff_summary}</p>
                )}

                {filter === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleAction(r, 'approve')}
                      disabled={isActing}
                      className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {isActing ? 'Promoting...' : 'Approve & Promote'}
                    </button>
                    <button
                      onClick={() => handleAction(r, 'reject')}
                      disabled={isActing}
                      className="px-4 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
