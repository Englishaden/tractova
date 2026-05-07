import { useState, useEffect, useCallback } from 'react'
import {
  getStatePrograms,
  getAllCountyData,
  updateCountyIntelligence,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

export default function CountiesTab() {
  const [stateId, setStateId] = useState('IL')
  const [counties, setCounties] = useState([])
  const [states, setStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStatePrograms().then(all => setStates(all.filter(s => s.csStatus !== 'none')))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache(`county_all:${stateId}`)
      const data = await getAllCountyData(stateId)
      setCounties(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [stateId])

  useEffect(() => { load() }, [load])

  const startEdit = (c) => {
    setEditId(c.id)
    setEditData({ ...c })
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { id, state_id, county_slug, created_at, updated_at, last_verified, ...fields } = editData
      await updateCountyIntelligence(id, fields)
      setEditId(null)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={stateId} onChange={e => { setStateId(e.target.value); setEditId(null) }} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
          {states.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
        </select>
        <span className="text-xs text-gray-400">{counties.length} counties</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading counties...</p>
      ) : counties.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No county data for {stateId}</p>
      ) : editId ? (
        <div>
          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back to list</button>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">{editData.county_slug} <span className="text-sm font-normal text-gray-400">({stateId})</span></h3>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Interconnection</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <Field label="Serving Utility" value={editData.serving_utility} field="serving_utility" onChange={handleChange} />
              <Field label="Queue Status Code" value={editData.queue_status_code} field="queue_status_code" onChange={handleChange} options={['open', 'limited', 'saturated']} />
              <Field label="Ease Score (1-10)" value={editData.ease_score} field="ease_score" onChange={handleChange} type="number" />
              <Field label="Avg Study Timeline" value={editData.avg_study_timeline} field="avg_study_timeline" onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Field label="Queue Status" value={editData.queue_status} field="queue_status" onChange={handleChange} type="textarea" />
              <Field label="Queue Notes" value={editData.queue_notes} field="queue_notes" onChange={handleChange} type="textarea" />
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Site Control</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <Field label="Available Land" value={editData.available_land} field="available_land" onChange={handleChange} type="boolean" />
              <Field label="Wetland Warning" value={editData.wetland_warning} field="wetland_warning" onChange={handleChange} type="boolean" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <Field label="Land Notes" value={editData.land_notes} field="land_notes" onChange={handleChange} type="textarea" />
              <Field label="Wetland Notes" value={editData.wetland_notes} field="wetland_notes" onChange={handleChange} type="textarea" />
              <Field label="Land Use Notes" value={editData.land_use_notes} field="land_use_notes" onChange={handleChange} type="textarea" />
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
          {counties.map(c => (
            <button
              key={c.id}
              onClick={() => startEdit(c)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:border-teal-500/40 hover:bg-teal-50/30 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{c.county_slug}</span>
                  <span className="text-xs text-gray-400">{c.serving_utility || '—'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge color={c.queue_status_code === 'open' ? 'green' : c.queue_status_code === 'limited' ? 'yellow' : c.queue_status_code === 'saturated' ? 'red' : 'gray'}>
                    {c.queue_status_code || '—'}
                  </Badge>
                  <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{c.ease_score ?? '—'}</span>
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
