import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getStatePrograms, getNewsFeed, getAllCountyData, getAllRevenueRates, getAllIXQueueData,
  updateStateProgram, updateCountyIntelligence, upsertCountyIntelligence,
  updateRevenueRates, upsertNewsItem, deleteNewsItem, updateIXQueueRow,
  getPucDockets, upsertPucDocket, deletePucDocket,
  getComparableDeals, upsertComparableDeal, deleteComparableDeal,
  computeFeasibilityScore, invalidateCache, invalidateCacheEverywhere,
} from '../lib/programData'
import { Input, Select, Button } from '../components/ui'
import TractovaLoader from '../components/ui/TractovaLoader'
import { analyzeCronLatency } from '../lib/cronLatencyMonitor'

const ADMIN_EMAIL = 'aden.walker67@gmail.com'
// Each tab carries its own accent color so the 10-tab strip is scannable at a
// glance. Dot is always visible (even when the tab is inactive) so users can
// learn position-by-color over time. Active state lifts the dot's hue into
// the label and border for emphasis.
const TABS = [
  { label: 'State Programs',     color: 'sky'     }, // regulatory / state
  { label: 'Counties',           color: 'emerald' }, // geographic
  { label: 'Revenue Rates',      color: 'amber'   }, // money
  { label: 'News Feed',          color: 'indigo'  }, // info stream
  { label: 'IX Queue',           color: 'cyan'    }, // infrastructure
  { label: 'PUC Dockets',        color: 'violet'  }, // regulatory dockets
  { label: 'Comparable Deals',   color: 'rose'    }, // market intel
  { label: 'Staging',            color: 'orange'  }, // work / pending
  { label: 'Data Health',        color: 'teal'    }, // system / brand
  { label: 'Test Notifications', color: 'red'     }, // alerts
]

