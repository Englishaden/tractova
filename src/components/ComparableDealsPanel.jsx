import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getComparableDeals } from '../lib/programData'
import { COMPARABLE_DEAL_SOURCES } from '../lib/pucPortals'
import { LoadingDot } from './ui'

// V3 Wave 2 — Comparable Deals panel.
//
// Surfaces anonymized recently-filed / under-construction / operational
// projects in the developer's target market so they can validate "is my
// deal sized right?" against actual market activity.
//
// Used in two places:
//   1. Lens results — shows comps matching {state, technology, ±50% MW}
//   2. Eventually: per-Library-project "Compare to Market" section
//      (deferred to Phase 2 next session)
//
// Pro-gated upstream (Lens itself is Pro). Empty state is honest:
// curation is admin-driven, so until a state has been seeded with comps
// the panel says so plainly.

const STATUS_CONFIG = {
  proposed: {
    label:  'Proposed',
    bg:     'rgba(37, 99, 235, 0.08)',
    color:  '#1D4ED8',
    border: 'rgba(37, 99, 235, 0.30)',
  },
  under_construction: {
    label:  'Under Construction',
    bg:     'rgba(245, 158, 11, 0.10)',
    color:  '#B45309',
    border: 'rgba(245, 158, 11, 0.36)',
  },
  operational: {
    label:  'Operational',
    bg:     'rgba(20, 184, 166, 0.10)',
    color:  '#0F766E',
    border: 'rgba(15, 118, 110, 0.32)',
  },
  cancelled: {
    label:  'Cancelled',
    bg:     'rgba(220, 38, 38, 0.06)',
    color:  '#B91C1C',
    border: 'rgba(220, 38, 38, 0.22)',
  },
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function fmtMW(mw) {
  if (mw == null) return '—'
  const n = parseFloat(mw)
  if (isNaN(n)) return '—'
  return n >= 100 ? `${Math.round(n)}` : n.toFixed(1).replace(/\.0$/, '')
}

// Sort: same-state > same-tech > closer-MW > more-recent
function sortDeals(rows, { mw } = {}) {
  if (!rows) return []
  const target = parseFloat(mw) || 0
  return [...rows].sort((a, b) => {
    if (target > 0) {
      const da = Math.abs(parseFloat(a.mw) - target)
      const db = Math.abs(parseFloat(b.mw) - target)
      if (da !== db) return da - db
    }
    const fa = a.filingDate ? new Date(a.filingDate).getTime() : 0
    const fb = b.filingDate ? new Date(b.filingDate).getTime() : 0
    return fb - fa
  })
}

// ── Single deal card ────────────────────────────────────────────────────────
function DealCard({ deal, targetMW }) {
  const status = STATUS_CONFIG[deal.status] || STATUS_CONFIG.proposed
  const filingFmt = fmtDate(deal.filingDate)
  const codFmt    = fmtDate(deal.codTarget)
  const dev       = deal.developer || 'Anonymous developer'

  // Δ vs target (when present)
  const delta = (() => {
    const t = parseFloat(targetMW)
    const d = parseFloat(deal.mw)
    if (!t || !d) return null
    const pct = ((d - t) / t) * 100
    if (Math.abs(pct) < 5) return { label: 'on-size', color: '#0F766E' }
    if (pct > 0) return { label: `+${Math.round(pct)}%`, color: '#5A6B7A' }
    return { label: `${Math.round(pct)}%`, color: '#5A6B7A' }
  })()

  return (
    <article
      className="rounded-xl bg-white px-5 py-4 transition-shadow hover:shadow-xs"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Header row: status + tech + size */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-sm border"
          style={{ background: status.bg, color: status.color, borderColor: status.border }}
        >
          {status.label}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
          {deal.technology}
        </span>
        <span className="text-ink-muted text-[10px]">·</span>
        <span className="font-mono font-bold tabular-nums text-[14px] text-ink">
          {fmtMW(deal.mw)} MW
        </span>
        {delta && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] tabular-nums" style={{ color: delta.color }}>
            {delta.label}
          </span>
        )}
      </div>

      {/* Location + utility */}
      <p className="text-[13px] text-ink leading-snug">
        <span className="font-medium">{deal.county ? `${deal.county} County, ` : ''}{deal.state}</span>
        {deal.servingUtility && <span className="text-ink-muted"> · {deal.servingUtility}</span>}
      </p>

      {/* Tractova analyst note */}
      {deal.notes && (
        <p className="text-[12px] text-ink-muted leading-relaxed mt-2">
          {deal.notes}
        </p>
      )}

      {/* Sub-meta strip */}
      <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-100 text-[11px]">
        <MetaItem label="Developer" value={dev} />
        {deal.estimatedCapexPerW && (
          <MetaItem label="CapEx" value={`$${deal.estimatedCapexPerW.toFixed(2)}/W`} mono />
        )}
        {deal.offtakeSummary && (
          <MetaItem label="Offtake" value={deal.offtakeSummary} />
        )}
        {filingFmt && (
          <MetaItem label="Filed" value={filingFmt} mono />
        )}
        {codFmt && (
          <MetaItem label="COD target" value={codFmt} mono />
        )}
        {deal.sourceUrl ? (
          <a
            href={deal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
          >
            {deal.source}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        ) : (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            {deal.source}
          </span>
        )}
      </div>
    </article>
  )
}

