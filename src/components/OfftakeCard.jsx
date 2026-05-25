import CardDrilldown from './CardDrilldown'
import IncentiveStackPanel from './lens/IncentiveStackPanel'
import {
  SectionLabel,
  DataRow,
  CSStatusBadge,
  RunwayBadge,
} from '../lib/searchShared.jsx'

// Offtake pillar detail (opened from the §04 Offtake summary card). Post the
// 2026-05 signal pivot this is a QUALITATIVE monetization read — program
// status, the ITC adder eligibility stack (Energy Community / §48(e) / HUD),
// and the structure's offtake mechanism. No synthesized dollars: the revenue/
// payback projections + $/W cost lineage retired with the $ layer.
export default function OfftakeCard({ stateProgram, revenueStack, technology, mw, energyCommunity, nmtcLic, hudQctDda, county }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const runway = stateProgram?.runway ?? null
  const isCS = technology === 'Community Solar'

  return (
    <div className="space-y-4">
      <div className="px-5 py-4 space-y-4">

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

            {/* Incentive stack — qualitative eligibility (ITC base + adders + REC
                + net-metering posture). No dollars. */}
            {revenueStack ? (
              <div>
                <SectionLabel>Incentive Stack</SectionLabel>
                <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
                  <DataRow label="ITC base" value={revenueStack.itcBase} highlight />
                  <DataRow label="ITC adders" value={revenueStack.itcAdder} />
                  <DataRow label="REC / I-REC market" value={revenueStack.irecMarket} />
                  <DataRow label="Net metering / credit" value={revenueStack.netMeteringStatus} />
                </div>
                {/* Federal ITC bonus credit eligibility — shared IncentiveStackPanel
                    (also the body of the §04 Incentives pillar detail tab) so the
                    eligibility read is one component, not two divergent copies. */}
                <div className="mt-2">
                  <IncentiveStackPanel energyCommunity={energyCommunity} nmtcLic={nmtcLic} hudQctDda={hudQctDda} county={county} />
                </div>
                {revenueStack.summary && <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">{revenueStack.summary}</p>}
              </div>
            ) : (
              <div>
                <SectionLabel>Incentive Stack</SectionLabel>
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">ITC base (federal)</span>
                    <span className="font-semibold text-gray-700">30%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">State-specific incentive details are sourced from the state's CS program administrator portal.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Non-CS structure — qualitative offtake read (no $ projection) */
          <div className="space-y-3">
            <SectionLabel>{technology} Offtake</SectionLabel>
            <div className="bg-surface rounded-md px-3 py-3 space-y-2">
              <p className="text-xs text-gray-700 leading-relaxed">{offtakeMechanismCopy(technology)}</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                The Offtake sub-score (shown on the §04 card) reflects this structure's monetization strength for the state. Confirm the current tariff / PPA terms and program enrollment directly with the serving utility or program administrator before committing capital.
              </p>
            </div>
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
      <CardDrilldown accentColor="#0F766E" label="How we built this incentive stack — sources, ITC math, assumptions">
        <div>
          <p className="eyebrow-mono font-bold mb-1.5" style={{ color: '#0F766E' }}>Incentive stack composition</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">ITC base</span> · 30% federal Investment Tax Credit (IRA §48) — requires prevailing-wage + apprenticeship compliance. Projects that don't meet PW&amp;A drop to a 6% base credit. Verify labor compliance with tax counsel before assuming the 30% figure.</li>
            <li><span className="font-semibold text-ink">ITC adders</span> · stack on the 30% base — Energy Community (+10%), §48(e) Cat 1 LIC (+10%, ≤5MW). Combined ceiling reaches 50% effective ITC for projects qualifying for both.</li>
            <li><span className="font-semibold text-ink">IREC / SREC market</span> · state-level renewable energy certificates. Tradable; value varies widely by state and market cycle.</li>
            <li><span className="font-semibold text-ink">Net metering / bill credit</span> · the per-kWh value of generation injected into the grid. Subject to NEM tariff rules — see precedent: CA NEM 3.0 cut bill credits 57% in Apr 2023.</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="eyebrow-mono font-bold mb-1.5" style={{ color: '#0F766E' }}>IRA bonus eligibility (§48 ITC)</p>
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
          <p className="eyebrow-mono font-bold mb-1.5" style={{ color: '#0F766E' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://energycommunities.gov/energy-community-tax-credit-bonus/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">DOE Energy Communities ↗</a>
            <a href="https://www.irs.gov/credits-deductions/low-income-communities-bonus-credit" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">§48(e) Bonus ↗</a>
            <a href="https://www.huduser.gov/portal/qct/index.html" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">HUD QCT/DDA ↗</a>
            <a href="https://www.irs.gov/forms-pubs/about-form-3468" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">IRS §48 ITC ↗</a>
          </div>
        </div>
        {/* A.5 fix 2026-05-05: surface how feasibility freshness flows so users
            know the score they see is live, not a cached snapshot. */}
        <div className="pt-2 border-t border-gray-100">
          <p className="eyebrow-mono font-bold mb-1.5" style={{ color: '#0F766E' }}>How freshness flows</p>
          <p className="text-[10px] text-gray-700 leading-relaxed">
            The Feasibility Index is computed <span className="font-semibold text-ink">live on every render</span> from the most recent
            state_program / county / IX data — never a cached snapshot. When underlying data refreshes (admin curation updates, IX scrapers
            weekly, NWI/SSURGO seeded), your scores update automatically on the next render — no manual re-run needed.
            Saved Library projects record both the original feasibility score (at save time) and the current live score so we can flag
            material drift. Dashboard "Markets on the Move" deltas come from `state_programs_snapshots` (append-only weekly captures).
          </p>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Tariff rates change quarterly. Verify CS program enrollment terms, IRA bonus designations, and current bill-credit values directly with state PUC and tax counsel before committing capital.
        </p>
      </CardDrilldown>
    </div>
  )
}

// Qualitative offtake mechanism copy per monetization structure (no $).
function offtakeMechanismCopy(technology) {
  switch (technology) {
    case 'C&I Solar':
      return 'Behind-the-meter / PPA structure: value comes from displacing the offtaker\'s retail rate. Strength tracks the state\'s commercial retail rate and market depth — high-retail markets (CA, ISO-NE, NY) monetize best. Success hinges on anchor-tenant credit quality and contract length.'
    case 'Net Metering':
      return 'Exports credited at (or near) the full retail rate, so offtake value tracks the state\'s retail-rate tier — the same signal as C&I. Confirm the current NEM tariff: successor tariffs (e.g. CA NEM 3.0) can cut export credit sharply.'
    case 'Net Billing':
      return 'Exports credited at avoided cost (below retail). Tractova does not model net-billing economics yet — there is no clean per-state export-credit dataset, so the offtake signal is held at a directional baseline rather than fabricated.'
    case 'BESS':
      return 'Merchant capacity-market / ancillary-services revenue (legacy standalone storage). Highly ISO-dependent and volatile; verify the serving ISO\'s most recent capacity-auction clearing before relying on this structure.'
    default:
      return 'Monetization structure offtake reflects the state\'s program / tariff posture. Confirm enrollment terms and current rates with the program administrator.'
  }
}
