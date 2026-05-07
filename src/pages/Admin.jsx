import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getAllIXQueueData,
  updateIXQueueRow,
  getComparableDeals, upsertComparableDeal, deleteComparableDeal,
  invalidateCache,
} from '../lib/programData'
import { Input, Select, Button } from '../components/ui'
import { analyzeCronLatency } from '../lib/cronLatencyMonitor'
import { endpointStatus, buildReportText } from '../lib/adminHelpers'
import StateProgramsTab from '../components/admin/StateProgramsTab.jsx'
import CountiesTab from '../components/admin/CountiesTab.jsx'
import RevenueRatesTab from '../components/admin/RevenueRatesTab.jsx'
import NewsFeedTab from '../components/admin/NewsFeedTab.jsx'
import PucDocketsTab from '../components/admin/PucDocketsTab.jsx'
import DataHealthTab from '../components/admin/DataHealthTab.jsx'

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
export function Field({ label, value, field, onChange, type = 'text', options, className = '' }) {
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

export function ReadOnlyCell({ value, className = '' }) {
  const display = value === null || value === undefined ? '—' : String(value)
  return <span className={`text-sm text-gray-700 tabular-nums ${className}`}>{display}</span>
}

export function SaveBar({ dirty, saving, onSave, onCancel, error }) {
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

export function Badge({ children, color = 'gray' }) {
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
// Refresh status banner — V3-styled diagnostics panel for the manual refresh
// click. Shows overall verdict, per-endpoint status, expandable failure
// detail with one-click copy so the admin can paste a clean error report.
// ─────────────────────────────────────────────────────────────────────────────

// CopyButton — clipboard with visible feedback. The previous inline buttons
// silently swallowed clipboard failures (`.catch(() => {})`) so the user
// couldn't tell whether the copy worked. This flips label to "Copied" on
// success and "Copy failed" on rejection (~1.5s) before reverting.
export function CopyButton({ text, label = 'Copy', className = '' }) {
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

export function RefreshStatusBanner({ result }) {
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

export function EndpointRow({ name, val }) {
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
export function CensusDiagnosticPanel({ result, onDismiss }) {
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

export function DetailRow({ label, value, ok }) {
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

export function MissionControl({ missionControl, cronRuns }) {
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

      {/* Curation drift row — flags state_programs entries past their
          warn threshold (>30d). The audit identified state_programs.capacity_mw
          as the highest-impact hand-curated value (drives Runway + Feasibility
          Index), so surfacing staleness here forces visibility before users
          see overstated numbers. Hidden when nothing is drifting. */}
      <CurationDriftRow
        drift={missionControl.state_programs_drift || []}
        thresholds={missionControl.state_programs_drift_thresholds || { warn_days: 30, urgent_days: 60 }}
      />

      {/* cs_status accuracy audit — joins curated state_programs.cs_status
          against operational MW from cs_projects (NREL Sharing the Sun).
          Flags states whose curated label doesn't match deployment reality.
          Read-only triage queue; user fixes via the State Programs editor. */}
      <CsStatusAuditRow audit={missionControl.cs_status_audit || null} />

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
export function NwiCoverageCard({ data }) {
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
export function IxFreshnessCard({ freshness }) {
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
export function MonthlyCronCard({ run }) {
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

// ── Curation drift row — surfaces state_programs entries past warn threshold ──
export function CurationDriftRow({ drift, thresholds }) {
  if (!drift || drift.length === 0) return null
  const sevStyle = {
    warn:   { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'WATCH' },
    urgent: { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'STALE' },
  }
  const urgentCount = drift.filter((d) => d.severity === 'urgent').length
  const warnCount   = drift.filter((d) => d.severity === 'warn').length

  return (
    <div className="border-t border-gray-100 px-5 pt-4 pb-3 bg-white">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-amber-800">
            ◆ Curation drift
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            state_programs not refreshed in &gt;{thresholds.warn_days}d
          </span>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
              style={{ background: sevStyle.urgent.bg, color: sevStyle.urgent.dot, border: `1px solid ${sevStyle.urgent.border}` }}
            >
              {urgentCount} stale
            </span>
          )}
          {warnCount > 0 && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
              style={{ background: sevStyle.warn.bg, color: sevStyle.warn.dot, border: `1px solid ${sevStyle.warn.border}` }}
            >
              {warnCount} watch
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
        Hand-curated capacity, LMI %, IX difficulty, and enrollment rate drift over time.{' '}
        State_programs older than {thresholds.warn_days}d turn amber; older than {thresholds.urgent_days}d turn red.
        Active-CS states sort first.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {drift.map((d) => {
          const sty = sevStyle[d.severity] || sevStyle.warn
          const fields = []
          if (!d.has_capacity) fields.push('capacity null')
          if (!d.has_enrollment_rate) fields.push('enrollment null')
          const tooltip = [
            `${d.name} (${d.state_id})`,
            `Last verified: ${new Date(d.latest_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            `Age: ${d.age_days} days`,
            d.cs_status ? `Status: ${d.cs_status}` : null,
            ...fields,
          ].filter(Boolean).join(' · ')
          return (
            <span
              key={d.state_id}
              title={tooltip}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md"
              style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
              <span className="font-bold">{d.state_id}</span>
              <span className="font-normal opacity-70 tabular-nums">{d.age_days}d</span>
              {(!d.has_capacity || !d.has_enrollment_rate) && (
                <span className="font-normal opacity-70">⚠</span>
              )}
            </span>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 leading-snug mt-2">
        Click <span className="font-mono">/admin → State Programs</span> to refresh values. ⚠ flag = capacity_mw or enrollment_rate_mw_per_month is null (silently breaks Runway).
      </p>
    </div>
  )
}

// ── cs_status accuracy audit row — flags states whose curated cs_status
// doesn't match operational MW from cs_projects (NREL Sharing the Sun).
// Read-only triage queue; user fixes via the State Programs editor.
export function CsStatusAuditRow({ audit }) {
  if (!audit || !audit.available || !audit.findings || audit.findings.length === 0) return null

  const flagStyle = {
    DEAD_MARKET:           { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'DEAD' },
    STRONG_MARKET:         { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'STRONG' },
    MISSING_STATUS:        { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'MISSING' },
    MISSING_FROM_CURATION: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'UNCURATED' },
    STALE_MARKET:          { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'STALE' },
  }

  const high = audit.findings.filter((f) => f.severity === 'high')
  const med  = audit.findings.filter((f) => f.severity === 'medium')

  return (
    <div className="border-t border-gray-100 px-5 pt-4 pb-3 bg-white">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-red-800">
            ◆ cs_status accuracy
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            curated label vs operational MW (NREL Sharing the Sun, vintage {audit.latest_vintage})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {high.length > 0 && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.30)' }}>
              {high.length} high
            </span>
          )}
          {med.length > 0 && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.30)' }}>
              {med.length} medium
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
        States flagged where <span className="font-mono">state_programs.cs_status</span> doesn't match operational deployment.
        DEAD = active label, &lt;{audit.thresholds?.dead_mw ?? 5}MW operational.
        STRONG = limited label, &gt;{audit.thresholds?.strong_mw ?? 500}MW operational.
        MISSING = no curated status, &gt;{audit.thresholds?.missing_mw ?? 50}MW operational.
        Hover for evidence; fix via <span className="font-mono">/admin → State Programs</span>.
      </p>
      <div className="space-y-1.5">
        {audit.findings.map((f) => {
          const sty = flagStyle[f.flag] || flagStyle.STALE_MARKET
          return (
            <div
              key={f.state}
              title={`${f.name} (${f.state}) · cs_status='${f.cs_status}' · ${f.total_projects} projects · ${f.total_operational_mw} MW · vintage range latest ${f.latest_install_year || '—'} · curated capacity_mw: ${f.capacity_mw_curated ?? '—'}`}
              className="flex items-center gap-2 text-[11px] flex-wrap"
            >
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md shrink-0"
                style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
                <span className="font-bold">{f.state}</span>
                <span className="font-normal opacity-70">{sty.label}</span>
              </span>
              <span className="font-mono text-[10px] text-gray-500 tabular-nums shrink-0">
                cs_status=<span className="font-semibold">{f.cs_status}</span> · {f.total_projects}p · {f.total_operational_mw} MW
              </span>
              <span className="text-[11px] text-gray-700 leading-snug min-w-0 flex-1">{f.suggestion}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 leading-snug mt-3">
        Source: <span className="font-mono">cs_projects</span> ({audit.cs_projects_count} rows from NREL Sharing the Sun).
        Re-run the audit by re-loading the Data Health page; re-seed via <span className="font-mono">node scripts/seed-cs-projects.mjs</span>.
      </p>
    </div>
  )
}

// ── Small inline KPI for the usage-signals row ──
export function UsageStat({ label, value, color }) {
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

export function IxStalenessAlert() {
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

export function CronLatencyPanel() {
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
  // 2026-05-05 (C1): role-based admin gate via profiles.role (migration 057).
  // Loads the role on mount; defaults to legacy email check while the role
  // value is still loading or if the migration isn't yet applied.
  const [profileRole, setProfileRole] = useState(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  useEffect(() => {
    if (!user) { setRoleLoaded(true); return }
    let cancelled = false
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setProfileRole(data?.role ?? null)
        setRoleLoaded(true)
      })
      .catch(() => { if (!cancelled) setRoleLoaded(true) })
    return () => { cancelled = true }
  }, [user])
  const [tab, setTab] = useState(0)

  // Reset window scroll to top on mount + when switching tabs.
  // React Router doesn't auto-reset scroll on route change, so if user
  // arrived from a scrolled-down page (Profile, Library) they'd land
  // mid-page on Admin -- past the tab headers, which is disorienting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tab])

  if (authLoading || !roleLoaded) {
    return <div className="min-h-screen bg-paper flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  // C1 fix 2026-05-05: role-based admin gate. Allows profiles.role='admin'
  // (migration 057). Legacy email fallback for the rollout window — once
  // role data is verified populated, the email match can be removed.
  const isAdmin = profileRole === 'admin' || (profileRole == null && user?.email === ADMIN_EMAIL)
  if (!user || !isAdmin) {
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
