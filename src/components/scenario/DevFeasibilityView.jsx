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

import { useMemo, useState } from 'react'
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
// it as a free 0–100% input. This is currently informational only — it
// doesn't drive the pillar sub-scores or the financial outputs. Future
// integration: feed into the Financial Sensitivity tab as a Year 1
// revenue scaler.
const SUBSCRIPTION_DEFAULT_PCT = 80
const SUBSCRIPTION_TOOLTIP = {
  title: 'Subscription target',
  body: 'Target fill rate for your project. Operating CS projects in the NREL Sharing the Sun dataset cluster roughly 50–100%, varying by program age, marketing reach, LMI mandate, and anchor-offtaker presence. Informational at the moment — used as conversation framing, not as an input to scoring. Will feed Year 1 revenue when subscription is wired into the financial engine.',
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
  mw,
  stateName,
  countyName,
}) {
  // `mw` arrives from Search.jsx's form state, which holds it as a string
  // ("5"). parseFloat coerces; Number.isFinite null-guards every subsequent
  // .toFixed call. Default 5 MW matches the Lens form default.
  const initialMw = (() => {
    const n = parseFloat(mw)
    return Number.isFinite(n) && n > 0 ? n : 5
  })()
  const [levers, setLevers] = useState({
    mw: initialMw,
    codYear: 2027,
    subscriptionPct: SUBSCRIPTION_DEFAULT_PCT,
    ixAssumption: 'queue',
  })

  // Recompute the pillar sub-scores live as the user drags MW. The other
  // levers (COD year, subscription, IX assumption) influence the timeline
  // narrative below but don't move scoreEngine outputs — those are
  // market-structure signals, not project-shape inputs.
  const subScores = useMemo(
    () => computeSubScores(stateProgram, countyData, stage || '', technology, ixQueueSummary, policyEvents, levers.mw),
    [stateProgram, countyData, stage, technology, ixQueueSummary, policyEvents, levers.mw]
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
        isCS={isCS}
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
        mw={levers.mw}
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
            <span className="text-[10px] text-gray-500 font-mono tabular-nums">
              composite {composite}/100
            </span>
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
const COVERAGE_TOOLTIPS = {
  live: {
    title: 'Live data',
    body: 'Score is driven by real-time data — IX queue scrapes (8 CS states), county geospatial (NWI wetlands + SSURGO farmland, all 3,142 counties), or live news/PUC ingest. Refreshed on cron; data-age stamps surface staleness when scrapers lag.',
  },
  researched: {
    title: 'Researched · curated',
    body: 'Score uses Tractova-curated baseline values — county_intelligence boolean (~18 states seeded), CS program status from state_programs (all 50 states). Stable but not live; updated when manual research lands.',
  },
  curated: {
    title: 'Curated baseline',
    body: 'Score uses the state-level curated baseline (e.g. ixDifficulty tier from state_programs). All 50 states have a curated value; the live-blend overlay applies only where ix_queue_data is wired.',
  },
  fallback: {
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
              {coverage}
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
  return (
    <PillarCardShell pillarLabel="Policy" subScore={subScore} coverage={coverage}>
      <div className="space-y-1 text-[11px]">
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
      </div>
    </PillarCardShell>
  )
}

// ── Feasibility levers ─────────────────────────────────────────────────────

function FeasibilityLevers({ levers, onChange, isCS }) {
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
        <span className="text-[10px] text-gray-400 italic">project-shape assumptions · informational</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        <ProjectSizeSlider mw={levers.mw} onChange={(v) => onChange({ ...levers, mw: v })} />

        <FieldSelect
          label="Target COD"
          value={String(levers.codYear)}
          onChange={(val) => onChange({ ...levers, codYear: parseInt(val, 10) })}
          options={COD_YEAR_OPTIONS}
          placeholder="Select…"
        />

        {isCS && (
          <SubscriptionSlider pct={levers.subscriptionPct} onChange={(v) => onChange({ ...levers, subscriptionPct: v })} />
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
function LeverSlider({ label, value, min, max, step, fillPct, format, tooltip }) {
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
      <div className="text-[11px] font-mono tabular-nums text-ink mt-1">{format.display(value)}</div>
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

function SubscriptionSlider({ pct, onChange }) {
  return (
    <LeverSlider
      label="Subscription"
      value={pct}
      min={0}
      max={100}
      step={5}
      fillPct={pct}
      format={{ onChange, display: (v) => `${Math.round(v)}%` }}
      tooltip={SUBSCRIPTION_TOOLTIP}
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
