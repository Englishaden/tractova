// Dev Feasibility view — the "is it realistic to build in X county with X
// utility" surface inside Scenario Studio. Composes data already fetched
// by Search.jsx into a dev-realism scorecard rather than a financial
// pro-forma. Sibling to the existing financial-sensitivity sliders + grid.
//
// All inputs are read from props — no new fetches, no new endpoints.
// The financial engine downstream stays untouched; this view sits next
// to it under a tab toggle.
//
// Architecture: pure-presentational over the existing scoreEngine /
// programData outputs. Per-tech dispatch matches scenarioEngine.computeOutputs
// (CS / C&I / BESS / Hybrid) — pillar shapes differ enough that a single
// table doesn't fit cleanly.

import { useMemo, useState, useEffect } from 'react'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import GlossaryLabel from '../ui/GlossaryLabel'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip'
import FieldSelect from '../FieldSelect'
import ComparableProjectsPanel from './ComparableProjectsPanel'

const VERDICT_PALETTE = {
  go:      { label: 'Go',      tone: '#0F766E', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.35)', icon: '◆' },
  caution: { label: 'Caution', tone: '#92400E', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.35)',  icon: '▼' },
  nogo:    { label: 'No-Go',   tone: '#991B1B', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.35)',  icon: '×' },
}

function classifyVerdict(composite) {
  if (composite == null) return null
  if (composite >= 70) return 'go'
  if (composite >= 50) return 'caution'
  return 'nogo'
}

// Subscription % is continuous, not bucketed — operating CS projects
// land anywhere from ~50% (LMI-mandated first-year launches) up through
// 100% (CCA-anchored or fully-LMI-subscribed deals). The slider treats
// it as a free 0–100% input, with one regulatory constraint applied:
// when a state mandates an LMI carve-out (NY 20%, IL 50%, NJ 51%, etc.),
// the slider floor locks at that percentage — projects can't structurally
// subscribe below the regulatory minimum.
const SUBSCRIPTION_DEFAULT_PCT = 80
const SUBSCRIPTION_TOOLTIP = {
  title: 'Subscription target',
  body: 'Target fill rate for your project. Operating CS projects in the NREL Sharing the Sun dataset cluster roughly 50–100%, varying by program age, marketing reach, LMI mandate, and anchor-offtaker presence. When a state mandates an LMI carve-out (NY 20%, IL 50%, NJ 51%, MD 40%, CO 25%), the slider floor locks at that percentage — projects can\'t subscribe below the regulatory minimum.',
}

const IX_ASSUMPTIONS = [
  { key: 'queue',         label: 'Stand in queue',     hint: 'Greenfield project — file fresh IX study, accept current queue position. Average study window for the state shown on the IX pillar card.' },
  { key: 'acquire',       label: 'Acquire position',   hint: 'Buy a mid-queue position from a developer who exited or dropped out. Skips the wait but adds acquisition cost (typically $5k–$50k/MW) and inherits any prior study assumptions.' },
  { key: 'distribution',  label: 'Distribution fast-track', hint: 'Distribution-tied small project (typically <2 MW) eligible for the utility fast-track interconnection path in states that support it. Bypasses transmission-queue delays.' },
]

const COD_YEAR_OPTIONS = ['2026', '2027', '2028', '2029', '2030']

