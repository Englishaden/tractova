import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { useCompare } from '../context/CompareContext'
import { supabase } from '../lib/supabase'
import { getStateProgram, getCountyData } from '../lib/programData'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { IX_LABEL } from '../lib/statusMaps.js'
import { saveComparison, loadSavedComparison } from '../lib/savedComparisons'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/Dialog'
import GlossaryLabel from './ui/GlossaryLabel'
import { useToast } from './ui/Toast'
import TractovaLoader from './ui/TractovaLoader'

// CS_LABEL is local — uses 'None' for compare-tray brevity; the canonical
// CS_STATUS_LABEL in statusMaps.js uses 'Closed' for chip labels.
const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }

const CS_CLS = {
  active:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  limited: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  pending: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/25',
  none:    'text-white/30 bg-white/5 border-white/10',
}
const IX_CLS = {
  easy:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  moderate:  'text-amber-400 bg-amber-400/10 border-amber-400/25',
  hard:      'text-orange-400 bg-orange-400/10 border-orange-400/25',
  very_hard: 'text-red-400 bg-red-400/10 border-red-400/25',
}

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-white/25 italic font-mono">—</span>
  const pct = Math.max(0, Math.min(100, score))
  let barColor = '#34D399'
  if (pct < 25) barColor = '#ef4444'
  else if (pct < 40) barColor = '#f59e0b'
  else if (pct < 55) barColor = '#d97706'
  else if (pct < 75) barColor = '#6ee7b7'

  return (
    <div>
      <div className="flex items-end gap-1 mb-1.5">
        <span className="text-2xl font-bold font-mono" style={{ color: barColor }}>{pct}</span>
        <span className="text-xs text-white/30 font-mono mb-0.5">/ 100</span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function MetricRow({ label, term, values }) {
  return (
    <div className="grid gap-4 border-b" style={{ gridTemplateColumns: `148px repeat(${values.length}, 1fr)`, borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/30 py-3 pr-2 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {term
          ? <GlossaryLabel term={term} displayAs={label} />
          : label}
      </span>
      {values.map((val, i) => (
        <div key={i} className="py-3 px-1">{val}</div>
      ))}
    </div>
  )
}

function CompareModal({ onClose }) {
  const { items, remove, clear } = useCompare()
  const toast = useToast()
  const [aiCompare, setAiCompare] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState(null)
  // AI panel collapses by default so the comparison row table gets the
  // primary screen real estate. User opens via the eyebrow button.
  const [aiOpen,    setAiOpen]    = useState(false)
  // Phase 2C: save / export state
  const [saveOpen,     setSaveOpen]     = useState(false)
  const [saveName,     setSaveName]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)

  // 2026-05-05 (C5): re-fetch fresh state/county data + recompute sub-scores
  // on modal open. Compare items capture data at add-time; if a state's
  // cs_status / capacity_mw / IX difficulty drifts between add and compare,
  // the modal would otherwise show stale scores that diverge from live
  // project cards. `refreshed` stores the recomputed sub-score per item,
  // keyed by item.id; deltas surface in the comparison rows.
  const [refreshed, setRefreshed]   = useState({})
  const [refreshTs, setRefreshTs]   = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (items.length === 0) return
    let cancelled = false
    setRefreshing(true)
    Promise.all(items.map(async (it) => {
      try {
        const [sp, cd] = await Promise.all([
          getStateProgram(it.state).catch(() => null),
          it.county ? getCountyData(it.state, it.county).catch(() => null) : null,
        ])
        if (!sp) return [it.id, null]
        const sub = computeSubScores(sp, cd, it.stage, it.technology)
        const score = safeScore(sub.offtake, sub.ix, sub.site)
        return [it.id, {
          subOfftake: sub.offtake, subIx: sub.ix, subSite: sub.site,
          score, csStatus: sp.csStatus, capacityMW: sp.capacityMW,
          ixDifficulty: sp.ixDifficulty,
        }]
      } catch {
        return [it.id, null]
      }
    })).then(entries => {
      if (cancelled) return
      const map = {}
      for (const [id, val] of entries) if (val) map[id] = val
      setRefreshed(map)
      setRefreshTs(new Date())
      setRefreshing(false)
    })
    return () => { cancelled = true }
  }, [items.length])

  // Helper: surface a delta badge when an item's stored score and refreshed
  // score diverge by >2 pts. Returns null when scores match (no badge).
  function scoreDelta(item) {
    const r = refreshed[item.id]
    if (!r || r.score == null || item.feasibilityScore == null) return null
    const delta = r.score - item.feasibilityScore
    if (Math.abs(delta) <= 2) return null
    return delta
  }

  useEffect(() => {
    if (items.length < 2) return
    let cancelled = false
    setAiLoading(true)
    setAiError(null)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      fetch('/api/lens-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'compare',
          projects: items.map(it => ({
            id: it.id, name: it.name, state: it.stateName || it.state,
            county: it.county, mw: it.mw, stage: it.stage,
            technology: it.technology, feasibilityScore: it.feasibilityScore,
            ixDifficulty: it.ixDifficulty, csStatus: it.csStatus
          }))
        })
      })
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(data => {
          if (cancelled) return
          if (data?.comparison) setAiCompare(data)
          else setAiError('AI comparison returned no result.')
        })
        .catch(err => {
          if (!cancelled) setAiError(err?.message || 'AI comparison unavailable.')
        })
        .finally(() => { if (!cancelled) setAiLoading(false) })
    })
    return () => { cancelled = true }
  }, [items.length])

  // V3.1: rows reorganized into "Composite + Pillars" / "Project" / "Source"
  // sections. New rows surface CS capacity (program runway) and LMI carveout
  // (subscriber-sourcing complexity) -- both decision-critical signals that
  // were previously missing from the compare view.
  const fmtCap = (mw) => mw == null ? '—' : mw >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`
  const fmtSubScore = (v) => {
    if (v == null) return <span className="text-xs text-white/25 font-mono">—</span>
    const tone = v >= 70 ? 'text-emerald-300' : v >= 50 ? 'text-amber-300' : 'text-orange-300'
    return <span className={`text-xs font-mono font-semibold tabular-nums ${tone}`}>{Math.round(v)}<span className="text-white/35 ml-0.5 text-[10px]">/100</span></span>
  }
  const fmtPct = (v) => {
    if (v == null) return <span className="text-xs text-white/25 font-mono">—</span>
    return <span className="text-xs font-mono text-white/65 tabular-nums">{v < 1 ? v.toFixed(1) : Math.round(v)}%</span>
  }
  // Wetland % cap-at-100 — NWI polygons overlap, raw sums can exceed 100.
  const fmtWetlandPct = (v) => {
    if (v == null) return <span className="text-xs text-white/25 font-mono">—</span>
    const capped = Math.min(100, v)
    const overflow = v > 100
    const display = capped < 1 ? capped.toFixed(1) : Math.round(capped)
    return <span className="text-xs font-mono text-white/65 tabular-nums">{display}%{overflow ? '+' : ''}</span>
  }
  // Phase 5 — `term` references a key in src/lib/glossaryDefinitions.js. When
  // present, MetricRow wraps the label in GlossaryLabel so hovering shows
  // the canonical definition + Tractova data inputs. Rows without a glossary
  // entry stay as plain labels.
  const rows = [
    {
      label: 'Feasibility Index',
      term: 'Feasibility Index',
      section: 'COMPOSITE',
      render: (item) => {
        const delta = scoreDelta(item)
        const r = refreshed[item.id]
        // When refresh-time score differs from add-time stored score by
        // >2 pts, surface the delta inline so the user sees the drift.
        // Use refreshed score as the visible value (more accurate).
        const displayScore = r?.score != null ? r.score : item.feasibilityScore
        return (
          <div>
            <ScoreBar score={displayScore} />
            {delta != null && (
              <div
                className="mt-1 text-[9px] font-mono uppercase tracking-widest"
                style={{ color: delta > 0 ? '#34D399' : '#FBBF24' }}
                title={`At add-time: ${item.feasibilityScore}. Recomputed against current state/county data: ${r.score}. Delta of ${delta > 0 ? '+' : ''}${delta} pts since added — state program data may have drifted.`}
              >
                {delta > 0 ? '↑ +' : '↓ '}{delta} pt vs at-add
              </div>
            )}
          </div>
        )
      },
    },
    {
      label: 'Offtake sub-score',
      term:  'Offtake',
      section: 'COMPOSITE',
      render: (item) => fmtSubScore(item.subOfftake),
    },
    {
      label: 'Interconnection sub-score',
      term:  'IX',
      section: 'COMPOSITE',
      render: (item) => fmtSubScore(item.subIx),
    },
    {
      label: 'Site Control sub-score',
      term:  'Site Control',
      section: 'COMPOSITE',
      render: (item) => fmtSubScore(item.subSite),
    },
    {
      label: 'CS Program Status',
      section: 'COMPOSITE',
      render: (item) => (
        item.csStatus
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-sm border ${CS_CLS[item.csStatus] || CS_CLS.none}`}>
              {CS_LABEL[item.csStatus] || item.csStatus}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'CS Program',
      section: 'COMPOSITE',
      render: (item) => <span className="text-xs text-white/65">{item.csProgram || '—'}</span>,
    },
    {
      label: 'Program Capacity',
      section: 'COMPOSITE',
      render: (item) => (
        <span className="text-xs font-mono text-white/65">
          {item.capacityMW != null
            ? <><span className="text-white/85 font-semibold">{fmtCap(item.capacityMW)}</span><span className="text-white/35 ml-1">remaining</span></>
            : '—'}
        </span>
      ),
    },
    {
      label: 'IX Difficulty',
      section: 'COMPOSITE',
      render: (item) => (
        item.ixDifficulty
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-sm border ${IX_CLS[item.ixDifficulty] || ''}`}>
              {IX_LABEL[item.ixDifficulty] || item.ixDifficulty}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'LMI Carveout',
      term:  'LMI Carveout',
      section: 'COMPOSITE',
      render: (item) => {
        if (item.lmiRequired === false || item.lmiPercent === 0) {
          return <span className="text-[10px] font-mono text-emerald-300/85">Not required</span>
        }
        if (item.lmiRequired && item.lmiPercent > 0) {
          const tone = item.lmiPercent >= 50 ? 'text-orange-300' : item.lmiPercent >= 30 ? 'text-amber-300' : 'text-yellow-300'
          return (
            <span className={`text-xs font-mono ${tone}`}>
              <span className="font-semibold">{item.lmiPercent}%</span><span className="text-white/35 ml-1">required</span>
            </span>
          )
        }
        return <span className="text-xs text-white/25 font-mono">—</span>
      },
    },
    {
      label: 'Wetland-richness index',
      term:  'Wetland Warning',
      section: 'COMPOSITE',
      render: (item) => fmtWetlandPct(item.wetlandPct),
    },
    {
      label: 'Prime farmland',
      term:  'Prime Farmland',
      section: 'COMPOSITE',
      render: (item) => fmtPct(item.farmlandPct),
    },
    {
      label: 'Project Size',
      section: 'PROJECT',
      render: (item) => <span className="text-xs font-mono text-white/65">{item.mw ? `${item.mw} MW AC` : '—'}</span>,
    },
    {
      label: 'Technology',
      section: 'PROJECT',
      render: (item) => <span className="text-xs text-white/65">{item.technology || '—'}</span>,
    },
    {
      label: 'Stage',
      section: 'PROJECT',
      render: (item) => <span className="text-xs text-white/65">{item.stage || '—'}</span>,
    },
    {
      label: 'Source',
      section: 'PROJECT',
      render: (item) => (
        <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${
          item.source === 'library'
            ? 'text-violet-400 bg-violet-400/10 border-violet-400/25'
            : 'text-sky-400 bg-sky-400/10 border-sky-400/25'
        }`}>
          {item.source === 'library'
            ? `Saved ${new Date(item.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`
            : 'Live (Lens)'}
        </span>
      ),
    },
  ]

  // Auto-generated "Best for" summary
  const bestFor = (() => {
    if (items.length < 2) return null
    const IX_RANK = { easy: 3, moderate: 2, hard: 1, very_hard: 0 }
    const bestScore = items.reduce((best, item) => (!best || (item.feasibilityScore ?? 0) > (best.feasibilityScore ?? 0)) ? item : best, null)
    const bestIX = items.reduce((best, item) => (!best || (IX_RANK[item.ixDifficulty] ?? 0) > (IX_RANK[best.ixDifficulty] ?? 0)) ? item : best, null)
    const parts = []
    if (bestScore) parts.push(`${bestScore.name} has the strongest feasibility index`)
    if (bestIX && bestIX.id !== bestScore?.id) parts.push(`${bestIX.name} has easier interconnection`)
    return parts.join(' · ') || null
  })()

  // Phase 3 — migrated to Radix Dialog (was hand-rolled <div role="dialog">
  // with manual ESC + focus management). Radix provides Esc handling,
  // focus-trap, outside-click, and aria-modal/labelledby/describedby for
  // free. The visible UI (navy chrome, teal accent rail, sticky column
  // headers) is unchanged; we wrap raw RadixDialog primitives directly
  // (rather than the ui/Dialog.jsx wrapper) to keep full control over the
  // wider max-w-5xl footprint + internal layout.

  return (
    <RadixDialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl outline-hidden"
          style={{
            background: '#080E1A',
            border: '1px solid rgba(52,211,153,0.18)',
            boxShadow: '0 0 0 1px rgba(52,211,153,0.06), 0 24px 64px rgba(0,0,0,0.6)',
          }}
          aria-describedby="compare-modal-desc"
        >
          {/* Visible h2 below serves as the visual title; Radix needs an
              actual Title element for screen readers. sr-only avoids a
              duplicate visual heading while keeping the a11y semantics. */}
          <RadixDialog.Title className="sr-only">Project Comparison</RadixDialog.Title>
          <RadixDialog.Description id="compare-modal-desc" className="sr-only">
            Side-by-side feasibility comparison of {items.length} project{items.length !== 1 ? 's' : ''}.
            Press Escape to close.
          </RadixDialog.Description>

          {/* Teal accent bar */}
          <div className="h-[3px] w-full rounded-t-xl" style={{ background: 'linear-gradient(90deg, #34D399 0%, #059669 60%, transparent 100%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Project Comparison</h2>
            <p className="text-[10px] font-mono text-white/30 mt-0.5 uppercase tracking-widest">
              {items.length} project{items.length !== 1 ? 's' : ''} · feasibility + key signals
              {refreshing && <span className="ml-2 text-amber-300/70">· refreshing scores…</span>}
              {!refreshing && refreshTs && (
                <span className="ml-2 text-emerald-400/70">
                  · scores recomputed at compare-open ({refreshTs.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Phase 2C — "Save as…" promotes the draft into a persistent
                saved_comparisons row. Available with 2+ items only (a
                single-project compare is meaningless to save). */}
            <button
              type="button"
              onClick={() => {
                if (items.length < 2) return
                const defaultName = items.map(it => it.state).join(' / ') + ` · ${items.length} projects`
                setSaveName(defaultName)
                setSaveOpen(true)
              }}
              disabled={items.length < 2}
              className="text-[10px] font-mono px-2 py-1 rounded-sm uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: '#5EEAD4' }}
              title={items.length < 2 ? 'Need 2+ projects to save' : 'Save this comparison to revisit later'}
            >
              Save as…
            </button>
            {/* Phase 2C — Export PDF. Lazy-loads CompareReportPDF on click
                so @react-pdf/renderer stays out of the main bundle. */}
            <button
              type="button"
              onClick={async () => {
                if (items.length < 2 || pdfExporting) return
                setPdfExporting(true)
                try {
                  const { exportCompareReportPDF } = await import('./CompareReportPDF')
                  await exportCompareReportPDF(items, { refreshed, recommendedId: aiCompare?.recommendedId, aiSummary: aiCompare?.comparison || null })
                } catch (err) {
                  toast.error('PDF export failed', { description: err?.message?.slice(0, 200) || 'Try again — refresh the modal if it persists.' })
                } finally {
                  setPdfExporting(false)
                }
              }}
              disabled={items.length < 2 || pdfExporting}
              className="text-[10px] font-mono px-2 py-1 rounded-sm uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: '#5EEAD4' }}
              title={items.length < 2 ? 'Need 2+ projects to export' : 'Export comparison as PDF'}
            >
              {pdfExporting ? 'Exporting…' : 'Export PDF'}
            </button>
            <button
              onClick={clear}
              className="text-[10px] font-mono text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded-sm uppercase tracking-widest"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-sm"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Save-as dialog — Radix Dialog so Esc + outside-click + focus-trap
            come for free. The default name suggests state IDs joined with
            ' / ' so a 3-project comp lands as "NY / ME / MA · 3 projects",
            which a developer can rename or accept in one keystroke. */}
        <Dialog open={saveOpen} onOpenChange={(open) => { if (!saving) setSaveOpen(open) }}>
          <DialogContent>
            <DialogTitle>Save comparison</DialogTitle>
            <DialogDescription>
              Save this {items.length}-project comparison to your Library. Re-open it later from <span className="font-medium text-ink">Library → Comparisons</span> or via <span className="font-mono text-[12px]">⌘K → :compare</span>.
            </DialogDescription>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (saving || !saveName.trim()) return
                setSaving(true)
                const row = await saveComparison(saveName, items)
                setSaving(false)
                if (row) {
                  setSaveOpen(false)
                  toast.success('Comparison saved', {
                    eyebrow: '◆ Saved',
                    description: `${row.name} · ${row.item_ids.length} projects · open from Library → Comparisons`,
                  })
                  // Library listens for this event to refresh the
                  // Comparisons tab badge count.
                  try { window.dispatchEvent(new CustomEvent('tractova:saved-comparisons-changed')) } catch { /* SSR-safe */ }
                } else {
                  toast.error('Save failed', { description: 'Check your sign-in status, then try again.' })
                }
              }}
              className="mt-4"
            >
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">Comparison name</span>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  autoFocus
                  maxLength={120}
                  placeholder="e.g. NE shortlist Q2 2026"
                  className="mt-1.5 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-ink outline-hidden focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/30"
                />
              </label>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setSaveOpen(false)}
                  disabled={saving}
                  className="cursor-pointer text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !saveName.trim()}
                  className="cursor-pointer text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#0F766E' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Table */}
        {/* Drop top padding from the scroll container so the sticky header
            below can sit flush against the Modal Header. The pb-4 keeps
            bottom breathing room; pt-3 was moved into the sticky header
            div so it scrolls correctly. */}
        <div className="flex-1 overflow-auto px-6 pb-4 scrollbar-dark">
          {/* Column headers — sticky 2026-05-04 (Aden's call) so devs always
              see which projects they're comparing while scrolling the
              analysis rows below. Tightened internals (text-xs → text-[11px],
              pb-3 → pb-2, removed mb-0.5 between name and state subline)
              shave ~8px of header row height vs prior. */}
          <div
            className="grid gap-4 pt-3 pb-2 mb-1 sticky top-0 z-10"
            style={{
              gridTemplateColumns: `148px repeat(${items.length}, 1fr)`,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: '#080E1A',
            }}
          >
            <div />
            {items.map((item) => (
              <div key={item.id} className="px-1">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[11px] font-bold text-white/85 leading-snug">{item.name}</p>
                    {aiCompare?.recommendedId === item.id && (
                      <span className="text-[7.5px] font-bold uppercase tracking-wider px-1 py-px rounded-full" style={{ color: '#34D399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
                    </svg>
                  </button>
                </div>
                <p className="text-[8.5px] font-mono text-white/30 uppercase tracking-wider">{item.stateName}</p>
              </div>
            ))}
          </div>

          {/* Metric rows -- grouped by section so the dossier reads as
              two distinct chambers (Composite, Project) instead of one
              long ungrouped list. */}
          <div>
            {Array.from(new Set(rows.map(r => r.section))).map(section => (
              <div key={section}>
                <div
                  className="grid gap-4 pt-3 pb-1"
                  style={{ gridTemplateColumns: `148px repeat(${items.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span
                    className="text-[8px] font-mono uppercase tracking-[0.32em] text-white/30 pr-2 leading-none"
                    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                  >
                    § {section === 'COMPOSITE' ? '01' : '02'} · {section}
                  </span>
                  {items.map(it => <span key={it.id} />)}
                </div>
                {rows.filter(r => r.section === section).map(row => (
                  <MetricRow
                    key={row.label}
                    label={row.label}
                    term={row.term}
                    values={items.map((item) => row.render(item))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* "Open in Lens" row — condensed 2026-05-04 (Aden's call) so the
            scrollable analysis table above gets more vertical breathing
            room. ~22px shaved vs prior layout. */}
        <div className="px-6 py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="grid gap-4 items-center" style={{ gridTemplateColumns: `148px repeat(${items.length}, 1fr)` }}>
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/30 pr-2">
              Actions
            </span>
            {items.map((item) => (
              <div key={item.id} className="px-1">
                <Link
                  to={`/search?state=${item.state}&county=${encodeURIComponent(item.county)}&mw=${item.mw || ''}&stage=${encodeURIComponent(item.stage || '')}&technology=${encodeURIComponent(item.technology || '')}`}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border transition-colors inline-block"
                  style={{ color: '#34D399', borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)' }}
                  onClick={onClose}
                >
                  Open in Lens
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* AI comparison + footer */}
        <div className="px-6 py-4 rounded-b-xl" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          {bestFor && (
            <p className="text-[10px] font-medium mb-3" style={{ color: '#34D399' }}>
              {bestFor}
            </p>
          )}
          {aiLoading ? (
            <div className="mb-3 rounded-xl px-5 py-6" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.08)' }}>
              <div className="flex items-center justify-center gap-4">
                <TractovaLoader size={48} />
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: '#5EEAD4' }}>
                    ◆ AI Comparison
                  </p>
                  <p className="text-[12px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Stacking the {items.length} projects across composite, IX, and program signals…
                  </p>
                </div>
              </div>
            </div>
          ) : aiError ? (
            <div className="mb-3 rounded-xl px-4 py-3" style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.20)' }}>
              <div className="flex items-start gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#FBBF24' }}>AI comparison unavailable</p>
                  <p className="text-[11px] text-white/55 leading-snug">{aiError} The project rows below are still accurate — refresh the modal to retry.</p>
                </div>
              </div>
            </div>
          ) : aiCompare?.comparison ? (
            <div className="mb-3 rounded-xl overflow-hidden" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.10)' }}>
              <button
                type="button"
                onClick={() => setAiOpen(o => !o)}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors hover:brightness-125 cursor-pointer"
                style={aiOpen ? { borderBottom: '1px solid rgba(52,211,153,0.06)' } : {}}
                aria-expanded={aiOpen}
                aria-controls="compare-ai-panel"
              >
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(5,150,105,0.3))' }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34D399' }}>
                    AI Comparison {aiCompare.insightType ? `· ${aiCompare.insightType}` : 'Analysis'}
                  </p>
                  {!aiOpen && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{aiCompare.comparison}</p>
                  )}
                </div>
                <svg
                  width="11" height="11" viewBox="0 0 24 24"
                  fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 transition-transform"
                  style={{ transform: aiOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {aiOpen && (
                <div id="compare-ai-panel" role="region" aria-label="AI comparison analysis">
                  <div className="px-4 py-3">
                    <p className="text-[11px] leading-relaxed text-white/65">{aiCompare.comparison}</p>
                  </div>
                  {aiCompare.reason && (
                    <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.08)' }}>
                      <svg className="w-3 h-3 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <p className="text-[10px] text-white/50 leading-relaxed">{aiCompare.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <p className="text-[9px] font-mono text-white/20 leading-relaxed uppercase tracking-wide">
            Scores reflect Tractova's composite feasibility index. Verify interconnection and capacity with the serving utility before committing capital.
          </p>
        </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export default function CompareTray() {
  const { items, remove, clear, load } = useCompare()
  const [modalOpen, setModalOpen] = useState(false)

  // Cmd-K verb `:compare` dispatches this event. Open the modal if we have
  // anything to compare; otherwise the tray isn't even mounted (items===0
  // short-circuits below) and the event is a silent no-op.
  useEffect(() => {
    const onOpen = () => { if (items.length > 0) setModalOpen(true) }
    window.addEventListener('tractova:open-compare', onOpen)
    return () => window.removeEventListener('tractova:open-compare', onOpen)
  }, [items.length])

  // Phase 2C — Cmd-K `:compare <saved-name>` and Library "Open" both fire
  // this event with either `{ savedId }` (fetch + hydrate) or `{ snapshot }`
  // (hydrate directly). Either path ends with the modal open. The tray
  // mounts unconditionally here so the listener stays alive even when
  // items is empty — important for the "load saved without an existing
  // draft" path.
  useEffect(() => {
    const onLoad = async (e) => {
      const detail = e?.detail || {}
      let snapshot = detail.snapshot
      if (!snapshot && detail.savedId) {
        try {
          const row = await loadSavedComparison(detail.savedId)
          snapshot = row?.snapshot
        } catch { /* fall through to no-op */ }
      }
      if (Array.isArray(snapshot) && snapshot.length > 0) {
        load(snapshot)
        setModalOpen(true)
      }
    }
    window.addEventListener('tractova:load-compare', onLoad)
    return () => window.removeEventListener('tractova:load-compare', onLoad)
  }, [load])

  // CompareTray is always mounted in App.jsx, so the `tractova:load-compare`
  // listener stays alive even with an empty draft — saved-comparison hydrate
  // updates items first, which triggers a re-render that renders the tray.
  if (items.length === 0) return null

  return (
    <>
      {/* Floating tray bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: '#080E1A',
            border: '1px solid rgba(52,211,153,0.22)',
            boxShadow: '0 0 0 1px rgba(52,211,153,0.06), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Icon */}
          <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>

          {/* Project chips */}
          <div className="flex items-center gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 rounded-md px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span className="text-xs font-medium text-white/80 truncate max-w-[120px]">{item.name}</span>
                <button
                  onClick={() => remove(item.id)}
                  className="text-white/25 hover:text-white/70 transition-colors shrink-0"
                  aria-label={`Remove ${item.name}`}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Compare button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
            style={{ background: '#059669' }}
            onMouseEnter={e => e.currentTarget.style.background = '#047857'}
            onMouseLeave={e => e.currentTarget.style.background = '#059669'}
          >
            Compare
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            className="text-white/25 hover:text-white/60 transition-colors shrink-0"
            aria-label="Clear comparison"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && <CompareModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
