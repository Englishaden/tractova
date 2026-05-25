// Incentives summary card — §04 Pillar Diagnostics. Pillar 4 of the
// 5-pillar feasibility model: "can we get ITC step-ups in this county?"
//
// Unlike the offtake/IX/site cards (which open the PillarDetailModal), this
// card is self-contained — the ITC adder stack is compact enough to read
// in full inline (eligibility chips + the resolved designation detail).
// All data is REAL, county-level federal eligibility (EPA Energy Communities,
// Census/CDFI §48(e) NMTC, HUD QCT/DDA). No dollars — eligibility only.

import MiniArcGauge from '../library/MiniArcGauge'
import CoverageChip from './CoverageChip'

const PILLAR_ACCENT = '#15803D'

// One eligibility chip: green when the adder is available at this county,
// muted slate when not. Keeps the binary read instant.
function AdderChip({ label, eligible, detail }) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-2 py-1 rounded-sm"
      style={eligible
        ? { background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.25)' }
        : { background: 'rgba(15,26,46,0.04)', border: '1px solid #E2E8F0' }}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0 text-white"
          style={{ background: eligible ? '#15803D' : '#CBD5E1' }}
        >
          {eligible ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          )}
        </span>
        <span className="text-[11px] font-medium truncate" style={{ color: eligible ? '#166534' : '#64748B' }}>{label}</span>
      </span>
      {detail && <span className="text-[9px] font-mono tabular-nums shrink-0" style={{ color: eligible ? '#15803D' : '#94A3B8' }}>{detail}</span>}
    </div>
  )
}

export default function IncentivesCardSummary({ score, coverage, adders, energyCommunity, nmtcLic, hudQctDda }) {
  const noData = coverage === 'none' || score == null

  // Resolved-designation detail (honest, source-derived) for the chips.
  const ecVia = energyCommunity?.qualifiesViaCoalClosure
    ? 'coal closure'
    : energyCommunity?.qualifiesViaMsa ? 'MSA' : null
  const nmtcCount = nmtcLic?.qualifyingTractsCount
  const qctCount = hudQctDda?.qctCount

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3.5 flex flex-col" style={{ minHeight: 200 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: PILLAR_ACCENT }}>
            04 / Incentives
          </p>
          <h3 className="font-serif text-[17px] font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
            ITC Adder Stack
          </h3>
        </div>
        <MiniArcGauge score={noData ? null : score} color={PILLAR_ACCENT} />
      </div>

      {noData ? (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-[11px] text-gray-500 leading-snug">
            County-level incentive eligibility not resolved for this geography. Verify Energy Community / §48(e) LIC status directly before underwriting an ITC adder.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 mb-2">
            <AdderChip
              label="Energy Community"
              eligible={!!adders?.energyCommunity}
              detail={adders?.energyCommunity ? (ecVia || '+10%') : null}
            />
            <AdderChip
              label="Low-Income (§48e)"
              eligible={!!adders?.lowIncomeCommunity}
              detail={adders?.lowIncomeCommunity ? '+10%' : null}
            />
            <AdderChip
              label="NMTC tracts"
              eligible={!!adders?.nmtc}
              detail={nmtcCount != null && nmtcCount > 0 ? `${nmtcCount} tract${nmtcCount === 1 ? '' : 's'}` : null}
            />
            <AdderChip
              label="HUD QCT / DDA"
              eligible={!!adders?.hudQctDda}
              detail={qctCount != null && qctCount > 0 ? `${qctCount} QCT` : (hudQctDda?.isNonMetroDda ? 'DDA' : null)}
            />
          </div>
          <p className="text-[10px] text-gray-500 leading-snug mt-auto">
            §48E base 30% (PW&amp;A) available nationwide; adders above stack on top — up to ~50% ITC.
          </p>
        </>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100">
        <CoverageChip coverage={coverage} variant="inline" />
      </div>
    </div>
  )
}