export default function DevFeasibilityView({
  stateProgram,
  countyData,
  ixQueueSummary,
  policyEvents,
  technology,
  stage,
  mw,           // live MW (lifted to Search.jsx — single source of truth across §03 + §04)
  searchMw,     // original search MW for the "Searched at X · Reset" affordance
  onMwChange,   // setter — when present, the MW slider writes through to Search.jsx state
  stateName,
  countyName,
}) {
  // MW comes from the lifted Search.jsx state (number, coerced upstream).
  // Fall back to a safe local default if a caller forgets to pass it.
  const effectiveMw = (() => {
    const n = parseFloat(mw)
    return Number.isFinite(n) && n > 0 ? n : 5
  })()

  // Non-MW levers stay local to this view — they're informational only
  // (COD year + subscription % + IX assumption shape the timeline
  // narrative below but don't drive scoreEngine outputs or §04 cards).
  const [levers, setLevers] = useState({
    codYear: 2027,
    subscriptionPct: SUBSCRIPTION_DEFAULT_PCT,
    ixAssumption: 'queue',
  })

  // LMI floor — when a state mandates a carve-out (NY 20%, IL 50%, etc.),
  // subscription can't structurally drop below it. Snap up if the user
  // switches state mid-session and current pct falls under the new floor.
  const lmiFloor = (stateProgram?.lmiRequired && stateProgram?.lmiPercent > 0)
    ? stateProgram.lmiPercent
    : 0
  useEffect(() => {
    if (lmiFloor > 0 && levers.subscriptionPct < lmiFloor) {
      setLevers((prev) => ({ ...prev, subscriptionPct: lmiFloor }))
    }
  }, [lmiFloor, levers.subscriptionPct])

  // Recompute the pillar sub-scores live as MW changes. Other levers
  // shape the timeline narrative only — they don't move scoreEngine.
  const subScores = useMemo(
    () => computeSubScores(stateProgram, countyData, stage || '', technology, ixQueueSummary, policyEvents, effectiveMw),
    [stateProgram, countyData, stage, technology, ixQueueSummary, policyEvents, effectiveMw]
  )

  const composite = useMemo(
    () => safeScore(subScores.offtake, subScores.ix, subScores.site, undefined, subScores.policyClimate),
    [subScores]
  )

  const verdict = classifyVerdict(composite)
  const verdictPalette = verdict ? VERDICT_PALETTE[verdict] : null

  const headwindPolicies = useMemo(() => {
    if (!Array.isArray(policyEvents)) return []
    return policyEvents.filter(p =>
      p.confidence_tier === 'high' &&
      (p.capex_delta > 0 || p.opex_delta > 0 || p.revenue_haircut > 0)
    )
  }, [policyEvents])

  const tailwindPolicies = useMemo(() => {
    if (!Array.isArray(policyEvents)) return []
    return policyEvents.filter(p =>
      p.confidence_tier === 'high' &&
      (p.capex_delta < 0 || p.opex_delta < 0 || p.revenue_haircut < 0)
    )
  }, [policyEvents])

  const isCS = technology === 'Community Solar' || technology === 'Hybrid'

  return (
    <TooltipProvider delayDuration={150}>
    <div className="px-6 py-5 space-y-5">
      <VerdictTile
        verdict={verdict}
        palette={verdictPalette}
        composite={composite}
        subScores={subScores}
        stateName={stateName}
        countyName={countyName}
        technology={technology}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <OfftakePillarCard
          stateProgram={stateProgram}
          subScore={subScores.offtake}
          coverage={subScores.coverage.offtake}
          technology={technology}
        />
        <InterconnectionPillarCard
          ixQueueSummary={ixQueueSummary}
          stateProgram={stateProgram}
          subScore={subScores.ix}
          coverage={subScores.coverage.ix}
        />
        <SitePillarCard
          countyData={countyData}
          subScore={subScores.site}
          coverage={subScores.coverage.site}
        />
        <PolicyPillarCard
          headwinds={headwindPolicies}
          tailwinds={tailwindPolicies}
          subScore={subScores.policyClimate}
          coverage={subScores.coverage.policy}
        />
      </div>

      <FeasibilityLevers
        levers={levers}
        onChange={setLevers}
        mw={effectiveMw}
        onMwChange={onMwChange}
        isCS={isCS}
        lmiFloor={lmiFloor}
        stateName={stateName}
      />

      <TimelineEstimate
        ixQueueSummary={ixQueueSummary}
        siteCoverage={subScores.coverage.site}
        countyData={countyData}
        headwindCount={headwindPolicies.length}
        ixAssumption={levers.ixAssumption}
        codYear={levers.codYear}
      />

      <ComparableProjectsPanel
        state={stateProgram?.id || null}
        stateName={stateName}
        technology={technology}
        mw={effectiveMw}
        servingUtility={countyData?.interconnection?.servingUtility || null}
      />
    </div>
    </TooltipProvider>
  )
}

