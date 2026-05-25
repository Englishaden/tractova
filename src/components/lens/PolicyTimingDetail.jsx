import MiniArcGauge from '../library/MiniArcGauge'
import { FEDERAL_TIMELINE } from '../../lib/federalTimeline'

// Policy & Timing pillar deep-dive (the §04 Policy & Timing card's modal body).
// Federal tax-credit timing rules engine (OBBBA §48E/§45Y) + applicable state
// policy headwinds (severity × probability). No dollars — risk tiers only.
const PILLAR_ACCENT = '#475569'

const TIER_PALETTE = {
  clear:   { label: 'On track', bg: 'rgba(20,184,166,0.10)', fg: '#0F766E', border: 'rgba(20,184,166,0.30)' },
  watch:   { label: 'Watch',    bg: 'rgba(217,119,6,0.10)',  fg: '#92400E', border: 'rgba(217,119,6,0.30)' },
  at_risk: { label: 'At risk',  bg: 'rgba(220,38,38,0.08)',  fg: '#B91C1C', border: 'rgba(220,38,38,0.25)' },
}
const SEVERITY_PALETTE = {
  severe: { bg: 'rgba(220,38,38,0.12)', fg: '#991B1B' },
  medium: { bg: 'rgba(217,119,6,0.12)', fg: '#92400E' },
  small:  { bg: 'rgba(15,26,46,0.06)',  fg: '#475569' },
}

export default function PolicyTimingDetail({ score, policyDetail }) {
  const federal = policyDetail?.federal
  const events = policyDetail?.statePolicy?.events || []
  const tier = federal?.tier && TIER_PALETTE[federal.tier] ? federal.tier : 'watch'
  const tp = TIER_PALETTE[tier]

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: PILLAR_ACCENT }}>
            05 / Policy &amp; Timing
          </p>
          <h3 className="font-serif text-[20px] font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
            {federal?.headline || 'Federal + State Risk'}
          </h3>
          <p className="text-[12px] text-gray-600 leading-relaxed mt-1.5 max-w-prose">
            How exposed is this project to the rug being pulled? A federal tax-credit timing rules engine (keyed to stage + target COD) blended with applicable state policy headwinds — risk tiers, no dollars.
          </p>
        </div>
        <MiniArcGauge score={score} color={PILLAR_ACCENT} />
      </div>

      {/* Federal timing */}
      {federal && (
        <div className="rounded-md border px-3 py-3" style={{ borderColor: tp.border, background: tp.bg }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm font-bold" style={{ background: 'rgba(255,255,255,0.6)', color: tp.fg, border: `1px solid ${tp.border}` }}>
              Federal §48E/§45Y · {tp.label}
            </span>
          </div>
          <ul className="space-y-1.5">
            {(federal.reasons || []).map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-snug" style={{ color: tp.fg }}>
                <span className="shrink-0">·</span><span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Federal calendar reference */}
      <div className="rounded-md px-3 py-2.5 bg-surface">
        <p className="eyebrow-mono font-bold mb-1.5" style={{ color: PILLAR_ACCENT }}>OBBBA / IRA federal calendar</p>
        <ul className="text-[11px] text-gray-700 leading-snug list-none space-y-1">
          <li><span className="font-semibold text-ink">{FEDERAL_TIMELINE.socCutoff}</span> · §48E/§45Y start-of-construction continuity cutoff — start by this date for the ~4-yr placed-in-service window.</li>
          <li><span className="font-semibold text-ink">{FEDERAL_TIMELINE.postCutoffPisDeadline}</span> · placed-in-service deadline if construction starts after the cutoff.</li>
          <li><span className="font-semibold text-ink">FEOC ({FEDERAL_TIMELINE.feocConstructionYear}+)</span> · Foreign-Entity-of-Concern restrictions apply to construction starting {FEDERAL_TIMELINE.feocConstructionYear}; Treasury start-of-construction rules pending → scored as "watch."</li>
          <li><span className="font-semibold text-ink">{FEDERAL_TIMELINE.safeHarborChange}</span> · 5% cost safe harbor removed for projects &gt; {FEDERAL_TIMELINE.safeHarborMwThreshold} MWac → Physical Work Test required.</li>
        </ul>
        <p className="text-[9px] text-gray-500 italic mt-1.5">Source: {FEDERAL_TIMELINE.source}</p>
      </div>

      {/* State policy headwinds */}
      <div>
        <p className="eyebrow-mono font-bold mb-2" style={{ color: PILLAR_ACCENT }}>
          State policy headwinds {events.length > 0 ? `(${events.length} applicable)` : ''}
        </p>
        {events.length > 0 ? (
          <div className="space-y-1.5">
            {events.map((e) => {
              const sev = SEVERITY_PALETTE[e.severity] || SEVERITY_PALETTE.small
              return (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-sm px-2.5 py-2 bg-surface">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="eyebrow-mono px-1 py-0.5 rounded-sm shrink-0" style={{ background: sev.bg, color: sev.fg }}>{e.severity}</span>
                    <span className="text-[12px] text-ink font-medium truncate">{e.event_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-500 font-mono">prob: {e.probability} · {e.pillar}</span>
                    {e.source_url && (
                      <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900">Source ↗</a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic leading-snug">
            No applicable high-confidence state policy headwinds for this project's stage / size. The full chronological state regulatory feed (including lower-confidence events + PUC dockets) is in §06 Regulatory Watch.
          </p>
        )}
      </div>
    </div>
  )
}