// V3 Wave 2 — Explore deal-source buttons. Pair of links to FERC Form 1 +
// EIA Form 860 -- the federal datasets where the comprehensive long
// tail of comparable deals lives. Tractova curates highlights; these
// buttons are the user's escape hatch when they want to drill deeper.
function ExploreDealSourcesButton() {
  return (
    <div className="inline-flex items-center gap-3 flex-wrap">
      {COMPARABLE_DEAL_SOURCES.map((src) => (
        <a
          key={src.name}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          title={src.desc}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700 hover:text-teal-900 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm"
        >
          Explore {src.name}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      ))}
    </div>
  )
}

function MetaItem({ label, value, mono }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">{label}</span>
      <span className={`text-ink ${mono ? 'font-mono tabular-nums text-[11px]' : 'text-[12px]'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────
// Filters comps to {state, technology, ±50% MW range} and shows the top 4
// closest matches (sorted by MW proximity then recency). When no MW is
// passed, returns most-recent deals in the state + tech.
export default function ComparableDealsPanel({ state, stateName, technology, mw }) {
  const [deals, setDeals] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!state) return
    let cancelled = false
    setLoading(true)
    const targetMW = parseFloat(mw)
    // ±50% MW range when targetMW provided; else no MW filter
    const mwRange = targetMW > 0 ? [Math.max(0.1, targetMW * 0.5), targetMW * 2.0] : undefined
    getComparableDeals({ state, technology, mwRange })
      .then(rows => {
        if (cancelled) return
        setDeals(sortDeals(rows, { mw: targetMW }).slice(0, 4))
        setLoading(false)
      })
      .catch(err => {
        console.warn('[comparable-deals] fetch failed:', err.message)
        if (!cancelled) { setDeals([]); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [state, technology, mw])

  const labelName = stateName || state || 'this state'

  if (loading) {
    return (
      <div>
        <PanelHeader stateName={labelName} count={null} />
        <div className="mt-4">
          <LoadingDot message="Loading comparable deals" />
        </div>
      </div>
    )
  }

  const dealsArr = deals || []

  if (dealsArr.length === 0) {
    return (
      <div>
        <PanelHeader stateName={labelName} count={0} />
        <div
          className="rounded-xl px-5 py-6 text-center mt-4"
          style={{ background: '#FAFAF7', border: '1px dashed #E2E8F0' }}
        >
          <p className="text-[13px] text-ink-muted leading-relaxed">
            No Tractova-flagged comps for{' '}
            <span className="font-medium text-ink">{technology}</span> in{' '}
            <span className="font-medium text-ink">{labelName}</span>{mw ? ` near ${mw} MW` : ''} right now.
          </p>
          <p className="text-[11px] text-ink-muted mt-1.5 mb-3">
            We curate selective benchmarks from federal filings — drill into FERC Form 1 or EIA Form 860 directly for the comprehensive deal universe.
          </p>
          <ExploreDealSourcesButton />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PanelHeader stateName={labelName} count={dealsArr.length} />
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4"
      >
        {dealsArr.map(d => <DealCard key={d.id} deal={d} targetMW={mw} />)}
      </motion.div>
      <div className="mt-3 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid #E2E8F0' }}>
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Tractova-flagged benchmarks. <span className="text-ink-muted">For the full deal universe:</span>
        </p>
        <ExploreDealSourcesButton />
      </div>
    </div>
  )
}

function PanelHeader({ stateName, count }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5"
          style={{ color: '#0F766E' }}>
          ◆ Comparable Deals · {stateName}
        </p>
        <h3 className="font-serif text-xl font-semibold text-ink tracking-tight"
          style={{ letterSpacing: '-0.015em' }}>
          Market Benchmarks
        </h3>
        <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">
          Tractova-flagged comps in {stateName} near your project size — selective benchmarks, not a complete index. Drill to source for the full universe.
        </p>
      </div>
      {count != null && count > 0 && (
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted tabular-nums">
          {count} comps
        </span>
      )}
    </div>
  )
}
