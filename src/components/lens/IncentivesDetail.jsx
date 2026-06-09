import MiniArcGauge from '../library/MiniArcGauge'
import IncentiveStackPanel from './IncentiveStackPanel'

// Incentives pillar deep-dive (the §04 Incentives card's modal body). The
// pillar answers "how rich is the ITC adder stack at this county?" — §48E base
// 30% nationwide + location bonuses scored from real federal data. No dollars.
const PILLAR_ACCENT = '#15803D'

export default function IncentivesDetail({ score, energyCommunity, nmtcLic, hudQctDda, county, tractResolve }) {
  return (
    <div className="px-5 py-4 space-y-4">
      {/* Header — score + framing */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: PILLAR_ACCENT }}>
            03 / Incentives
          </p>
          <h3 className="font-serif text-[20px] font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
            ITC Adder Stack
          </h3>
          <p className="text-[12px] text-gray-600 leading-relaxed mt-1.5 max-w-prose">
            The §48E base 30% (with prevailing-wage + apprenticeship) is available nationwide. The location-bonus stack below varies by county and is scored from real federal eligibility data — a full stack pushes the effective ITC toward ~50%.
          </p>
        </div>
        <MiniArcGauge score={score} color={PILLAR_ACCENT} />
      </div>

      {/* Eligibility panel (shared with the Offtake detail) */}
      <IncentiveStackPanel energyCommunity={energyCommunity} nmtcLic={nmtcLic} hudQctDda={hudQctDda} county={county} tractResolve={tractResolve} />

      {/* Base-credit + scoring note */}
      <div className="rounded-md px-3 py-2.5 bg-surface space-y-1.5">
        <p className="eyebrow-mono font-bold" style={{ color: PILLAR_ACCENT }}>How the Incentives sub-score works</p>
        <ul className="text-[11px] text-gray-700 leading-snug list-none space-y-1">
          <li><span className="font-semibold text-ink">Base 50</span> · §48E eligibility (30% with PW&amp;A) — available in every county.</li>
          <li><span className="font-semibold text-ink">+25 Energy Community</span> · coal-closure tract or fossil-fuel MSA designation (DOE NETL).</li>
          <li><span className="font-semibold text-ink">+25 Low-Income (§48e)</span> · qualifying NMTC LIC tract (DOE §48e / CDFI CIMS · ACS 2016-2020), ≤5 MW. HUD QCT/DDA is a separate LIHTC instrument — shown for context, but it does NOT grant this ITC adder.</li>
          <li className="text-gray-500 italic">Coverage reads "live" when the county FIPS resolves against the federal layers; otherwise the pillar is excluded from the composite rather than scored on a fabricated baseline.</li>
        </ul>
      </div>

      <p className="text-[10px] text-gray-500 italic leading-relaxed">
        Energy-Community / flood / wetland reads are county-level. §48(e) LIC is shown for the census tract your address resolves to when provided (the neighborhood, not the parcel); it screens eligibility, not the official IRS determination — verify with tax counsel before banking an adder.
      </p>
    </div>
  )
}
