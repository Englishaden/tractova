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
const TABS = ['State Programs', 'Counties', 'Revenue Rates', 'News Feed', 'IX Queue', 'Data Health']

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, value, field, onChange, type = 'text', options, className = '' }) {
  const inputBase = 'text-sm border border-gray-300 rounded-md px-2.5 py-1.5 bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors'
  return (
    <div className={className}>
      <label className="text-[11px] font-medium text-gray-500 block mb-1">{label}</label>
      {options ? (
        <select value={value ?? ''} onChange={e => onChange(field, e.target.value)} className={`${inputBase} w-full`}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'boolean' ? (
        <input type="checkbox" checked={!!value} onChange={e => onChange(field, e.target.checked)} className="h-4 w-4 accent-primary mt-1" />
      ) : type === 'textarea' ? (
        <textarea value={value ?? ''} onChange={e => onChange(field, e.target.value)} rows={2} className={`${inputBase} w-full resize-y`} />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
          className={`${inputBase} ${type === 'number' ? 'w-24 tabular-nums' : 'w-full'}`}
        />
      )}
    </div>
  )
}

function ReadOnlyCell({ value, className = '' }) {
  const display = value === null || value === undefined ? '—' : String(value)
  return <span className={`text-sm text-gray-700 tabular-nums ${className}`}>{display}</span>
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
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button onClick={() => setEditId(null)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div>
      <div className="space-y-1.5">
        {programs.filter(p => p.csStatus !== 'none').map(p => (
          <button
            key={p.id}
            onClick={() => startEdit(p)}
            className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-gray-900 w-7">{p.id}</span>
                <span className="text-sm text-gray-600 truncate">{p.name}</span>
                <Badge color={statusColor[p.csStatus]}>{p.csStatus}</Badge>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-gray-400">{p.capacityMW} MW</span>
                  <span className="text-xs text-gray-300 mx-1.5">|</span>
                  <span className="text-xs text-gray-400">{p.ixDifficulty}</span>
                </div>
                <span className={`text-sm font-bold tabular-nums w-8 text-right ${p.feasibilityScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {p.feasibilityScore}
                </span>
                <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Edit →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
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
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditId(null)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
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
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{c.county_slug}</span>
                  <span className="text-xs text-gray-400">{c.serving_utility || '—'}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge color={c.queue_status_code === 'open' ? 'green' : c.queue_status_code === 'limited' ? 'yellow' : c.queue_status_code === 'saturated' ? 'red' : 'gray'}>
                    {c.queue_status_code || '—'}
                  </Badge>
                  <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{c.ease_score ?? '—'}</span>
                  <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Edit →</span>
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
          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back to list</button>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{editData.label || editId}</h3>
            <span className="text-xs text-gray-400">State ID: {editId}</span>

            {['cs', 'ci', 'bess'].map(group => (
              <div key={group} className="mt-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {group === 'cs' ? 'Community Solar' : group === 'ci' ? 'C&I Solar' : 'BESS'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {NUM_FIELDS.filter(f => f.group === group).map(f => (
                    <Field key={f.key} label={f.label} value={editData[f.key]} field={f.key} onChange={handleChange} type="number" />
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-5">
              <Field label="Notes" value={editData.notes} field="notes" onChange={handleChange} type="textarea" />
            </div>

            <div className="flex gap-3 pt-4 mt-5 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditId(null)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            </div>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rates.map(r => (
            <button
              key={r.state_id}
              onClick={() => startEdit(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-900 w-7">{r.state_id}</span>
                  <span className="text-sm text-gray-600 truncate">{r.label || '—'}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:flex items-center gap-3">
                    <span className="text-xs text-gray-400 tabular-nums">{r.bill_credit_cents_kwh}¢</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">${r.rec_per_mwh} REC</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">{r.itc_pct}%+{r.itc_adder_pct}%</span>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Edit →</span>
                </div>
              </div>
            </button>
          ))}
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">{adding ? 'New item' : `Editing: ${editData.headline?.slice(0, 40)}...`}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Headline" value={editData.headline} field="headline" onChange={handleChange} className="md:col-span-2" />
            <Field label="Source" value={editData.source} field="source" onChange={handleChange} />
            <Field label="URL" value={editData.url} field="url" onChange={handleChange} />
            <Field label="Date" value={editData.date} field="date" onChange={handleChange} type="date" />
            <Field label="Pillar" value={editData.pillar} field="pillar" onChange={handleChange} options={['offtake', 'ix', 'site']} />
            <Field label="Type" value={editData.type} field="type" onChange={handleChange} options={['policy-alert', 'market-update']} />
            <Field label="State IDs (comma-separated)" value={Array.isArray(editData.stateIds) ? editData.stateIds.join(', ') : editData.stateIds} field="stateIds" onChange={handleChange} />
            <Field label="Summary" value={editData.summary} field="summary" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : adding ? 'Add item' : 'Save changes'}
            </button>
            <button onClick={() => { setEditId(null); setAdding(false) }} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
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
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditId(null)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
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
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-900 w-7">{r.state_id}</span>
                  <span className="text-sm text-gray-600 truncate">{r.utility_name}</span>
                  <span className="text-xs text-gray-400">{r.iso}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:flex items-center gap-3">
                    <span className="text-xs text-gray-400 tabular-nums">{r.projects_in_queue} projects</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">{r.mw_pending} MW</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className={`text-xs font-medium ${trendColor[r.queue_trend] || ''}`}>{r.queue_trend}</span>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Edit →</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Data Health Tab
// ─────────────────────────────────────────────────────────────────────────────

const FRESHNESS_CONFIG = {
  state_programs:      { label: 'State Programs',      icon: '🗺', field: 'newest_verified', staleField: 'stale_count', thresholds: [90, 180] },
  ix_queue_data:       { label: 'IX Queue Data',       icon: '⚡', field: 'newest_fetch',    staleField: 'stale_count', thresholds: [14, 30] },
  substations:         { label: 'Substations',         icon: '🔌', field: 'last_updated',    staleField: null,          thresholds: [60, 180] },
  county_intelligence: { label: 'County Intelligence', icon: '📍', field: 'oldest_verified', staleField: 'stale_count', thresholds: [90, 180] },
  revenue_rates:       { label: 'Revenue Rates',       icon: '💰', field: 'last_updated',    staleField: null,          thresholds: [90, 180] },
  news_feed:           { label: 'News Feed',           icon: '📰', field: 'latest_item',     staleField: null,          thresholds: [14, 30] },
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function freshnessColor(days, thresholds) {
  if (days == null) return 'gray'
  if (days <= thresholds[0]) return 'green'
  if (days <= thresholds[1]) return 'yellow'
  return 'red'
}

function DataHealthTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('Not authenticated'); setLoading(false); return }
        const resp = await fetch('/api/data-health', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        setData(await resp.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading data health...</div>
  if (error) return <div className="py-8 text-sm text-red-500">Failed to load: {error}</div>
  if (!data) return null

  const { freshness, cronRuns, dataUpdates } = data

  return (
    <div className="space-y-8">

      {/* ── Section 1: Freshness Grid ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Data Freshness</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(FRESHNESS_CONFIG).map(([key, cfg]) => {
            const tableData = freshness?.[key]
            if (!tableData) return null
            const dateVal = tableData[cfg.field]
            const days = daysSince(dateVal)
            const color = freshnessColor(days, cfg.thresholds)
            const rowCount = tableData.row_count ?? tableData.active_count ?? '—'
            const staleCount = cfg.staleField ? (tableData[cfg.staleField] ?? 0) : null
            const colorMap = { green: 'border-emerald-200 bg-emerald-50/40', yellow: 'border-amber-200 bg-amber-50/40', red: 'border-red-200 bg-red-50/40', gray: 'border-gray-200 bg-gray-50' }
            const dotMap = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-red-500', gray: 'bg-gray-300' }

            return (
              <div key={key} className={`rounded-lg border px-4 py-3 ${colorMap[color]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">{cfg.label}</span>
                  <span className={`w-2 h-2 rounded-full ${dotMap[color]}`} />
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{rowCount} <span className="text-xs font-normal text-gray-400">rows</span></p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {days != null ? (
                    <>Last updated <span className="font-medium">{days}d ago</span></>
                  ) : (
                    <span className="text-gray-400">No data</span>
                  )}
                </p>
                {staleCount > 0 && (
                  <p className="text-[10px] font-medium text-amber-600 mt-0.5">{staleCount} stale row{staleCount > 1 ? 's' : ''}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 2: Cron Run History ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Cron Run History</h3>
        {cronRuns.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No cron runs recorded yet. Runs will appear after the next scheduled cron execution.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Cron</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Finished</th>
                  <th className="text-right px-3 py-2 font-semibold">Duration</th>
                  <th className="text-right px-3 py-2 font-semibold">Changes</th>
                  <th className="text-left px-3 py-2 font-semibold">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {cronRuns.map((run) => {
                  const statusColor = run.status === 'success' ? 'green' : run.status === 'partial' ? 'yellow' : 'red'
                  const summary = run.summary || {}
                  const changes = summary.updated ?? summary.changes ?? 0
                  const warnings = summary.warnings || []
                  const finishedAgo = daysSince(run.finished_at)
                  return (
                    <tr key={run.id} className={`border-b border-gray-100 last:border-0 ${run.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-700">{run.cron_name}</td>
                      <td className="px-3 py-2"><Badge color={statusColor}>{run.status}</Badge></td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">
                        {run.finished_at ? (
                          <>{finishedAgo === 0 ? 'Today' : `${finishedAgo}d ago`} <span className="text-gray-300">·</span> {new Date(run.finished_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{changes}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{warnings.length > 0 ? warnings.join('; ') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Recent Changes ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Recent Data Changes</h3>
        {dataUpdates.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No changes recorded yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Table</th>
                  <th className="text-left px-3 py-2 font-semibold">Row</th>
                  <th className="text-left px-3 py-2 font-semibold">Field</th>
                  <th className="text-left px-3 py-2 font-semibold">Old → New</th>
                  <th className="text-left px-3 py-2 font-semibold">By</th>
                  <th className="text-left px-3 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {dataUpdates.map((u) => {
                  const ago = daysSince(u.updated_at)
                  return (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-gray-700">{u.table_name}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={u.row_id}>{u.row_id}</td>
                      <td className="px-3 py-2 text-gray-500">{u.field}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {u.old_value && <span className="text-red-400 line-through mr-1">{u.old_value}</span>}
                        <span className="text-emerald-600">{u.new_value}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          u.updated_by?.includes('scraper') || u.updated_by?.includes('refresh')
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>{u.updated_by || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{ago != null ? `${ago}d ago` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Last Cron Runs Summary from RPC ── */}
      {freshness?.last_cron_runs && freshness.last_cron_runs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Last Run per Cron</h3>
          <div className="flex gap-3">
            {freshness.last_cron_runs.map((r) => {
              const ago = daysSince(r.finished_at)
              const statusColor = r.status === 'success' ? 'green' : r.status === 'partial' ? 'yellow' : 'red'
              return (
                <div key={r.cron_name} className="flex-1 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-gray-700">{r.cron_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color={statusColor}>{r.status}</Badge>
                    <span className="text-[11px] text-gray-400">{ago != null ? `${ago}d ago` : '—'}</span>
                  </div>
                  {r.changes && <p className="text-[11px] text-gray-500 mt-1">{r.changes} changes</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
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
            {tab === 5 && <DataHealthTab />}
          </div>
        </div>
      </main>
    </div>
  )
}
