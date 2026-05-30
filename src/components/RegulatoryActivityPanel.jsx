import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getPucDockets } from '../lib/programData'
import { getPucPortal } from '../lib/pucPortals'
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

// Dark-surface variants — used when this panel is embedded in the
// dashboard StateDetailPanel "Regulatory" tab (mode="tab"), which sits on
// the dark navy scope. The light palette above is for Lens results
// (mode="lens") on the cream brand surface. Dark cards emulate the News
// tab cards (Aden 2026-05-30: "regulatory section shouldn't have a white
// background — emulate the news section").
const STATUS_CONFIG_DARK = {
  comment_open:     { label: 'Comment Open',     bg: 'rgba(20, 184, 166, 0.12)', color: '#5EEAD4', border: 'rgba(20, 184, 166, 0.36)' },
  pending_decision: { label: 'Pending Decision', bg: 'rgba(245, 158, 11, 0.12)', color: '#FBBF24', border: 'rgba(245, 158, 11, 0.36)' },
  filed:            { label: 'Filed',            bg: 'rgba(255, 255, 255, 0.04)', color: '#98A4B6', border: 'rgba(255, 255, 255, 0.14)' },
  closed:           { label: 'Closed',           bg: 'rgba(148, 163, 184, 0.08)', color: '#6C7A91', border: 'rgba(148, 163, 184, 0.22)' },
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

const PILLAR_COLOR_DARK = {
  offtake:        '#2DD4BF',
  ix:             '#FBBF24',
  site:           '#60A5FA',
  'cross-cutting': '#98A4B6',
}

const IMPACT_DOT = {
  high:   { color: '#DC2626', label: 'High impact' },
  medium: { color: '#D97706', label: 'Medium impact' },
  low:    { color: '#5A6B7A', label: 'Low impact' },
}

const IMPACT_DOT_DARK = {
  high:   { color: '#F87171', label: 'High impact' },
  medium: { color: '#FBBF24', label: 'Medium impact' },
  low:    { color: '#6C7A91', label: 'Low impact' },
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
function DocketCard({ docket, dark = false }) {
  const status = (dark ? STATUS_CONFIG_DARK : STATUS_CONFIG)[docket.status]
    || (dark ? STATUS_CONFIG_DARK : STATUS_CONFIG).filed
  const pillar = PILLAR_LABEL[docket.pillar] || docket.pillar
  const pillarCol = (dark ? PILLAR_COLOR_DARK : PILLAR_COLOR)[docket.pillar] || (dark ? '#98A4B6' : '#5A6B7A')
  const impact = (dark ? IMPACT_DOT_DARK : IMPACT_DOT)[docket.impactTier] || (dark ? IMPACT_DOT_DARK : IMPACT_DOT).low

  const filedFmt = fmtDate(docket.filedDate)
  const commentDays = daysUntil(docket.commentDeadline)
  const decisionFmt = fmtDate(docket.decisionTarget)

  // Color tokens flip with the surface. Light = cream brand (Lens results);
  // dark = the dashboard navy scope (Regulatory tab), matching the News tab.
  const c = dark ? {
    cardBg: 'var(--bg-surface)', cardBorder: 'var(--cards-border)',
    title: 'var(--text-primary)', eyebrow: 'var(--text-muted)',
    summary: 'var(--text-label)', metaSep: 'var(--text-muted)',
    footerBorder: 'var(--cards-border)', link: '#5EEAD4', linkHover: '#99F6E4',
  } : {
    cardBg: '#FFFFFF', cardBorder: '#E2E8F0',
    title: '#0A1828', eyebrow: '#5A6B7A',
    summary: '#0A1828', metaSep: '#5A6B7A',
    footerBorder: '#F1F5F9', link: '#0F766E', linkHover: '#115E59',
  }

  return (
    <article
      className="rounded-xl px-5 py-4 transition-shadow hover:shadow-xs"
      style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
    >
      {/* Top strip: status + impact + pillar */}
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-sm border"
          style={{ background: status.bg, color: status.color, borderColor: status.border }}
        >
          {status.label}
        </span>
        <span className="flex items-center gap-1" title={impact.label}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: impact.color }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: c.eyebrow }}>
            {docket.impactTier}
          </span>
        </span>
        <span className="text-[10px]" style={{ color: c.metaSep }}>·</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: pillarCol }}>
          {pillar}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-serif text-[15px] font-semibold leading-tight tracking-tight break-words"
        style={{ letterSpacing: '-0.01em', color: c.title }}>
        {docket.title}
      </h4>

      {/* Docket number eyebrow */}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] mt-1.5 break-words" style={{ color: c.eyebrow }}>
        {docket.pucName}
        {docket.docketNumber && <> · Docket {docket.docketNumber}</>}
      </p>

      {/* Summary */}
      <p className="text-[13px] leading-relaxed mt-2.5 break-words" style={{ color: c.summary }}>
        {docket.summary}
      </p>

      {/* Footer meta strip */}
      <div className="flex items-center gap-3 flex-wrap mt-3 pt-3" style={{ borderTop: `1px solid ${c.footerBorder}` }}>
        {filedFmt && (
          <MetaItem label="Filed" value={filedFmt} dark={dark} />
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
            dark={dark}
          />
        )}
        {decisionFmt && (
          <MetaItem label="Decision target" value={decisionFmt} dark={dark} />
        )}
        {/* Source link wrapped in MetaItem-shaped 2-row stack so its
            baseline aligns with the other meta cells (label + value),
            instead of centering against the 2-row stacks like a 1-row
            outlier. */}
        {docket.sourceUrl && (
          <div className="ml-auto flex flex-col items-end">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: c.eyebrow }}>Source</span>
            <a
              href={docket.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold transition-colors"
              style={{ color: c.link }}
              onMouseEnter={(e) => { e.currentTarget.style.color = c.linkHover }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.link }}
            >
              Open docket
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

