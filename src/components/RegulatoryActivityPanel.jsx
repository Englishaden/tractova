import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getPucDockets } from '../lib/programData'
import { LoadingDot } from './ui'

// V3 Wave 2 — PUC Docket Tracker MVP
//
// Surfaces active state Public Utility Commission proceedings for a given
// state. Used in two places:
//
//   1. Lens results (`<RegulatoryActivityPanel state={...} stateName={...} />`)
//      where the developer is actively analyzing a project. Most actionable
//      moment to surface a comment-open docket -- if there's a window, the
//      developer can file comments before sinking capital.
//
//   2. Dashboard StateDetailPanel "Regulatory" tab where the developer
//      is exploring states and wants the regulatory pulse for that market.
//
// Pro-gated: when isPro=false we show a teaser count + upsell. The teaser
// is always live-counted (not faked) so non-Pro users get an honest signal
// of what they're missing.

// Status palette -- each status has its own visual weight matching how
// urgent/actionable it is. Comment-open is the most actionable so it gets
// teal (V3 brand color). Pending decision = caution amber. Filed = neutral
// navy. Closed = gray (only shown if includeClosed).
const STATUS_CONFIG = {
  comment_open: {
    label:    'Comment Open',
    bg:       'rgba(20, 184, 166, 0.10)',
    color:    '#0F766E',
    border:   'rgba(15, 118, 110, 0.32)',
  },
  pending_decision: {
    label:    'Pending Decision',
    bg:       'rgba(245, 158, 11, 0.10)',
    color:    '#B45309',
    border:   'rgba(245, 158, 11, 0.36)',
  },
  filed: {
    label:    'Filed',
    bg:       'rgba(15, 26, 46, 0.06)',
    color:    '#0F1A2E',
    border:   'rgba(15, 26, 46, 0.18)',
  },
  closed: {
    label:    'Closed',
    bg:       'rgba(90, 107, 122, 0.08)',
    color:    '#5A6B7A',
    border:   'rgba(90, 107, 122, 0.22)',
  },
}

const PILLAR_LABEL = {
  offtake:        'Offtake',
  ix:             'Interconnection',
  site:           'Site Control',
  'cross-cutting': 'Cross-cutting',
}

const PILLAR_COLOR = {
  offtake:        '#0F766E',
  ix:             '#D97706',
  site:           '#2563EB',
  'cross-cutting': '#5A6B7A',
}

const IMPACT_DOT = {
  high:   { color: '#DC2626', label: 'High impact' },
  medium: { color: '#D97706', label: 'Medium impact' },
  low:    { color: '#5A6B7A', label: 'Low impact' },
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const ms = d.getTime() - now.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

// Sort by impact tier (high first), then filed_date desc within tier
function sortDockets(rows) {
  const tierRank = { high: 0, medium: 1, low: 2 }
  return [...rows].sort((a, b) => {
    const tA = tierRank[a.impactTier] ?? 3
    const tB = tierRank[b.impactTier] ?? 3
    if (tA !== tB) return tA - tB
    const dA = a.filedDate ? new Date(a.filedDate).getTime() : 0
    const dB = b.filedDate ? new Date(b.filedDate).getTime() : 0
    return dB - dA
  })
}

// ── Single docket card ──────────────────────────────────────────────────────
function DocketCard({ docket }) {
  const status = STATUS_CONFIG[docket.status] || STATUS_CONFIG.filed
  const pillar = PILLAR_LABEL[docket.pillar] || docket.pillar
  const pillarCol = PILLAR_COLOR[docket.pillar] || '#5A6B7A'
  const impact = IMPACT_DOT[docket.impactTier] || IMPACT_DOT.low

  const filedFmt = fmtDate(docket.filedDate)
  const commentDays = daysUntil(docket.commentDeadline)
  const decisionFmt = fmtDate(docket.decisionTarget)

  return (
    <article
      className="rounded-xl bg-white px-5 py-4 transition-shadow hover:shadow-sm"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Top strip: status + impact + pillar */}
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded border"
          style={{ background: status.bg, color: status.color, borderColor: status.border }}
        >
          {status.label}
        </span>
        <span className="flex items-center gap-1" title={impact.label}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: impact.color }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
            {docket.impactTier}
          </span>
        </span>
        <span className="text-ink-muted text-[10px]">·</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: pillarCol }}>
          {pillar}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-serif text-[15px] font-semibold text-ink leading-tight tracking-tight"
        style={{ letterSpacing: '-0.01em' }}>
        {docket.title}
      </h4>

      {/* Docket number eyebrow */}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mt-1.5">
        {docket.pucName}
        {docket.docketNumber && <> · Docket {docket.docketNumber}</>}
      </p>

      {/* Summary */}
      <p className="text-[13px] text-ink leading-relaxed mt-2.5">
        {docket.summary}
      </p>

      {/* Footer meta strip */}
      <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-100">
        {filedFmt && (
          <MetaItem label="Filed" value={filedFmt} />
        )}
        {docket.commentDeadline && (
          <MetaItem
            label="Comment deadline"
            value={fmtDate(docket.commentDeadline)}
            hint={commentDays != null ? (commentDays < 0
              ? `${Math.abs(commentDays)}d ago`
              : commentDays === 0
                ? 'today'
                : `${commentDays}d left`) : null}
            urgent={commentDays != null && commentDays >= 0 && commentDays <= 14}
          />
        )}
        {decisionFmt && (
          <MetaItem label="Decision target" value={decisionFmt} />
        )}
        {docket.sourceUrl && (
          <a
            href={docket.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
          >
            Source
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        )}
      </div>
    </article>
  )
}