// ── Verdict tile ───────────────────────────────────────────────────────────

function VerdictTile({ verdict, palette, composite, subScores, stateName, countyName, technology }) {
  if (!verdict || !palette) {
    return (
      <div className="rounded-lg px-4 py-3 text-[12px] text-gray-500"
        style={{ background: 'rgba(15,26,46,0.04)', border: '1px solid #E2E8F0' }}>
        Feasibility verdict unavailable — pillar data still loading or incomplete for {stateName || 'this state'}.
      </div>
    )
  }
  return (
    <div className="rounded-lg px-4 py-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="text-3xl font-bold tabular-nums" style={{ color: palette.tone }}>
          {palette.icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="eyebrow-mono px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(15,26,46,0.06)', color: '#475569', border: '1px solid rgba(15,26,46,0.18)' }}>
              Feasibility Verdict
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-gray-500 font-mono tabular-nums cursor-help underline decoration-dotted underline-offset-2">
                  composite {composite}/100
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="!max-w-[340px]">
                <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>Composite + verdict thresholds</p>
                <p className="leading-relaxed mb-2">
                  Composite = weighted blend of the four pillar sub-scores (Offtake 36% · IX 31.5% · Site 22.5% · Policy 10%, defined in <code className="text-[10px]" style={{ color: '#FCA5A5' }}>WEIGHT_SCENARIOS.default</code>). Same math as the Feasibility Index gauge in the Lens header — single source of truth.
                </p>
                <p className="leading-relaxed">
                  Verdict bands are <span className="font-semibold" style={{ color: '#5EEAD4' }}>Tractova editorial</span>, not empirically anchored: <b>Go ≥ 70</b>, <b>Caution 50–69</b>, <b>No-Go &lt; 50</b>. They're a screening shortcut for "is this market worth more diligence?" — calibrate to your own deal-flow benchmark over time.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="font-bold text-[18px] leading-tight" style={{ color: palette.tone }}>
            {palette.label} — {countyName ? `${countyName} County, ` : ''}{stateName || 'site'} · {technology}
          </div>
          <div className="text-[11px] text-gray-600 mt-1 leading-snug">
            {verdictRationale(verdict, subScores)}
          </div>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-3 text-[10px] font-mono tabular-nums shrink-0">
        <PillarReadout label="OFFT" value={subScores.offtake} />
        <PillarReadout label="IX"   value={subScores.ix} />
        <PillarReadout label="SITE" value={subScores.site} />
        <PillarReadout label="POL"  value={subScores.policyClimate} />
      </div>
    </div>
  )
}

function PillarReadout({ label, value }) {
  if (value == null) return null
  return (
    <div className="text-center">
      <div className="eyebrow-mono text-gray-500">{label}</div>
      <div className="font-bold text-[13px] text-ink">{Math.round(value)}</div>
    </div>
  )
}

function verdictRationale(verdict, subScores) {
  const weakest = [
    { name: 'Offtake', val: subScores.offtake },
    { name: 'Interconnection', val: subScores.ix },
    { name: 'Site', val: subScores.site },
  ].sort((a, b) => a.val - b.val)[0]

  if (verdict === 'go') return `All pillars clear the build-it threshold. Watch ${weakest.name} (${Math.round(weakest.val)}/100) as the weakest link.`
  if (verdict === 'caution') return `Mixed signals — ${weakest.name} is the dominant friction at ${Math.round(weakest.val)}/100. Diligence the bottom-ranked pillar before committing capex.`
  return `${weakest.name} scores ${Math.round(weakest.val)}/100. Either the market structure or the site fundamentally doesn't support this project shape.`
}

// ── Pillar cards (compact) ─────────────────────────────────────────────────

function PillarCardShell({ pillarLabel, subScore, coverage, children }) {
  const tone = subScore == null ? '#475569' : subScore >= 70 ? '#0F766E' : subScore >= 50 ? '#92400E' : '#991B1B'
  return (
    <div className="rounded-md px-3 py-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow-mono text-gray-500">{pillarLabel}</span>
        <span className="font-bold text-[14px] tabular-nums" style={{ color: tone }}>
          {subScore == null ? '—' : Math.round(subScore)}
        </span>
      </div>
      {children}
      <CoverageChip coverage={coverage} />
    </div>
  )
}

// Coverage chip lineage taxonomy — matches scoreEngine.js coverage tiers.
// Source of truth for the body copy is the comments in computeSubScores.
// Label = the human-readable text shown in the chip; the internal tier
// strings ('live' / 'researched' / etc.) stay in the data path for
// filtering/aggregation consistency with scoreEngine outputs.
const COVERAGE_TOOLTIPS = {
  live: {
    label: 'Live data',
    title: 'Live data',
    body: 'Score is driven by real-time data — IX queue scrapes (8 CS states), county geospatial (NWI wetlands + SSURGO farmland, all 3,142 counties), or live news/PUC ingest. Refreshed on cron; data-age stamps surface staleness when scrapers lag.',
  },
  researched: {
    label: 'Researched',
    title: 'Researched · curated',
    body: 'Score uses Tractova-curated baseline values — county_intelligence boolean (~18 states seeded), CS program status from state_programs (all 50 states). Stable but not live; updated when manual research lands.',
  },
  curated: {
    label: 'Curated baseline',
    title: 'Curated baseline',
    body: 'Score uses the state-level curated baseline (e.g. ixDifficulty tier from state_programs). All 50 states have a curated value; the live-blend overlay applies only where ix_queue_data is wired.',
  },
  fallback: {
    label: 'Fallback estimate',
    title: 'Fallback estimate',
    body: 'Curated data not yet seeded for this state/county — score uses a neutral placeholder (50–60 depending on pillar). Treat as low-confidence; verify directly before using to make a decision.',
  },
  none: null,
}

function CoverageChip({ coverage }) {
  if (!coverage || coverage === 'none') return null
  const palette =
    coverage === 'live' ? { bg: 'rgba(20,184,166,0.10)', fg: '#0F766E' } :
    coverage === 'researched' ? { bg: 'rgba(15,26,46,0.06)', fg: '#475569' } :
    coverage === 'curated' ? { bg: 'rgba(15,26,46,0.06)', fg: '#475569' } :
    { bg: 'rgba(217,119,6,0.10)', fg: '#92400E' }
  const tip = COVERAGE_TOOLTIPS[coverage]
  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {tip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm cursor-help" style={{ background: palette.bg, color: palette.fg }}>
              {tip.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>{tip.title}</p>
            <p className="leading-relaxed">{tip.body}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm" style={{ background: palette.bg, color: palette.fg }}>
          {coverage}
        </span>
      )}
    </div>
  )
}