// V3 Wave 2 — Explore PUC button. The user-facing escape hatch from
// Tractova's selective curation to the comprehensive long tail. Always
// visible in both empty-state AND populated-state -- signals honestly
// that we curate signal, the source has the universe.
function ExplorePucButton({ state, dark = false }) {
  const portal = getPucPortal(state)
  return (
    <a
      href={portal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm"
      style={{ color: dark ? '#5EEAD4' : '#0F766E' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = dark ? '#99F6E4' : '#115E59' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = dark ? '#5EEAD4' : '#0F766E' }}
    >
      Explore {portal.name}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  )
}

function MetaItem({ label, value, hint, urgent, dark = false }) {
  const labelCol = dark ? 'var(--text-muted)' : '#5A6B7A'
  const valueCol = urgent ? (dark ? '#FBBF24' : '#B45309') : (dark ? 'var(--text-primary)' : '#0A1828')
  const hintCol  = urgent ? (dark ? '#FBBF24' : '#B45309') : (dark ? 'var(--text-muted)' : '#5A6B7A')
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: labelCol }}>{label}</span>
      <span className="font-mono text-[11px] tabular-nums" style={{ color: valueCol }}>
        {value}
        {hint && <span className="ml-1.5 text-[10px]" style={{ color: hintCol }}>· {hint}</span>}
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
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
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
        className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-3 py-2 rounded-lg text-white transition-transform hover:-translate-y-px"
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
  // Same pattern as ComparableDealsPanel: distinguish "no dockets in this
  // state" (dockets=[]) from "fetch failed" so the UI stops gaslighting
  // users into thinking there's no regulatory activity when really we
  // couldn't reach the data layer.
  const [fetchError, setFetchError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!state) return
    let cancelled = false
    setLoading(true)
    setFetchError(false)
    getPucDockets({ state }).then(rows => {
      if (cancelled) return
      setDockets(sortDockets(rows || []))
      setLoading(false)
    }).catch(err => {
      console.warn('[regulatory] fetch failed:', err.message)
      if (!cancelled) {
        setDockets([])
        setFetchError(true)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [state, retryKey])

  const labelName = stateName || state || 'this state'
  // Dashboard "Regulatory" tab sits on the dark navy scope; Lens results
  // sit on the cream brand surface. Drive every surface/ text color off this.
  const dark = mode === 'tab'

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

  // Failed fetch — distinct from genuine empty state. Surfaces the network
  // problem instead of pretending the state has no regulatory activity.
  if (fetchError) {
    return (
      <div className={mode === 'lens' ? '' : 'px-5 py-6'}>
        {mode === 'lens' && <PanelHeader stateName={labelName} count={null} />}
        <div
          className={`rounded-xl px-5 py-5 text-center ${mode === 'lens' ? 'mt-4' : ''}`}
          style={{ background: 'rgba(217,119,6,0.04)', border: '1px solid rgba(217,119,6,0.30)' }}
        >
          <p className="text-[13px] font-semibold leading-relaxed" style={{ color: '#92400E' }}>
            Regulatory data temporarily unavailable.
          </p>
          <p className="text-[11px] mt-1.5 mb-3" style={{ color: 'rgba(146,64,14,0.78)' }}>
            Couldn't reach the PUC docket index. Retry, or try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold px-3 py-1 rounded-sm transition-colors"
            style={{ color: '#92400E', border: '1px solid rgba(146,64,14,0.30)', background: 'rgba(255,255,255,0.55)' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

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
          style={dark
            ? { background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--cards-border)' }
            : { background: '#FAFAF7', border: '1px dashed #E2E8F0' }}>
          <p className="text-[13px] leading-relaxed" style={{ color: dark ? 'var(--text-label)' : '#5A6B7A' }}>
            No Tractova-flagged proceedings in <span className="font-medium" style={{ color: dark ? 'var(--text-primary)' : '#0A1828' }}>{labelName}</span> right now.
          </p>
          <p className="text-[11px] mt-1.5 mb-3" style={{ color: dark ? 'var(--text-muted)' : '#5A6B7A' }}>
            We surface only the dockets we've assessed as material — drill into the state PUC e-filing portal directly for the comprehensive index.
          </p>
          <ExplorePucButton state={state} dark={dark} />
        </div>
      </div>
    )
  }

  // Normal render — populated list + a footer-row "Explore source" link
  // so users always have an escape hatch to the comprehensive long tail.
  return (
    <div className={mode === 'lens' ? '' : 'px-5 py-4'}>
      {mode === 'lens' && <PanelHeader stateName={labelName} count={docketsArr.length} />}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`grid grid-cols-1 ${mode === 'lens' ? 'lg:grid-cols-2 gap-4 mt-4' : 'gap-3'}`}
      >
        {docketsArr.map(d => <DocketCard key={d.id} docket={d} dark={dark} />)}
      </motion.div>
      <div className="mt-3 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: `1px solid ${dark ? 'var(--cards-border)' : '#E2E8F0'}` }}>
        <p className="text-[11px] leading-relaxed" style={{ color: dark ? 'var(--text-muted)' : '#5A6B7A' }}>
          Tractova-flagged signal. <span>For the full docket index:</span>
        </p>
        <ExplorePucButton state={state} dark={dark} />
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
          ◆ Regulatory · {stateName}
        </p>
        <h3 className="font-serif text-xl font-semibold text-ink tracking-tight"
          style={{ letterSpacing: '-0.015em' }}>
          Active PUC Dockets
        </h3>
        <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">
          Tractova-flagged proceedings shaping {stateName}'s community-solar / DER market — selective, not exhaustive. Drill to source for the full docket index.
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
