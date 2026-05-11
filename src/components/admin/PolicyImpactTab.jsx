import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  getPolicyImpactEvents,
  upsertPolicyImpactEvent,
  deletePolicyImpactEvent,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

// ── Policy Impact Events admin tab ──────────────────────────────────────────
// Curates the `policy_impact_events` table (migration 059). Each row is an
// enacted state bill / PUC order / tariff change with admin-curated
// quantified financial impact ($/MW capex, IRR bps, ongoing fees, revenue
// haircut) plus applicability filters (safe-harbor cutoffs, FEOC, MW range).
//
// The Lens API (api/lens-insight.js) reads published rows server-side and
// folds them into the Sonnet 4.6 verdict prompt. Edits here invalidate the
// 6h verdict cache automatically via dataVersionFor() folding the latest
// verified_at into the cache key.
//
// AI-assist quick-add lands in Phase 2 — for now this is fully manual
// curation. Pending-review queue is here from day one for forward
// compatibility with the Phase 3 weekly auto-scan cron.

const EVENT_TYPES   = ['enacted_bill', 'puc_order', 'tariff_change', 'rule_filing', 'executive_order']
const STATUSES      = ['pending', 'enacted', 'partially_effective', 'overturned', 'expired']
const PILLARS       = ['offtake', 'ix', 'site', 'cross-cutting']
const CONFIDENCES   = ['high', 'medium', 'low']
const REVIEW_STATES = ['draft', 'pending_admin_review', 'published', 'rejected']