function OfftakePillarCard({ stateProgram, subScore, coverage, technology }) {
  const isCS = technology === 'Community Solar' || technology === 'Hybrid'
  return (
    <PillarCardShell pillarLabel="Offtake" subScore={subScore} coverage={coverage}>
      {isCS && stateProgram ? (
        <div className="space-y-1 text-[11px]">
          <div className="font-semibold text-ink leading-tight">{stateProgram.csProgram || 'No CS program'}</div>
          <div className="text-gray-600 capitalize">Status: {stateProgram.csStatus || 'none'}</div>
          {stateProgram.capacityMW > 0 && (
            <div className="text-gray-600 font-mono tabular-nums">
              {stateProgram.capacityMW.toLocaleString()} MW cap
            </div>
          )}
          {stateProgram.lmiRequired && (
            <div className="text-[10px] text-amber-700">
              LMI required{stateProgram.lmiPercent ? ` · ${stateProgram.lmiPercent}%` : ''}
            </div>
          )}
        </div>
      ) : technology === 'BESS' ? (
        <div className="text-[11px] text-gray-600">
          Capacity-market clearing varies by ISO. Score reflects 2026 forward curves; verify against ISO auction results.
        </div>
      ) : (
        <div className="text-[11px] text-gray-600">
          C&I offtake driven by retail rates (EIA 861). Higher retail rate = stronger displacement value.
        </div>
      )}
    </PillarCardShell>
  )
}

