// Policy Impact Ecosystem (PIE-001) Phase D — pillar-routed policy chips.
//
// Renders the active policy_impact_events for a given state + pillar,
// filtered against the project's MW band, stage, and technology.
// One chip per applicable policy; click expands methodology + source.
//
// Drop into any card to surface "this state has active policy effects
// in this pillar." Honest-data discipline:
//   - high-confidence policies show "💵 Modeled in financials" badge
//     (they ARE in Studio + composite score).
//   - medium/low show "📋 Qualitative — not modeled" badge.
//
// No state-name hardcoding — the component is generic and renders
// whatever rows exist for the state.

import { useState } from 'react'

const PILLAR_LABEL = {
  offtake:        'Offtake',
  ix:             'Interconnect',
  site:           'Site',
  'cross-cutting': 'Cross-cutting',
}

const CONFIDENCE_STYLE = {
  high:   { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.40)', color: '#92400E', label: '💵 Modeled' },
  medium: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', color: '#92400E', label: '📋 Qualitative' },
  low:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)', color: '#475569', label: '📋 Qualitative' },
}

/**
 * Filters policies for the given pillar + applicability shape. Display-only —
 * shows all confidence levels (the user wants to SEE all active policies on
 * the card, even ones that don't move numbers). The high-confidence subset
 * is what moves Studio IRR + composite score (handled by policyAdjustments).
 *
 * MW band filter: shown if mw is provided and the row has bands. We INCLUDE
 * rows without bands (uniform policies) since they apply to all sizes.
 */
function filterForPillar(events, pillar, { mw, technology } = {}) {
  if (!Array.isArray(events) || events.length === 0) return []
  const mwNum = Number(mw) || null
  return events.filter(e => {
    if (!e || e.is_active === false) return false
    if (e.review_status && e.review_status !== 'published') return false
    if (e.pillar !== pillar) return false

    // MW band: inclusive lower, exclusive upper.
    if (mwNum != null) {
      if (e.min_mw_ac != null && mwNum < e.min_mw_ac) return false
      if (e.max_mw_ac != null && mwNum >= e.max_mw_ac) return false
    }
    // Technology filter — null array = applies to all.
    if (technology && Array.isArray(e.applicable_technologies) && e.applicable_technologies.length > 0) {
      if (!e.applicable_technologies.includes(technology)) return false
    }
    return true
  })
}

function PolicyChip({ event }) {
  const [open, setOpen] = useState(false)
  const conf = event.impact_confidence || 'low'
  const style = CONFIDENCE_STYLE[conf] || CONFIDENCE_STYLE.low
  const tierTag = (event.min_mw_ac != null && event.max_mw_ac != null) ? ` · ${event.min_mw_ac}-${event.max_mw_ac} MW` : ''
  const shortLabel = (event.event_name || '').slice(0, 60)

  return (
    <div className="rounded-md border" style={{ borderColor: style.border, background: style.bg }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: style.color, color: 'white' }}>
            {PILLAR_LABEL[event.pillar] || event.pillar}
          </span>
          <span className="text-[11px] font-semibold truncate" style={{ color: style.color }}>{shortLabel}{tierTag}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: style.color, opacity: 0.75 }}>{style.label}</span>
          <span className="text-[9px]" style={{ color: style.color }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-[10px] leading-snug" style={{ color: style.color }}>
          {event.summary && <div className="mb-1">{event.summary}</div>}
          {event.effective_date && <div className="opacity-70 mb-1">Effective {event.effective_date}</div>}
          {event.impact_methodology && (
            <div className="border-t pt-1 mt-1 whitespace-pre-wrap opacity-90" style={{ borderColor: style.border }}>
              {event.impact_methodology.slice(0, 600)}
            </div>
          )}
          {event.source_url && (
            <div className="mt-1.5">
              <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: style.color }}>
                source ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PolicyChipStrip({ pillar, policyEvents, mw, technology, className = '' }) {
  const applicable = filterForPillar(policyEvents, pillar, { mw, technology })
  if (applicable.length === 0) return null

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold text-gray-500 flex items-center gap-1.5">
        <span>◆ Active Policy</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-400">{applicable.length} event{applicable.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1">
        {applicable.map((e) => <PolicyChip key={e.id} event={e} />)}
      </div>
    </div>
  )
}
