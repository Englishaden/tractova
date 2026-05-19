// Policy pillar summary card — 4th tile in the §04 row alongside Offtake /
// IX / Site Control. Replaces the standalone LensPolicyClimateSection
// that sat loose below the pillars (Aden flagged it as feeling thrown
// behind the row instead of being a peer).
//
// Click → opens the same PillarDetailModal as the other pillars on the
// 'policy' tab, which renders LensPolicyClimateSection inside.

import { SummaryShell } from './OfftakeCardSummary'

// Policy pillar accent — violet (purple-700). Distinct from the existing
// teal / amber / blue pillar palette. Solid color, not a gradient
// (gradients are the design-vocab anti-pattern, not solid purples).
const PILLAR_ACCENT = '#5B21B6'

export default function PolicyPillarCardSummary({ policyEvents = [], stateName, score, coverage, onOpen }) {
  const active = Array.isArray(policyEvents)
    ? policyEvents.filter(e => e?.is_active !== false && (e.review_status === 'published' || !e.review_status))
    : []
  const headwinds = active.filter(e =>
    e.impact_confidence === 'high' && (e.capex_delta > 0 || e.opex_delta > 0 || e.revenue_haircut > 0)
  )
  const tailwinds = active.filter(e =>
    e.impact_confidence === 'high' && (e.capex_delta < 0 || e.opex_delta < 0 || e.revenue_haircut < 0)
  )

  const title = active.length > 0
    ? `${active.length} active polic${active.length === 1 ? 'y' : 'ies'}`
    : 'No active policy'

  let caption = null
  if (active.length === 0) {
    caption = `No active policy events tracked for ${stateName || 'this state'}.`
  } else {
    const top = headwinds[0] || tailwinds[0] || active[0]
    caption = top?.event_name || `Mixed signals · ${headwinds.length} headwind${headwinds.length === 1 ? '' : 's'} · ${tailwinds.length} tailwind${tailwinds.length === 1 ? '' : 's'}`
  }

  // Status chip — counts and color-codes headwind vs tailwind balance.
  let statusChip = null
  if (active.length > 0) {
    const isHeadwindHeavy = headwinds.length > tailwinds.length
    statusChip = (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-sm"
        style={
          isHeadwindHeavy
            ? { background: 'rgba(217,119,6,0.12)', color: '#92400E', border: '1px solid rgba(217,119,6,0.35)' }
            : tailwinds.length > 0
            ? { background: 'rgba(20,184,166,0.12)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.35)' }
            : { background: 'rgba(15,26,46,0.06)', color: '#475569', border: '1px solid rgba(15,26,46,0.18)' }
        }
      >
        {headwinds.length}↓ · {tailwinds.length}↑
      </span>
    )
  }

  return (
    <SummaryShell
      pillarLabel="04 / Policy"
      pillarAccent={PILLAR_ACCENT}
      title={title}
      score={score}
      coverage={coverage}
      caption={caption}
      statusChip={statusChip}
      onOpen={onOpen}
    />
  )
}