function InterconnectionPillarCard({ ixQueueSummary, stateProgram, subScore, coverage }) {
  const hasLive = ixQueueSummary && ixQueueSummary.totalProjects > 0
  return (
    <PillarCardShell pillarLabel="Interconnection" subScore={subScore} coverage={coverage}>
      {hasLive ? (
        <div className="space-y-1 text-[11px]">
          <div className="font-mono tabular-nums text-ink">
            {ixQueueSummary.avgStudyMonths} mo · {ixQueueSummary.totalMW.toLocaleString()} MW pending
          </div>
          <div className="text-gray-600 capitalize">Congestion: {ixQueueSummary.congestionLevel}</div>
          <div className="text-[10px] text-gray-500">{ixQueueSummary.totalProjects} projects in queue</div>
        </div>
      ) : (
        <div className="text-[11px] text-gray-600">
          {stateProgram?.ixDifficulty
            ? <>Difficulty: <span className="capitalize font-semibold text-ink">{String(stateProgram.ixDifficulty).replace('_', ' ')}</span></>
            : 'Live queue data not yet wired for this state.'}
        </div>
      )}
    </PillarCardShell>
  )
}

function SitePillarCard({ countyData, subScore, coverage }) {
  const wet = countyData?.geospatial?.wetlandCoveragePct
  const farm = countyData?.geospatial?.primeFarmlandPct
  const siteControl = countyData?.siteControl
  return (
    <PillarCardShell pillarLabel="Site" subScore={subScore} coverage={coverage}>
      <div className="space-y-1 text-[11px]">
        {wet != null && (
          <div className="text-gray-700">
            Wetlands: <span className="font-mono tabular-nums font-semibold text-ink">{wet.toFixed(1)}%</span>
            {wet >= 25 && <span className="ml-1 text-[10px] text-amber-700">permit risk</span>}
          </div>
        )}
        {farm != null && (
          <div className="text-gray-700">
            Prime farmland: <span className="font-mono tabular-nums font-semibold text-ink">{farm.toFixed(1)}%</span>
          </div>
        )}
        {wet == null && farm == null && (
          <div className="text-gray-600">
            {siteControl === true ? 'Curated: land available' : siteControl === false ? 'Curated: limited land' : 'No site signal yet for this county.'}
          </div>
        )}
      </div>
    </PillarCardShell>
  )
}

function PolicyPillarCard({ headwinds, tailwinds, subScore, coverage }) {
  const top = headwinds[0] || tailwinds[0]
  // coverage='none' means policyEvents wasn't passed in at all — the
  // wiring isn't live for this state/surface, NOT that we looked and
  // found zero events. Different copy for each so devs aren't misled
  // into thinking a state is "policy clean" when we just haven't wired
  // the data through.
  const dataNotWired = coverage === 'none'
  return (
    <PillarCardShell pillarLabel="Policy" subScore={subScore} coverage={coverage}>
      <div className="space-y-1 text-[11px]">
        {dataNotWired ? (
          <div className="text-gray-500 italic leading-snug">
            Policy data not yet wired for this surface. §06 Regulatory Watch may still surface events independently.
          </div>
        ) : (
          <>
            <div className="font-mono tabular-nums text-ink">
              {headwinds.length} headwind{headwinds.length === 1 ? '' : 's'} · {tailwinds.length} tailwind{tailwinds.length === 1 ? '' : 's'}
            </div>
            {top ? (
              <div className="text-gray-600 line-clamp-2 leading-snug">
                {top.event_name || 'Active policy event'}
              </div>
            ) : (
              <div className="text-gray-500 italic">No active high-confidence policy events.</div>
            )}
          </>
        )}
      </div>
    </PillarCardShell>
  )
}

