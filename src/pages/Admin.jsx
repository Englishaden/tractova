import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getStatePrograms, getNewsFeed, getAllCountyData, getAllRevenueRates, getAllIXQueueData,
  updateStateProgram, updateCountyIntelligence, upsertCountyIntelligence,
  updateRevenueRates, upsertNewsItem, deleteNewsItem, updateIXQueueRow,
  computeFeasibilityScore, invalidateCache,
} from '../lib/programData'

const ADMIN_EMAIL = 'aden.walker67@gmail.com'
const TABS = ['State Programs', 'Counties', 'Revenue Rates', 'News Feed', 'IX Queue']

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

function Cell({ value, field, editing, onChange, type = 'text', options }) {
  if (!editing) {
    const display = value === null || value === undefined ? '—' : String(value)
    return <span className="text-sm text-gray-700 truncate">{display}</span>
  }
  if (options) {
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(field, e.target.value)}
        className="text-sm border border-gray-300 rounded px-2 py-1 w-full bg-white"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(field, e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    )
  }
  if (type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(field, e.target.value)}
        rows={2}
        className="text-sm border border-gray-300 rounded px-2 py-1 w-full resize-y"
      />
    )
  }
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
    />
  )
}

function SaveBar({ dirty, saving, onSave, onCancel, error }) {
  if (!dirty && !error) return null
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-3 z-20">
      {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
      {dirty && (
        <>
          <button onClick={onSave} disabled={saving} className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button onClick={onCancel} disabled={saving} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
        </>
      )}
    </div>
  )
}

function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}>{children}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// State Programs Tab
// ─────────────────────────────────────────────────────────────────────────────

