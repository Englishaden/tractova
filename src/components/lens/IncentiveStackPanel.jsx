import LoadingDot from '../ui/LoadingDot'

// Shared ITC adder-eligibility panel — the federal location-bonus stack
// (Energy Community +10% · §48(e) Cat 1 LIC +10% · HUD QCT/DDA LIHTC) on top
// of the §48E base 30%. Rendered both inside the Offtake detail (CS revenue
// stack context) and as the body of the Incentives pillar detail tab, so the
// eligibility read is one component, not two divergent copies. No dollars —
// eligibility + the resulting ITC ceiling only.
export default function IncentiveStackPanel({ energyCommunity, nmtcLic, hudQctDda, county }) {
  return (
    <div className="px-3 py-2.5 rounded-md border border-teal-100 bg-teal-50/40 space-y-2">
      {/* Energy Community row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow-mono font-semibold text-teal-800 mb-1">
            Energy Community (+10% ITC)
          </div>
          {energyCommunity?.isEnergyCommunity ? (
            <>
              <div className="text-xs font-semibold text-teal-900">
                ✓ Eligible — {[
                  energyCommunity.qualifiesViaCoalClosure && `${energyCommunity.coalClosureTractCount} coal-closure tract${energyCommunity.coalClosureTractCount === 1 ? '' : 's'}`,
                  energyCommunity.qualifiesViaMsa && (energyCommunity.msaAreaName ? `MSA: ${energyCommunity.msaAreaName}` : 'Statistical area'),
                ].filter(Boolean).join(' · ')}
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                Adds 10% to ITC for projects in {energyCommunity.countyName || 'this county'}. Brownfield sites qualify separately.
              </div>
            </>
          ) : energyCommunity === null ? (
            <>
              <div className="text-xs text-gray-700">Not flagged in Treasury data</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                County not in MSA / coal-closure layers. Brownfield qualification still possible at site level.
              </div>
            </>
          ) : (
            <LoadingDot message="Checking" size="sm" />
          )}
        </div>
        <a
          href="https://energycommunities.gov/energy-community-tax-credit-bonus/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
          title="DOE NETL Energy Communities Tax Credit Bonus tool — the canonical lookup for IRA §45/§48 +10% adder eligibility"
        >
          Source ↗
        </a>
      </div>

      {/* §48(e) Category 1 row */}
      <div className="pt-2 border-t border-teal-100/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow-mono font-semibold text-teal-800 mb-1">
            §48(e) Cat 1 LIC (+10% ITC)
          </div>
          {nmtcLic?.isEligible ? (
            <>
              <div className="text-xs font-semibold text-teal-900">
                ✓ Eligible — {nmtcLic.qualifyingTractsCount} of {nmtcLic.totalTractsInCounty} tract{nmtcLic.totalTractsInCounty === 1 ? '' : 's'} qualify as NMTC LIC
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                Project sited in any of these tracts adds 10% to ITC (≤5 MW only). Stacks with Energy Community above.
                {nmtcLic.qualifyingViaPoverty > 0 && nmtcLic.qualifyingViaLowMfi > 0 && (
                  <> Via poverty: {nmtcLic.qualifyingViaPoverty} · via low MFI: {nmtcLic.qualifyingViaLowMfi}.</>
                )}
              </div>
            </>
          ) : nmtcLic ? (
            <>
              <div className="text-xs text-gray-700">No qualifying NMTC LIC tracts in this county</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                Categories 3-4 (low-income residential / economic benefit) may still qualify — verify with tax counsel.
              </div>
            </>
          ) : (
            <LoadingDot message="Checking" size="sm" />
          )}
        </div>
        <a
          href="https://www.irs.gov/credits-deductions/low-income-communities-bonus-credit"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
        >
          Source ↗
        </a>
      </div>

      {/* HUD QCT / Non-Metro DDA row -- LIHTC instrument, NOT ITC. */}
      <div className="pt-2 border-t border-teal-100/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow-mono font-semibold text-teal-800 mb-1">
            HUD QCT / Non-Metro DDA (LIHTC)
          </div>
          {hudQctDda && (hudQctDda.qctCount > 0 || hudQctDda.isNonMetroDda) ? (
            <>
              <div className="text-xs font-semibold text-teal-900">
                ✓ Designated — {[
                  hudQctDda.qctCount > 0 && `${hudQctDda.qctCount} Qualified Census Tract${hudQctDda.qctCount === 1 ? '' : 's'}`,
                  hudQctDda.isNonMetroDda && (hudQctDda.ddaName || 'non-metro DDA'),
                ].filter(Boolean).join(' · ')}
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                LIHTC bonus credit eligibility for hybrid CS + affordable-housing structures. Strong overlap with state CS LMI carve-outs (NY VDER, IL Shines low-income tier, MA SMART LMI adder). Different instrument from ITC — does not stack into the ceiling below.
              </div>
            </>
          ) : hudQctDda ? (
            <>
              <div className="text-xs text-gray-700">No QCT or non-metro DDA in {county || 'this county'}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                Metro-area DDAs are designated at ZCTA level — verify per-site at huduser.gov for metropolitan projects.
              </div>
            </>
          ) : (
            <LoadingDot message="Checking" size="sm" />
          )}
        </div>
        <a
          href="https://www.huduser.gov/portal/qct/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
        >
          Source ↗
        </a>
      </div>

      {/* Combined ITC summary — only when at least one ITC bonus applies.
          LIHTC excluded (separate instrument). */}
      {(energyCommunity?.isEnergyCommunity || nmtcLic?.isEligible) && (
        <div className="pt-2 border-t border-teal-200/60 flex items-baseline justify-between">
          <span className="eyebrow-mono font-semibold text-teal-900">
            Combined ITC ceiling
          </span>
          <span className="font-serif text-base font-bold text-teal-900">
            Up to {30 + (energyCommunity?.isEnergyCommunity ? 10 : 0) + (nmtcLic?.isEligible ? 10 : 0)}%
          </span>
        </div>
      )}
    </div>
  )
}