// ── Feasibility levers ─────────────────────────────────────────────────────

function FeasibilityLevers({ levers, onChange, mw, onMwChange, isCS, lmiFloor = 0, stateName = '' }) {
  const ixLabels = IX_ASSUMPTIONS.map(p => p.label)
  const ixTooltips = Object.fromEntries(IX_ASSUMPTIONS.map(p => [p.label, p.hint]))
  const currentIxLabel = IX_ASSUMPTIONS.find(p => p.key === levers.ixAssumption)?.label || ''

  return (
    <div className="rounded-lg px-4 py-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-2 mb-3">
        <GlossaryLabel
          term="Feasibility Levers"
          displayAs="Feasibility Levers"
          className="eyebrow-mono text-gray-500"
        />
        <span className="text-[10px] text-gray-400 italic">
          {onMwChange ? 'Project Size syncs across §03 + §04 · others are informational' : 'project-shape assumptions · informational'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        <ProjectSizeSlider
          mw={mw}
          onChange={(v) => {
            // Lifted MW: writes through to Search.jsx so §04 cards
            // recompute reactively. If onMwChange isn't wired (older
            // caller), no-op gracefully — slider stays static.
            if (onMwChange) onMwChange(v)
          }}
        />

        <FieldSelect
          label="Target COD"
          value={String(levers.codYear)}
          onChange={(val) => onChange({ ...levers, codYear: parseInt(val, 10) })}
          options={COD_YEAR_OPTIONS}
          placeholder="Select…"
        />

        {isCS && (
          <SubscriptionSlider
            pct={levers.subscriptionPct}
            onChange={(v) => onChange({ ...levers, subscriptionPct: v })}
            minPct={lmiFloor}
            floorLabel={lmiFloor > 0 ? `Min ${lmiFloor}% — ${stateName || 'state'} LMI carve-out` : null}
          />
        )}

        <FieldSelect
          label="IX Assumption"
          value={currentIxLabel}
          onChange={(val) => {
            const next = IX_ASSUMPTIONS.find(p => p.label === val)
            if (next) onChange({ ...levers, ixAssumption: next.key })
          }}
          options={ixLabels}
          optionTooltips={ixTooltips}
          placeholder="Select…"
        />
      </div>
    </div>
  )
}

// Shared slider chrome used by Project Size + Subscription. Matches the
// teal/slate vocab used by the financial-side SliderRow but lighter (no
// glossary label, no direction palette — these are pure scalar levers).
//
// `floorTickPct` (0–100) draws a faint navy tick on the track to mark a
// regulatory floor (e.g. LMI carve-out on the subscription slider). The
// slider's native `min` enforces the constraint; the tick discloses it.
// `footerCaption` renders a slate mono caption below the slider when set
// (e.g. "Min 50% — Illinois LMI carve-out").
function LeverSlider({ label, value, min, max, step, fillPct, format, tooltip, floorTickPct = null, footerCaption = null }) {
  const labelEl = (
    <label className="block text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-500 mb-1.5 cursor-help">
      {label}
    </label>
  )
  return (
    <div>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{labelEl}</TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>{tooltip.title}</p>
            <p className="leading-relaxed">{tooltip.body}</p>
          </TooltipContent>
        </Tooltip>
      ) : labelEl}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => format.onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer scenario-slider"
          style={{ background: `linear-gradient(to right, #14B8A6 0%, #14B8A6 ${fillPct}%, #E2E8F0 ${fillPct}%, #E2E8F0 100%)` }}
        />
        {floorTickPct != null && floorTickPct > 0 && floorTickPct < 100 && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${floorTickPct}%`,
              transform: `translate(-50%, -50%)`,
              width: '2px',
              height: '10px',
              background: '#0F1A2E',
              opacity: 0.4,
            }}
          />
        )}
      </div>
      <div className="text-[11px] font-mono tabular-nums text-ink mt-1">{format.display(value)}</div>
      {footerCaption && (
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-500 mt-1 leading-snug">
          {footerCaption}
        </div>
      )}
    </div>
  )
}

function ProjectSizeSlider({ mw, onChange }) {
  return (
    <LeverSlider
      label="Project Size"
      value={mw}
      min={0.5}
      max={20}
      step={0.5}
      fillPct={(mw / 20) * 100}
      format={{ onChange, display: (v) => `${v.toFixed(1)} MW` }}
    />
  )
}

function SubscriptionSlider({ pct, onChange, minPct = 0, floorLabel = null }) {
  // Clamp to floor so the displayed value can't fall below the regulatory
  // minimum even when the upstream snap-up effect hasn't run yet.
  const safePct = Math.max(minPct, pct)
  return (
    <LeverSlider
      label="Subscription"
      value={safePct}
      min={minPct}
      max={100}
      step={5}
      fillPct={safePct}
      format={{ onChange, display: (v) => `${Math.round(v)}%` }}
      tooltip={SUBSCRIPTION_TOOLTIP}
      floorTickPct={minPct > 0 ? minPct : null}
      footerCaption={floorLabel}
    />
  )
}

// ── Timeline estimate (informational, narrative) ───────────────────────────

function TimelineEstimate({ ixQueueSummary, siteCoverage, countyData, headwindCount, ixAssumption, codYear }) {
  const lines = []

  // IX timeline contribution
  if (ixQueueSummary && ixQueueSummary.avgStudyMonths > 0) {
    const months = ixQueueSummary.avgStudyMonths
    if (ixAssumption === 'fast_lane' && months > 12) {
      lines.push(`Fast-lane IX skips most of the ${months}-month standard queue, but eligibility caps at ~2 MW in most utilities.`)
    } else if (ixAssumption === 'acquire') {
      lines.push(`Acquired queue position avoids the ${months}-month study window — add acquisition cost to capex.`)
    } else {
      lines.push(`Live IX queue: ${months}-month avg study window · ${ixQueueSummary.totalProjects} projects ahead.`)
    }
  } else {
    lines.push('No live IX queue data — fall back to curated difficulty tier.')
  }

  // Site contribution
  const wet = countyData?.geospatial?.wetlandCoveragePct
  if (wet != null && wet >= 25) {
    lines.push(`Wetland coverage ${wet.toFixed(0)}% likely triggers state DEC / Army Corps Section 404 review — add 6–12 mo.`)
  }

  // Policy contribution
  if (headwindCount > 0) {
    lines.push(`${headwindCount} active headwind polic${headwindCount === 1 ? 'y' : 'ies'} may shift project economics mid-development — diligence the §06 Regulatory Watch feed.`)
  }

  // Target vs current year
  const now = 2026
  const yearsToTarget = codYear - now
  const minMonths = yearsToTarget * 12

  return (
    <div className="rounded-md px-4 py-3" style={{ background: 'rgba(15,26,46,0.04)', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-2 mb-2">
        <GlossaryLabel
          term="Timeline to COD"
          displayAs="Timeline to COD"
          className="eyebrow-mono text-gray-500"
        />
        <span className="text-[10px] font-mono tabular-nums text-gray-500">target {codYear} · {minMonths} mo runway</span>
      </div>
      <ul className="space-y-1 text-[11px] text-gray-700 leading-snug">
        {lines.map((l, i) => <li key={i}>· {l}</li>)}
      </ul>
    </div>
  )
}
