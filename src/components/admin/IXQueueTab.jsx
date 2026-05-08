import { useState, useEffect, useCallback } from 'react'
import {
  getAllIXQueueData,
  updateIXQueueRow,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field } from '../../pages/Admin.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// IX Queue Tab (read-only view of automated data)
// ─────────────────────────────────────────────────────────────────────────────

export default function IXQueueTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('ix_queue_all')
      const data = await getAllIXQueueData()
      setRows(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (r) => {
    setEditId(r.id)
    setEditData({ ...r })
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { id, state_id, iso, utility_name, fetched_at, updated_at, ...fields } = editData
      await updateIXQueueRow(id, fields)
      setEditId(null)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading IX queue data...</p>

  const trendColor = { growing: 'text-red-500', stable: 'text-amber-500', shrinking: 'text-emerald-500' }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">Auto-refreshed weekly by cron. Manual edits persist until next scraper run.</p>

      {editId ? (
        <div>
          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back to list</button>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editData.utility_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{editData.state_id}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{editData.iso}</span>
                </div>
              </div>
              <span className={`text-sm font-medium ${trendColor[editData.queue_trend] || 'text-gray-500'}`}>{editData.queue_trend}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
              <Field label="Projects in Queue" value={editData.projects_in_queue} field="projects_in_queue" onChange={handleChange} type="number" />
              <Field label="MW Pending" value={editData.mw_pending} field="mw_pending" onChange={handleChange} type="number" />
              <Field label="Avg Study (months)" value={editData.avg_study_months} field="avg_study_months" onChange={handleChange} type="number" />
              <Field label="Withdrawal %" value={editData.withdrawal_pct} field="withdrawal_pct" onChange={handleChange} type="number" />
              <Field label="Upgrade $/MW" value={editData.avg_upgrade_cost_mw} field="avg_upgrade_cost_mw" onChange={handleChange} type="number" />
              <Field label="Trend" value={editData.queue_trend} field="queue_trend" onChange={handleChange} options={['growing', 'stable', 'shrinking']} />
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="accent" onClick={handleSave} loading={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="link" onClick={() => setEditId(null)} disabled={saving}>Cancel</Button>
            </div>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(r => (
            <button
              key={r.id}
              onClick={() => startEdit(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-teal-500/40 hover:bg-teal-50/30 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-900 w-7">{r.state_id}</span>
                  <span className="text-sm text-gray-600 truncate">{r.utility_name}</span>
                  <span className="text-xs text-gray-400">{r.iso}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:flex items-center gap-3">
                    <span className="text-xs text-gray-400 tabular-nums">{r.projects_in_queue} projects</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">{r.mw_pending} MW</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className={`text-xs font-medium ${trendColor[r.queue_trend] || ''}`}>{r.queue_trend}</span>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-teal-700 transition-colors">Edit →</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {!editId && error && <p className="text-xs text-red-500 mt-3">{error}</p>}
    </div>
  )
}
