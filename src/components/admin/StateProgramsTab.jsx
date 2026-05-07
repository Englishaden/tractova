import { useState, useEffect, useCallback } from 'react'
import {
  getStatePrograms,
  updateStateProgram,
  computeFeasibilityScore,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

export default function StateProgramsTab() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('state_programs')
      const data = await getStatePrograms()
      setPrograms(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (p) => {
    setEditId(p.id)
    setEditData({
      cs_status: p.csStatus,
      cs_program: p.csProgram,
      capacity_mw: p.capacityMW,
      lmi_required: p.lmiRequired,
      lmi_percent: p.lmiPercent,
      ix_difficulty: p.ixDifficulty,
      ix_notes: p.ixNotes,
      program_notes: p.programNotes,
      enrollment_rate_mw_per_month: p.enrollmentRateMWPerMonth,
      coverage_tier: p.coverageTier || 'light',
    })
    setError(null)
  }

  const handleChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateStateProgram(editId, editData)
      setEditId(null)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const previewScore = editId ? computeFeasibilityScore({
    cs_status: editData.cs_status,
    capacity_mw: editData.capacity_mw,
    lmi_percent: editData.lmi_percent,
    ix_difficulty: editData.ix_difficulty,
  }) : null

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading state programs...</p>

  const statusColor = { active: 'green', limited: 'yellow', pending: 'blue', none: 'gray' }

  // Detail view when editing
  if (editId) {
    const p = programs.find(x => x.id === editId)
    return (
      <div>
        <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back to list</button>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{p?.name || editId}</h3>
              <span className="text-xs text-gray-400">State ID: {editId}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Live Score</p>
              <span className={`text-2xl font-bold tabular-nums ${previewScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {previewScore}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <Field label="CS Status" value={editData.cs_status} field="cs_status" onChange={handleChange} options={['active', 'limited', 'pending', 'none']} />
            <Field label="Coverage Tier" value={editData.coverage_tier || 'light'} field="coverage_tier" onChange={handleChange} options={['full', 'mid', 'light']} />
            <Field label="Program Name" value={editData.cs_program} field="cs_program" onChange={handleChange} />
            <Field label="Capacity (MW)" value={editData.capacity_mw} field="capacity_mw" onChange={handleChange} type="number" />
            <Field label="LMI %" value={editData.lmi_percent} field="lmi_percent" onChange={handleChange} type="number" />
            <Field label="IX Difficulty" value={editData.ix_difficulty} field="ix_difficulty" onChange={handleChange} options={['easy', 'moderate', 'hard', 'very_hard']} />
            <Field label="Enrollment Rate (MW/mo)" value={editData.enrollment_rate_mw_per_month} field="enrollment_rate_mw_per_month" onChange={handleChange} type="number" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="IX Notes" value={editData.ix_notes} field="ix_notes" onChange={handleChange} type="textarea" />
            <Field label="Program Notes" value={editData.program_notes} field="program_notes" onChange={handleChange} type="textarea" />
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
    )
  }

  // List view
  // Show states that have any CS activity OR are explicitly Tier 1/2 coverage
  // (so admin can manage BESS/C&I-relevant Tier 2 states even when csStatus='none').
  const visiblePrograms = programs.filter(p =>
    p.csStatus !== 'none' || ['full', 'mid'].includes(p.coverageTier)
  )

  const tierBadgeColor = { full: 'green', mid: 'yellow', light: 'gray' }

  return (
    <div>
      <div className="space-y-1.5">
        {visiblePrograms.map(p => (
          <button
            key={p.id}
            onClick={() => startEdit(p)}
            className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-teal-500/40 hover:bg-teal-50/30 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-gray-900 w-7">{p.id}</span>
                <span className="text-sm text-gray-600 truncate">{p.name}</span>
                <Badge color={statusColor[p.csStatus]}>{p.csStatus}</Badge>
                <Badge color={tierBadgeColor[p.coverageTier] || 'gray'}>{p.coverageTier || 'light'}</Badge>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-gray-400">{p.capacityMW} MW</span>
                  <span className="text-xs text-gray-300 mx-1.5">|</span>
                  <span className="text-xs text-gray-400">{p.ixDifficulty}</span>
                </div>
                <span className={`text-sm font-bold tabular-nums w-8 text-right ${p.feasibilityScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {p.feasibilityScore}
                </span>
                <span className="text-xs text-gray-300 group-hover:text-teal-700 transition-colors">Edit →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
    </div>
  )
}
