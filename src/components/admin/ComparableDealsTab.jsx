import { useState, useEffect, useCallback } from 'react'
import {
  getComparableDeals, upsertComparableDeal, deleteComparableDeal,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

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

export default function ComparableDealsTab() {
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