function StateProgramsTab() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache()
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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              {['State', 'Status', 'Program', 'Cap (MW)', 'LMI %', 'IX Diff', 'Enroll/mo', 'Score', ''].map(h => (
                <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.filter(p => p.csStatus !== 'none').map(p => {
              const isEditing = editId === p.id
              return (
                <tr key={p.id} className={`border-b border-gray-100 ${isEditing ? 'bg-primary-50/30' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-medium text-gray-900">{p.id}</span>
                    <span className="text-xs text-gray-400 ml-1.5">{p.name}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <Cell value={editData.cs_status} field="cs_status" editing onChange={handleChange} options={['active', 'limited', 'pending', 'none']} />
                    ) : (
                      <Badge color={statusColor[p.csStatus]}>{p.csStatus}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-w-[140px]">
                    <Cell value={isEditing ? editData.cs_program : p.csProgram} field="cs_program" editing={isEditing} onChange={handleChange} />
                  </td>
                  <td className="px-3 py-2.5 w-20">
                    <Cell value={isEditing ? editData.capacity_mw : p.capacityMW} field="capacity_mw" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-3 py-2.5 w-16">
                    <Cell value={isEditing ? editData.lmi_percent : p.lmiPercent} field="lmi_percent" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <Cell value={editData.ix_difficulty} field="ix_difficulty" editing onChange={handleChange} options={['easy', 'moderate', 'hard', 'very_hard']} />
                    ) : (
                      <span className="text-sm text-gray-700">{p.ixDifficulty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 w-20">
                    <Cell value={isEditing ? editData.enrollment_rate_mw_per_month : p.enrollmentRateMWPerMonth} field="enrollment_rate_mw_per_month" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-3 py-2.5 w-16">
                    <span className={`text-sm font-bold tabular-nums ${(isEditing ? previewScore : p.feasibilityScore) >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isEditing ? previewScore : p.feasibilityScore}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving} className="text-xs font-medium text-primary hover:text-primary-700 disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-xs text-gray-400 hover:text-primary transition-colors">Edit</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-500 px-3 py-2">{error}</p>}

      {editId && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes (editing {editId})</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">IX Notes</label>
            <Cell value={editData.ix_notes} field="ix_notes" editing onChange={handleChange} type="textarea" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Program Notes</label>
            <Cell value={editData.program_notes} field="program_notes" editing onChange={handleChange} type="textarea" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Counties Tab
// ─────────────────────────────────────────────────────────────────────────────

function CountiesTab() {
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
      const { id, ...fields } = editData
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                {['County', 'Utility', 'Queue Status', 'Ease', 'Land', 'Wetland', ''].map(h => (
                  <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counties.map(c => {
                const isEditing = editId === c.id
                return (
                  <tr key={c.id} className={`border-b border-gray-100 ${isEditing ? 'bg-primary-50/30' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{c.county_slug}</td>
                    <td className="px-3 py-2.5">
                      <Cell value={isEditing ? editData.serving_utility : c.serving_utility} field="serving_utility" editing={isEditing} onChange={handleChange} />
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <Cell value={editData.queue_status_code} field="queue_status_code" editing onChange={handleChange} options={['open', 'limited', 'saturated']} />
                      ) : (
                        <span className="text-sm text-gray-700">{c.queue_status_code || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 w-16">
                      <Cell value={isEditing ? editData.ease_score : c.ease_score} field="ease_score" editing={isEditing} onChange={handleChange} type="number" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={isEditing ? editData.available_land : c.available_land} field="available_land" editing={isEditing} onChange={handleChange} type="boolean" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={isEditing ? editData.wetland_warning : c.wetland_warning} field="wetland_warning" editing={isEditing} onChange={handleChange} type="boolean" />
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button onClick={handleSave} disabled={saving} className="text-xs font-medium text-primary hover:text-primary-700 disabled:opacity-50">
                            {saving ? '...' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(c)} className="text-xs text-gray-400 hover:text-primary transition-colors">Edit</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Queue Status</label>
            <Cell value={editData.queue_status} field="queue_status" editing onChange={handleChange} type="textarea" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Avg Study Timeline</label>
            <Cell value={editData.avg_study_timeline} field="avg_study_timeline" editing onChange={handleChange} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Queue Notes</label>
            <Cell value={editData.queue_notes} field="queue_notes" editing onChange={handleChange} type="textarea" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Land Notes</label>
            <Cell value={editData.land_notes} field="land_notes" editing onChange={handleChange} type="textarea" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Wetland Notes</label>
            <Cell value={editData.wetland_notes} field="wetland_notes" editing onChange={handleChange} type="textarea" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Land Use Notes</label>
            <Cell value={editData.land_use_notes} field="land_use_notes" editing onChange={handleChange} type="textarea" />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 px-3 py-2">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Rates Tab
// ─────────────────────────────────────────────────────────────────────────────

function RevenueRatesTab() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('revenue_rates_all')
      const data = await getAllRevenueRates()
      setRates(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (r) => {
    setEditId(r.state_id)
    setEditData({ ...r })
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { state_id, updated_at, ...fields } = editData
      await updateRevenueRates(state_id, fields)
      setEditId(null)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading revenue rates...</p>

  const NUM_FIELDS = [
    { key: 'bill_credit_cents_kwh', label: 'Bill Credit (¢/kWh)', group: 'cs' },
    { key: 'rec_per_mwh', label: 'REC ($/MWh)', group: 'cs' },
    { key: 'itc_pct', label: 'ITC %', group: 'cs' },
    { key: 'itc_adder_pct', label: 'ITC Adder %', group: 'cs' },
    { key: 'capacity_factor_pct', label: 'Cap Factor %', group: 'cs' },
    { key: 'installed_cost_per_watt', label: 'Install $/W', group: 'cs' },
    { key: 'ci_ppa_rate_cents_kwh', label: 'PPA Rate (¢/kWh)', group: 'ci' },
    { key: 'ci_retail_rate_cents_kwh', label: 'Retail Rate (¢/kWh)', group: 'ci' },
    { key: 'ci_escalator_pct', label: 'Escalator %', group: 'ci' },
    { key: 'ci_installed_cost_per_watt', label: 'Install $/W', group: 'ci' },
    { key: 'bess_capacity_per_kw_year', label: 'Cap $/kW-yr', group: 'bess' },
    { key: 'bess_demand_charge_per_kw_month', label: 'Demand $/kW-mo', group: 'bess' },
    { key: 'bess_arbitrage_per_mwh', label: 'Arb $/MWh', group: 'bess' },
    { key: 'bess_installed_cost_per_kwh', label: 'Install $/kWh', group: 'bess' },
  ]

  return (
    <div>
      {editId ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">← Back to list</button>
            <span className="text-sm font-medium text-gray-900">Editing: {editId} — {editData.label}</span>
          </div>

          {['cs', 'ci', 'bess'].map(group => (
            <div key={group} className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {group === 'cs' ? 'Community Solar' : group === 'ci' ? 'C&I Solar' : 'BESS'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {NUM_FIELDS.filter(f => f.group === group).map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                    <Cell value={editData[f.key]} field={f.key} editing onChange={handleChange} type="number" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <Cell value={editData.notes} field="notes" editing onChange={handleChange} type="textarea" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditId(null)} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                {['State', 'Bill Credit', 'REC', 'ITC', 'Cap Factor', 'C&I PPA', 'BESS Cap', 'Updated', ''].map(h => (
                  <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.state_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{r.state_id}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">{r.bill_credit_cents_kwh}¢</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">${r.rec_per_mwh}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">{r.itc_pct}%+{r.itc_adder_pct}%</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">{r.capacity_factor_pct}%</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">{r.ci_ppa_rate_cents_kwh ?? '—'}¢</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">${r.bess_capacity_per_kw_year ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => startEdit(r)} className="text-xs text-gray-400 hover:text-primary transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// News Feed Tab
// ─────────────────────────────────────────────────────────────────────────────

function NewsFeedTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('news_feed')
      const data = await getNewsFeed()
      setItems(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blankItem = { headline: '', source: '', url: '', date: new Date().toISOString().split('T')[0], pillar: 'offtake', type: 'market-update', summary: '', tags: [], stateIds: [] }

  const startAdd = () => {
    setAdding(true)
    setEditData({ ...blankItem })
    setEditId(null)
    setError(null)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditData({ ...item })
    setAdding(false)
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (adding) {
        await upsertNewsItem({
          headline: editData.headline,
          source: editData.source,
          url: editData.url,
          published_at: editData.date,
          pillar: editData.pillar,
          type: editData.type,
          summary: editData.summary,
          tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()) : editData.tags,
          state_ids: typeof editData.stateIds === 'string' ? editData.stateIds.split(',').map(t => t.trim()) : editData.stateIds,
          is_active: true,
        })
      } else {
        await upsertNewsItem({
          id: editId,
          headline: editData.headline,
          source: editData.source,
          url: editData.url,
          published_at: editData.date,
          pillar: editData.pillar,
          type: editData.type,
          summary: editData.summary,
          tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()) : editData.tags,
          state_ids: typeof editData.stateIds === 'string' ? editData.stateIds.split(',').map(t => t.trim()) : editData.stateIds,
          is_active: true,
        })
      }
      setEditId(null)
      setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDeactivate = async (id) => {
    try {
      await deleteNewsItem(id)
      await load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading news feed...</p>

  const isFormOpen = editId || adding

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">{items.length} active items</span>
        <button onClick={startAdd} className="text-xs font-medium text-primary hover:text-primary-700 transition-colors">+ Add item</button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{adding ? 'New item' : `Editing: ${editData.headline?.slice(0, 40)}...`}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Headline</label>
              <Cell value={editData.headline} field="headline" editing onChange={handleChange} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Source</label>
              <Cell value={editData.source} field="source" editing onChange={handleChange} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">URL</label>
              <Cell value={editData.url} field="url" editing onChange={handleChange} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <Cell value={editData.date} field="date" editing onChange={handleChange} type="date" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Pillar</label>
              <Cell value={editData.pillar} field="pillar" editing onChange={handleChange} options={['offtake', 'ix', 'site']} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <Cell value={editData.type} field="type" editing onChange={handleChange} options={['policy-alert', 'market-update']} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">State IDs (comma-separated)</label>
              <Cell value={Array.isArray(editData.stateIds) ? editData.stateIds.join(', ') : editData.stateIds} field="stateIds" editing onChange={handleChange} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Summary</label>
              <Cell value={editData.summary} field="summary" editing onChange={handleChange} type="textarea" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : adding ? 'Add' : 'Save'}
            </button>
            <button onClick={() => { setEditId(null); setAdding(false) }} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-medium truncate">{item.headline}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color={item.pillar === 'offtake' ? 'green' : item.pillar === 'ix' ? 'yellow' : 'blue'}>{item.pillar}</Badge>
                <Badge>{item.type}</Badge>
                <span className="text-[10px] text-gray-400">{item.source} — {item.date}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-primary transition-colors">Edit</button>
              <button onClick={() => handleDeactivate(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IX Queue Tab (read-only view of automated data)
// ─────────────────────────────────────────────────────────────────────────────

function IXQueueTab() {
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
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              {['State', 'Utility', 'ISO', 'Projects', 'MW', 'Avg Study', 'Withdraw %', 'Upgrade $/MW', 'Trend', 'Source', ''].map(h => (
                <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isEditing = editId === r.id
              return (
                <tr key={r.id} className={`border-b border-gray-100 ${isEditing ? 'bg-primary-50/30' : 'hover:bg-gray-50'}`}>
                  <td className="px-2 py-2 text-sm font-medium text-gray-900">{r.state_id}</td>
                  <td className="px-2 py-2 text-sm text-gray-700">{r.utility_name}</td>
                  <td className="px-2 py-2 text-xs text-gray-400">{r.iso}</td>
                  <td className="px-2 py-2">
                    <Cell value={isEditing ? editData.projects_in_queue : r.projects_in_queue} field="projects_in_queue" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-2 py-2">
                    <Cell value={isEditing ? editData.mw_pending : r.mw_pending} field="mw_pending" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-2 py-2">
                    <Cell value={isEditing ? editData.avg_study_months : r.avg_study_months} field="avg_study_months" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-2 py-2">
                    <Cell value={isEditing ? editData.withdrawal_pct : r.withdrawal_pct} field="withdrawal_pct" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-2 py-2">
                    <Cell value={isEditing ? editData.avg_upgrade_cost_mw : r.avg_upgrade_cost_mw} field="avg_upgrade_cost_mw" editing={isEditing} onChange={handleChange} type="number" />
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <Cell value={editData.queue_trend} field="queue_trend" editing onChange={handleChange} options={['growing', 'stable', 'shrinking']} />
                    ) : (
                      <span className={`text-sm font-medium ${trendColor[r.queue_trend] || ''}`}>{r.queue_trend}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Badge color={r.data_source === 'scraper' ? 'green' : 'gray'}>{r.data_source}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving} className="text-xs font-medium text-primary hover:text-primary-700 disabled:opacity-50">
                          {saving ? '...' : 'Save'}
                        </button>
                        <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(r)} className="text-xs text-gray-400 hover:text-primary transition-colors">Edit</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-500 px-2 py-2">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Page Shell
// ─────────────────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState(0)

  if (authLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-gray-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Data Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Edit live market intelligence data. Changes propagate within 1 hour (cache TTL).</p>

          <div className="flex gap-1 mt-6 border-b border-gray-200">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === 0 && <StateProgramsTab />}
            {tab === 1 && <CountiesTab />}
            {tab === 2 && <RevenueRatesTab />}
            {tab === 3 && <NewsFeedTab />}
            {tab === 4 && <IXQueueTab />}
          </div>
        </div>
      </main>
    </div>
  )
}
