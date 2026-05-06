import { computeSubScores, computeDisplayScoreRange, getOfftakeCoverageStates, safeScore } from '../lib/scoreEngine'
import ArcGauge from './ArcGauge.jsx'
import CoverageBadge from './CoverageBadge'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import { SubScoreBar, STATUS_CFG, getMarketRank } from '../pages/Search.jsx'

// V3 redesign: editorial-intelligence "research note" hero block.
// Drops the dark gradient banner. Mono eyebrow strip up top with metadata,
// then asymmetric two-column body: tachometer left, identity + sub-scores right.
// §7.4: accepts activeScenario prop. When active, gauge renders the override score
// with a delta indicator. Toggle row renders below this panel via the parent.
export default function MarketPositionPanel({ stateProgram, countyData, programMap, stage, technology, activeScenario, ixQueueSummary }) {
  if (!stateProgram) return null
  // Apply scenario override if active — recompute sub-scores from the override state
  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const { offtake, ix, site, coverage } = computeSubScores(effectiveProgram, countyData, stage, technology, ixQueueSummary)
  const { rank, total } = getMarketRank(stateProgram.id, programMap)
  const status = STATUS_CFG[effectiveProgram.csStatus] || STATUS_CFG.none
  const score = safeScore(offtake, ix, site)
  // Base-case score for delta calculation
  const baseSubs = computeSubScores(stateProgram, countyData, stage, technology, ixQueueSummary)
  const baseScore = safeScore(baseSubs.offtake, baseSubs.ix, baseSubs.site)
  // Guard delta math against null scores (safeScore returns null when any
  // sub-score isn't finite — e.g. partial data + edge-case state programs).
  const delta = (activeScenario && score != null && baseScore != null) ? score - baseScore : 0
  // State-level baseline: stage-agnostic + county-agnostic. This is the
  // "MN market = 81" number the Analyst Brief uses, distinct from the
  // gauge's project-adjusted score (which applies stage modifiers + the
  // user's specific county data). Surfacing both lets the user see why
  // the brief's number and the gauge can diverge — they're measuring
  // different things.
  const stateBaseline = typeof stateProgram.feasibilityScore === 'number' ? stateProgram.feasibilityScore : null
  const projectAdjustment = (stateBaseline != null && score != null) ? score - stateBaseline : 0
  // Methodology-sensitivity range — composite weights (0.40/0.35/0.25) are
  // Tractova editorial choice, not anchored on primary data. Show users how
  // the score moves under reasonable alternative weights so they can see
  // whether the project's verdict is robust to methodology choice.
  // Surfaced when spread > 4 (meaningful sensitivity); suppressed otherwise
  // so it doesn't add noise to clearly-strong / clearly-weak projects.
  const scoreRange = computeDisplayScoreRange(offtake, ix, site)
  // When state/county is outside our curated coverage, surface that to match
  // the honesty already in the revenue panel ("model not available"). Without
  // this, the user sees a feasibility number that looks researched but is
  // actually an estimated baseline.
  const offtakeCoverageStates = coverage?.offtake === 'fallback' ? getOfftakeCoverageStates(technology) : null
  const siteFallback = coverage?.site === 'fallback'
  const hasCoverageNote = offtakeCoverageStates || siteFallback

  // "AS OF" timestamp — institutional research-note convention
  const latestDate = (() => {
    const v = stateProgram.lastVerified ? new Date(stateProgram.lastVerified) : null
    const u = stateProgram.updatedAt    ? new Date(stateProgram.updatedAt)    : null
    return (v && u) ? (v > u ? v : u) : (v || u)
  })()
  const asOf = latestDate
    ? latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    : null
  const ageDays = latestDate ? Math.floor((Date.now() - latestDate) / 86400000) : null
  const isStale = ageDays != null && ageDays > 14

  // Verdict tag mapped to the score
  const verdict = score >= 70 ? { label: 'Strong Fit',    color: '#0F766E' }
                : score >= 55 ? { label: 'Viable',         color: '#0F766E' }
                : score >= 38 ? { label: 'Caution',        color: '#D97706' }
                : score >= 18 ? { label: 'High Friction',  color: '#DC2626' }
                :               { label: 'Not Recommended', color: '#DC2626' }

  return (
    <article
      className="bg-white rounded-lg mb-6 overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Top teal accent rail — V3 brand signature */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }} />

      {/* Eyebrow metadata strip — research-note convention */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Tractova Lens · Market Position
          </span>
          {asOf && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${isStale ? 'text-amber-600' : 'text-gray-400'}`}>
                As of {asOf}
              </span>
            </>
          )}
          {rank && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
                Rank <span className="font-bold text-gray-700">#{rank}</span> of {total}
              </span>
            </>
          )}
          <span className="text-gray-300 text-[9px]">/</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            {(technology || '').toUpperCase()}
          </span>
          {/* Live-IX indicator — present when ix_queue_data covers this state and
              the queue-health signal blended into the IX sub-score. Currently
              fires for ~8 top-CS-market states (CO/IL/MA/MD/ME/MN/NJ/NY); for
              the rest, the IX score is curated from stateProgram.ixDifficulty
              and this badge stays absent. Honest signal — no badge means
              we didn't have live data, not that we're hiding something.

              Stale-data downgrade: when the underlying ISO scraper hasn't
              refreshed within 7 days (e.g. during upstream URL changes
              that have hit PJM, NYISO, and ISO-NE in the past), the badge
              flips amber + adds "stale Nd" suffix. The tooltip explains
              the staleness explicitly so the user knows the live signal
              is frozen, not current. */}
          {coverage?.ix === 'live' && (() => {
            const ageDays = ixQueueSummary?.dataAgeDays
            const isStale = ageDays != null && ageDays > 7
            const badgeStyle = isStale
              ? { background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.45)' }
              : { background: 'rgba(20,184,166,0.10)', color: '#115E59', border: '1px solid rgba(20,184,166,0.30)' }
            const dotStyle = isStale
              ? { background: '#D97706', boxShadow: '0 0 5px rgba(217,119,6,0.65)' }
              : { background: '#14B8A6', boxShadow: '0 0 5px rgba(20,184,166,0.65)' }
            return (
              <>
                <span className="text-gray-300 text-[9px]">/</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold cursor-help"
                      style={badgeStyle}
                    >
                      <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={dotStyle} />
                      {isStale ? `IX · Live · stale ${ageDays}d` : 'IX · Live'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="text-[10px]">
                    <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>
                      {isStale ? 'Live IX Queue Data — STALE' : 'Live IX Queue Data'}
                    </p>
                    {isStale ? (
                      <>
                        <p>The ISO scraper for this state hasn't returned fresh data in {ageDays} days. The queue numbers below reflect the last successful pull on {ixQueueSummary?.oldestFetchedAt ? new Date(ixQueueSummary.oldestFetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'an earlier date'}.</p>
                        <p className="mt-1.5"><span className="text-amber-300 font-mono">REASON</span> — upstream public-CSV/JSON URLs changed on the ISO side; our scrapers are pending repair.</p>
                        <p className="mt-1.5 text-gray-400">We're showing the badge in amber rather than hiding it so you can interpret the queue context honestly. Confirm current queue conditions with the serving utility before committing to a project plan.</p>
                      </>
                    ) : (
                      <>
                        <p>This state has current ISO/RTO queue-snapshot coverage. The Interconnection sub-score blends live signals on top of the curated <span className="font-mono">ixDifficulty</span> baseline.</p>
                        <p className="mt-1.5"><span className="text-teal-300 font-mono">INPUTS</span> — avg study months · total pending MW (weighted across utilities)</p>
                        <p className="mt-0.5"><span className="text-amber-300 font-mono">CLAMP</span> — adjustment limited to ±10 so live signal can move the curated baseline meaningfully without dominating structural ISO context.</p>
                        <p className="mt-1.5 text-gray-400">Absent badge = curated only. We don't fabricate live coverage where ISO scrapers haven't landed yet.</p>
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>
              </>
            )
          })()}
          {/* Live-Site indicator (Path B). Fires when this county has a row in
              county_geospatial_data — derived from USFWS NWI wetlands + USDA
              SSURGO prime farmland. Covers all 50 states / 3,142 counties once
              both ingests have run. Closes the 32-state coverage gap of the
              curated county_intelligence table. Absent = falling back to the
              curated booleans (or the site=60 baseline) for this county. */}
          {coverage?.site === 'live' && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold cursor-help"
                    style={{ background: 'rgba(20,184,166,0.10)', color: '#115E59', border: '1px solid rgba(20,184,166,0.30)' }}
                  >
                    <span
                      className="relative inline-flex w-1.5 h-1.5 rounded-full"
                      style={{ background: '#14B8A6', boxShadow: '0 0 5px rgba(20,184,166,0.65)' }}
                    />
                    Site · Live
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="text-[10px]">
                  <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>Live Geospatial Site Data</p>
                  <p>The Site Control sub-score is derived from authoritative federal geospatial sources for this county, not from a curated qualitative cell.</p>
                  <p className="mt-1.5"><span className="text-teal-300 font-mono">INPUTS</span> — wetland coverage % (USFWS NWI) · prime farmland % (USDA SSURGO)</p>
                  <p className="mt-0.5"><span className="text-amber-300 font-mono">THRESHOLDS</span> — wetlandWarning ≥ 15% · availableLand ≥ 25% (calibrated against ground-truth counties)</p>
                  <p className="mt-1.5 text-gray-400">Replaces the legacy curated county_intelligence booleans for the 32 states that were never seeded — all 3,142 counties get live signals.</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {/* §7.4: scenario indicator in the eyebrow when active */}
          {activeScenario && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#92400E', border: '1px solid rgba(245,158,11,0.40)' }}>
                ◆ Scenario · {activeScenario.label.replace('What if ', '').replace('?', '')}
              </span>
            </>
          )}
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
          style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}` }}
        >
          {status.label}
        </span>
      </div>

      {/* Body — asymmetric grid: 5 cols gauge / 7 cols identity + sub-scores */}
      <div className="grid grid-cols-1 md:grid-cols-12">
        {/* Left — gauge */}
        <div className="md:col-span-5 px-6 py-7 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-3 text-gray-400">
            Feasibility Index
          </p>
          <ArcGauge score={score} />
          {/* §7.4: delta indicator when a scenario is active */}
          {activeScenario && delta !== 0 && (
            <span
              className="mt-1 font-mono text-[12px] font-bold tabular-nums"
              style={{ color: delta > 0 ? '#0F766E' : '#DC2626' }}
            >
              {delta > 0 ? '↑' : '↓'} {delta > 0 ? '+' : ''}{delta} vs base ({baseScore})
            </span>
          )}
          {/* State baseline reference — surfaces the unadjusted state-level
              composite (the same number the Analyst Brief cites as "the
              market is X/100") so users can read the gauge as a delta from
              market baseline rather than as an unmoored score. Suppressed
              when projectAdjustment is small (≤2 pts — within rounding noise)
              so the line only appears when there's something to explain. */}
          {stateBaseline != null && Math.abs(projectAdjustment) > 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500 cursor-help inline-flex items-center gap-1.5">
                  <span className="text-gray-400">{stateProgram.id} baseline</span>
                  <span className="font-bold tabular-nums" style={{ color: '#0F1A2E' }}>{stateBaseline}</span>
                  <span style={{ color: projectAdjustment >= 0 ? '#0F766E' : '#92400E' }}>
                    {projectAdjustment >= 0 ? '↑' : '↓'} {Math.abs(projectAdjustment)} project
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>State baseline vs your project</p>
                <p>The {stateProgram.id} state-level composite ({stateBaseline}) is the unadjusted market score — what the Analyst Brief means when it cites "the market".</p>
                <p className="mt-1.5">The gauge ({score}) is your project's adjusted score. Stage modifiers (Prospecting / Site Control / etc.) and your specific county data can shift it {projectAdjustment >= 0 ? 'up' : 'down'} from the state baseline.</p>
                <p className="mt-1.5 text-gray-400">Both numbers are correct — they measure different things. Move the project to a later stage or a stronger county to close the gap.</p>
              </TooltipContent>
            </Tooltip>
          )}
          <div
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] font-bold"
            style={{ color: verdict.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdict.color }} />
            {verdict.label}
          </div>
          {/* Methodology-sensitivity indicator (audit Tier C composite weights).
              Shown when spread > 4 pts to flag projects where verdict
              depends on which pillar weighting you use. */}
          {scoreRange.spread > 4 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 cursor-help inline-flex items-center gap-1.5">
                  <span>weight sensitivity</span>
                  <span className="font-bold tabular-nums" style={{ color: '#5A6B7A' }}>
                    {scoreRange.min}–{scoreRange.max}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] max-w-xs">
                <p className="font-bold mb-1.5" style={{ color: '#5EEAD4' }}>How sensitive is this score to methodology?</p>
                <p className="mb-2">The composite weights (Offtake 40% / IX 35% / Site 25%) are Tractova editorial — there's no primary-data anchor for "how much should each pillar count." Score below under reasonable alternatives:</p>
                <ul className="space-y-1 mb-2">
                  {Object.entries(scoreRange.scenarios).map(([k, s]) => (
                    <li key={k} className="flex items-center justify-between gap-3">
                      <span className={k === 'default' ? 'text-white' : 'text-gray-300'}>
                        {s.label}
                      </span>
                      <span className="font-mono font-bold tabular-nums" style={{ color: k === 'default' ? '#5EEAD4' : '#9CA3AF' }}>
                        {s.score}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-gray-400 italic">Spread {scoreRange.spread} pts. Wider spread = the project's verdict depends on methodology choice; consider running multiple weight scenarios in your underwriting.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Right — identity + sub-scores */}
        <div className="md:col-span-7 px-6 py-7 flex flex-col gap-6">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400">
                Target State
              </p>
              <CoverageBadge tier={stateProgram.coverageTier} />
            </div>
            <h2 className="font-serif font-semibold text-ink leading-[0.95]" style={{ fontSize: '34px', letterSpacing: '-0.02em' }}>
              {stateProgram.name}
            </h2>
            {stateProgram.csProgram && (
              <p className="text-sm font-medium mt-1.5" style={{ color: '#0F766E' }}>
                {stateProgram.csProgram}
              </p>
            )}
          </div>

          {/* Sub-scores */}
          <div className="pt-5 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400">
                Sub-Scores
              </p>
              {/* V3: Radix-portal tooltip — was a hand-rolled absolute-positioned div
                  that overflowed on narrow viewports. Portal renders to document.body
                  and Radix handles viewport collision avoidance. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Methodology" className="cursor-help" onClick={(e) => e.preventDefault()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="text-[10px]">
                  <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>Methodology</p>
                  <p><span className="text-teal-300 font-mono">OFFTAKE 40%</span> — Program status, capacity, LMI complexity, enrollment runway</p>
                  <p className="mt-0.5"><span className="text-amber-300 font-mono">INTERCONN 35%</span> — Queue difficulty, study timelines, upgrade cost risk</p>
                  <p className="mt-0.5"><span className="text-blue-300 font-mono">SITE CTRL 25%</span> — Land availability, wetland risk, zoning constraints</p>
                  <p className="mt-1.5 text-gray-400">Offtake viability is the first gate. IX risk is the primary capital risk. Site control is increasingly commoditized.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <SubScoreBar label="Offtake"         weight="40%" value={offtake} baseValue={baseSubs.offtake} color="#0F766E" />
            <SubScoreBar label="Interconnection" weight="35%" value={ix}      baseValue={baseSubs.ix}      color="#D97706" />
            <SubScoreBar label="Site Control"    weight="25%" value={site}    baseValue={baseSubs.site}    color="#2563EB" />
            {hasCoverageNote && (
              <div
                className="mt-2 flex items-start gap-1.5 px-2 py-1.5 rounded-sm"
                style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.18)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-[10px] leading-snug" style={{ color: '#78350F' }}>
                  <span className="font-bold uppercase tracking-wider text-[9px]">Limited coverage — directional only</span>
                  <span className="block mt-0.5 font-normal space-y-0.5">
                    {offtakeCoverageStates && (
                      <span className="block">
                        <strong>Offtake:</strong> {technology} economics are curated for {offtakeCoverageStates.join(', ')}. {stateProgram.name} uses an estimated baseline.
                      </span>
                    )}
                    {siteFallback && (
                      <span className="block">
                        <strong>Site Control:</strong> County-level land/wetland/zoning data not yet seeded for this geography. Score uses a national baseline; verify locally before committing capital.
                      </span>
                    )}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
