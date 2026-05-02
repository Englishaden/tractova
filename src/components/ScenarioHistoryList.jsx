import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/Dialog'
import { formatScenarioSummary } from '../lib/scenarioEngine'
import { supabase } from '../lib/supabase'

// Vertical list view of saved scenarios. Replaces the original horizontal
// chip row from ScenarioStudio so the user sees timestamps + headline
// metrics + delta-vs-baseline at a glance — fixes the "two saves with
// the same preset name look identical" UX trap that read as "the new
// save overrode the old one."
//
// Reused in two places:
//   1. ScenarioStudio (Lens result panel) — scoped to the current Lens
//      context (state + tech, optionally project_id).
//   2. Library "Scenarios" view — grouped by Lens context, shows ALL of
//      the user's scenarios including exploration (project_id null).
//
// Each row is a button: click anywhere except the trash icon to load the
// scenario back into the Studio sliders. The trash icon opens a confirm
// modal — onDelete is only called after user clicks "Delete" in the
// modal. This prevents accidental data loss from misclicks (the previous
// implementation deleted on first click, which Aden flagged as too easy
// to do by accident).

export default function ScenarioHistoryList({
  scenarios,
  onLoad,
  onDelete,
  baselineRevenue = null,  // optional — when set, delta-vs-baseline column appears
  emptyText = 'No scenarios saved yet.',
  autoExpandId = null,     // when set, that row's commentary auto-expands + auto-fetches
}) {
  const [confirmDelete, setConfirmDelete] = useState(null)
  // Per-row expand state + commentary cache. Map<id, { commentary?, loading?, error? }>.
  const [commentaries, setCommentaries] = useState({})
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const fetchCommentary = useCallback(async (snap) => {
    if (!snap?.id) return
    setCommentaries((c) => ({ ...c, [snap.id]: { loading: true } }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setCommentaries((c) => ({ ...c, [snap.id]: { error: 'Sign in to load commentary' } }))
        return
      }
      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'scenario-commentary',
          stateId: snap.state_id,
          technology: snap.technology,
          mw: snap.scenario_inputs?.systemSizeMW ?? snap.baseline_inputs?.systemSizeMW ?? null,
          county: snap.county_name || null,
          baselineInputs: snap.baseline_inputs,
          scenarioInputs: snap.scenario_inputs,
          outputs: snap.outputs,
        }),
      })
      const json = await res.json()
      if (json.commentary) {
        setCommentaries((c) => ({ ...c, [snap.id]: { commentary: json.commentary } }))
      } else {
        setCommentaries((c) => ({ ...c, [snap.id]: { error: json.reason || 'no_commentary' } }))
      }
    } catch (err) {
      setCommentaries((c) => ({ ...c, [snap.id]: { error: err?.message || 'fetch_failed' } }))
    }
  }, [])

  const toggleExpand = useCallback((snap) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(snap.id)) {
        next.delete(snap.id)
      } else {
        next.add(snap.id)
        // Lazy-fetch on first expand. Skip if we already have a result or are mid-flight.
        const existing = commentaries[snap.id]
        if (!existing?.commentary && !existing?.loading) fetchCommentary(snap)
      }
      return next
    })
  }, [commentaries, fetchCommentary])

  // Auto-expand the just-saved row + fire the commentary fetch immediately.
  useEffect(() => {
    if (!autoExpandId) return
    const snap = scenarios.find((s) => s.id === autoExpandId)
    if (!snap) return
    setExpandedIds((prev) => {
      if (prev.has(autoExpandId)) return prev
      const next = new Set(prev)
      next.add(autoExpandId)
      return next
    })
    if (!commentaries[autoExpandId]?.commentary && !commentaries[autoExpandId]?.loading) {
      fetchCommentary(snap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpandId, scenarios.length])

  if (!scenarios || scenarios.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 italic px-1 py-2">{emptyText}</p>
    )
  }

  async function handleConfirmDelete() {
    if (confirmDelete && onDelete) await onDelete(confirmDelete)
    setConfirmDelete(null)
  }

  return (
    <>
      <div className="space-y-1.5">
        {scenarios.map((snap) => (
          <ScenarioRow
            key={snap.id}
            snap={snap}
            onLoad={onLoad}
            onDelete={onDelete ? (s) => setConfirmDelete(s) : null}
            baselineRevenue={baselineRevenue}
            expanded={expandedIds.has(snap.id)}
            commentary={commentaries[snap.id]}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
            <DialogTitle>Delete scenario "{confirmDelete?.name}"?</DialogTitle>
          </div>
          <DialogDescription>
            This permanently removes the saved scenario, including its inputs and computed metrics. This can't be undone.
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="cursor-pointer text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="cursor-pointer flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#DC2626' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
            >
              Delete scenario
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ScenarioRow({ snap, onLoad, onDelete, baselineRevenue, expanded, commentary, onToggleExpand }) {
  const out = snap.outputs || {}
  const y1 = out.year1Revenue
  const irr = out.irr
  const payback = out.paybackYears
  const delta = baselineRevenue && y1 != null ? (y1 - baselineRevenue) / Math.max(Math.abs(baselineRevenue), 1) : null
  const deltaPositive = delta != null && delta > 0
  const ts = relativeTime(snap.created_at)
  // Inputs summary — deterministic mechanical view of what changed. AI
  // commentary (below) is the analytical complement.
  const inputSummary = snap.scenario_inputs && snap.baseline_inputs
    ? formatScenarioSummary(
        { inputs: snap.scenario_inputs, outputs: out },
        { inputs: snap.baseline_inputs },
      )
    : ''

  const handleRowClick = (e) => {
    // Don't fire onLoad when the click landed on the expand or delete button.
    if (e.target.closest('[data-row-control]')) return
    if (onLoad) onLoad(snap)
  }

  const handleKeyDown = (e) => {
    if (!onLoad) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onLoad(snap)
    }
  }

  return (
    <div
      style={{ background: '#FAFAF7', border: '1px solid #E5E7EB' }}
      className={`group/row rounded-md transition-colors ${onLoad ? 'hover:bg-gray-50' : ''}`}
    >
      <div
        role={onLoad ? 'button' : undefined}
        tabIndex={onLoad ? 0 : undefined}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between gap-3 px-3 py-2 ${onLoad ? 'cursor-pointer' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] font-semibold text-ink truncate">
              <span style={{ color: '#0F766E' }}>◆</span> {snap.name}
            </span>
            <span className="text-[9px] text-gray-400 font-mono shrink-0">{ts}</span>
          </div>
          <div className="text-[10px] text-gray-600 tabular-nums flex items-center gap-2.5 flex-wrap">
            <span><span className="text-gray-400">$</span>{formatLarge(y1)}<span className="text-gray-400">/yr</span></span>
            {irr != null && (
              <>
                <span className="text-gray-300">·</span>
                <span>{(irr * 100).toFixed(1)}%<span className="text-gray-400"> IRR</span></span>
              </>
            )}
            {payback != null && (
              <>
                <span className="text-gray-300">·</span>
                <span>{payback}<span className="text-gray-400">yr payback</span></span>
              </>
            )}
            {delta != null && Math.abs(delta) > 0.005 && (
              <>
                <span className="text-gray-300">·</span>
                <span
                  className="font-bold tabular-nums px-1.5 py-px rounded-sm"
                  style={{
                    background: deltaPositive ? 'rgba(16,185,129,0.18)' : 'rgba(217,119,6,0.18)',
                    color: deltaPositive ? '#0F766E' : '#92400E',
                  }}
                >
                  {deltaPositive ? '+' : ''}{(delta * 100).toFixed(0)}% rev
                </span>
              </>
            )}
          </div>
          {inputSummary && (
            <div className="text-[9px] text-gray-400 font-mono mt-0.5 truncate" title={inputSummary}>
              <span className="text-gray-300">↳</span> {inputSummary}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand && (
            <button
              type="button"
              data-row-control
              onClick={(e) => { e.stopPropagation(); onToggleExpand(snap) }}
              aria-expanded={expanded}
              aria-label={expanded ? `Hide commentary for ${snap.name}` : `Show commentary for ${snap.name}`}
              className="cursor-pointer text-[10px] font-mono uppercase tracking-[0.16em] px-2 py-1 rounded transition-colors"
              style={{
                color: expanded ? '#0F766E' : '#64748B',
                background: expanded ? 'rgba(20,184,166,0.10)' : 'transparent',
                border: '1px solid',
                borderColor: expanded ? 'rgba(20,184,166,0.35)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.color = '#0F766E' }}
              onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.color = '#64748B' }}
            >
              {expanded ? '▼ Hide' : '▸ Why?'}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              data-row-control
              onClick={(e) => { e.stopPropagation(); onDelete(snap) }}
              className="cursor-pointer shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              aria-label={`Delete scenario ${snap.name}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div
          className="px-3 pb-2.5 pt-1 -mt-0.5 text-[12px] leading-relaxed"
          style={{ borderTop: '1px solid #E5E7EB', background: '#F8FAFC' }}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className="font-mono text-[8px] uppercase tracking-[0.20em] font-bold shrink-0"
              style={{ color: '#0F766E' }}
            >
              ◆ Analyst note
            </span>
            <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-gray-300 shrink-0">
              haiku 4.5
            </span>
          </div>
          {commentary?.loading && (
            <p className="text-[12px] text-gray-500 italic">
              Reading the scenario…
            </p>
          )}
          {commentary?.commentary && (
            <p className="text-[12px] text-gray-700">
              {commentary.commentary}
            </p>
          )}
          {commentary?.error && (
            <p className="text-[11px] text-amber-700">
              Couldn't load commentary ({commentary.error}). Try again in a moment.
            </p>
          )}
          {!commentary && (
            <p className="text-[11px] text-gray-400 italic">No commentary yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Compact USD formatter — mirrors the formatter used in ScenarioStudio
// + Library so numbers read identically across the three surfaces.
function formatLarge(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return Math.round(n).toLocaleString()
}

// Relative time formatter shared with Profile.jsx — kept inline rather
// than imported so this component has no internal dependencies.
function relativeTime(ts) {
  if (!ts) return ''
  const d = new Date(ts).getTime()
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
