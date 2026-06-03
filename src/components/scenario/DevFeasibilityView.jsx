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
import { applyLeverAdjustments } from '../../lib/leverAdjustments'
import GlossaryLabel from '../ui/GlossaryLabel'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip'
import FieldSelect from '../FieldSelect'

const VERDICT_PALETTE = {
  go:      { label: 'Go',      tone: '#0F766E', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.35)', icon: '◆' },
  caution: { label: 'Caution', tone: '#92400E', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.35)',  icon: '▼' },
  nogo:    { label: 'No-Go',   tone: '#991B1B', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.35)',  icon: '×' },
}

export function classifyVerdict(composite) {
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

// ITC what-if scenarios — model a fluxable Incentives outcome. The label is
// what the user picks; applyItcScenario re-shapes the county eligibility.
const ITC_SCENARIOS = [
  { key: 'as_mapped', label: 'As mapped (live eligibility)' },
  { key: 'no_ec',     label: 'Lose Energy Community adder' },
  { key: 'base_only', label: 'Base §48E only (no location adders)' },
]
const ITC_SCENARIO_HINTS = {
  'As mapped (live eligibility)':           'Use the real county-level ITC adder eligibility (EPA Energy Community + §48(e) Low-Income).',
  'Lose Energy Community adder':            'Model the project dropping out of the Energy Community map (e.g. annual DOE NETL remap) — keeps any §48(e) Low-Income adder, drops the +10% EC bonus.',
  'Base §48E only (no location adders)':    'Model both location adders falling away — only the base 30% §48E credit survives. The downside case for tax-equity dependent deals.',
}

// Re-shape county incentive getter results per the ITC what-if lever so the
// Incentives pillar can model a fluxable adder outcome. Only acts when real
// coverage exists — never fabricates eligibility where the county has none.
function applyItcScenario(incentives, scenario) {
  if (!incentives || scenario === 'as_mapped') return incentives
  if (scenario === 'no_ec') {
    return {
      ...incentives,
      energyCommunity: { ...(incentives.energyCommunity || {}), isEnergyCommunity: false, qualifiesViaMsa: false, qualifiesViaCoalClosure: false },
    }
  }
  if (scenario === 'base_only') {
    return {
      energyCommunity: { isEnergyCommunity: false },
      nmtcLic: { isEligible: false },
      hudQctDda: { qctCount: 0, isNonMetroDda: false },
    }
  }
  return incentives
}

export default function DevFeasibilityView({
  stateProgram,
  countyData,
  ixQueueSummary,
  policyEvents,
  incentives,   // raw { energyCommunity, nmtcLic, hudQctDda } county getter results → Incentives pillar
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

  // What-if levers (local to this view). Each now FLOWS INTO the verdict:
  //   - codYear → federal timing (Policy & Timing pillar, structural)
  //   - itcScenario → Incentives pillar (structural — model losing an adder)
  //   - subscriptionPct → offtake (lever layer)
  //   - ixAssumption → interconnection (lever layer)
  const [levers, setLevers] = useState({
    codYear: 2027,
    subscriptionPct: SUBSCRIPTION_DEFAULT_PCT,
    ixAssumption: 'queue',
    itcScenario: 'as_mapped',
  })

  // ITC what-if: re-shape the county incentive eligibility per the lever so the
  // user can model fluxable risk — "what if we drop out of the Energy-Community
  // map?" or "what if only the base §48E credit survives?" Only overrides when
  // real county coverage exists (never fabricates eligibility where there's none).
  const scenarioIncentives = useMemo(
    () => applyItcScenario(incentives, levers.itcScenario),
    [incentives, levers.itcScenario]
  )

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

  // Structural sub-scores from computeSubScores — driven by state program,
  // county data, IX queue, MW. These also drive the Lens header gauge.
  // opts: incentives (county ITC adder eligibility → Pillar 4) + the COD-year
  // lever (drives the federal tax-credit timing inside Pillar 5). The COD
  // lever is the one lever that feeds the structural call directly — federal
  // timing is a pure function of the target year + stage, so it belongs in
  // computeSubScores, not the bounded ±10 lever layer.
  const structuralSubScores = useMemo(
    () => computeSubScores(stateProgram, countyData, stage || '', technology, ixQueueSummary, policyEvents, effectiveMw, { incentives: scenarioIncentives, codYear: levers.codYear }),
    [stateProgram, countyData, stage, technology, ixQueueSummary, policyEvents, effectiveMw, scenarioIncentives, levers.codYear]
  )

  // Lever-adjusted sub-scores — layer Subscription / COD / IX assumption
  // deltas on top of the structural baseline. Capped ±10 per pillar so
  // user levers can shape but not dominate. Returns rationale rows for
  // the verdict tile to enumerate which lever fired.
  const leverResult = useMemo(
    () => applyLeverAdjustments(structuralSubScores, levers, { technology, ixQueueSummary }),
    [structuralSubScores, levers, technology, ixQueueSummary]
  )
  const subScores = leverResult.adjusted

  const composite = useMemo(
    () => safeScore(subScores),
    [subScores]
  )

  const structuralComposite = useMemo(
    () => safeScore(structuralSubScores),
    [structuralSubScores]
  )

  const compositeDelta = (composite != null && structuralComposite != null) ? composite - structuralComposite : 0

  const verdict = classifyVerdict(composite)
  const verdictPalette = verdict ? VERDICT_PALETTE[verdict] : null

  // Policy & Timing pillar detail (federal tax-credit timing tier + applicable
  // state-policy events ranked by severity). Sourced from the engine's
  // policyDetail so the verdict rationale, the Policy & Timing card, and the
  // composite all read one number — no parallel re-filtering of policyEvents.
  const federalTiming = subScores.policyDetail?.federal || null
  const statePolicyEvents = subScores.policyDetail?.statePolicy?.events || []

  const isCS = technology === 'Community Solar' || technology === 'Hybrid'

  return (
    <TooltipProvider delayDuration={150}>
    <div className="px-5 py-4 space-y-4">
      <VerdictTile
        verdict={verdict}
        palette={verdictPalette}
        composite={composite}
        subScores={subScores}
        stateName={stateName}
        countyName={countyName}
        technology={technology}
        compositeDelta={compositeDelta}
        leverRationale={leverResult.rationale}
        stateProgram={stateProgram}
        countyData={countyData}
        ixQueueSummary={ixQueueSummary}
        statePolicyEvents={statePolicyEvents}
        federalTiming={federalTiming}
      />

      {/* The full 5-pillar card grid was removed here (2026-06-03 §03 rework):
          it duplicated §05 Pillar Diagnostics (deep cards + modals) AND the
          VerdictTile's own OFFT/IX/INC/SITE/P&T readout. §03's distinct value
          is the interactive Verdict + Levers ("what moves the score"); the
          deep per-pillar read lives in §05. De-dup per the unify tenet. */}

      <FeasibilityLevers
        levers={levers}
        onChange={setLevers}
        mw={effectiveMw}
        onMwChange={onMwChange}
        isCS={isCS}
        lmiFloor={lmiFloor}
        stateName={stateName}
      />

      {/* The editorial Timeline-to-COD phase Gantt was removed in the 2026-05
          signal pivot — only the IX study window was real (8 states); the
          permit/construct/energization segments were uniform editorial guesses.
          COD's effect now lives where it's real: the Policy & Timing pillar
          (federal §48E/§45Y cliff) + the IX lever (queue-vs-runway). */}
    </div>
    </TooltipProvider>
  )
}

// ── Verdict tile ───────────────────────────────────────────────────────────

function VerdictTile({ verdict, palette, composite, subScores, stateName, countyName, technology, compositeDelta = 0, leverRationale = [], stateProgram = null, countyData = null, ixQueueSummary = null, statePolicyEvents = [], federalTiming = null }) {
  if (!verdict || !palette) {
    return (
      <div className="rounded-lg px-4 py-3 text-[12px] text-gray-500"
        style={{ background: 'rgba(15,26,46,0.04)', border: '1px solid #E2E8F0' }}>
        Feasibility verdict unavailable — pillar data still loading or incomplete for {stateName || 'this state'}.
      </div>
    )
  }
  const showLeverImpact = Math.abs(compositeDelta) >= 1 && leverRationale.length > 0
  const deltaSign = compositeDelta >= 0 ? '+' : ''
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
                  Composite = weighted blend of the five pillar sub-scores (Offtake 25% · IX 25% · Incentives 20% · Site 20% · Policy &amp; Timing 10%, defined in <code className="text-[10px]" style={{ color: '#FCA5A5' }}>WEIGHT_SCENARIOS.default</code>). Pillars without data for this surface are rebalanced out, not penalized. The Dev Feasibility verdict reflects your levers (Subscription / COD / IX Assumption); the structural baseline shown in the Lens header gauge does NOT — it's the pre-lever search snapshot.
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
            {verdictRationale(verdict, subScores, { stateProgram, countyData, ixQueueSummary, statePolicyEvents, federalTiming, technology, stateName, countyName })}
          </div>
          {showLeverImpact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500 mt-1.5 cursor-help underline decoration-dotted underline-offset-2 leading-snug">
                  Lever impact: {deltaSign}{Math.round(compositeDelta)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="!max-w-[420px]">
                <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>Lever adjustments</p>
                <p className="leading-relaxed mb-2">
                  Subscription / COD year / IX assumption shift pillar sub-scores by editorial deltas (capped ±10 per pillar). Disclosed math:
                </p>
                <ul className="space-y-1 leading-snug" style={{ color: '#E2E8F0' }}>
                  {leverRationale.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono tabular-nums font-bold shrink-0" style={{ color: r.delta > 0 ? '#5EEAD4' : '#FCA5A5' }}>
                        {r.delta > 0 ? '+' : ''}{r.delta} {r.pillar.toUpperCase()}
                      </span>
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {/* Readout strip mirrors the composite's pillars. All five now feed the
          composite (rebalanced when a pillar lacks data), so all five show —
          Incentives + Policy & Timing render only when present for this site. */}
      <div className="hidden md:flex items-center gap-3 text-[10px] font-mono tabular-nums shrink-0">
        <PillarReadout label="OFFT" value={subScores.offtake} />
        <PillarReadout label="IX"   value={subScores.ix} />
        <PillarReadout label="INC"  value={subScores.incentives} />
        <PillarReadout label="SITE" value={subScores.site} />
        <PillarReadout label="P&T"  value={subScores.policyTiming} />
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

// Verdict rationale — surfaces the single highest-leverage diligence
// step instead of just naming the weakest pillar by score. Pillar-
// specific friction descriptions read pillar metadata to produce
// concrete next-step copy ("Norfolk wetland 38% — screen adjacent
// counties or commit to Section 404 review") rather than generic
// score-reading copy ("Site is weakest at 41/100").
//
// Falls back to a generic friction line when pillar metadata isn't
// loaded yet — never blanks the rationale.
export function verdictRationale(verdict, subScores, ctx = {}) {
  // All five pillars are weakest-candidates; skip any that lack data for this
  // surface (null sub-score) so we don't surface a "weakest" pillar that's
  // really just unmeasured.
  const weakest = [
    { key: 'offtake',      name: 'Offtake',         val: subScores.offtake },
    { key: 'ix',           name: 'Interconnection', val: subScores.ix },
    { key: 'incentives',   name: 'Incentives',      val: subScores.incentives },
    { key: 'site',         name: 'Site',            val: subScores.site },
    { key: 'policyTiming', name: 'Policy & Timing', val: subScores.policyTiming },
  ].filter(p => Number.isFinite(p.val)).sort((a, b) => a.val - b.val)[0]

  if (!weakest) return 'Add project parameters (stage, county) to assess feasibility.'
  const action = describePillarFriction(weakest.key, ctx, subScores)

  if (verdict === 'go') {
    return `All pillars clear the build-it threshold. Watch ${weakest.name} (${Math.round(weakest.val)}/100) — ${action}`
  }
  if (verdict === 'caution') {
    return `Mixed signals — ${weakest.name} ${Math.round(weakest.val)}/100. ${action}`
  }
  return `${weakest.name} ${Math.round(weakest.val)}/100. ${action}`
}

function describePillarFriction(pillar, ctx, subScores) {
  if (pillar === 'offtake')      return offtakeFriction(ctx)
  if (pillar === 'ix')           return ixFriction(ctx)
  if (pillar === 'site')         return siteFriction(ctx)
  if (pillar === 'incentives')   return incentivesFriction(subScores)
  if (pillar === 'policyTiming') return policyTimingFriction(ctx)
  return 'Diligence this pillar before committing capex.'
}

function incentivesFriction(subScores) {
  const a = subScores?.incentiveDetail || {}
  if (!a.energyCommunity && !a.lowIncomeCommunity) {
    return 'No Energy Community or §48(e) Low-Income adder resolves at this county — base §48E only. Check site-specific brownfield qualification at energycommunities.gov.'
  }
  if (!a.energyCommunity) return 'Low-Income adder qualifies but no Energy Community designation — verify brownfield/coal-closure status for the full adder stack.'
  if (!a.lowIncomeCommunity) return 'Energy Community qualifies but no §48(e) Low-Income tract — confirm NMTC / QCT-DDA tracts near the parcel.'
  return 'Full ITC adder stack available — confirm prevailing-wage + apprenticeship compliance to bank the base 30%.'
}

function policyTimingFriction(ctx) {
  const fed = ctx.federalTiming
  if (fed && fed.tier === 'at_risk') {
    return `${fed.headline} — ${fed.reasons?.[0] || 'confirm §48E/§45Y start-of-construction + placed-in-service path.'}`
  }
  const events = ctx.statePolicyEvents || []
  if (events.length > 0) {
    const top = events[0]
    const stateLabel = ctx.stateName ? ` in ${ctx.stateName}` : ''
    return `${events.length} state policy headwind${events.length === 1 ? '' : 's'}${stateLabel} — top: "${top.event_name}" (${top.severity}). Review §06 Regulatory Watch.`
  }
  if (fed) return `${fed.headline} — ${fed.reasons?.[0] || 'confirm the federal tax-credit timeline for your target COD.'}`
  return 'Confirm the §48E/§45Y federal timing window for your target COD year.'
}

function offtakeFriction(ctx) {
  const { stateProgram, technology, stateName } = ctx
  if (!stateProgram) return 'Verify state program structure before underwriting.'
  const isCS = technology === 'Community Solar' || technology === 'Hybrid'
  if (isCS) {
    const status = stateProgram.csStatus
    if (!status || status === 'none' || status === 'closed') {
      return `${stateName || 'This state'} has no active CS program — pivot to a CS-active state or wait for program reopening.`
    }
    if (status === 'pending') {
      return `${stateName || 'State'} CS program pending — confirm launch + tariff finalization before committing capex.`
    }
    if (stateProgram.capacityMW > 0 && stateProgram.capacityMW < 200) {
      return `Only ${stateProgram.capacityMW} MW capacity remaining — file early or check waitlist status.`
    }
    if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) {
      return `${stateProgram.lmiPercent}% LMI carve-out required — verify your subscriber pipeline can fill that floor.`
    }
    return 'Verify program capacity remaining + subscription pipeline.'
  }
  if (technology === 'BESS')      return 'ISO capacity-market clearing is thin in this state — verify recent auction prices and resource-adequacy position.'
  if (technology === 'C&I Solar') return 'Retail-rate displacement is thin — verify EIA Form 861 rates vs. your PPA quote.'
  return 'Diligence offtake structure before underwriting.'
}

function ixFriction(ctx) {
  const { ixQueueSummary, stateProgram, stateName } = ctx
  if (ixQueueSummary && ixQueueSummary.avgStudyMonths >= 18) {
    return `${stateName || 'State'} IX queue: ${ixQueueSummary.avgStudyMonths}-mo avg study window — verify queue position or acquire a mid-queue slot.`
  }
  if (stateProgram?.ixDifficulty === 'very_hard') {
    return `${stateName || 'State'} interconnection flagged very hard — cluster-study upgrade costs may dominate project economics.`
  }
  if (stateProgram?.ixDifficulty === 'hard') {
    return `${stateName || 'State'} interconnection flagged hard — confirm utility cluster-study schedule before committing site control.`
  }
  return 'Confirm interconnection feasibility with a system-impact study.'
}

function siteFriction(ctx) {
  const { countyData, countyName } = ctx
  const wet  = countyData?.geospatial?.wetlandCoveragePct
  const farm = countyData?.geospatial?.primeFarmlandPct
  const countyLabel = countyName ? `${countyName} County` : 'This county'
  if (wet != null && wet >= 25) {
    return `${countyLabel} wetland coverage ${wet.toFixed(0)}% — screen adjacent counties or commit to Section 404 review (+6–12 mo).`
  }
  if (farm != null && farm >= 40) {
    return `${countyLabel} prime farmland ${farm.toFixed(0)}% — verify state ag-land protections and dual-use eligibility.`
  }
  if (countyData?.siteControl === false) {
    return `${countyLabel} flagged limited developable land — verify parcel availability before committing.`
  }
  if (countyData?.siteControl == null && wet == null && farm == null) {
    return `Site signal not yet curated for ${countyLabel.toLowerCase()} — verify directly via parcel survey.`
  }
  return 'Verify parcel-level land control + permitting path.'
}

// ── Feasibility levers ─────────────────────────────────────────────────────

function FeasibilityLevers({ levers, onChange, mw, onMwChange, isCS, lmiFloor = 0, stateName = '' }) {
  const ixLabels = IX_ASSUMPTIONS.map(p => p.label)
  const ixTooltips = Object.fromEntries(IX_ASSUMPTIONS.map(p => [p.label, p.hint]))
  const currentIxLabel = IX_ASSUMPTIONS.find(p => p.key === levers.ixAssumption)?.label || ''
  const itcLabels = ITC_SCENARIOS.map(s => s.label)
  const currentItcLabel = ITC_SCENARIOS.find(s => s.key === levers.itcScenario)?.label || ''

  return (
    <div className="rounded-lg px-4 py-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-2 mb-3">
        <GlossaryLabel
          term="Feasibility Levers"
          displayAs="Feasibility Levers"
          className="eyebrow-mono text-gray-500"
        />
        <span className="text-[10px] text-gray-400 italic">
          Model fluxable risk — every lever flows into the verdict above{onMwChange ? ' · Project Size syncs across §03 + §04' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
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
          optionTooltips={Object.fromEntries(COD_YEAR_OPTIONS.map(y => [y, `Target commercial-operation year ${y} — drives the §48E/§45Y federal timing tier in the Policy & Timing pillar (early stage + a far COD raises FEOC / placed-in-service risk).`]))}
        />

        <FieldSelect
          label="ITC Adders"
          value={currentItcLabel}
          onChange={(val) => {
            const next = ITC_SCENARIOS.find(s => s.label === val)
            if (next) onChange({ ...levers, itcScenario: next.key })
          }}
          options={itcLabels}
          optionTooltips={ITC_SCENARIO_HINTS}
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
// Floor handling: when `lockedBelowPct` is set (0–100, e.g. LMI carve-out
// on subscription), the slider's full 0→100 track stays visible — but
// the segment from 0 to lockedBelowPct renders as a dimmed slate "locked"
// zone, the active value clamps via onChange to never fall below the
// floor, and a navy tick marks the exact floor position. Devs see the
// full regulatory landscape, can't violate it.
function LeverSlider({ label, value, min, max, step, fillPct, format, tooltip, lockedBelowPct = 0, footerCaption = null }) {
  const labelEl = (
    <label className="block text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-500 mb-1.5 cursor-help">
      {label}
    </label>
  )
  // Three-stop gradient: locked zone (slate) → active fill (teal) →
  // unfilled remainder (light grey). `fillPct` is clamped above
  // lockedBelowPct so the teal segment never starts before the floor.
  const safeFill = Math.max(lockedBelowPct, fillPct)
  const trackBackground = lockedBelowPct > 0
    ? `linear-gradient(to right,
        rgba(148,163,184,0.30) 0%,
        rgba(148,163,184,0.30) ${lockedBelowPct}%,
        #14B8A6 ${lockedBelowPct}%,
        #14B8A6 ${safeFill}%,
        #E2E8F0 ${safeFill}%,
        #E2E8F0 100%)`
    : `linear-gradient(to right, #14B8A6 0%, #14B8A6 ${fillPct}%, #E2E8F0 ${fillPct}%, #E2E8F0 100%)`
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
          onChange={(e) => {
            // Floor clamp lives at the input layer — drag below floor
            // snaps the value back to the floor, but the native slider
            // track keeps showing the full 0→max range for context.
            const raw = parseFloat(e.target.value)
            const clamped = lockedBelowPct > 0 ? Math.max(lockedBelowPct, raw) : raw
            format.onChange(clamped)
          }}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer scenario-slider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          style={{ background: trackBackground }}
        />
        {lockedBelowPct > 0 && lockedBelowPct < 100 && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${lockedBelowPct}%`,
              transform: `translate(-50%, -50%)`,
              width: '2px',
              height: '10px',
              background: '#0F1A2E',
              opacity: 0.5,
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
  // Clamp the displayed value to the floor so it can't sit below the LMI
  // regulatory minimum even if upstream snap-up hasn't flushed yet. The
  // slider track itself remains 0–100 — the locked zone is the dimmed
  // band on the left, not a track truncation.
  const safePct = Math.max(minPct, pct)
  return (
    <LeverSlider
      label="Subscription"
      value={safePct}
      min={0}
      max={100}
      step={5}
      fillPct={safePct}
      format={{ onChange, display: (v) => `${Math.round(v)}%` }}
      tooltip={SUBSCRIPTION_TOOLTIP}
      lockedBelowPct={minPct > 0 ? minPct : 0}
      footerCaption={floorLabel}
    />
  )
}