export default function PolicyImpactTab() {
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [editId, setEditId]             = useState(null)
  const [editData, setEditData]         = useState({})
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState(null)
  const [adding, setAdding]             = useState(false)
  const [filterState, setFilterState]   = useState('')
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  // AI Classify Quick-Add state
  const [classifyText, setClassifyText]     = useState('')
  const [classifyStateHint, setClassifyStateHint] = useState('')
  const [classifyEventHint, setClassifyEventHint] = useState('')
  const [classifying, setClassifying]       = useState(false)
  const [classifyError, setClassifyError]   = useState(null)
  const [classifyHint, setClassifyHint]     = useState(null) // 'cached' | 'fresh' after success

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('policy_impact_events:*')
      const data = await getPolicyImpactEvents({ includeUnpublished: true })
      setItems(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = {
    state: '',
    event_name: '',
    event_type: 'enacted_bill',
    effective_date: '',
    status: 'enacted',
    pillar: 'cross-cutting',
    // Quantified impact (admin-curated; leave null when unknown)
    capex_impact_per_mw_usd: null,
    irr_impact_bps: null,
    ongoing_fee_per_mw_yr_usd: null,
    revenue_haircut_pct: null,
    impact_confidence: 'medium',
    impact_methodology: '',
    // Applicability
    applies_to_new_applications: true,
    applies_to_existing_queue: false,
    applies_to_operating_projects: false,
    safe_harbor_eligible: false,
    safe_harbor_cutoff_date: '',
    safe_harbor_notes: '',
    feoc_compliance_required: false,
    feoc_notes: '',
    min_mw_ac: null,
    max_mw_ac: null,
    // applicable_technologies / applicable_stages: comma-separated text in
    // the form, normalized to text[] on save. UI hint shows accepted values.
    applicable_technologies_text: '',
    applicable_stages_text: '',
    // Sourcing
    summary: '',
    analyst_note: '',
    source_url: '',
    review_status: 'published',
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
      id:                              item.id,
      state:                           item.state,
      event_name:                      item.eventName,
      event_type:                      item.eventType,
      effective_date:                  item.effectiveDate || '',
      status:                          item.status,
      pillar:                          item.pillar,
      capex_impact_per_mw_usd:         item.capexImpactPerMwUsd,
      irr_impact_bps:                  item.irrImpactBps,
      ongoing_fee_per_mw_yr_usd:       item.ongoingFeePerMwYrUsd,
      revenue_haircut_pct:             item.revenueHaircutPct,
      impact_confidence:               item.impactConfidence || 'medium',
      impact_methodology:              item.impactMethodology || '',
      applies_to_new_applications:     !!item.appliesToNewApplications,
      applies_to_existing_queue:       !!item.appliesToExistingQueue,
      applies_to_operating_projects:   !!item.appliesToOperatingProjects,
      safe_harbor_eligible:            !!item.safeHarborEligible,
      safe_harbor_cutoff_date:         item.safeHarborCutoffDate || '',
      safe_harbor_notes:               item.safeHarborNotes || '',
      feoc_compliance_required:        !!item.feocComplianceRequired,
      feoc_notes:                      item.feocNotes || '',
      min_mw_ac:                       item.minMwAc,
      max_mw_ac:                       item.maxMwAc,
      applicable_technologies_text:    Array.isArray(item.applicableTechnologies) ? item.applicableTechnologies.join(', ') : '',
      applicable_stages_text:          Array.isArray(item.applicableStages) ? item.applicableStages.join(', ') : '',
      summary:                         item.summary,
      analyst_note:                    item.analystNote || '',
      source_url:                      item.sourceUrl,
      review_status:                   item.reviewStatus,
    })
    setAdding(false)
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Normalize empty date strings → null, comma-split text arrays.
      const parseList = (s) => {
        if (!s) return null
        const arr = String(s).split(',').map(x => x.trim()).filter(Boolean)
        return arr.length > 0 ? arr : null
      }
      const payload = {
        state:                          (editData.state || '').toUpperCase(),
        event_name:                     editData.event_name,
        event_type:                     editData.event_type,
        effective_date:                 editData.effective_date         || null,
        status:                         editData.status,
        pillar:                         editData.pillar,
        capex_impact_per_mw_usd:        editData.capex_impact_per_mw_usd,
        irr_impact_bps:                 editData.irr_impact_bps,
        ongoing_fee_per_mw_yr_usd:      editData.ongoing_fee_per_mw_yr_usd,
        revenue_haircut_pct:            editData.revenue_haircut_pct,
        impact_confidence:              editData.impact_confidence,
        impact_methodology:             editData.impact_methodology     || null,
        applies_to_new_applications:    !!editData.applies_to_new_applications,
        applies_to_existing_queue:      !!editData.applies_to_existing_queue,
        applies_to_operating_projects:  !!editData.applies_to_operating_projects,
        safe_harbor_eligible:           !!editData.safe_harbor_eligible,
        safe_harbor_cutoff_date:        editData.safe_harbor_cutoff_date || null,
        safe_harbor_notes:              editData.safe_harbor_notes      || null,
        feoc_compliance_required:       !!editData.feoc_compliance_required,
        feoc_notes:                     editData.feoc_notes             || null,
        min_mw_ac:                      editData.min_mw_ac,
        max_mw_ac:                      editData.max_mw_ac,
        applicable_technologies:        parseList(editData.applicable_technologies_text),
        applicable_stages:              parseList(editData.applicable_stages_text),
        summary:                        editData.summary,
        analyst_note:                   editData.analyst_note           || null,
        source_url:                     editData.source_url,
        review_status:                  editData.review_status,
        is_active:                      true,
      }
      if (editId) payload.id = editId
      await upsertPolicyImpactEvent(payload)
      setEditId(null)
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Remove this policy event from the active feed? (Soft-deactivates; not destructive.)')) return
    try {
      await deletePolicyImpactEvent(id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // AI Classify — paste bill / article text, Haiku 4.5 extracts the
  // qualitative structured fields and pre-fills the edit form. Dollar/IRR
  // fields are deliberately left null — admin curates from primary sources.
  const handleClassify = async () => {
    if (!classifyText || classifyText.trim().length < 60) {
      setClassifyError('Paste at least 60 characters of bill text / article content.')
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          action:        'policy-classify',
          rawText:       classifyText,
          stateHint:     classifyStateHint.trim() || null,
          eventNameHint: classifyEventHint.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setClassifyError(json?.error || `HTTP ${res.status}`)
        setClassifying(false)
        return
      }
      if (!json?.draft) {
        setClassifyError(json?.reason || 'Classification failed — try again or fall back to manual add.')
        setClassifying(false)
        return
      }
      const d = json.draft
      // Pre-fill the edit form. Admin reviews + edits + publishes. The four
      // impact-number fields are intentionally null — admin fills those.
      setEditData({
        state:                          (d.state || classifyStateHint || '').toUpperCase(),
        event_name:                     d.event_name || classifyEventHint || '',
        event_type:                     d.event_type || 'enacted_bill',
        effective_date:                 d.effective_date || '',
        status:                         d.status || 'enacted',
        pillar:                         d.pillar || 'cross-cutting',
        capex_impact_per_mw_usd:        null,
        irr_impact_bps:                 null,
        ongoing_fee_per_mw_yr_usd:      null,
        revenue_haircut_pct:            null,
        impact_confidence:              d.impact_confidence || 'medium',
        impact_methodology:             d.impact_methodology || '',
        applies_to_new_applications:    !!d.applies_to_new_applications,
        applies_to_existing_queue:      !!d.applies_to_existing_queue,
        applies_to_operating_projects:  !!d.applies_to_operating_projects,
        safe_harbor_eligible:           !!d.safe_harbor_eligible,
        safe_harbor_cutoff_date:        d.safe_harbor_cutoff_date || '',
        safe_harbor_notes:              d.safe_harbor_notes || '',
        feoc_compliance_required:       !!d.feoc_compliance_required,
        feoc_notes:                     d.feoc_notes || '',
        min_mw_ac:                      null,
        max_mw_ac:                      null,
        applicable_technologies_text:   '',
        applicable_stages_text:         '',
        summary:                        d.summary || '',
        analyst_note:                   d.analyst_note || '',
        source_url:                     d.source_url || '',
        // AI drafts land in the review queue, not published.
        review_status:                  'pending_admin_review',
      })
      setAdding(true)
      setEditId(null)
      setClassifyText('')
      setClassifyStateHint('')
      setClassifyEventHint('')
      setClassifyHint(json.cached ? 'cached' : 'fresh')
    } catch (e) {
      setClassifyError(`Network error: ${e.message}`)
    }
    setClassifying(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading policy events...</p>

  const isFormOpen = editId || adding

  const visible = items.filter(i => {
    if (filterState && i.state?.toUpperCase() !== filterState.toUpperCase()) return false
    if (showPendingOnly && i.reviewStatus !== 'pending_admin_review') return false
    return true
  })
  const pendingCount = items.filter(i => i.reviewStatus === 'pending_admin_review').length

  return (
    <div>
      {/* Curation cadence banner */}
      <div className="rounded-lg px-4 py-3 mb-5" style={{ background: '#FAFAF7', borderLeft: '3px solid #14B8A6', border: '1px solid #E2E8F0' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700 mb-1">
          ◆ Curation cadence
        </p>
        <p className="text-[12px] text-ink leading-relaxed">
          Track only ENACTED policies with material project impact — $/MW capex, IRR basis points, ongoing fees, revenue haircut. Cite the bill text or PUC order URL; quantified dollar/IRR numbers come from your own analyst research (never AI). Aim for 1-3 events per active state per year. Lens automatically threads these into the analyst brief for the relevant state.
        </p>
      </div>

      {/* AI Classify — Quick Add. Paste bill / article text, Haiku 4.5
          extracts the qualitative fields (type, pillar, applicability,
          safe-harbor, FEOC) and pre-fills the form. Dollar / IRR fields
          stay null — admin curates those from primary sources. */}
      <div
        className="rounded-xl mb-5 px-5 py-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#5EEAD4' }}>
              ◆ AI Classify · Quick Add
            </p>
            <p className="font-serif text-[15px] font-semibold text-white tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              Paste bill text — Tractova drafts the qualitative fields
            </p>
          </div>
          {classifyHint && (
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,184,166,0.18)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.32)' }}>
              {classifyHint === 'cached' ? '✓ cached · free' : '✓ drafted'}
            </span>
          )}
        </div>
        <p id="policy-classify-helper" className="text-[12px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Paste bill text or a trade-press article. Haiku extracts state, event type, pillar, applicability flags, safe-harbor + FEOC signals, and writes a draft analyst note. <strong style={{ color: '#FCA5A5' }}>Dollar / IRR fields are left null on purpose</strong> — you research and fill those in from primary sources before publishing.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <input
            type="text"
            value={classifyStateHint}
            onChange={(e) => setClassifyStateHint(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="State hint (e.g. ME) — optional"
            className="text-[11px] font-mono px-3 py-2 rounded-lg outline-hidden focus:ring-2 focus:ring-teal-500/40 uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFFFFF' }}
          />
          <input
            type="text"
            value={classifyEventHint}
            onChange={(e) => setClassifyEventHint(e.target.value)}
            placeholder="Event name hint (e.g. LD 1777) — optional"
            className="text-[11px] font-mono px-3 py-2 rounded-lg outline-hidden focus:ring-2 focus:ring-teal-500/40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFFFFF' }}
          />
        </div>
        <textarea
          value={classifyText}
          onChange={(e) => setClassifyText(e.target.value)}
          placeholder="Paste bill text, signed-bill summary, PUC order, or trade-press article describing the enacted policy. Min 60 characters."
          rows={6}
          aria-label="Paste bill / article text for AI classification"
          aria-describedby="policy-classify-helper"
          className="w-full text-[12px] font-mono px-3 py-2.5 rounded-lg outline-hidden resize-y mb-3 focus:ring-2 focus:ring-teal-500/40"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border:     '1px solid rgba(255,255,255,0.10)',
            color:      '#FFFFFF',
          }}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.42)' }}>
            ~$0.01/draft · cached 24h · drafts land in pending-review queue
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
                  Drafting…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/>
                  </svg>
                  Draft with AI
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

      {/* Filter row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{visible.length} of {items.length} events</span>
          <input
            type="text"
            placeholder="Filter by state (e.g. ME)"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value.toUpperCase())}
            className="text-xs px-2.5 py-1.5 rounded-sm border border-gray-200 bg-white font-mono uppercase tracking-wider w-40"
          />
          <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPendingOnly}
              onChange={(e) => setShowPendingOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Pending review only
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-full bg-amber-100 text-amber-800">{pendingCount}</span>
            )}
          </label>
        </div>
        <button onClick={startAdd} className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors">+ Add manually</button>
      </div>

      {/* Edit / Add form */}
      {isFormOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {adding ? 'New policy event' : `Editing: ${editData.event_name || editData.state}`}
          </p>

          {/* Identity */}
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-teal-700 mb-3">◆ Identity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="State (2-letter)" value={editData.state} field="state" onChange={handleChange} />
            <Field label="Event Name (e.g. LD 1777)" value={editData.event_name} field="event_name" onChange={handleChange} />
            <Field label="Event Type" value={editData.event_type} field="event_type" onChange={handleChange} options={EVENT_TYPES} />
            <Field label="Status" value={editData.status} field="status" onChange={handleChange} options={STATUSES} />
            <Field label="Pillar" value={editData.pillar} field="pillar" onChange={handleChange} options={PILLARS} />
            <Field label="Effective Date" value={editData.effective_date} field="effective_date" onChange={handleChange} type="date" />
            <Field label="Source URL (bill text / PUC order)" value={editData.source_url} field="source_url" onChange={handleChange} type="url" className="md:col-span-2" />
            <Field label="Summary (1-2 sentence why developers care)" value={editData.summary} field="summary" onChange={handleChange} type="textarea" className="md:col-span-2" />
            <Field label="Analyst note (longer rationale + caveats)" value={editData.analyst_note} field="analyst_note" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>

          {/* Quantified impact */}
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-teal-700 mb-3">◆ Quantified impact (admin-curated · leave blank when unknown)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="Capex Impact ($/MW · signed: + = cost, − = savings)" value={editData.capex_impact_per_mw_usd} field="capex_impact_per_mw_usd" onChange={handleChange} type="number" />
            <Field label="IRR Impact (basis points · signed)" value={editData.irr_impact_bps} field="irr_impact_bps" onChange={handleChange} type="number" />
            <Field label="Ongoing fee ($/MW/yr)" value={editData.ongoing_fee_per_mw_yr_usd} field="ongoing_fee_per_mw_yr_usd" onChange={handleChange} type="number" />
            <Field label="Revenue haircut (%)" value={editData.revenue_haircut_pct} field="revenue_haircut_pct" onChange={handleChange} type="number" />
            <Field label="Impact confidence" value={editData.impact_confidence} field="impact_confidence" onChange={handleChange} options={CONFIDENCES} />
            <Field label="Impact methodology (how the numbers were derived)" value={editData.impact_methodology} field="impact_methodology" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>

          {/* Applicability */}
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-teal-700 mb-3">◆ Applicability</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <Field label="Applies to new applications" value={editData.applies_to_new_applications} field="applies_to_new_applications" onChange={handleChange} type="boolean" />
            <Field label="Applies to projects in queue" value={editData.applies_to_existing_queue} field="applies_to_existing_queue" onChange={handleChange} type="boolean" />
            <Field label="Applies to operating projects" value={editData.applies_to_operating_projects} field="applies_to_operating_projects" onChange={handleChange} type="boolean" />
            <Field label="Min MW AC (leave blank = all sizes)" value={editData.min_mw_ac} field="min_mw_ac" onChange={handleChange} type="number" />
            <Field label="Max MW AC (leave blank = all sizes)" value={editData.max_mw_ac} field="max_mw_ac" onChange={handleChange} type="number" />
            <Field label="Applicable technologies (comma-sep, e.g. Community Solar, Hybrid)" value={editData.applicable_technologies_text} field="applicable_technologies_text" onChange={handleChange} className="md:col-span-3" />
            <Field label="Applicable stages (comma-sep, e.g. Site Control, Development)" value={editData.applicable_stages_text} field="applicable_stages_text" onChange={handleChange} className="md:col-span-3" />
          </div>

          {/* Safe harbor + FEOC */}
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-teal-700 mb-3">◆ Safe harbor / FEOC</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="Safe harbor available" value={editData.safe_harbor_eligible} field="safe_harbor_eligible" onChange={handleChange} type="boolean" />
            <Field label="Safe-harbor cutoff date" value={editData.safe_harbor_cutoff_date} field="safe_harbor_cutoff_date" onChange={handleChange} type="date" />
            <Field label="Safe-harbor notes (gate: COD / IS / spend / other)" value={editData.safe_harbor_notes} field="safe_harbor_notes" onChange={handleChange} type="textarea" className="md:col-span-2" />
            <Field label="FEOC compliance required" value={editData.feoc_compliance_required} field="feoc_compliance_required" onChange={handleChange} type="boolean" />
            <Field label="FEOC notes (material-sourcing implications)" value={editData.feoc_notes} field="feoc_notes" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>

          {/* Review status (publishing gate) */}
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-teal-700 mb-3">◆ Publishing</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Review status" value={editData.review_status} field="review_status" onChange={handleChange} options={REVIEW_STATES} />
            <p className="text-[11px] text-gray-500 self-end pb-2 leading-relaxed">
              Only <code>published</code> rows surface to Lens. Use <code>draft</code> while researching numbers; <code>pending_admin_review</code> is the AI-assist staging area; <code>rejected</code> keeps a paper trail of why a discovered candidate didn't make the cut.
            </p>
          </div>

          <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
            <Button variant="accent" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : adding ? 'Add event' : 'Save changes'}
            </Button>
            <Button variant="link" onClick={() => { setEditId(null); setAdding(false) }} disabled={saving}>Cancel</Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 italic py-6 text-center">
            {showPendingOnly ? 'No drafts awaiting review.' : 'No policy events match. Add one to populate the Lens context.'}
          </p>
        )}
        {visible.map(item => {
          const impactBits = [
            item.capexImpactPerMwUsd != null   && `capex ${item.capexImpactPerMwUsd > 0 ? '+' : '−'}$${Math.abs(item.capexImpactPerMwUsd).toLocaleString()}/MW`,
            item.irrImpactBps != null          && `IRR ${item.irrImpactBps > 0 ? '+' : '−'}${Math.abs(item.irrImpactBps)}bps`,
            item.ongoingFeePerMwYrUsd != null  && `$${item.ongoingFeePerMwYrUsd.toLocaleString()}/MW/yr`,
            item.revenueHaircutPct != null     && `rev ${item.revenueHaircutPct > 0 ? '−' : '+'}${Math.abs(item.revenueHaircutPct)}%`,
          ].filter(Boolean).join(' · ')
          return (
            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 font-medium truncate">{item.eventName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge>{item.state}</Badge>
                  <Badge color={item.reviewStatus === 'published' ? 'green' : item.reviewStatus === 'pending_admin_review' ? 'yellow' : 'gray'}>{item.reviewStatus}</Badge>
                  <Badge color={item.status === 'enacted' ? 'green' : item.status === 'pending' ? 'yellow' : 'gray'}>{item.status}</Badge>
                  <Badge>{item.pillar}</Badge>
                  <Badge color={item.impactConfidence === 'high' ? 'green' : item.impactConfidence === 'medium' ? 'yellow' : 'gray'}>conf: {item.impactConfidence || '—'}</Badge>
                  {item.safeHarborEligible && <Badge color="blue">safe harbor</Badge>}
                  {item.feocComplianceRequired && <Badge color="red">FEOC</Badge>}
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-mono tabular-nums truncate">
                  {item.eventType} · {item.effectiveDate || 'no date'} · {impactBits || 'no quantified impact'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
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
