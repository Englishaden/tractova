import { computeCIRevenueProjection, computeBESSProjection, computeHybridProjection, SOLAR_RATES_AS_OF, CI_RATES_AS_OF, BESS_RATES_AS_OF } from '../lib/revenueEngine'
import {
  CollapsibleCard,
  CardDrilldown,
  SectionLabel,
  DataRow,
  RevenueStackBar,
  RevenueProjectionSection,
  CSStatusBadge,
  RunwayBadge,
  SolarCostLineagePanel,
} from '../pages/Search.jsx'

export default function OfftakeCard({ stateProgram, revenueStack, technology, mw, rates, energyCommunity, nmtcLic, hudQctDda, county }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const runway = stateProgram?.runway ?? null
  const isCS = technology === 'Community Solar'

  return (
    <CollapsibleCard
      accentColor="#0F766E"
      eyebrow="01 / Offtake"
      title={isCS ? (stateProgram?.csProgram || 'No CS Program') : `${technology}`}
      caption={isCS ? 'PROGRAM STATUS · REVENUE STACK' : 'REVENUE PROFILE'}
    >
      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Per-state $/W data lineage panel — promoted out of the methodology
            dropdown 2026-05-05 so the Tier A/B confidence is visible at first
            glance, not buried behind a click-to-expand. Self-hides when no
            rates row exists (non-CS-active states). */}
        <SolarCostLineagePanel rates={rates} stateName={stateProgram?.name} />

        {isCS ? (
          <>
            {/* CS program status — only for Community Solar */}
            <div>
              <SectionLabel>Community Solar Program</SectionLabel>
              {hasProgram ? (
                <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-500">Program</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-800 text-right max-w-[180px] leading-tight">{stateProgram.csProgram}</span>
                      <CSStatusBadge csStatus={stateProgram.csStatus} />
                    </div>
                  </div>
                  <DataRow
                    label="Capacity remaining"
                    value={stateProgram.capacityMW > 0 ? `${stateProgram.capacityMW.toLocaleString()} MW` : '—'}
                    highlight
                  />
                  <DataRow
                    label="LMI allocation required"
                    value={
                      stateProgram.lmiRequired
                        ? (stateProgram.lmiPercent > 0
                            ? `Yes — ${stateProgram.lmiPercent}%`
                            : 'Yes — % not yet finalized')
                        : 'No'
                    }
                  />
                  {mw && stateProgram.capacityMW > 0 && (
                    <DataRow
                      label="Project share of remaining"
                      value={`${((parseFloat(mw) / stateProgram.capacityMW) * 100).toFixed(1)}%`}
                    />
                  )}
                  {runway ? (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-xs text-gray-500">Est. program runway</span>
                      <RunwayBadge runway={runway} />
                    </div>
                  ) : stateProgram?.csStatus !== 'none' && (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-xs text-gray-500">Est. program runway</span>
                      <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-sm">Contact program administrator for current fill status</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-3">
                  <p className="text-xs font-medium text-gray-600">No active community solar program in this state.</p>
                  {stateProgram?.programNotes && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{stateProgram.programNotes}</p>
                  )}
                </div>
              )}
            </div>

            {/* Revenue stack — only for Community Solar */}
            {revenueStack ? (
              <div>
                <SectionLabel>Revenue Stack</SectionLabel>
                <RevenueStackBar revenueStack={revenueStack} />
                <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
                  <DataRow label="ITC base" value={revenueStack.itcBase} highlight />
                  <DataRow label="ITC adders" value={revenueStack.itcAdder} />
                  <DataRow label="REC / I-REC market" value={revenueStack.irecMarket} />
                  <DataRow label="Net metering / credit" value={revenueStack.netMeteringStatus} />
                </div>
                {/* Federal ITC bonus credits panel — Energy Community + §48(e) Cat 1
                    stack on top of the base 30% ITC. A project hitting both adders
                    can reach 50% effective ITC. Live-pulled, both rows verified per
                    county. */}
                <div className="mt-2 px-3 py-2.5 rounded-md border border-teal-100 bg-teal-50/40 space-y-2">
                  {/* Energy Community row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
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
                        <div className="text-xs text-gray-400">Loading…</div>
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
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
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
                        <div className="text-xs text-gray-400">Loading…</div>
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

                  {/* HUD QCT / Non-Metro DDA row -- LIHTC instrument, NOT ITC.
                      Folded into the same teal-stack panel because it's another
                      federal geographic-designation incentive overlay, but
                      excluded from the ITC ceiling math below since it's a
                      different tax credit. */}
                  <div className="pt-2 border-t border-teal-100/60 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
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
                        <div className="text-xs text-gray-400">Loading…</div>
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

                  {/* Combined ITC summary — only shown if at least one bonus applies.
                      LIHTC is intentionally excluded since it's a separate instrument. */}
                  {(energyCommunity?.isEnergyCommunity || nmtcLic?.isEligible) && (
                    <div className="pt-2 border-t border-teal-200/60 flex items-baseline justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-900">
                        Combined ITC ceiling
                      </span>
                      <span className="font-serif text-base font-bold text-teal-900">
                        Up to {30 + (energyCommunity?.isEnergyCommunity ? 10 : 0) + (nmtcLic?.isEligible ? 10 : 0)}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">{revenueStack.summary}</p>
                {revenueStack.dsireProgramUrl && (
                  <p className="text-[10px] text-gray-400 mt-1.5 px-1 leading-relaxed">
                    Verified against{' '}
                    <a
                      href={revenueStack.dsireProgramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono uppercase tracking-[0.14em] text-teal-700 hover:text-teal-900 underline"
                    >
                      DSIRE
                    </a>
                    {revenueStack.dsireLastVerified && (
                      <span> · last checked {new Date(revenueStack.dsireLastVerified).toISOString().slice(0, 10)}</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <SectionLabel>Revenue Stack</SectionLabel>
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">ITC base (federal)</span>
                    <span className="font-semibold text-gray-700">30%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">State-specific incentive details available at <a href="https://dsireusa.org" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline hover:text-teal-700">dsireusa.org</a></p>
                </div>
              </div>
            )}

            {/* Revenue Projection — quantitative $/MW estimate */}
            <RevenueProjectionSection stateId={stateProgram?.id} mw={mw} rates={rates} />
          </>
        ) : (
          /* Non-CS technology — structured analysis per tech type */
          <div className="space-y-4">
            <SectionLabel>{technology} Offtake</SectionLabel>

            {technology === 'C&I Solar' && (() => {
              const proj = computeCIRevenueProjection(stateProgram?.id, mw, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(37,99,235,0.25)', borderLeft: '3px solid #2563EB' }}>
                      {/* M1 fix 2026-05-05: surface CI rate vintage at top of
                          card. PPA + retail rates anchor on EIA Form 861 +
                          Lazard LCOE+ v18 — utility tariffs change quarterly,
                          so the savings % can drift. Mirrors BESS pattern. */}
                      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2" style={{ background: 'rgba(37,99,235,0.05)' }}>
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold shrink-0"
                          style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.30)' }}
                          title="C&I capex anchors on NREL CS MMP -$0.05 + LBNL TTS 2024; PPA + retail rates retained from prior 2025-Q2 EIA Form 861. Utility tariffs change quarterly — verify current PUC tariff filings before committing."
                        >
                          ◆ Rates as of {CI_RATES_AS_OF.split('+')[0].trim()}
                        </span>
                        <span className="text-[10px] text-gray-500 leading-tight">verify utility tariff before committing</span>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(37,99,235,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual PPA Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Offtaker Savings</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#2563EB' }}>{proj.savingsPercent}%</p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">PPA rate</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.ppaRateCentsKwh}¢/kWh</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">vs. utility retail rate</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.retailRateCentsKwh}¢/kWh</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Annual escalator</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.escalatorPct}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ITC (one-time)</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)} <span className="font-normal text-gray-400">({proj.itcPct}%)</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                          <span className="text-gray-500">25-year NPV <span className="text-gray-400">(8% discount)</span></span>
                          <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv25)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">C&I success depends on anchor tenant credit quality and contract length. PPA rates are state-level estimates.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see C&I PPA revenue projection.'
                          : `C&I PPA revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for C&I; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'BESS' && (() => {
              const proj = computeBESSProjection(stateProgram?.id, mw, 4, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.25)', borderLeft: '3px solid #7C3AED' }}>
                      {/* Vintage chip at the TOP of the BESS card — 2026-05-05
                          C2 fix: the "as of" stamp used to live at the panel
                          footer; users would read the headline number + payback
                          first and miss the staleness disclosure. ISO capacity
                          prices swing 2-9× YoY (per DataLimitationsModal §03),
                          so the vintage IS the trust anchor. Surface it before
                          the number, not after. */}
                      {proj.ratesAsOf && (
                        <div className="px-4 pt-2.5 pb-1 flex items-center gap-2" style={{ background: 'rgba(124,58,237,0.05)' }}>
                          <span
                            className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold shrink-0"
                            style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.30)' }}
                            title="BESS rates anchor on 2025/26 ISO clearing × 4hr accreditation + NREL ATB 2024 capex. Demand charge + arbitrage components remain seeded synthesis. Verify against your ISO's most recent capacity-market clearing results before committing capital."
                          >
                            ◆ Rates as of {proj.ratesAsOf}
                          </span>
                          <span className="text-[10px] text-gray-500 leading-tight">verify ISO clearing before committing</span>
                        </div>
                      )}
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(124,58,237,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payback</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#7C3AED' }}>{proj.paybackYears ? `${proj.paybackYears}yr` : '—'}</p>
                        </div>
                      </div>
                      {/* Three revenue stream tiles */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100">
                        {[
                          { label: 'Capacity Market', value: fmt(proj.capacityRevenue), sub: `$${proj.capacityPerKwYear}/kW-yr`, color: '#7C3AED' },
                          { label: 'Demand Charge', value: fmt(proj.demandChargeRevenue), sub: `$${proj.demandChargePerKwMonth}/kW-mo`, color: '#8B5CF6' },
                          { label: 'Arbitrage', value: fmt(proj.arbitrageRevenue), sub: `$${proj.arbitragePerMwh}/MWh`, color: '#A78BFA' },
                        ].map(s => (
                          <div key={s.label} className="bg-white px-3 py-2.5 text-center">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{s.label}</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">{s.sub}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ISO/RTO region</span>
                          <span className="font-semibold text-gray-700">{proj.isoRegion}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Duration</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.durationHrs}-hour ({proj.mwh} MWh)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Installed cost</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.installedCostTotal)} <span className="font-normal text-gray-400">@ ${proj.installedCostPerKwh}/kWh</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ITC (one-time)</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)} <span className="font-normal text-gray-400">({proj.itcPct}%)</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                          <span className="text-gray-500">15-year NPV <span className="text-gray-400">(8% discount)</span></span>
                          <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv15)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">Revenue depends on {proj.isoRegion} capacity market pricing — historically volatile. 15-year NPV reflects battery lifecycle. (Rate vintage shown at top of card.)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see BESS revenue projection.'
                          : `BESS revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for BESS; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'Hybrid' && (() => {
              const mwNum = parseFloat(mw) || 0
              const solarMW = mwNum
              const storageMW = Math.round(mwNum * 0.5 * 10) / 10
              const proj = computeHybridProjection(stateProgram?.id, solarMW, storageMW, 4, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(5,150,105,0.25)', borderLeft: '3px solid #059669' }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(5,150,105,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Combined Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Revenue / MW</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#059669' }}>{fmt(proj.revenuePerMW)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-gray-100">
                        <div className="bg-white px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Solar ({proj.solarMW} MW)</p>
                          <p className="text-sm font-bold tabular-nums" style={{ color: '#059669' }}>{fmt(proj.solarAnnualRevenue)}<span className="text-[9px] font-normal text-gray-400 ml-1">/yr</span></p>
                        </div>
                        <div className="bg-white px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Storage ({proj.storageMW} MW / {proj.durationHrs}hr)</p>
                          <p className="text-sm font-bold tabular-nums" style={{ color: '#7C3AED' }}>{fmt(proj.storageAnnualRevenue)}<span className="text-[9px] font-normal text-gray-400 ml-1">/yr</span></p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Total installed cost</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.totalInstalledCost)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Solar 25yr NPV</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.solarNpv25)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Storage 15yr NPV</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.storageNpv15)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">Hybrid assumes {proj.storageMW}MW / {proj.durationHrs}hr co-located storage. ITC applied at 30% for both solar and storage components.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see hybrid revenue projection.'
                          : `Hybrid revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for hybrid; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Program notes — shown for all tech types */}
        {hasProgram && stateProgram.programNotes && (
          <div>
            <SectionLabel>Developer Notes</SectionLabel>
            <p className="text-xs text-gray-600 leading-relaxed">{stateProgram.programNotes}</p>
          </div>
        )}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#0F766E" label="How we built this revenue stack — sources, ITC math, assumptions">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>Revenue stack composition</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">ITC base</span> · 30% federal Investment Tax Credit (IRA §48) — requires prevailing-wage + apprenticeship compliance. Projects that don't meet PW&amp;A drop to a 6% base credit. Verify labor compliance with tax counsel before assuming the 30% figure.</li>
            <li><span className="font-semibold text-ink">ITC adders</span> · stack on the 30% base — Energy Community (+10%), §48(e) Cat 1 LIC (+10%, ≤5MW). Combined ceiling reaches 50% effective ITC for projects qualifying for both.</li>
            <li><span className="font-semibold text-ink">IREC / SREC market</span> · state-level renewable energy certificates. Tradable, $/MWh varies wildly by state (NJ $250, MA $30, IL $80 typical 2024).</li>
            <li><span className="font-semibold text-ink">Net metering / bill credit</span> · the per-kWh value of generation injected into the grid. Subject to NEM tariff rules — see precedent: CA NEM 3.0 cut bill credits 57% in Apr 2023.</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>IRA bonus eligibility (§48 ITC)</p>
          <div className="grid grid-cols-1 gap-1.5 text-[10px]">
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">Energy Community (+10%)</p>
              <p className="text-teal-900 mt-0.5">County-level eligibility via coal-closure tract OR fossil-fuel MSA designation. Brownfield sites qualify separately at site level.</p>
            </div>
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">§48(e) Cat 1 LIC (+10%)</p>
              <p className="text-teal-900 mt-0.5">Project sited in NMTC Low-Income Community tract (poverty rate ≥ 20% OR median income ≤ 80% area). Cap: 5 MW. Allocated annually via Treasury auction.</p>
            </div>
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">HUD QCT / Non-Metro DDA (LIHTC)</p>
              <p className="text-teal-900 mt-0.5">Separate tax credit instrument (LIHTC ≠ ITC). Relevant for hybrid CS + affordable housing financing structures. Does not stack into the ITC ceiling.</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://programs.dsireusa.org/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">DSIRE ↗</a>
            <a href="https://energycommunities.gov/energy-community-tax-credit-bonus/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">DOE Energy Communities ↗</a>
            <a href="https://www.irs.gov/credits-deductions/low-income-communities-bonus-credit" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">§48(e) Bonus ↗</a>
            <a href="https://www.huduser.gov/portal/qct/index.html" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">HUD QCT/DDA ↗</a>
            <a href="https://www.irs.gov/forms-pubs/about-form-3468" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">IRS §48 ITC ↗</a>
          </div>
        </div>
        {/* SolarCostLineagePanel was hosted here pre-2026-05-05; promoted to
            OfftakeCard body so the tier disclosure is visible without an
            expander click. The methodology dropdown keeps the broader citation
            paragraph below for context. */}
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>Rate vintage &amp; sources</p>
          <ul className="space-y-1.5 text-[10px] text-gray-700 list-none">
            <li>
              <span className="font-semibold text-ink">Solar capex $/W national anchor</span> · {SOLAR_RATES_AS_OF} · <span className="text-gray-700">Anchored on NREL Q1 2023 CS-specific Modeled Market Price ($1.76/Wdc PV-only / $2.94/Wdc PV+storage). National TTS reference: $1.91/W median (n=839, 0.5-5 MW large non-res, install years 2022-2024). Forward-extrapolated 2023→2026 (+$0.40-$0.70/W cumulative) with explicit driver layers: NREL Spring 2025 observed +22% YoY 2023→2024 (+$0.20-$0.30), FEOC restrictions (+$0.05-$0.10), reshoring + IRA bonus credit threshold 40%→55% (+$0.03-$0.05), Iran-Israel oil/logistics pass-through (+$0.02-$0.05). National 2026 PV-only anchor $2.45/W; PV+storage hybrid $3.15/W.</span> Forward magnitudes + Tier B regional multipliers are Tractova editorial judgment, not LBNL/NREL-published. Refreshes when new annual TTS / NREL data lands.
            </li>
            <li>
              <span className="font-semibold text-ink">Independent benchmarks (cross-check)</span> · <span className="text-gray-700">NREL ATB 2024 Solar - PV Distributed Commercial CAPEX $2,058/kW = $2.06/W (Advanced scenario, Class 1, 2022 base; falls to $1,845/kW next year per NREL forward modeling). NREL ATB 2024 Solar - Utility PV CAPEX $1,483/kW = $1.48/W (Class 1, 2022 base). LBNL TTS observed national median $1.91/W (n=839) for 2022-2024 install years. Tractova's $2.45/W national 2026 anchor sits ~$0.40-$0.50 above ATB's modeled forward — that delta is the FEOC + tariff + reshoring shock layer that ATB's moderate-scenario projection doesn't include.</span> ATB refreshes annually each Q1.
            </li>
            <li><span className="font-semibold text-ink">Bill credits + REC pricing</span> · State-specific from DSIRE + state PUC tariff filings + NEPOOL GIS / PJM-EIS GATS / WREGIS / M-RETS depending on REC market.</li>
            <li><span className="font-semibold text-ink">Capacity factors</span> · NREL PVWatts API v8 state averages (more granular than Lazard's 15–20% national range). Where a Nexamp / SR Energy / Catalyze operating-fleet sample exists for the state, the observed AC capacity factor is shown alongside PVWatts modeled in the lens for cross-check. Single-developer / three-source bias disclosed in the Privacy Policy; not engine input.</li>
            <li><span className="font-semibold text-ink">C&amp;I PPA + retail</span> · {CI_RATES_AS_OF} · Lazard LCOE+ v18 commercial range + EIA Form 861 commercial retail tariffs 2024.</li>
            <li><span className="font-semibold text-ink">BESS capacity + arbitrage</span> · {BESS_RATES_AS_OF} · ISO/RTO clearing prices (PJM RPM, NYISO ICAP, ISO-NE FCM, CAISO RA) + NREL ATB 2024 Commercial Battery Storage CAPEX $1,450/kWh + Utility-Scale Battery Storage CAPEX $1,290/kWh (2022 base, Advanced scenario).</li>
            <li className="text-gray-500 italic">All three datasets are seeded constants. Refresh cadence: NREL ATB 2025 expected Q1 2026 (annual cycle); Lazard v19 expected April–June 2026; BESS rates re-anchored against ISO/RTO auctions as cycles complete. Automated refresh cron is on the backlog.</li>
          </ul>
        </div>
        {/* A.5 fix 2026-05-05: surface how feasibility freshness flows so users
            know the score they see is live, not a cached snapshot. */}
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>How freshness flows</p>
          <p className="text-[10px] text-gray-700 leading-relaxed">
            The Feasibility Index is computed <span className="font-semibold text-ink">live on every render</span> from the most recent
            state_program / county / IX data — never a cached snapshot. When underlying data refreshes (DSIRE weekly, IX scrapers
            weekly, NWI/SSURGO seeded), your scores update automatically on the next render — no manual re-run needed.
            Saved Library projects record both the original feasibility score (at save time) and the current live score so we can flag
            material drift. Dashboard "Markets on the Move" deltas come from `state_programs_snapshots` (append-only weekly captures).
          </p>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Tariff rates change quarterly. Verify CS program enrollment terms, IRA bonus designations, and current bill-credit values directly with state PUC and tax counsel before committing capital.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}
