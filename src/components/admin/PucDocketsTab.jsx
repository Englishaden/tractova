import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  getPucDockets,
  upsertPucDocket,
  deletePucDocket,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

export default function PucDocketsTab() {
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
  const [classifyHint, setClassifyHint]   = useState(null)  // 'cached' | 'fresh' after success
  const [classifyFetchedUrl, setClassifyFetchedUrl] = useState(null)
  const [autoPublish, setAutoPublish]   = useState(true)
  const [rescanningId, setRescanningId] = useState(null)

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

  // Shared classifier call — used by Quick-Add AND Re-scan.
  const callClassifyDocket = async (rawText) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Sign-in required')
    const res = await fetch('/api/lens-insight', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ action: 'classify-docket', rawText }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
    if (!json?.classification) throw new Error(json?.reason || 'Classification failed.')
    return json
  }

  const buildPayloadFromClassification = (c, opts = {}) => ({
    state:            (c.state || opts.fallbackState || '').toUpperCase(),
    puc_name:         c.puc_name || '',
    docket_number:    c.docket_number || opts.fallbackDocket || '',
    title:            c.title || '',
    status:           c.status || 'filed',
    pillar:           c.pillar || 'offtake',
    impact_tier:      c.impact_tier || 'medium',
    filed_date:       c.filed_date       || null,
    comment_deadline: c.comment_deadline || null,
    decision_target:  c.decision_target  || null,
    summary:          c.summary || '',
    source_url:       c.source_url || opts.fallbackSourceUrl || null,
    is_active:        true,
  })

  // AI Classify — paste docket URL or page contents. URL-first auto-
  // publish flow: when autoPublish is on, classify + upsert published row
  // in one click. Off → pre-fills the form for review.
  const handleClassify = async () => {
    if (!classifyText || classifyText.trim().length < 5) {
      setClassifyError('Paste a URL or at least 40 characters of docket page content.')
      return
    }
    setClassifying(true)
    setClassifyError(null)
    setClassifyHint(null)
    try {
      const json = await callClassifyDocket(classifyText)
      const c = json.classification

      if (autoPublish) {
        const fallbackSourceUrl = /^https?:\/\//i.test(classifyText.trim())
          ? classifyText.trim().split(/\s/)[0]
          : ''
        const payload = buildPayloadFromClassification(c, { fallbackSourceUrl })
        if (!payload.state || !payload.docket_number) {
          setClassifyError('Draft missing state or docket number — switch off auto-publish and review manually.')
          setClassifying(false)
          return
        }
        await upsertPucDocket(payload)
        setClassifyText('')
        setClassifyHint(json.cached ? 'cached' : 'fresh')
        setClassifyFetchedUrl(json.fetchedUrl || null)
        await load()
        setClassifying(false)
        return
      }

      // Manual-review path: pre-fill the form.
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
      setClassifyFetchedUrl(json.fetchedUrl || null)
    } catch (e) {
      setClassifyError(e.message || 'Classification failed')
    }
    setClassifying(false)
  }

  // Re-scan an existing docket's source URL — detects status updates
  // (comment closed, decision issued) by re-running classify against the
  // original URL. Overwrites the row in place.
  const handleRescan = async (item) => {
    if (!item.sourceUrl || !/^https?:\/\//i.test(item.sourceUrl)) {
      window.alert(`Re-scan requires a valid source URL. This row has: ${item.sourceUrl || '(none)'}`)
      return
    }
    if (!window.confirm(`Re-scan ${item.docketNumber}?\n\nFetches ${item.sourceUrl} and re-classifies. Existing row will be overwritten.`)) return
    setRescanningId(item.id)
    try {
      const json = await callClassifyDocket(item.sourceUrl)
      const payload = buildPayloadFromClassification(json.classification, {
        fallbackState:      item.state,
        fallbackDocket:     item.docketNumber,
        fallbackSourceUrl:  item.sourceUrl,
      })
      payload.id = item.id
      await upsertPucDocket(payload)
      await load()
    } catch (e) {
      window.alert(`Re-scan failed: ${e.message}`)
    }
    setRescanningId(null)
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
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {classifyFetchedUrl && (
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(20,184,166,0.10)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.22)' }}>
                  ◆ url fetched
                </span>
              )}
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(20,184,166,0.18)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.32)' }}>
                {classifyHint === 'cached' ? '✓ cached · free' : '✓ classified'}
              </span>
            </div>
          )}
        </div>
        <p id="classify-helper" className="text-[12px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Paste a URL <strong style={{ color: '#5EEAD4' }}>or</strong> the docket page contents directly. URL input is auto-fetched server-side. AI extracts state, docket number, status, pillar, impact tier, dates, and a Tractova analyst summary.
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
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="h-3.5 w-3.5 accent-teal-500"
            />
            Publish immediately (skip review)
          </label>
          <div className="flex items-center gap-2">
            {classifyText && (
              <button
                onClick={() => { setClassifyText(''); setClassifyError(null); setClassifyHint(null); setClassifyFetchedUrl(null) }}
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
                  {autoPublish ? 'Classifying + Publishing…' : 'Classifying…'}
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/>
                  </svg>
                  {autoPublish ? 'Fetch + Publish' : 'Classify for review'}
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
        {visible.map(item => {
          // Staleness based on last_updated. PUC dockets DO go stale fast —
          // comment deadlines pass, decisions issue, etc. Tighter thresholds
          // than policy events (30/90/180 vs 90/180/never-quiet).
          const updatedTs  = item.lastUpdated ? new Date(item.lastUpdated).getTime() : null
          const filedTs    = item.filedDate ? new Date(item.filedDate).getTime() : null
          const latestTs   = Math.max(updatedTs || 0, filedTs || 0) || null
          const daysSince  = latestTs ? Math.floor((Date.now() - latestTs) / 86_400_000) : null
          let staleChip = null
          if (item.status === 'closed') { /* closed dockets aren't "stale", they're done */ }
          else if (daysSince == null)   staleChip = { color: 'gray',   label: 'unverified' }
          else if (daysSince >= 180)    staleChip = { color: 'red',    label: `stale (${daysSince}d)` }
          else if (daysSince >= 90)     staleChip = { color: 'yellow', label: `aging (${daysSince}d)` }
          const isRescanning = rescanningId === item.id
          return (
            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge>{item.state}</Badge>
                  <Badge color={item.status === 'comment_open' ? 'green' : item.status === 'pending_decision' ? 'yellow' : 'blue'}>{item.status}</Badge>
                  <Badge color={item.impactTier === 'high' ? 'red' : item.impactTier === 'medium' ? 'yellow' : 'gray'}>{item.impactTier}</Badge>
                  <Badge>{item.pillar}</Badge>
                  {staleChip && <Badge color={staleChip.color}>◆ {staleChip.label}</Badge>}
                  <span className="text-[10px] text-gray-400 truncate">{item.pucName} · {item.docketNumber}</span>
                </div>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-700 hover:underline truncate block mt-0.5">
                    {item.sourceUrl.length > 80 ? item.sourceUrl.slice(0, 80) + '…' : item.sourceUrl}
                  </a>
                )}
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && (
                  <button
                    onClick={() => handleRescan(item)}
                    disabled={isRescanning}
                    className="text-xs text-teal-700 hover:text-teal-900 transition-colors disabled:opacity-50"
                    title="Re-fetch source URL + reclassify. Use when a docket status changes (comment closed, decision issued)."
                  >
                    {isRescanning ? 'Re-scanning…' : '↻ Re-scan'}
                  </button>
                )}
                <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-teal-700 transition-colors">Edit</button>
                <button onClick={() => handleDeactivate(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
