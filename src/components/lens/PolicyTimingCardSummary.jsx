// Policy & Timing summary card — §04 Pillar Diagnostics. Pillar 5 of the
// 5-pillar feasibility model: "how exposed is the project's timeline / how
// likely is the rug pulled?"
//
// Self-contained (no modal): blends a FEDERAL tax-credit timing tier (OBBBA
// §48E/§45Y start-of-construction cutoff + placed-in-service deadline, FEOC,
// safe harbor — a rules engine over published law, keyed to stage + target
// COD) with applicable STATE policy events ranked by severity. No dollars —
// risk tiers only.

import MiniArcGauge from '../library/MiniArcGauge'
import CoverageChip from './CoverageChip'

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

export default function PolicyTimingCardSummary({ score, coverage, policyDetail }) {
  const noData = coverage === 'none' || score == null
  const federal = policyDetail?.federal
  const events = policyDetail?.statePolicy?.events || []
  const tier = federal?.tier && TIER_PALETTE[federal.tier] ? federal.tier : null
  const tierPalette = tier ? TIER_PALETTE[tier] : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3.5 flex flex-col" style={{ minHeight: 200 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: PILLAR_ACCENT }}>
            05 / Policy &amp; Timing
          </p>
          <h3 className="font-serif text-[17px] font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
            {federal?.headline || 'Federal + State Risk'}
          </h3>
        </div>
        <MiniArcGauge score={noData ? null : score} color={PILLAR_ACCENT} />
      </div>

      {noData ? (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-[11px] text-gray-500 leading-snug">
            Add a development stage (and target COD year) to assess §48E/§45Y federal timing exposure and applicable state policy risk.
          </p>
        </div>
      ) : (
        <>
          {/* Federal tax-credit timing tier */}
          {federal && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm font-bold"
                  style={tierPalette ? { background: tierPalette.bg, color: tierPalette.fg, border: `1px solid ${tierPalette.border}` } : {}}>
                  Federal · {tierPalette?.label || federal.tier}
                </span>
              </div>
              {federal.reasons?.[0] && (
                <p className="text-[10px] text-gray-600 leading-snug line-clamp-3">{federal.reasons[0]}</p>
              )}
            </div>
          )}

          {/* State policy events, ranked by severity */}
          <div className="mt-auto">
            {events.length > 0 ? (
              <div className="space-y-1">
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-gray-400 font-bold">
                  {events.length} state polic{events.length === 1 ? 'y' : 'ies'}
                </p>
                {events.slice(0, 3).map((e) => {
                  const sev = SEVERITY_PALETTE[e.severity] || SEVERITY_PALETTE.small
                  return (
                    <div key={e.id} className="flex items-center gap-1.5">
                      <span className="eyebrow-mono px-1 py-0.5 rounded-sm shrink-0" style={{ background: sev.bg, color: sev.fg }}>
                        {e.severity}
                      </span>
                      <span className="text-[10px] text-gray-700 truncate">{e.event_name}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 italic leading-snug">
                No applicable high-confidence state policy headwinds for this stage / size.
              </p>
            )}
          </div>
        </>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100">
        <CoverageChip coverage={coverage} variant="inline" />
      </div>
    </div>
  )
}