// Tailwind's JIT can't see classes built from interpolation, so map color
// keys to the static class strings we actually want generated.
const TAB_COLOR_CLASSES = {
  sky:     { dot: 'bg-sky-500',     activeBorder: 'border-sky-500',     activeText: 'text-sky-700' },
  emerald: { dot: 'bg-emerald-500', activeBorder: 'border-emerald-500', activeText: 'text-emerald-700' },
  amber:   { dot: 'bg-amber-500',   activeBorder: 'border-amber-500',   activeText: 'text-amber-700' },
  indigo:  { dot: 'bg-indigo-500',  activeBorder: 'border-indigo-500',  activeText: 'text-indigo-700' },
  cyan:    { dot: 'bg-cyan-500',    activeBorder: 'border-cyan-500',    activeText: 'text-cyan-700' },
  violet:  { dot: 'bg-violet-500',  activeBorder: 'border-violet-500',  activeText: 'text-violet-700' },
  rose:    { dot: 'bg-rose-500',    activeBorder: 'border-rose-500',    activeText: 'text-rose-700' },
  orange:  { dot: 'bg-orange-500',  activeBorder: 'border-orange-500',  activeText: 'text-orange-700' },
  teal:    { dot: 'bg-teal-500',    activeBorder: 'border-teal-500',    activeText: 'text-teal-700' },
  red:     { dot: 'bg-red-500',     activeBorder: 'border-red-500',     activeText: 'text-red-700' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

// Admin Field — preserves the existing external API
// (label, value, field, onChange, type, options, className) so the 30+
// call sites elsewhere in this file need no changes. Internally delegates
// to V3 Input/Select primitives where applicable; falls back to native
// textarea + checkbox (those primitives don't exist yet).
function Field({ label, value, field, onChange, type = 'text', options, className = '' }) {
  if (options) {
    return (
      <Select
        label={label}
        value={value ?? ''}
        onChange={(next) => onChange(field, next)}
        options={options}
        className={className}
      />
    )
  }
  if (type === 'boolean') {
    return (
      <div className={className}>
        <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
          {label}
        </label>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field, e.target.checked)}
          className="h-4 w-4 accent-primary mt-1"
        />
      </div>
    )
  }
  if (type === 'textarea') {
    return (
      <div className={className}>
        <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
          {label}
        </label>
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          rows={2}
          className="w-full text-sm rounded-lg px-3 py-2 bg-white border border-gray-200 text-ink resize-y focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-colors"
        />
      </div>
    )
  }
  // text / number / url etc.
  const isNumeric = type === 'number'
  return (
    <Input
      label={label}
      type={type}
      value={value ?? ''}
      onChange={(next) => onChange(field, isNumeric ? (next === '' ? null : Number(next)) : next)}
      className={className}
    />
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
          <Button variant="accent" size="sm" onClick={onSave} loading={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button variant="link" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
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
          {rates.map(r => (
            <button
              key={r.state_id}
              onClick={() => startEdit(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-teal-500/40 hover:bg-teal-50/30 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-900 w-7">{r.state_id}</span>
                  <span className="text-sm text-gray-600 truncate">{r.label || '—'}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:flex items-center gap-3">
                    <span className="text-xs text-gray-400 tabular-nums">{r.bill_credit_cents_kwh}¢</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">${r.rec_per_mwh} REC</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">{r.itc_pct}%+{r.itc_adder_pct}%</span>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-teal-700 transition-colors">Edit →</span>
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
    if (!window.confirm('Remove this news item? This will deactivate it from the feed.')) return
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
        <button onClick={startAdd} className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors">+ Add item</button>
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
            <Button variant="accent" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : adding ? 'Add item' : 'Save changes'}
            </Button>
            <Button variant="link" onClick={() => { setEditId(null); setAdding(false) }} disabled={saving}>Cancel</Button>
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
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-teal-700 transition-colors">Edit</button>
              <button onClick={() => handleDeactivate(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUC Dockets Tab — V3 Wave 2 PUC Docket Tracker MVP
// ─────────────────────────────────────────────────────────────────────────────
// Curate active state Public Utility Commission proceedings that materially
// affect community-solar / DER programs. Surfaces in Lens (per-project state)
// and Dashboard StateDetailPanel (Regulatory tab).

function PucDocketsTab() {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [adding, setAdding]     = useState(false)
  const [filterState, setFilterState] = useState('')
  // AI Classify Quick-Add state
  const [classifyText, setClassifyText] = useState('')
  const [classifying, setClassifying]   = useState(false)
  const [classifyError, setClassifyError] = useState(null)
  const [classifyHint, setClassifyHint]   = useState(null)  // 'cached' | null after success

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('puc_dockets:*')
      const data = await getPucDockets({ includeClosed: true })
      setItems(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = {
    state: '',
    puc_name: '',
    docket_number: '',
    title: '',
    status: 'filed',
    pillar: 'offtake',
    impact_tier: 'medium',
    filed_date: new Date().toISOString().split('T')[0],
    comment_deadline: '',
    decision_target: '',
    summary: '',
    source_url: '',
  }

  const startAdd = () => {
    setAdding(true)
    setEditData({ ...blank })
    setEditId(null)
    setError(null)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditData({
      id:               item.id,
      state:            item.state,
      puc_name:         item.pucName,
      docket_number:    item.docketNumber,
      title:            item.title,
      status:           item.status,
      pillar:           item.pillar,
      impact_tier:      item.impactTier,
      filed_date:       item.filedDate || '',
      comment_deadline: item.commentDeadline || '',
      decision_target:  item.decisionTarget || '',
      summary:          item.summary,
      source_url:       item.sourceUrl || '',
    })
    setAdding(false)
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Normalize empty date strings to null so the DB column stays clean.
      const payload = {
        state:            editData.state.toUpperCase(),
        puc_name:         editData.puc_name,
        docket_number:    editData.docket_number,
        title:            editData.title,
        status:           editData.status,
        pillar:           editData.pillar,
        impact_tier:      editData.impact_tier,
        filed_date:       editData.filed_date       || null,
        comment_deadline: editData.comment_deadline || null,
        decision_target:  editData.decision_target  || null,
        summary:          editData.summary,
        source_url:       editData.source_url       || null,
        is_active:        true,
      }
      if (editId) payload.id = editId
      await upsertPucDocket(payload)
      setEditId(null)
      setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Remove this docket from the active feed? (Soft-deactivates; not destructive.)')) return
    try {
      await deletePucDocket(id)
      await load()
    } catch (e) { setError(e.message) }
  }

  // AI Classify — paste docket URL + page contents, Sonnet extracts the
  // structured fields and pre-fills the edit form for review.
  const handleClassify = async () => {
    if (!classifyText || classifyText.trim().length < 40) {
      setClassifyError('Paste at least 40 characters of docket page content.')
      return
    }
    setClassifying(true)
    setClassifyError(null)
    setClassifyHint(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setClassifyError('Sign-in required'); setClassifying(false); return }
      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'classify-docket', rawText: classifyText }),
      })
      const rawBody = await res.text()
      let json = null
      try { json = JSON.parse(rawBody) } catch {}
      if (!res.ok) {
        setClassifyError(json?.error || `Server error (${res.status})`)
        setClassifying(false)
        return
      }
      if (!json?.classification) {
        setClassifyError(json?.reason || 'Classification failed -- try again or fall back to manual add.')
        setClassifying(false)
        return
      }
      const c = json.classification
      // Pre-fill the edit form with AI extraction. User reviews + saves.
      setEditData({
        state:            (c.state || '').toUpperCase(),
        puc_name:         c.puc_name || '',
        docket_number:    c.docket_number || '',
        title:            c.title || '',
        status:           c.status || 'filed',
        pillar:           c.pillar || 'offtake',
        impact_tier:      c.impact_tier || 'medium',
        filed_date:       c.filed_date || '',
        comment_deadline: c.comment_deadline || '',
        decision_target:  c.decision_target || '',
        summary:          c.summary || '',
        source_url:       c.source_url || '',
      })
      setAdding(true)
      setEditId(null)
      setClassifyText('')
      setClassifyHint(json.cached ? 'cached' : 'fresh')
    } catch (e) {
      setClassifyError(`Network error: ${e.message}`)
    }
    setClassifying(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading PUC dockets...</p>

  const isFormOpen = editId || adding

  const visible = filterState
    ? items.filter(i => i.state?.toUpperCase() === filterState.toUpperCase())
    : items

  const STATUS_OPTIONS = ['comment_open', 'pending_decision', 'filed', 'closed']
  const PILLAR_OPTIONS = ['offtake', 'ix', 'site', 'cross-cutting']
  const IMPACT_OPTIONS = ['high', 'medium', 'low']

  return (
    <div>
      {/* Curation cadence banner — admin-only sanity check on scope. */}
      <div className="rounded-lg px-4 py-3 mb-5" style={{ background: '#FAFAF7', borderLeft: '3px solid #14B8A6', border: '1px solid #E2E8F0' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700 mb-1">
          ◆ Curation cadence
        </p>
        <p className="text-[12px] text-ink leading-relaxed">
          Highlight 1–3 high-impact dockets per active state, refresh quarterly. Tractova surfaces signal, not exhaustive coverage — users see an "Explore PUC portal →" link in every empty / populated panel to drill into the long tail themselves. Don't chase comprehensiveness here.
        </p>
      </div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{visible.length} of {items.length} dockets</span>
          <input
            type="text"
            placeholder="Filter by state (e.g. IL)"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value.toUpperCase())}
            className="text-xs px-2.5 py-1.5 rounded-sm border border-gray-200 bg-white font-mono uppercase tracking-wider w-40"
          />
        </div>
        <button onClick={startAdd} className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors">+ Add manually</button>
      </div>

      {/* AI Classify — Quick Add. Paste docket URL + page contents,
          Sonnet extracts the structured fields, user reviews + saves. */}
      <div
        className="rounded-xl mb-5 px-5 py-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
      >
        {/* V3 teal rail */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#5EEAD4' }}>
              ◆ AI Classify · Quick Add
            </p>
            <p className="font-serif text-[15px] font-semibold text-white tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              Paste a PUC docket — Tractova fills in the rest
            </p>
          </div>
          {classifyHint && (
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,184,166,0.18)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.32)' }}>
              {classifyHint === 'cached' ? '✓ cached · free' : '✓ classified'}
            </span>
          )}
        </div>
        <p id="classify-helper" className="text-[12px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Paste the docket URL on the first line, then copy-paste the page contents from your state's PUC e-filing portal. AI extracts state, docket number, status, pillar, impact tier, dates, and a Tractova analyst summary — you review and save.
        </p>
        <textarea
          value={classifyText}
          onChange={(e) => setClassifyText(e.target.value)}
          placeholder="https://documents.dps.ny.gov/public/MatterManagement/CaseMaster.aspx?MatterCaseNo=15-E-0751&#10;&#10;In the Matter of the Value of Distributed Energy Resources..."
          rows={5}
          aria-label="Paste docket URL and page contents for AI classification"
          aria-describedby="classify-helper"
          className="w-full text-[12px] font-mono px-3 py-2.5 rounded-lg outline-hidden resize-y mb-3 focus:ring-2 focus:ring-teal-500/40"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#FFFFFF',
            fontFeatureSettings: '"tnum"',
          }}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.42)' }}>
            ~$0.011/docket · cached 24h
          </p>
          <div className="flex items-center gap-2">
            {classifyText && (
              <button
                onClick={() => { setClassifyText(''); setClassifyError(null); setClassifyHint(null) }}
                disabled={classifying}
                className="text-[11px] font-mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-md transition-colors"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                Clear
              </button>
            )}
            <button
              onClick={handleClassify}
              disabled={classifying || !classifyText.trim()}
              className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-4 py-2 rounded-lg text-white transition-transform hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#14B8A6' }}
            >
              {classifying ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Classifying…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/>
                  </svg>
                  Classify with AI
                </>
              )}
            </button>
          </div>
        </div>
        {classifyError && (
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#FCA5A5' }}>
            {classifyError}
          </p>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {adding ? 'New docket' : `Editing: ${editData.title?.slice(0, 40) || editData.docket_number}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="State (2-letter)" value={editData.state} field="state" onChange={handleChange} />
            <Field label="PUC Name" value={editData.puc_name} field="puc_name" onChange={handleChange} />
            <Field label="Docket Number" value={editData.docket_number} field="docket_number" onChange={handleChange} />
            <Field label="Status" value={editData.status} field="status" onChange={handleChange} options={STATUS_OPTIONS} />
            <Field label="Pillar" value={editData.pillar} field="pillar" onChange={handleChange} options={PILLAR_OPTIONS} />
            <Field label="Impact Tier" value={editData.impact_tier} field="impact_tier" onChange={handleChange} options={IMPACT_OPTIONS} />
            <Field label="Title" value={editData.title} field="title" onChange={handleChange} className="md:col-span-2" />
            <Field label="Filed Date" value={editData.filed_date} field="filed_date" onChange={handleChange} type="date" />
            <Field label="Comment Deadline" value={editData.comment_deadline} field="comment_deadline" onChange={handleChange} type="date" />
            <Field label="Decision Target" value={editData.decision_target} field="decision_target" onChange={handleChange} type="date" />
            <Field label="Source URL" value={editData.source_url} field="source_url" onChange={handleChange} type="url" />
            <Field label="Summary (1-2 sentences why developers care)" value={editData.summary} field="summary" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
            <Button variant="accent" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : adding ? 'Add docket' : 'Save changes'}
            </Button>
            <Button variant="link" onClick={() => { setEditId(null); setAdding(false) }} disabled={saving}>Cancel</Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 italic py-6 text-center">
            No dockets match. Add one to begin populating the feed.
          </p>
        )}
        {visible.map(item => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge>{item.state}</Badge>
                <Badge color={item.status === 'comment_open' ? 'green' : item.status === 'pending_decision' ? 'yellow' : 'blue'}>{item.status}</Badge>
                <Badge color={item.impactTier === 'high' ? 'red' : item.impactTier === 'medium' ? 'yellow' : 'gray'}>{item.impactTier}</Badge>
                <Badge>{item.pillar}</Badge>
                <span className="text-[10px] text-gray-400 truncate">{item.pucName} · {item.docketNumber}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-teal-700 transition-colors">Edit</button>
              <button onClick={() => handleDeactivate(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparable Deals Tab — V3 Wave 2
// ─────────────────────────────────────────────────────────────────────────────
// Curate anonymized recently-completed / under-construction / proposed
// CS / DER projects sourced from FERC Form 1, EIA Form 860, PUC dockets,
// and Tractova analyst review. Surfaces in Lens (Comparable Deals panel)
// filtered by state + tech + ±50% MW.
//
// MVP: manual CRUD only. AI Classify Quick-Add (paste FERC filing or
// news article -> AI extracts structured fields) is Phase 2.

function ComparableDealsTab() {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [adding, setAdding]     = useState(false)
  const [filterState, setFilterState] = useState('')
  const [filterTech, setFilterTech]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('comparable_deals:*')
      const data = await getComparableDeals({ includeInactive: true })
      setItems(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = {
    state:                  '',
    county:                 '',
    technology:             'Community Solar',
    mw:                     '',
    status:                 'proposed',
    developer:              '',
    estimated_capex_per_w:  '',
    offtake_summary:        '',
    ix_difficulty:          '',
    serving_utility:        '',
    source:                 'Tractova analyst',
    source_url:             '',
    filing_date:            new Date().toISOString().split('T')[0],
    cod_target:             '',
    notes:                  '',
  }

  const startAdd = () => {
    setAdding(true)
    setEditData({ ...blank })
    setEditId(null)
    setError(null)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditData({
      id:                     item.id,
      state:                  item.state,
      county:                 item.county || '',
      technology:             item.technology,
      mw:                     item.mw,
      status:                 item.status,
      developer:              item.developer || '',
      estimated_capex_per_w:  item.estimatedCapexPerW || '',
      offtake_summary:        item.offtakeSummary || '',
      ix_difficulty:          item.ixDifficulty || '',
      serving_utility:        item.servingUtility || '',
      source:                 item.source,
      source_url:             item.sourceUrl || '',
      filing_date:            item.filingDate || '',
      cod_target:             item.codTarget || '',
      notes:                  item.notes || '',
    })
    setAdding(false)
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        state:                  editData.state.toUpperCase(),
        county:                 editData.county || null,
        technology:             editData.technology,
        mw:                     parseFloat(editData.mw),
        status:                 editData.status,
        developer:              editData.developer || null,
        estimated_capex_per_w:  editData.estimated_capex_per_w === '' ? null : parseFloat(editData.estimated_capex_per_w),
        offtake_summary:        editData.offtake_summary || null,
        ix_difficulty:          editData.ix_difficulty || null,
        serving_utility:        editData.serving_utility || null,
        source:                 editData.source,
        source_url:             editData.source_url || null,
        filing_date:            editData.filing_date || null,
        cod_target:             editData.cod_target || null,
        notes:                  editData.notes || null,
        is_active:              true,
      }
      if (editId) payload.id = editId
      await upsertComparableDeal(payload)
      setEditId(null)
      setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Remove this deal from the active feed? (Soft-deactivates; not destructive.)')) return
    try {
      await deleteComparableDeal(id)
      await load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading comparable deals...</p>

  const isFormOpen = editId || adding

  const visible = items.filter(i => {
    if (filterState && i.state?.toUpperCase() !== filterState.toUpperCase()) return false
    if (filterTech && i.technology !== filterTech) return false
    return true
  })

  const TECH_OPTIONS    = ['Community Solar', 'C&I Solar', 'BESS', 'Hybrid']
  const STATUS_OPTIONS  = ['proposed', 'under_construction', 'operational', 'cancelled']
  const IX_OPTIONS      = ['', 'easy', 'moderate', 'hard', 'very_hard']
  const SOURCE_OPTIONS  = ['FERC Form 1', 'EIA Form 860', 'PUC docket', 'State agency filing', 'News article', 'Industry report', 'Tractova analyst']

  return (
    <div>
      {/* Curation cadence banner — admin-only sanity check on scope. */}
      <div className="rounded-lg px-4 py-3 mb-5" style={{ background: '#FAFAF7', borderLeft: '3px solid #14B8A6', border: '1px solid #E2E8F0' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700 mb-1">
          ◆ Curation cadence
        </p>
        <p className="text-[12px] text-ink leading-relaxed">
          3–6 representative comps per state × technology, refresh quarterly. Tractova curates highlights — users see "Explore FERC Form 1 / EIA Form 860 →" links in every empty / populated panel to drill into the long tail themselves. Don't chase comprehensiveness here.
        </p>
      </div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">{visible.length} of {items.length} deals</span>
          <input
            type="text"
            placeholder="Filter state (e.g. IL)"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value.toUpperCase())}
            className="text-xs px-2.5 py-1.5 rounded-sm border border-gray-200 bg-white font-mono uppercase tracking-wider w-32"
          />
          <select
            value={filterTech}
            onChange={(e) => setFilterTech(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-sm border border-gray-200 bg-white"
          >
            <option value="">All technologies</option>
            {TECH_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={startAdd} className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors">+ Add deal</button>
      </div>

      {isFormOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {adding ? 'New comparable deal' : `Editing: ${editData.state} · ${editData.county || '—'} · ${editData.mw}MW`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="State (2-letter)" value={editData.state} field="state" onChange={handleChange} />
            <Field label="County" value={editData.county} field="county" onChange={handleChange} />
            <Field label="Technology" value={editData.technology} field="technology" onChange={handleChange} options={TECH_OPTIONS} />
            <Field label="MW" value={editData.mw} field="mw" onChange={handleChange} type="number" />
            <Field label="Status" value={editData.status} field="status" onChange={handleChange} options={STATUS_OPTIONS} />
            <Field label="IX Difficulty" value={editData.ix_difficulty} field="ix_difficulty" onChange={handleChange} options={IX_OPTIONS} />
            <Field label="Developer" value={editData.developer} field="developer" onChange={handleChange} />
            <Field label="Serving Utility" value={editData.serving_utility} field="serving_utility" onChange={handleChange} />
            <Field label="Est. CapEx ($/W)" value={editData.estimated_capex_per_w} field="estimated_capex_per_w" onChange={handleChange} type="number" />
            <Field label="Filing Date" value={editData.filing_date} field="filing_date" onChange={handleChange} type="date" />
            <Field label="COD Target" value={editData.cod_target} field="cod_target" onChange={handleChange} type="date" />
            <Field label="Source" value={editData.source} field="source" onChange={handleChange} options={SOURCE_OPTIONS} />
            <Field label="Source URL" value={editData.source_url} field="source_url" onChange={handleChange} type="url" className="md:col-span-3" />
            <Field label="Offtake Summary (e.g. 'PPA at 7.2 cents, 25-yr term')" value={editData.offtake_summary} field="offtake_summary" onChange={handleChange} type="textarea" className="md:col-span-3" />
            <Field label="Tractova Analyst Note (1-2 sentences why this comp matters)" value={editData.notes} field="notes" onChange={handleChange} type="textarea" className="md:col-span-3" />
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
            <Button variant="accent" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : adding ? 'Add deal' : 'Save changes'}
            </Button>
            <Button variant="link" onClick={() => { setEditId(null); setAdding(false) }} disabled={saving}>Cancel</Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 italic py-6 text-center">
            No deals match. Add one to begin populating the feed.
          </p>
        )}
        {visible.map(item => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-medium truncate">
                {item.state}{item.county ? ` · ${item.county}` : ''}
                <span className="ml-2 font-mono text-xs text-gray-500 tabular-nums">{item.mw} MW</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-gray-600">{item.technology}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge color={item.status === 'operational' ? 'green' : item.status === 'under_construction' ? 'yellow' : item.status === 'cancelled' ? 'red' : 'blue'}>
                  {item.status.replace('_', ' ')}
                </Badge>
                {item.developer && <Badge>{item.developer}</Badge>}
                <span className="text-[10px] text-gray-400 truncate">{item.source}{item.filingDate ? ` · ${item.filingDate}` : ''}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-teal-700 transition-colors">Edit</button>
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

// ─────────────────────────────────────────────────────────────────────────────
// Data Health Tab
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Refresh status banner — V3-styled diagnostics panel for the manual refresh
// click. Shows overall verdict, per-endpoint status, expandable failure
// detail with one-click copy so the admin can paste a clean error report.
// ─────────────────────────────────────────────────────────────────────────────

// CopyButton — clipboard with visible feedback. The previous inline buttons
// silently swallowed clipboard failures (`.catch(() => {})`) so the user
// couldn't tell whether the copy worked. This flips label to "Copied" on
// success and "Copy failed" on rejection (~1.5s) before reverting.
function CopyButton({ text, label = 'Copy', className = '' }) {
  const [state, setState] = useState('idle')
  async function handleClick() {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
      setState('copied')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 1500)
  }
  const display = state === 'copied' ? 'Copied' : state === 'error' ? 'Copy failed' : label
  const tone = state === 'copied'
    ? 'text-emerald-700'
    : state === 'error'
      ? 'text-red-700'
      : 'text-teal-700 hover:text-teal-900'
  return (
    <button
      onClick={handleClick}
      className={`text-[10px] font-mono uppercase tracking-[0.18em] font-semibold transition-colors ${tone} ${className}`}
    >
      {display}
    </button>
  )
}

function endpointStatus(val) {
  // Returns 'ok' | 'stale-ok' | 'partial' | 'failed'
  //   ok        — everything fresh and healthy
  //   stale-ok  — most recent attempt failed but we still have data inside
  //               the freshness window (Census 503 with last-good <90d, etc.)
  //               Data the user sees is correct; no alarm, but signal the
  //               soft-fail so admin knows the upstream is misbehaving.
  //   partial   — some sub-sources hard-failed but others succeeded
  //   failed    — no useful data (hard fail / no recent good)
  const isHardFail = (s) => s?.ok === false && !s?.stale_tolerated
  const isStaleOk  = (s) => s?.ok === false && !!s?.stale_tolerated
  if (!val) return 'failed'
  if (val.error || (val.ok === false && !val.sources && !val.stale_tolerated)) return 'failed'
  if (val.sources) {
    const subs = Object.values(val.sources)
    const anyFail = subs.some(isHardFail)
    if (anyFail) return subs.every(isHardFail) ? 'failed' : 'partial'
    // No hard-fails: if any sub-source is stale-tolerated, surface as stale-ok
    if (subs.some(isStaleOk)) return 'stale-ok'
  } else if (val.ok === false && val.stale_tolerated) {
    // Non-multiplexed endpoint that stale-toleranced its own failure
    return 'stale-ok'
  }
  return 'ok'
}

function buildReportText(result) {
  const lines = [
    `Tractova data refresh report`,
    `Started: ${result.startedAt || '—'}`,
    `Total:   ${result.totalMs ? `${(result.totalMs / 1000).toFixed(1)}s` : '—'}`,
    `Verdict: ${result.ok ? 'OK' : 'PARTIAL / FAILED'}`,
    '',
  ]
  for (const [name, val] of Object.entries(result.endpoints || {})) {
    const status = endpointStatus(val).toUpperCase()
    if (val.sources) {
      const subs = Object.entries(val.sources)
        .map(([k, v]) => {
          if (v?.ok !== false) return `  ${k}: ok`
          if (v?.stale_tolerated) return `  ${k}: STALE-OK (last good ${v.days_since_last_good}d ago) — ${v.error || 'unknown'}`
          return `  ${k}: FAIL — ${v.error || 'unknown'}`
        })
        .join('\n')
      lines.push(`[${name}] ${status}\n${subs}`)
    } else if (val.error || val.ok === false) {
      lines.push(`[${name}] ${status}\n  ${val.error || 'unknown error'}`)
    } else {
      lines.push(`[${name}] ${status}`)
    }
  }
  return lines.join('\n')
}

function RefreshStatusBanner({ result }) {
  if (!result) return null

  // Top-level catastrophic case: the click itself threw before any endpoints ran.
  if (result.error && !result.endpoints) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-serif text-sm font-medium text-red-900">Refresh failed before any endpoint ran</span>
        </div>
        <pre className="mt-2 ml-5 text-[11px] font-mono text-red-700 whitespace-pre-wrap wrap-break-word leading-snug">
          {String(result.error)}
        </pre>
      </div>
    )
  }

  const eps = Object.entries(result.endpoints || {})
  const okCount   = eps.filter(([, v]) => endpointStatus(v) === 'ok').length
  const staleOk   = eps.filter(([, v]) => endpointStatus(v) === 'stale-ok').length
  const partial   = eps.filter(([, v]) => endpointStatus(v) === 'partial').length
  const failed    = eps.filter(([, v]) => endpointStatus(v) === 'failed').length

  const verdict = failed === 0 && partial === 0 && staleOk === 0
    ? { label: 'Refresh complete',     tone: 'emerald' }
    : failed === eps.length
      ? { label: 'Refresh failed',     tone: 'red' }
      : failed === 0 && partial === 0  // only stale-ok soft fails remain
        ? { label: 'Refresh complete · stale-tolerated', tone: 'amber' }
        : { label: 'Partial refresh',  tone: 'amber' }

  const tones = {
    emerald: { ring: 'border-emerald-200', wash: 'bg-emerald-50/40', dot: 'bg-emerald-500', text: 'text-emerald-800' },
    amber:   { ring: 'border-amber-200',   wash: 'bg-amber-50/40',   dot: 'bg-amber-500',   text: 'text-amber-900'   },
    red:     { ring: 'border-red-200',     wash: 'bg-red-50/40',     dot: 'bg-red-500',     text: 'text-red-900'     },
  }
  const t = tones[verdict.tone]

  const totalSec = result.totalMs ? (result.totalMs / 1000).toFixed(1) : null
  const startedTime = result.startedAt ? new Date(result.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null

  return (
    <div
      className={`rounded-xl border ${t.ring} ${t.wash} overflow-hidden`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${t.ring}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full ${t.dot} shrink-0`} />
          <span className={`font-serif text-sm font-medium ${t.text}`}>{verdict.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted truncate">
            {okCount}/{eps.length} ok
            {staleOk > 0 ? ` · ${staleOk} stale-ok` : ''}
            {partial > 0 ? ` · ${partial} partial` : ''}
            {failed > 0 ? ` · ${failed} failed` : ''}
            {startedTime ? ` · ${startedTime}` : ''}
            {totalSec ? ` · ${totalSec}s` : ''}
          </span>
        </div>
        <CopyButton
          text={() => buildReportText(result)}
          label="Copy report"
          className="shrink-0"
        />
      </div>

      {/* Endpoint rows */}
      <div className="divide-y divide-gray-200/60">
        {eps.map(([name, val]) => <EndpointRow key={name} name={name} val={val} />)}
      </div>
    </div>
  )
}

function EndpointRow({ name, val }) {
  const status = endpointStatus(val)
  const isMux  = !!val?.sources

  const dots = { ok: 'bg-emerald-500', 'stale-ok': 'bg-amber-500', partial: 'bg-amber-500', failed: 'bg-red-500' }
  const labels = { ok: 'OK', 'stale-ok': 'STALE-OK', partial: 'PARTIAL', failed: 'FAILED' }
  const labelColors = { ok: 'text-emerald-700', 'stale-ok': 'text-amber-700', partial: 'text-amber-700', failed: 'text-red-700' }

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${dots[status]} shrink-0`} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink truncate">{name}</span>
          {isMux && (
            <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">
              · {Object.keys(val.sources).length} sources
            </span>
          )}
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-[0.18em] font-semibold ${labelColors[status]}`}>
          {labels[status]}
        </span>
      </div>

      {/* Multiplexed: per-source pills */}
      {isMux && (
        <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
          {Object.entries(val.sources).map(([k, v]) => {
            const subOk = v?.ok !== false
            const stale = v?.stale_tolerated
            const tone = subOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : stale
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
            const mark = subOk ? '✓' : stale ? '◐' : '✗'
            return (
              <span key={k} className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${tone}`}>
                <span className="mr-1">{mark}</span>{k}
                {stale && <span className="ml-1 text-amber-600">·stale-ok</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Top-level endpoint failure */}
      {!isMux && status === 'failed' && (
        <div className="mt-2 ml-4 flex items-start gap-2">
          <pre className="flex-1 text-[10px] font-mono text-red-800 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-all leading-snug max-h-40 overflow-auto">
            {String(val?.error || 'unknown error')}
            {val?.where ? `\n  at: ${val.where}` : ''}
          </pre>
          <CopyButton
            text={() => String(val?.error || '')}
            className="shrink-0 pt-1"
          />
        </div>
      )}

      {/* Multiplexed: per-source failure detail */}
      {isMux && Object.entries(val.sources).filter(([, v]) => v?.ok === false).length > 0 && (
        <div className="mt-2 ml-4 space-y-1.5">
          {Object.entries(val.sources)
            .filter(([, v]) => v?.ok === false)
            .map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <div className="flex-1 text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 leading-snug">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-amber-700">{k}</div>
                    {v.stale_tolerated && (
                      <span className="text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 border border-amber-300">
                        stale-ok · last good {v.days_since_last_good}d ago
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-all">{String(v.error || 'unknown')}</div>
                  {v.first_error && v.first_error !== v.error && (
                    <div className="mt-1 pt-1 border-t border-amber-200 text-amber-800 break-all">
                      <span className="text-amber-600">first row error: </span>{v.first_error}
                    </div>
                  )}
                </div>
                <CopyButton
                  text={() => `[${k}] ${v.error || ''}${v.first_error ? `\nfirst row: ${v.first_error}` : ''}`}
                  className="shrink-0 pt-1"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Census diagnostic panel — renders the response from /api/refresh-data?debug=1.
// Surfaces just the fields that drive triage decisions (HTTP status, key shape
// sanity, important headers, body) plus a Copy button for sharing the raw JSON.
// ─────────────────────────────────────────────────────────────────────────────
function CensusDiagnosticPanel({ result, onDismiss }) {
  if (!result) return null

  // Fetch-level failure (network error, abort, JSON parse fail).
  if (result.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="font-serif text-sm font-medium text-red-900">Census diagnostic failed</span>
          </div>
          <button onClick={onDismiss} className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
        <pre className="mt-2 ml-5 text-[11px] font-mono text-red-700 whitespace-pre-wrap break-words leading-snug">
          {String(result.error)}
        </pre>
      </div>
    )
  }

  const j = result.json || {}
  const req = j.request || {}
  const resp = j.response || {}
  const status = resp.status
  const keyOk = req.key_length > 0 && req.key_shape_ok && (req.key_whitespace_check || '').includes('no surrounding')
  const censusOk = status === 200

  const verdict = censusOk && keyOk
    ? { label: 'Census healthy + key valid',  tone: 'emerald', dot: 'bg-emerald-500', text: 'text-emerald-800', ring: 'border-emerald-200', wash: 'bg-emerald-50/40' }
    : !keyOk
      ? { label: 'Key issue detected',         tone: 'red',     dot: 'bg-red-500',     text: 'text-red-900',     ring: 'border-red-200',     wash: 'bg-red-50/40' }
      : { label: `Census responded ${status || '???'}`, tone: 'amber', dot: 'bg-amber-500', text: 'text-amber-900', ring: 'border-amber-200', wash: 'bg-amber-50/40' }

  // Triage hint based on diagnostic shape.
  let hint = null
  if (!keyOk) {
    if (req.key_length === 0) hint = 'CENSUS_API_KEY env var is empty in Production. Add it in Vercel → Settings → Environment Variables.'
    else if (!req.key_shape_ok) hint = `Key length is ${req.key_length}; Census keys are 40-char hex. Check for typos / wrong value.`
    else hint = 'Key has surrounding whitespace — likely a copy-paste with a trailing newline. Edit the env var to remove it.'
  } else if (status === 503) {
    hint = (resp.headers || {})['retry-after']
      ? `Upstream throttling. Retry-After header: ${resp.headers['retry-after']}s. Wait then click Refresh again.`
      : 'Census ACS API is busy or in maintenance. No client-side fix; wait it out. Stale-tolerance keeps existing data green for 90 days.'
  } else if ((resp.headers || {})['cf-ray'] || (resp.headers || {})['cf-mitigated']) {
    hint = 'Cloudflare edge sitting in front of Census — possible WAF block on Vercel egress IPs. Investigate bulk-download fallback if this persists.'
  } else if (status && status >= 400 && status < 500 && status !== 429) {
    hint = `Census returned ${status} — body should explain. Check key validity if 401/403.`
  } else if (censusOk) {
    hint = 'Everything reachable. If refreshes still fail, the issue is in our handlers, not Census itself.'
  }


  return (
    <div className={`rounded-xl border ${verdict.ring} ${verdict.wash} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${verdict.ring}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full ${verdict.dot} flex-shrink-0`} />
          <span className={`font-serif text-sm font-medium ${verdict.text}`}>{verdict.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted truncate">
            {result.totalMs ? `${(result.totalMs / 1000).toFixed(1)}s` : ''}
            {req.vercel_region ? ` · region ${req.vercel_region}` : ''}
            {typeof j.duration_ms === 'number' ? ` · upstream ${(j.duration_ms / 1000).toFixed(2)}s` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CopyButton text={() => JSON.stringify(j, null, 2)} label="Copy JSON" />
          <button onClick={onDismiss} className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-400 hover:text-gray-600 transition-colors">
            Dismiss
          </button>
        </div>
      </div>

      {/* Hint */}
      {hint && (
        <div className={`px-4 py-2 text-[11px] ${verdict.text} border-b ${verdict.ring} bg-white/30`}>
          <span className="font-semibold uppercase tracking-[0.14em] text-[9px] mr-2 opacity-70">Triage</span>
          {hint}
        </div>
      )}

      {/* Detail grid */}
      <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono">
        <DetailRow label="HTTP status"  value={status ? `${status} ${resp.status_text || ''}`.trim() : '(no response)'} ok={censusOk} />
        <DetailRow label="Key length"   value={req.key_length || 0} ok={req.key_length === 40} />
        <DetailRow label="Key shape"    value={req.key_shape_ok ? '40-char hex ✓' : 'unexpected'} ok={req.key_shape_ok} />
        <DetailRow label="Whitespace"   value={req.key_whitespace_check || '(unknown)'} ok={(req.key_whitespace_check || '').includes('no surrounding')} />
        <DetailRow label="Vercel region" value={req.vercel_region || '(unknown)'} />
        <DetailRow label="Body size"    value={typeof resp.body_length === 'number' ? `${resp.body_length} bytes` : '—'} />
      </div>

      {/* Headers */}
      {resp.headers && Object.keys(resp.headers).length > 0 && (
        <div className="px-4 pb-2 text-[11px] font-mono">
          <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-gray-500 mb-1">Response headers</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
            {Object.entries(resp.headers).map(([k, v]) => (
              <div key={k} className="text-gray-700 truncate">
                <span className="text-gray-400">{k}:</span> {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {resp.body && (
        <div className="px-4 pb-3 text-[11px] font-mono">
          <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-gray-500 mb-1">Response body (first 4KB)</div>
          <pre className="text-[10px] text-gray-800 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-all leading-snug max-h-48 overflow-auto">
            {resp.body}
          </pre>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, ok }) {
  const valueColor = ok === undefined
    ? 'text-gray-700'
    : ok
      ? 'text-emerald-700'
      : 'text-red-700'
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-gray-400 flex-shrink-0">{label}:</span>
      <span className={`${valueColor} truncate`}>{String(value)}</span>
    </div>
  )
}

// Each card prefers `last_cron_success` (when did the cron last verify this
// data against the live source?) -- migration 031 derives this from cron_runs
// so a click on "Refresh data from sources" bumps every card whose cron
// succeeded, even if no rows actually mutated. `fallbackField` keeps the
// card meaningful when migration 031 hasn't been applied yet OR when the
// cron has never logged a success entry yet.
// county_intelligence is the one exception: hand-curated, no cron, so we
// keep its row-level field as primary.
const FRESHNESS_CONFIG = {
  state_programs:      { label: 'State Programs',      icon: '🗺', field: 'last_cron_success', fallbackField: 'newest_verified', staleField: 'stale_count', thresholds: [14, 30] },
  lmi_data:            { label: 'LMI Data (Census)',   icon: '🏘', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [14, 30] },
  ix_queue_data:       { label: 'IX Queue Data',       icon: '⚡', field: 'last_cron_success', fallbackField: 'newest_fetch',    staleField: 'stale_count', thresholds: [14, 30] },
  substations:         { label: 'Substations',         icon: '🔌', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [45, 90] },
  county_intelligence: { label: 'County Intelligence', icon: '📍', field: 'oldest_verified',   fallbackField: null,              staleField: 'stale_count', thresholds: [90, 180] },
  county_acs_data:     { label: 'County ACS (Census)', icon: '📊', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [14, 30] },
  energy_community_data:{ label: 'Energy Community (IRA)', icon: '⚡', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  hud_qct_dda_data:    { label: 'HUD QCT / DDA',         icon: '🏘', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  nmtc_lic_data:       { label: 'NMTC LIC §48(e)',       icon: '🎯', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  revenue_rates:       { label: 'Revenue Rates',       icon: '💰', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [120, 200] },
  revenue_stacks:      { label: 'Revenue Stacks',      icon: '🏛', field: 'last_cron_success', fallbackField: 'newest_dsire_check', staleField: null,       thresholds: [14, 30] },
  news_feed:           { label: 'News Feed',           icon: '📰', field: 'last_cron_success', fallbackField: 'latest_item',     staleField: null,          thresholds: [14, 30] },
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

// ─────────────────────────────────────────────────────────────────────────────
// Staging Tab — Review and promote staged state_programs changes
// ─────────────────────────────────────────────────────────────────────────────

function StagingTab() {
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

// ─────────────────────────────────────────────────────────────────────────────
// Data Health Tab
// ─────────────────────────────────────────────────────────────────────────────

function DataHealthTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  // Manual data-refresh trigger -- alternative to waiting for the weekly
  // cron. Fans out to every supported source via /api/refresh-data?source=all.
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)
  // Census diagnostic — hits /api/refresh-data?debug=1 to surface raw
  // upstream state when Census handlers are misbehaving. Auth-bypass
  // endpoint, response is fully redacted (no key chars), so no risk
  // surfacing it inline.
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnostic, setDiagnostic] = useState(null)

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

  const handleRefreshData = async () => {
    setRefreshing(true)
    setRefreshResult(null)
    setError(null)
    const startedAt = new Date()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const auth = { Authorization: `Bearer ${session.access_token}` }

      // Fan out to every cron endpoint in parallel. We split the multiplexed
      // refresh into two HTTP calls so each has its own ~60s gateway budget:
      //   - "fast": 7 sources (everything except NMTC LIC)
      //   - "nmtc": NMTC alone -- it iterates 51 states sequentially through
      //     Census API and takes 50-70s on its own, which would otherwise
      //     blow the multiplexer past the gateway ceiling.
      // substations + ix-queue + capacity-factors are separate Vercel
      // functions (12-slot Hobby cap). All endpoints accept the admin JWT.
      const endpoints = [
        { name: 'fast',        url: '/api/refresh-data?source=fast' },
        { name: 'nmtc_lic',    url: '/api/refresh-data?source=nmtc_lic' },
        { name: 'substations', url: '/api/refresh-substations' },
        { name: 'ix_queue',    url: '/api/refresh-ix-queue' },
        { name: 'capacity',    url: '/api/refresh-capacity-factors' },
      ]
      // 310s hard ceiling per endpoint -- slightly above the server's 300s
      // function budget. Without this, a hung connection (e.g. Vercel killing
      // the function but the gateway not closing the socket cleanly) leaves
      // the UI spinning forever.
      const settled = await Promise.allSettled(
        endpoints.map(e => {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 310000)
          return fetch(e.url, { method: 'POST', headers: auth, signal: controller.signal })
            .then(async r => {
              clearTimeout(timer)
              const text = await r.text()
              let json = null
              try { json = JSON.parse(text) } catch {}
              if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`)
              return json
            })
            .catch(err => {
              clearTimeout(timer)
              if (err?.name === 'AbortError') throw new Error('Client timeout (>310s) — server did not respond')
              throw err
            })
        })
      )

      const aggregate = { ok: true, endpoints: {}, startedAt: startedAt.toISOString() }
      for (let i = 0; i < endpoints.length; i++) {
        const e = endpoints[i]
        const r = settled[i]
        if (r.status === 'fulfilled') {
          aggregate.endpoints[e.name] = r.value
          // The multiplexer returns 200 with `ok: false` if any sub-source
          // failed. Stale-tolerated sub-sources don't count against the
          // aggregate verdict -- the data is still recent, the failed
          // attempt is just a transient upstream blip.
          if (r.value?.ok === false && !r.value?.stale_tolerated) aggregate.ok = false
          if (r.value?.sources) {
            for (const sub of Object.values(r.value.sources)) {
              if (sub?.ok === false && !sub?.stale_tolerated) aggregate.ok = false
            }
          }
        } else {
          aggregate.ok = false
          aggregate.endpoints[e.name] = { ok: false, error: r.reason?.message || 'failed' }
        }
      }
      aggregate.totalMs = Date.now() - startedAt.getTime()
      setRefreshResult(aggregate)

      // Crons just rewrote the underlying tables -- nuke the front-end 1h
      // cache so the rest of the app re-fetches without a hard reload.
      // Cross-tab variant: BroadcastChannel so a Dashboard left open in
      // another tab also clears its in-memory cache, not just this Admin tab.
      invalidateCacheEverywhere()

      // Re-fetch the freshness panel itself so the cards update inline.
      try {
        const fresh = await fetch('/api/data-health', { headers: auth })
        if (fresh.ok) setData(await fresh.json())
      } catch (_) { /* non-fatal */ }
    } catch (err) {
      setRefreshResult({ ok: false, error: err.message, startedAt: startedAt.toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } finally {
      setRefreshing(false)
    }
  }

  const handleRunDiagnostic = async () => {
    setDiagnosing(true)
    setDiagnostic(null)
    const startedAt = new Date()
    try {
      // ?debug=1 is intentionally auth-bypassed (response carries no
      // secrets — key length only). 35s ceiling: the server-side fetch
      // has a 30s timeout, plus a few seconds of network slack.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 35000)
      const resp = await fetch('/api/refresh-data?debug=1', { signal: controller.signal })
        .finally(() => clearTimeout(timer))
      const json = await resp.json()
      setDiagnostic({ ok: resp.ok, json, fetchedAt: new Date().toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } catch (err) {
      setDiagnostic({ ok: false, error: err?.message || String(err), fetchedAt: new Date().toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } finally {
      setDiagnosing(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired — please log in again')
      const resp = await fetch('/api/data-health?action=export', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resp.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'tractova-backup.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div className="py-12 flex items-center justify-center">
      <TractovaLoader size={56} label="Loading Data Health" sublabel="freshness · cron runs · audit log" />
    </div>
  )
  if (error) return <div className="py-8 text-sm text-red-500">Failed to load: {error}</div>
  if (!data) return null

  const { freshness, cronRuns, dataUpdates } = data

  return (
    <div className="space-y-8">

      {/* ── Mission Control — single-screen executive snapshot of system health ──
          Pulls the missionControl block surfaced by /api/data-health (the
          same probes the bearer-token health-summary endpoint runs, just
          inline-served to the admin's JWT). Sits at the very top so the
          first thing the admin sees on Data Health is "is the platform
          healthy." Detail surfaces (freshness grid, audit log, cron
          rollups, cron latency, IX staleness alert) live below. */}
      <MissionControl missionControl={data?.missionControl} cronRuns={data?.cronRuns || []} />

      {/* ── Action buttons + manual data-refresh trigger ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: '#14B8A6' }}
          >
            {refreshing ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Refreshing live data…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh data from sources
              </>
            )}
          </button>
          <button
            onClick={handleRunDiagnostic}
            disabled={diagnosing}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Hits /api/refresh-data?debug=1 — single tiny Census fetch with full response diagnostics. Use when Census handlers are misbehaving."
          >
            {diagnosing ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                Running diagnostic…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                Run Census diagnostic
              </>
            )}
          </button>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
        </button>
      </div>

      {/* Refresh status panel — full-width, copy-friendly diagnostics */}
      {refreshResult && <RefreshStatusBanner result={refreshResult} />}

      {/* Census diagnostic panel — appears when "Run Census diagnostic" is clicked */}
      {diagnostic && <CensusDiagnosticPanel result={diagnostic} onDismiss={() => setDiagnostic(null)} />}

      {/* Source attribution help */}
      <p className="text-[11px] text-ink-muted leading-relaxed">
        Clicking Refresh fans out to every cron in parallel: Census ACS (LMI + counties), DSIRE (state programs + revenue stacks), RSS+AI (news feed),
        ISO queues (IX queue), EIA Form 860 (substations), and NREL + EIA (capacity factors + retail rates). Each handler logs to{' '}
        <span className="font-mono">cron_runs</span> on success, which drives the freshness cards above.
      </p>

      {/* ── Section 1: Freshness Grid ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Data Freshness</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(FRESHNESS_CONFIG).map(([key, cfg]) => {
            const tableData = freshness?.[key]
            if (!tableData) return null
            // Prefer the cron-success timestamp, but fall back to the row-level
            // field if migration 031 hasn't run or the cron has never succeeded.
            const dateVal = tableData[cfg.field] ?? (cfg.fallbackField ? tableData[cfg.fallbackField] : null)
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

      {/* ── IX scraper staleness alert ──
          Surfaces ISO scrapers that haven't refreshed in >7 days. When the
          underlying queue download URL changes upstream, the scraper silently
          fails and stale data sits in ix_queue_data forever. The Lens IX
          panel also flips its 'IX · Live' pill to amber + 'stale Nd' for
          affected states; this admin alert is the system-level mirror. */}
      <IxStalenessAlert />

      {/* ── Cron latency monitor — defensive observability ──
          Aggregates cron_runs over the last 30 days and flags any handler
          whose p95 duration is approaching the parent function's
          maxDuration ceiling. Catches the next 504-class bug structurally
          before users see a red panel. */}
      <CronLatencyPanel />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Control — single-screen system-health executive snapshot
// ─────────────────────────────────────────────────────────────────────────────
// Renders at the top of DataHealthTab. Three KPI cards:
//   1. NWI coverage gauge (live geospatial seed completion %)
//   2. IX freshness — per-ISO pills, colored by staleness
//   3. Substations cron — latency bar vs the 60s function ceiling
// Plus a usage-signals row (Scenario Studio saves + churn-defense surveys).
//
// Visual language: matches the rest of the platform (mono uppercase eyebrows,
// serif titles, tinted bordered panels, brand teal/amber/navy palette).

function MissionControl({ missionControl, cronRuns }) {
  if (!missionControl) {
    // Skeleton during initial load — keeps layout stable
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
        <p className="text-[11px] text-gray-400 italic">Loading mission control…</p>
      </div>
    )
  }

  const { nwi_coverage, ix_freshness, scenario_snapshots_count, cancellation_feedback_count } = missionControl
  const monthlyRun = (cronRuns || []).find((r) => r.cron_name === 'monthly-data-refresh' && r.status === 'success') || null

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15,26,46,0.025) 0%, rgba(15,26,46,0.05) 100%)',
        border: '1px solid rgba(15,26,46,0.10)',
      }}
    >
      {/* Header eyebrow — wraps on narrow viewports so the timestamp drops
          to its own line instead of colliding with the eyebrow text. */}
      <div
        className="px-5 py-3 flex items-baseline justify-between gap-3 border-b flex-wrap"
        style={{ borderColor: 'rgba(15,26,46,0.08)', background: 'rgba(15,26,46,0.04)' }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
            style={{ color: '#0F1A2E' }}
          >
            ◆ Mission Control
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
            executive snapshot · live data
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
          {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* 3-card KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
        <NwiCoverageCard data={nwi_coverage} />
        <IxFreshnessCard freshness={ix_freshness} />
        <MonthlyCronCard run={monthlyRun} />
      </div>

      {/* Usage signals — small horizontal row */}
      <div className="border-t border-gray-100 px-5 py-3 bg-white flex items-center gap-6 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400 font-bold">
          Usage signals
        </span>
        <UsageStat
          label="Scenario Studio saves"
          value={scenario_snapshots_count}
          color="#0F766E"
        />
        <UsageStat
          label="Churn-defense surveys"
          value={cancellation_feedback_count}
          color="#D97706"
        />
      </div>
    </section>
  )
}

// ── KPI Card 1: NWI coverage gauge ──
function NwiCoverageCard({ data }) {
  const pct = data?.pct ?? 0
  const populated = data?.populated ?? 0
  const total = data?.total ?? 0
  // Goal is 95%+. Color the gauge by tier.
  const tier = pct >= 95 ? 'good' : pct >= 85 ? 'watch' : 'warn'
  const colorMap = {
    good:  { stroke: '#0F766E', label: 'Goal met',  bg: 'rgba(15,118,110,0.06)', dot: '#10B981' },
    watch: { stroke: '#D97706', label: 'Approaching', bg: 'rgba(217,119,6,0.06)', dot: '#D97706' },
    warn:  { stroke: '#DC2626', label: 'Below goal', bg: 'rgba(220,38,38,0.06)', dot: '#DC2626' },
  }
  const c = colorMap[tier]
  // Circular gauge — same construction as the Lens composite for visual continuity.
  const R = 32
  const C = 2 * Math.PI * R
  const filled = (pct / 100) * C

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ NWI coverage
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{ background: c.bg, color: c.stroke, border: `1px solid ${c.stroke}40` }}
        >
          {c.label}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r={R} stroke="#F3F4F6" strokeWidth="6" fill="none" />
            <circle
              cx="40" cy="40" r={R}
              stroke={c.stroke} strokeWidth="6" fill="none"
              strokeDasharray={`${filled} ${C}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute font-mono text-xl font-bold tabular-nums text-ink">
            {pct}<span className="text-xs text-gray-400">%</span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-700 leading-snug">
            <span className="font-bold tabular-nums">{populated.toLocaleString()}</span> of <span className="tabular-nums">{total.toLocaleString()}</span> counties
          </p>
          <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
            USFWS NWI wetlands · USDA SSURGO farmland
          </p>
          <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
            Goal: <span className="font-semibold text-gray-600">95%+</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card 2: IX freshness pills per ISO ──
function IxFreshnessCard({ freshness }) {
  const list = freshness || []
  const staleCount = list.filter((f) => f.stale).length
  const totalCount = list.length

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ IX scrapers
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{
            background: staleCount === 0 ? 'rgba(15,118,110,0.06)' : 'rgba(217,119,6,0.06)',
            color:      staleCount === 0 ? '#0F766E' : '#92400E',
            border: `1px solid ${staleCount === 0 ? '#0F766E40' : '#D9770640'}`,
          }}
        >
          {staleCount} of {totalCount} stale
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No IX queue data loaded.</p>
      ) : (
        <div className="space-y-1.5 flex-1">
          {list.map((f) => {
            const sty = f.stale
              ? { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', text: '#92400E', dot: '#D97706' }
              : { bg: 'rgba(15,118,110,0.06)', border: 'rgba(15,118,110,0.25)', text: '#0F766E', dot: '#10B981' }
            return (
              <div
                key={f.iso}
                className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-md"
                style={{ background: sty.bg, border: `1px solid ${sty.border}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: sty.text }}>
                    {f.iso}
                  </span>
                </div>
                <span className="font-mono text-[10px] tabular-nums" style={{ color: sty.text }}>
                  {f.ageDays}d ago
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-gray-400 leading-snug mt-2 pt-2 border-t border-gray-100">
        Stale = oldest fetched_at &gt; 7d
      </p>
    </div>
  )
}

// ── KPI Card 3: monthly-data-refresh latency bar ──
function MonthlyCronCard({ run }) {
  const ceilingMs = 60_000
  const durationMs = run?.duration_ms ?? null
  const pct = durationMs != null ? Math.min(100, (durationMs / ceilingMs) * 100) : 0
  const headroomPct = durationMs != null ? Math.max(0, Math.round((1 - durationMs / ceilingMs) * 100)) : null
  const tier = headroomPct == null ? 'unknown' : headroomPct >= 50 ? 'good' : headroomPct >= 30 ? 'watch' : 'warn'
  const colorMap = {
    good:    { fill: '#0F766E', label: 'Healthy',    bg: 'rgba(15,118,110,0.06)' },
    watch:   { fill: '#D97706', label: 'Watch',      bg: 'rgba(217,119,6,0.06)' },
    warn:    { fill: '#DC2626', label: 'Drifting',   bg: 'rgba(220,38,38,0.06)' },
    unknown: { fill: '#94A3B8', label: 'No data',    bg: 'rgba(148,163,184,0.06)' },
  }
  const c = colorMap[tier]
  const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  const finishedAgo = run?.finished_at
    ? Math.floor((Date.now() - new Date(run.finished_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ Substations cron
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{ background: c.bg, color: c.fill, border: `1px solid ${c.fill}40` }}
        >
          {c.label}
        </span>
      </div>
      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-gray-700">Last run duration</span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: c.fill }}>
            {fmtMs(durationMs)}
          </span>
        </div>
        {/* Latency bar with ceiling marker */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-all"
            style={{ width: `${pct}%`, background: c.fill }}
          />
          {/* 70% threshold tick — where WATCH would flip */}
          <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: '70%' }} />
        </div>
        <div className="flex items-baseline justify-between mt-1 text-[9px] font-mono text-gray-400 tabular-nums">
          <span>0s</span>
          <span style={{ color: '#6B7280' }}>ceiling 60s</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug mt-1">
        {durationMs != null
          ? <>{headroomPct}% headroom · last successful run {finishedAgo == null ? 'unknown' : finishedAgo === 0 ? 'today' : `${finishedAgo}d ago`}</>
          : 'No successful run found yet.'}
      </p>
      <p className="text-[10px] text-gray-400 leading-snug mt-2 pt-2 border-t border-gray-100">
        api/refresh-substations · monthly cadence
      </p>
    </div>
  )
}

// ── Small inline KPI for the usage-signals row ──
function UsageStat({ label, value, color }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
        {Number(value || 0).toLocaleString()}
      </span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IX scraper staleness alert — flags ISOs frozen past the 7-day freshness window
// ─────────────────────────────────────────────────────────────────────────────

function IxStalenessAlert() {
  const [state, setState] = useState({ loading: true, stale: [], totalIsos: 0 })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('ix_queue_data')
        .select('state_id, iso, utility_name, fetched_at')
      if (cancelled) return
      if (error || !data) {
        setState({ loading: false, stale: [], totalIsos: 0 })
        return
      }
      // Worst-case fetched_at per ISO.
      const byIso = {}
      for (const row of data) {
        if (!row.fetched_at) continue
        const ts = new Date(row.fetched_at).getTime()
        if (!byIso[row.iso] || ts < byIso[row.iso].oldest) {
          byIso[row.iso] = { oldest: ts, fetched_at: row.fetched_at }
        }
      }
      const now = Date.now()
      const stale = Object.entries(byIso)
        .map(([iso, v]) => ({
          iso,
          ageDays: Math.floor((now - v.oldest) / (1000 * 60 * 60 * 24)),
          fetchedAt: v.fetched_at,
        }))
        .filter((r) => r.ageDays > 7)
        .sort((a, b) => b.ageDays - a.ageDays)
      setState({ loading: false, stale, totalIsos: Object.keys(byIso).length })
    })()
    return () => { cancelled = true }
  }, [])

  if (state.loading || state.stale.length === 0) return null

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
    >
      <div
        className="px-4 py-2.5 flex items-baseline justify-between gap-2 border-b border-amber-100"
        style={{ background: 'rgba(217,119,6,0.05)' }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-amber-800">
          ◆ IX scraper staleness · {state.stale.length} of {state.totalIsos} ISOs frozen
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
          7-day window
        </span>
      </div>
      <div className="px-4 py-3 bg-white">
        <p className="text-[11px] text-amber-900 leading-relaxed mb-2">
          The following ISO queue scrapers haven't returned fresh data in &gt;7 days. The Lens IX · Live pill flips amber + "stale Nd" for affected states. Repair likely requires finding new public download URLs (PJM Cycles reform, NYISO portal moves, ISO-NE iRTT URL changes).
        </p>
        <div className="space-y-1.5">
          {state.stale.map((s) => (
            <div
              key={s.iso}
              className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md"
              style={{ background: 'rgba(217,119,6,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-bold text-amber-800">{s.iso}</span>
                <span className="text-amber-900">last fresh pull {s.ageDays} day{s.ageDays === 1 ? '' : 's'} ago</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono tabular-nums">
                {new Date(s.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cron Latency Panel — surfaces handlers approaching their function ceiling
// ─────────────────────────────────────────────────────────────────────────────

function CronLatencyPanel() {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await analyzeCronLatency(supabase, 30)
      if (cancelled) return
      if (!result.ok) setState({ loading: false, error: result.error, data: null })
      else setState({ loading: false, error: null, data: result })
    })()
    return () => { cancelled = true }
  }, [])

  const fmtMs = (ms) => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60_000).toFixed(1)}m`
  }

  const SEVERITY_STYLE = {
    warn:  { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'WARN'  },
    watch: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)',dot: '#D97706', label: 'WATCH' },
    ok:    { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.20)',dot: '#10B981', label: 'OK'    },
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="text-sm font-bold text-gray-900">Cron Latency</h3>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
          p95 vs maxDuration · 30-day window
        </span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
        Catches the next 504 before users do. Any handler whose p95 exceeds
        70% of its function ceiling needs structural attention — sequential
        per-state calls, slow upstream sources, or a missing parallelization
        pass. The original <span className="font-mono">refresh-substations</span> 504
        (commit <span className="font-mono">bbc9543</span>) would have surfaced
        here weeks earlier.
      </p>

      {state.loading && (
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          Loading latency rollup…
        </div>
      )}

      {state.error && (
        <div className="text-[11px] text-red-500">
          Failed to load cron latency: {state.error}
        </div>
      )}

      {state.data && state.data.rows.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">
          No successful cron runs in the last {state.data.windowDays} days.
        </p>
      )}

      {state.data && state.data.rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">
                <th className="px-3 py-2 font-bold">Cron Name</th>
                <th className="px-3 py-2 font-bold text-right">Runs</th>
                <th className="px-3 py-2 font-bold text-right">p95</th>
                <th className="px-3 py-2 font-bold text-right">Max</th>
                <th className="px-3 py-2 font-bold text-right">Avg</th>
                <th className="px-3 py-2 font-bold text-right">Ceiling</th>
                <th className="px-3 py-2 font-bold text-right">Headroom</th>
                <th className="px-3 py-2 font-bold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {state.data.rows.map((r) => {
                const sty = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.ok
                return (
                  <tr key={r.cron_name} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-gray-700">{r.cron_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.sample_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">{fmtMs(r.p95_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.max_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.avg_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.ceiling_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.headroom_pct}%</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                        style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sty.dot }} />
                        {sty.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Page Shell
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Test Notifications — admin-only panel for triggering test emails / Slack
// ─────────────────────────────────────────────────────────────────────────────
function TestNotificationsTab() {
  const [running, setRunning] = useState(null)  // 'digest' | 'email' | 'slack' | null
  const [result, setResult] = useState(null)    // { kind, ok, message }

  const trigger = async (kind) => {
    setRunning(kind)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in. Refresh the page and try again.')

      const endpoint = kind === 'digest'
        ? '/api/send-digest'
        : kind === 'opportunity'
          ? '/api/send-alerts?channel=email&type=opportunity'
          : `/api/send-alerts${kind === 'slack' ? '?channel=slack' : '?channel=email'}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ test: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      const sent = json.sent ?? 0
      const slackSent = json.slack?.sent ?? 0
      const where = kind === 'digest'
        ? `Email sent to ${ADMIN_EMAIL}`
        : kind === 'email'
          ? `Email sent to ${ADMIN_EMAIL} (${sent} message${sent !== 1 ? 's' : ''})`
          : kind === 'opportunity'
            ? `Opportunity email sent to ${ADMIN_EMAIL} (${sent} message${sent !== 1 ? 's' : ''})`
            : `Slack message posted to your saved webhook (${slackSent} sent)`
      setResult({ kind, ok: true, message: `✓ ${where}. Check inbox / channel — subject prefixed with [TEST].` })
    } catch (err) {
      setResult({ kind, ok: false, message: `✗ ${err.message}` })
    } finally {
      setRunning(null)
    }
  }

  const buttons = [
    {
      kind: 'digest',
      label: 'Send Test Weekly Digest',
      desc: 'Fires the Monday 14:00 UTC digest for your account only. Review header, portfolio meta, Markets in Motion, project cards, footer.',
      bg: '#0F1A2E',
    },
    {
      kind: 'email',
      label: 'Send Test Email Alert',
      desc: 'Fires the policy-alert email template. Synthesizes a sample urgent alert if no real alerts exist on your saved projects.',
      bg: '#D97706',
    },
    {
      kind: 'opportunity',
      label: 'Send Test Opportunity Alert',
      desc: 'Fires the positive-event email template — capacity expansions, new program launches, score improvements. Synthesizes a sample upside opportunity (teal accent rail, "MARKET OPPORTUNITY" eyebrow, ↑ delta).',
      bg: '#0F766E',
    },
    {
      kind: 'slack',
      label: 'Send Test Slack Alert',
      desc: 'Posts a Block Kit alert to the webhook URL saved in your Profile → Slack delivery section. Fails clearly if no webhook configured.',
      bg: '#14B8A6',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink-muted mb-1.5">Test Notifications</p>
        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
          Fire a one-shot test of each notification template against your admin account. All deliveries are scoped to <span className="font-mono text-ink">{ADMIN_EMAIL}</span> and your saved Slack webhook — no other users are touched. Subjects are prefixed with <span className="font-mono">[TEST]</span> so you can filter / delete after review.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {buttons.map(b => (
          <div key={b.kind} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
            <p className="font-serif text-base font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
              {b.label.replace('Send Test ', '')}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2 flex-1">{b.desc}</p>
            <button
              onClick={() => trigger(b.kind)}
              disabled={running !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: b.bg }}
            >
              {running === b.kind ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending…
                </>
              ) : b.label}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: result.ok ? 'rgba(20,184,166,0.06)' : 'rgba(220,38,38,0.06)',
            border: `1px solid ${result.ok ? 'rgba(20,184,166,0.30)' : 'rgba(220,38,38,0.30)'}`,
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: result.ok ? '#0F766E' : '#991B1B' }}>
            {result.ok ? 'Success' : 'Failed'} · {result.kind}
          </p>
          <p className="text-sm text-ink leading-relaxed">{result.message}</p>
        </div>
      )}

      <div className="rounded-lg px-4 py-3 mt-4" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: '#92400E' }}>
          Note · Temporary tooling
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">
          This panel exists for QA review of the notification templates and Slack integration. The endpoints accept admin JWTs in addition to the Vercel cron header — production cron behavior is unchanged.
        </p>
      </div>
    </div>
  )
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState(0)

  // Reset window scroll to top on mount + when switching tabs.
  // React Router doesn't auto-reset scroll on route change, so if user
  // arrived from a scrolled-down page (Profile, Library) they'd land
  // mid-page on Admin -- past the tab headers, which is disorienting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tab])

  if (authLoading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-gray-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Data Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Edit live market intelligence data. Changes propagate within 1 hour (cache TTL).</p>

          <div className="flex flex-wrap gap-1 mt-6 border-b border-gray-200">
            {TABS.map((t, i) => {
              const c = TAB_COLOR_CLASSES[t.color]
              const isActive = tab === i
              return (
                <button
                  key={t.label}
                  onClick={() => setTab(i)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    isActive
                      ? `${c.activeBorder} ${c.activeText}`
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${isActive ? '' : 'opacity-70'}`} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            {tab === 0 && <StateProgramsTab />}
            {tab === 1 && <CountiesTab />}
            {tab === 2 && <RevenueRatesTab />}
            {tab === 3 && <NewsFeedTab />}
            {tab === 4 && <IXQueueTab />}
            {tab === 5 && <PucDocketsTab />}
            {tab === 6 && <ComparableDealsTab />}
            {tab === 7 && <StagingTab />}
            {tab === 8 && <DataHealthTab />}
            {tab === 9 && <TestNotificationsTab />}
          </div>
        </div>
      </main>
    </div>
  )
}