function MetaItem({ label, value, hint, urgent }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">{label}</span>
      <span className="font-mono text-[11px] tabular-nums" style={{ color: urgent ? '#B45309' : '#0A1828' }}>
        {value}
        {hint && <span className="ml-1.5 text-[10px]" style={{ color: urgent ? '#B45309' : '#5A6B7A' }}>· {hint}</span>}
      </span>
    </div>
  )
}

// ── Pro upsell teaser (used when isPro=false) ───────────────────────────────
function ProTeaser({ count, stateName }) {
  return (
    <div
      className="rounded-xl px-5 py-5 flex items-center gap-4"
      style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(20,184,166,0.20)', border: '1px solid rgba(20,184,166,0.36)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#5EEAD4' }}>
          ◆ Pro Intelligence
        </p>
        <p className="text-[14px] font-medium text-white leading-snug">
          {count > 0
            ? <>{count} active PUC docket{count === 1 ? '' : 's'} affecting {stateName}'s market</>
            : <>Track active PUC dockets across {stateName}</>
          }
        </p>
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
          See proceeding details, comment deadlines, decision targets, and Tractova analyst summaries — upgrade to Pro to access.
        </p>
      </div>
      <a
        href="/upgrade"
        className="flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-3 py-2 rounded-lg text-white transition-transform hover:-translate-y-px"
        style={{ background: '#14B8A6' }}
      >
        Upgrade
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </a>
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────
// `mode` switches the chrome:
//   "lens"      — full editorial section (eyebrow + serif title + dockets)
//   "tab"       — embedded inside StateDetailPanel's "Regulatory" tab; no
//                 outer eyebrow/title since the tab already provides framing
//
// `isPro` controls whether the docket details render or the upsell teaser
// shows. Always queries the live count so the teaser is honest.
export default function RegulatoryActivityPanel({ state, stateName, isPro = true, mode = 'lens' }) {
  const [dockets, setDockets] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!state) return
    let cancelled = false
    setLoading(true)
    getPucDockets({ state }).then(rows => {
      if (cancelled) return
      setDockets(sortDockets(rows || []))
      setLoading(false)
    }).catch(err => {
      console.warn('[regulatory] fetch failed:', err.message)
      if (!cancelled) { setDockets([]); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [state])

  const labelName = stateName || state || 'this state'

  // Loading state
  if (loading) {
    return (
      <div className={mode === 'lens' ? '' : 'px-5 py-6'}>
        {mode === 'lens' && <PanelHeader stateName={labelName} count={null} />}
        <div className={mode === 'lens' ? 'mt-4' : ''}>
          <LoadingDot message="Loading regulatory activity" />
        </div>
      </div>
    )
  }

  const docketsArr = dockets || []

  // Pro gate (Lens mode only — Dashboard stays open since tabs are exploratory)
  if (mode === 'lens' && !isPro) {
    return (
      <div>
        <PanelHeader stateName={labelName} count={docketsArr.length} />
        <div className="mt-4">
          <ProTeaser count={docketsArr.length} stateName={labelName} />
        </div>
      </div>
    )
  }

  // Empty state
  if (docketsArr.length === 0) {
    return (
      <div className={mode === 'lens' ? '' : 'px-5 py-6'}>
        {mode === 'lens' && <PanelHeader stateName={labelName} count={0} />}
        <div className={`rounded-xl px-5 py-6 text-center ${mode === 'lens' ? 'mt-4' : ''}`}
          style={{ background: '#FAFAF7', border: '1px dashed #E2E8F0' }}>
          <p className="text-[13px] text-ink-muted leading-relaxed">
            No active PUC dockets currently tracked for <span className="font-medium text-ink">{labelName}</span>.
          </p>
          <p className="text-[11px] text-ink-muted mt-1.5">
            Tractova reviews state PUC filings weekly. Check back, or contact the {labelName} PUC e-filing portal directly for the latest proceedings.
          </p>
        </div>
      </div>
    )
  }

  // Normal render
  return (
    <div className={mode === 'lens' ? '' : 'px-5 py-4'}>
      {mode === 'lens' && <PanelHeader stateName={labelName} count={docketsArr.length} />}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`grid grid-cols-1 ${mode === 'lens' ? 'lg:grid-cols-2 gap-4 mt-4' : 'gap-3'}`}
      >
        {docketsArr.map(d => <DocketCard key={d.id} docket={d} />)}
      </motion.div>
    </div>
  )
}

function PanelHeader({ stateName, count }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5"
          style={{ color: '#0F766E' }}>
          ◆ Regulatory · {stateName}
        </p>
        <h3 className="font-serif text-xl font-semibold text-ink tracking-tight"
          style={{ letterSpacing: '-0.015em' }}>
          Active PUC Dockets
        </h3>
        <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">
          Public Utility Commission proceedings shaping {stateName}'s community-solar / DER market.
        </p>
      </div>
      {count != null && count > 0 && (
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted tabular-nums">
          {count} active
        </span>
      )}
    </div>
  )
}
