// Scenario Studio engine — pure functions over revenueEngine.js.
//
// Powers the interactive sensitivity layer in Search.jsx (Lens result tab).
// Two responsibilities:
//   1. computeBaseline({stateId, technology, mw, rates}) → the "achievable
//      baseline" numbers for this state + tech + size, captured as a frozen
//      reference point.
//   2. applyScenario(baseline, sliders) → recompute Year 1 revenue + simple
//      payback when the user drags any of the 6 sliders. Returns deltas vs
//      the baseline so the UI can render green/red chips.
//
// Why a separate engine instead of calling revenueEngine directly?
//   - revenueEngine takes (stateId, mw, rates) and computes a single point.
//     Scenario Studio needs to override individual inputs (capex, IX cost,
//     REC price, capacity factor, allocation) without re-fetching rates.
//   - Captures industry baselines for inputs the engine doesn't expose
//     as first-class fields (IX cost $/W, program allocation %).
//   - Keeps the sensitivity math in one place so the disclaimer + the
//     formula stay in lockstep.
//
// Disclaimer is a constant export — the same string appears in the
// ScenarioStudio panel and the optional PDF section.

import {
  computeRevenueProjection,
  computeCIRevenueProjection,
  computeBESSProjection,
} from './revenueEngine'

// ── Industry baselines ──────────────────────────────────────────────────────
// Values that aren't in revenueEngine's per-state data but are needed to
// compute payback. Sourced from public industry surveys (Wood Mac 2025,
// Allcot CS Cost Survey 2025). Conservative defaults — users override
// freely via the slider.
const INDUSTRY_BASELINE = {
  ixCostPerWatt: 0.10,        // typical CS interconnection cost ($/W)
  programAllocation: 1.0,     // 100% — assume full allocation for the baseline
  opexPerKwYear: 20,          // $/kW/yr utility-scale solar O&M (Wood Mac H2 2025: $15-25/kW/yr)
  opexInflationPct: 2.5,      // %/yr opex escalator
  discountRate: 0.08,         // 8% standard project finance discount rate
  contractYears: 25,          // CS+C&I project life (PPA contract) — BESS overrides to 15
  bessContractYears: 15,      // BESS project life (battery degradation cap)
  // Capital structure for Equity-IRR + DSCR. Conservative IPP norms —
  // 70/30 debt:equity, 6.5% all-in rate, 18-year amortization. Bakes
  // in standard project-finance assumptions; users can mentally adjust
  // for highly-levered tax-equity deals (typically less debt + flip
  // structures we don't model here).
  debtPct: 0.70,
  debtRate: 0.065,
  debtTermYears: 18,
}

// User-facing disclaimer. Must appear in UI + PDF wherever scenarios are
// surfaced. Words chosen to make the directional-sensitivity nature clear
// and to redirect users toward an advisor for IC-grade modeling.
export const SCENARIO_DISCLAIMER =
  'Scenarios are directional sensitivity analyses based on industry baseline assumptions. ' +
  'IRR / LCOE / NPV use $20/kW/yr opex baseline + 25-year project life (15 for BESS) + 8% discount. ' +
  'NOT investment-grade pro-forma — engage a financial advisor for IC-grade modeling.'

// ── Preset scenarios ────────────────────────────────────────────────────────
// One-tap P10 / P90 envelopes anchored to public industry data. Each
// multiplier and cap is documented in SCENARIO_PRESET_METHODOLOGY below
// (mirrored verbatim into the chip tooltip + glossary entry so users can
// audit the assumptions).
//
// Recalibration 2026-05-03:
//   - Best-case allocation cap dropped 1.25 → 1.10. The 1.25 cap was
//     allowing best-case to extrapolate program allocation past 110% of
//     the curated baseline, which Aden flagged as not defensible.
//   - Worst-case IX cost widened 1.50 → 2.50. Real-world IX cost shocks
//     (network upgrades, distribution feeder reinforcement) routinely run
//     5-10× the typical baseline — 1.50 was too gentle. Tooltip discloses
//     that outlier IX cost scenarios still exist beyond this band.
//
// Applied as multipliers on the baseline inputs; UI calls applyScenario
// with the resulting numbers. Tech-aware: REC/allocation are CS-specific
// and silently no-op for C&I/BESS.
export const SCENARIO_PRESETS = {
  best: {
    label: 'Best case',
    description: 'P10 outcome — favorable cost, production, pricing',
    apply: (b) => ({
      systemSizeMW:    b.systemSizeMW,
      capexPerWatt:    b.capexPerWatt   != null ? round2(b.capexPerWatt   * 0.85) : null,
      ixCostPerWatt:   b.ixCostPerWatt  != null ? round2(b.ixCostPerWatt  * 0.70) : null,
      capacityFactor:  b.capacityFactor != null ? Math.min(0.28, b.capacityFactor * 1.05) : null,
      recPricePerMwh:  b.recPricePerMwh != null ? Math.round(b.recPricePerMwh * 1.15) : null,
      programAllocation: b.programAllocation != null ? Math.min(1.10, b.programAllocation * 1.10) : null,
    }),
  },
  worst: {
    label: 'Worst case',
    description: 'P90 outcome — cost overruns, weaker pricing',
    apply: (b) => ({
      systemSizeMW:    b.systemSizeMW,
      capexPerWatt:    b.capexPerWatt   != null ? round2(b.capexPerWatt   * 1.20) : null,
      ixCostPerWatt:   b.ixCostPerWatt  != null ? round2(b.ixCostPerWatt  * 2.50) : null,
      capacityFactor:  b.capacityFactor != null ? Math.max(0.12, b.capacityFactor * 0.92) : null,
      recPricePerMwh:  b.recPricePerMwh != null ? Math.round(b.recPricePerMwh * 0.85) : null,
      programAllocation: b.programAllocation != null ? Math.max(0.50, b.programAllocation * 0.75) : null,
    }),
  },
}

// Methodology behind each preset multiplier. Surfaced in the preset-chip
// Radix tooltip + Best/Worst case glossary entry so users can audit the
// assumptions rather than treating the presets as a black box. Sources
// are public — anchor each row to a specific industry survey or filing.
export const SCENARIO_PRESET_METHODOLOGY = {
  best: {
    title: 'Best case · P10 industry outcome',
    rows: [
      { label: 'Capex',       multiplier: '−15%', source: 'NREL ATB 2024 P10 utility-PV cost' },
      { label: 'IX cost',     multiplier: '−30%', source: 'Typical greenfield (no major upgrades)' },
      { label: 'Capacity factor', multiplier: '+5% (cap 28%)', source: 'Top-quartile fixed-tilt siting' },
      { label: 'REC price',   multiplier: '+15%', source: 'Historical 12mo upper band' },
      { label: 'Allocation',  multiplier: '+10% (cap 110%)', source: 'Curated baseline + program fill upside' },
    ],
  },
  worst: {
    title: 'Worst case · P90 industry outcome',
    rows: [
      { label: 'Capex',       multiplier: '+20%', source: 'NREL ATB 2024 P90 utility-PV cost' },
      { label: 'IX cost',     multiplier: '+150%', source: 'Network-upgrade shock (distribution feeder)' },
      { label: 'Capacity factor', multiplier: '−8% (floor 12%)', source: 'Bottom-quartile / soiling / snow-loss' },
      { label: 'REC price',   multiplier: '−15%', source: 'Historical 12mo lower band' },
      { label: 'Allocation',  multiplier: '−25% (floor 50%)', source: 'Curated baseline − program fill drag' },
    ],
    caveat: 'Outlier IX-cost scenarios (5-10× baseline) exist beyond this band. Treat the worst-case envelope as defensible-sensitivity, not a tail risk.',
  },
}

function round2(v) {
  return Math.round(v * 100) / 100
}

// ── Public API ──────────────────────────────────────────────────────────────

// Build the baseline object for a state + tech + system size. Returns null
// if the state has no revenue data for this tech (caller should hide the
// Scenario Studio tab in that case).
//
// `rates` is the optional Supabase revenue_rates row (snake_case). If
// omitted, revenueEngine uses its hardcoded fallback dataset.
export function computeBaseline({ stateId, technology, mw, rates }) {
  if (!stateId || !mw || mw <= 0) return null
  const tech = normalizeTech(technology)
  const size = parseFloat(mw)
  if (!Number.isFinite(size) || size <= 0) return null

  const raw = computeForTech(tech, stateId, size, rates)
  if (!raw) return null

  const inputs = extractInputs(tech, raw)
  const outputs = computeOutputs(tech, raw, inputs)

  return {
    stateId,
    stateLabel: raw.stateLabel,
    technology: tech,
    inputs,
    outputs,
    raw,
  }
}

// Apply user slider deltas to a baseline. Pure — no I/O, microsecond fast.
// Returns the new {inputs, outputs} including delta fields the UI uses
// to render green/red revenue + payback chips.
export function applyScenario(baseline, sliders) {
  if (!baseline) return null
  const merged = { ...baseline.inputs, ...sliders }
  const outputs = computeOutputs(baseline.technology, baseline.raw, merged, baseline.outputs)
  return { inputs: merged, outputs }
}

// Slider configuration per tech — the UI uses this to render only the
// applicable controls and to set min/max/step bounds. `baseline` value
// becomes the slider's tick marker and starting position.
export function getSliderConfig(baseline) {
  if (!baseline) return []
  const i = baseline.inputs
  const tech = baseline.technology

  // direction: 'higher-better' | 'lower-better' | 'neutral'
  // Drives the slider color (grey at baseline, teal when "good direction,"
  // amber when "bad direction"). systemSizeMW is neutral because the
  // financial impact is genuinely mixed — bigger system = more revenue
  // AND more capex, with offsetting effects on payback.

  // Lifecycle assumption sliders apply across all techs. Group at the
  // bottom so the user starts with the project-shape sliders (size, cost,
  // production) before adjusting the financial-model assumptions.
  const lifecycleSliders = [
    {
      key: 'opexPerKwYear',
      label: 'Opex',
      unit: '$/kW/yr',
      baseline: i.opexPerKwYear,
      min: 8,
      max: 50,
      step: 1,
      format: (v) => `$${v.toFixed(0)}/kW/yr`,
      direction: 'lower-better',
    },
    {
      key: 'discountRate',
      label: 'Discount Rate',
      unit: '',
      baseline: i.discountRate,
      min: 0.04,
      max: 0.15,
      step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`,
      direction: 'lower-better',  // lower discount = higher NPV
    },
    {
      key: 'contractYears',
      label: 'Contract Tenor',
      unit: 'yr',
      baseline: i.contractYears,
      min: 10,
      max: tech === 'bess' ? 20 : 30,  // BESS capped to battery degradation envelope
      step: 1,
      format: (v) => `${Math.round(v)} yr`,
      direction: 'higher-better',
    },
  ]

  const common = [
    {
      key: 'systemSizeMW',
      label: 'System Size',
      unit: 'MW AC',
      baseline: i.systemSizeMW,
      min: 0.5,
      max: Math.max(20, i.systemSizeMW * 2),
      step: 0.5,
      format: (v) => `${v.toFixed(1)} MW`,
      direction: 'neutral',
    },
    {
      key: 'capexPerWatt',
      label: 'Capex',
      unit: '$/W',
      baseline: i.capexPerWatt,
      // 2026-05-05 (A.1): dynamic ranges proportional to baseline so the
      // user has ample headroom both directions. Cumberland County Maine
      // ($2.70/W baseline) was previously pinned at 90% of the slider's
      // right edge (max 3.00). Now: 0.50× to 2.00× baseline, clamped to
      // the floor + ceiling that bound any realistic CS project capex.
      min: i.capexPerWatt != null ? Math.max(0.60, Number((i.capexPerWatt * 0.50).toFixed(2))) : 0.80,
      max: i.capexPerWatt != null ? Math.min(4.00, Number((i.capexPerWatt * 2.00).toFixed(2))) : 3.00,
      step: 0.05,
      format: (v) => `$${v.toFixed(2)}/W`,
      direction: 'lower-better',
      disabled: i.capexPerWatt == null,
    },
    {
      key: 'ixCostPerWatt',
      label: 'IX Cost',
      unit: '$/W',
      baseline: i.ixCostPerWatt,
      // 2026-05-05 (A.1): floor drops to $0 to support the acquired-project
      // case where the IX cost is paid by an external party. Max scales with
      // baseline so high-IX-difficulty markets (NJ, MA) have enough headroom.
      min: 0,
      max: i.ixCostPerWatt != null ? Math.max(0.50, Number((i.ixCostPerWatt * 3.00).toFixed(2))) : 0.50,
      step: 0.01,
      format: (v) => `$${v.toFixed(2)}/W`,
      direction: 'lower-better',
    },
  ]

  if (tech === 'community-solar') {
    return [
      ...common,
      {
        key: 'capacityFactor',
        label: 'Capacity Factor',
        unit: '',
        baseline: i.capacityFactor,
        min: 0.12,
        max: 0.28,
        step: 0.005,
        format: (v) => `${(v * 100).toFixed(1)}%`,
        direction: 'higher-better',
      },
      {
        key: 'recPricePerMwh',
        label: 'REC Price',
        unit: '$/MWh',
        baseline: i.recPricePerMwh,
        min: 0,
        max: Math.max(120, (i.recPricePerMwh || 0) * 1.5),
        step: 1,
        format: (v) => `$${v.toFixed(0)}/MWh`,
        direction: 'higher-better',
      },
      {
        key: 'programAllocation',
        label: 'Program Allocation',
        unit: '',
        baseline: i.programAllocation,
        min: 0.25,
        max: 1.25,
        step: 0.05,
        format: (v) => `${(v * 100).toFixed(0)}%`,
        direction: 'higher-better',
      },
      ...lifecycleSliders,
    ]
  }

  if (tech === 'commercial-industrial') {
    return [
      ...common,
      {
        key: 'capacityFactor',
        label: 'Capacity Factor',
        unit: '',
        baseline: i.capacityFactor,
        min: 0.12,
        max: 0.28,
        step: 0.005,
        format: (v) => `${(v * 100).toFixed(1)}%`,
        direction: 'higher-better',
      },
      ...lifecycleSliders,
    ]
  }

  // BESS — only size + capex/kWh + IX + lifecycle sliders matter.
  return [...common, ...lifecycleSliders]
}

// Format a one-line summary of a scenario for chip + memo rendering.
// e.g. "10.0 MW · $1.40/W capex · REC at +15%"
export function formatScenarioSummary(scenario, baseline) {
  if (!scenario || !baseline) return ''
  const parts = []
  const i = scenario.inputs
  const b = baseline.inputs
  parts.push(`${(i.systemSizeMW ?? 0).toFixed(1)} MW`)
  if (i.capexPerWatt != null && Math.abs((i.capexPerWatt - b.capexPerWatt) / b.capexPerWatt) > 0.01) {
    parts.push(`$${i.capexPerWatt.toFixed(2)}/W capex`)
  }
  if (i.ixCostPerWatt != null && Math.abs((i.ixCostPerWatt - b.ixCostPerWatt) / Math.max(b.ixCostPerWatt, 0.01)) > 0.05) {
    parts.push(`$${i.ixCostPerWatt.toFixed(2)}/W IX`)
  }
  if (i.recPricePerMwh != null && b.recPricePerMwh != null && b.recPricePerMwh > 0) {
    const pct = (i.recPricePerMwh - b.recPricePerMwh) / b.recPricePerMwh
    if (Math.abs(pct) > 0.05) parts.push(`REC ${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(0)}%`)
  }
  if (i.programAllocation != null && Math.abs(i.programAllocation - 1) > 0.01) {
    parts.push(`${(i.programAllocation * 100).toFixed(0)}% allocation`)
  }
  if (i.capacityFactor != null && b.capacityFactor != null) {
    const pct = (i.capacityFactor - b.capacityFactor) / b.capacityFactor
    if (Math.abs(pct) > 0.02) parts.push(`CF ${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(0)}%`)
  }
  return parts.join(' · ')
}

// ── Internal helpers ────────────────────────────────────────────────────────

// Normalize tech strings to the engine's three canonical buckets.
function normalizeTech(t) {
  const s = String(t || '').toLowerCase()
  if (s.includes('bess') || s.includes('storage') || s.includes('battery')) return 'bess'
  if (s.includes('c&i') || s.includes('commercial') || s.includes('industrial')) return 'commercial-industrial'
  if (s.includes('hybrid')) return 'community-solar'  // hybrid uses CS as primary scenario tech
  return 'community-solar'
}

function computeForTech(tech, stateId, mw, rates) {
  if (tech === 'commercial-industrial') return computeCIRevenueProjection(stateId, mw, rates)
  if (tech === 'bess') return computeBESSProjection(stateId, mw, 4, rates)
  return computeRevenueProjection(stateId, mw, rates)
}

function extractInputs(tech, raw) {
  // Tech-specific defaults for the lifecycle assumptions. BESS uses a
  // 15-year project life (battery warranty); solar tech uses 25-year.
  const baseLife = tech === 'bess' ? INDUSTRY_BASELINE.bessContractYears : INDUSTRY_BASELINE.contractYears
  const common = {
    ixCostPerWatt: INDUSTRY_BASELINE.ixCostPerWatt,
    programAllocation: INDUSTRY_BASELINE.programAllocation,
    opexPerKwYear: INDUSTRY_BASELINE.opexPerKwYear,
    discountRate: INDUSTRY_BASELINE.discountRate,
    contractYears: baseLife,
  }
  if (tech === 'commercial-industrial') {
    return {
      systemSizeMW: raw.mw,
      capacityFactor: raw.capacityFactor / 100,
      capexPerWatt: raw.installedCostPerWatt,
      recPricePerMwh: 0,
      ...common,
    }
  }
  if (tech === 'bess') {
    return {
      systemSizeMW: raw.mw,
      capacityFactor: null,
      capexPerWatt: null,  // BESS uses $/kWh — handled internally
      recPricePerMwh: 0,
      ...common,
    }
  }
  // CS
  return {
    systemSizeMW: raw.mw,
    capacityFactor: raw.capacityFactor / 100,
    capexPerWatt: raw.installedCostPerWatt,
    recPricePerMwh: raw.recPerMwh,
    ...common,
  }
}

function computeOutputs(tech, raw, inputs, baseOutputs) {
  if (tech === 'commercial-industrial') return computeCIOutputs(raw, inputs, baseOutputs)
  if (tech === 'bess') return computeBESSOutputs(raw, inputs, baseOutputs)
  return computeCSOutputs(raw, inputs, baseOutputs)
}

function computeCSOutputs(raw, inputs, baseOutputs) {
  const mw = num(inputs.systemSizeMW)
  const cf = num(inputs.capacityFactor)
  const capex = num(inputs.capexPerWatt)
  const ix = num(inputs.ixCostPerWatt)
  const rec = num(inputs.recPricePerMwh)
  const alloc = clamp(num(inputs.programAllocation, 1), 0, 1.5)

  const annualMWh = mw * 8760 * cf
  const annualKWh = annualMWh * 1000
  const billCreditRevenue = annualKWh * (raw.billCreditCentsKwh / 100) * alloc
  const recRevenue = annualMWh * rec
  const installedCostTotal = mw * 1_000_000 * capex
  const itcTotalPct = raw.itcTotalPct ?? 30
  const itcValue = installedCostTotal * (itcTotalPct / 100)
  const itcAnnualized = itcValue / 6
  const year1Revenue = billCreditRevenue + recRevenue + itcAnnualized
  const ixCostTotal = mw * 1_000_000 * ix
  const totalDevCost = installedCostTotal + ixCostTotal
  const paybackYears = year1Revenue > 0 ? totalDevCost / year1Revenue : null

  const lifecycle = computeLifecycleMetrics({
    totalDevCost,
    year1Revenue,
    itcAnnualized,
    annualMWh,
    mwAC: mw,
    degradationPct: raw.degradationPct ?? 0.5,
    contractYears: num(inputs.contractYears, INDUSTRY_BASELINE.contractYears),
    opexPerKwYear: num(inputs.opexPerKwYear, INDUSTRY_BASELINE.opexPerKwYear),
    discountRate: num(inputs.discountRate, INDUSTRY_BASELINE.discountRate),
  })

  return withDeltas({
    annualMWh: Math.round(annualMWh),
    billCreditRevenue: Math.round(billCreditRevenue),
    recRevenue: Math.round(recRevenue),
    itcAnnualized: Math.round(itcAnnualized),
    year1Revenue: Math.round(year1Revenue),
    installedCostTotal: Math.round(installedCostTotal),
    ixCostTotal: Math.round(ixCostTotal),
    totalDevCost: Math.round(totalDevCost),
    paybackYears: paybackYears != null ? round1(paybackYears) : null,
    ...lifecycle,
  }, baseOutputs)
}

function computeCIOutputs(raw, inputs, baseOutputs) {
  const mw = num(inputs.systemSizeMW)
  const cf = num(inputs.capacityFactor)
  const capex = num(inputs.capexPerWatt)
  const ix = num(inputs.ixCostPerWatt)

  const annualMWh = mw * 8760 * cf
  const annualKWh = annualMWh * 1000
  const ppaRevenue = annualKWh * (raw.ppaRateCentsKwh / 100)
  const installedCostTotal = mw * 1_000_000 * capex
  const itcAnnualized = installedCostTotal * (raw.itcPct / 100) / 6
  const year1Revenue = ppaRevenue + itcAnnualized
  const ixCostTotal = mw * 1_000_000 * ix
  const totalDevCost = installedCostTotal + ixCostTotal
  const paybackYears = year1Revenue > 0 ? totalDevCost / year1Revenue : null

  const lifecycle = computeLifecycleMetrics({
    totalDevCost,
    year1Revenue,
    itcAnnualized,
    annualMWh,
    mwAC: mw,
    degradationPct: raw.degradationPct ?? 0.5,
    contractYears: num(inputs.contractYears, INDUSTRY_BASELINE.contractYears),
    opexPerKwYear: num(inputs.opexPerKwYear, INDUSTRY_BASELINE.opexPerKwYear),
    discountRate: num(inputs.discountRate, INDUSTRY_BASELINE.discountRate),
  })

  return withDeltas({
    annualMWh: Math.round(annualMWh),
    ppaRevenue: Math.round(ppaRevenue),
    itcAnnualized: Math.round(itcAnnualized),
    year1Revenue: Math.round(year1Revenue),
    installedCostTotal: Math.round(installedCostTotal),
    ixCostTotal: Math.round(ixCostTotal),
    totalDevCost: Math.round(totalDevCost),
    paybackYears: paybackYears != null ? round1(paybackYears) : null,
    ...lifecycle,
  }, baseOutputs)
}

function computeBESSOutputs(raw, inputs, baseOutputs) {
  // BESS revenue scales linearly with MW (capacity, demand, arbitrage all
  // scale 1:1). CF + REC are not applicable. Capex/kWh is fixed in raw.
  const mw = num(inputs.systemSizeMW)
  const ix = num(inputs.ixCostPerWatt)
  const baselineMW = raw.mw || 1
  const scale = baselineMW > 0 ? mw / baselineMW : 0

  const year1Revenue = (raw.annualGrossRevenue || 0) * scale
  const installedCostTotal = (raw.installedCostTotal || 0) * scale
  const itcAnnualized = ((raw.itcAnnualized || 0)) * scale
  const ixCostTotal = mw * 1_000_000 * ix
  const totalDevCost = installedCostTotal + ixCostTotal
  const paybackYears = year1Revenue > 0 ? totalDevCost / year1Revenue : null

  // BESS uses 15-year battery life + 2.5% annual degradation. LCOE in MWh
  // terms doesn't translate cleanly for storage (storage cycles vs solar
  // production), so leave LCOE null for BESS — the IRR + NPV are the
  // meaningful lifecycle metrics here.
  const lifecycle = computeLifecycleMetrics({
    totalDevCost,
    year1Revenue,
    itcAnnualized,
    annualMWh: 0,                      // suppress LCOE for BESS
    mwAC: mw,
    degradationPct: raw.annualDegradationPct ?? 2.5,
    contractYears: num(inputs.contractYears, INDUSTRY_BASELINE.bessContractYears),
    opexPerKwYear: num(inputs.opexPerKwYear, INDUSTRY_BASELINE.opexPerKwYear),
    discountRate: num(inputs.discountRate, INDUSTRY_BASELINE.discountRate),
  })

  return withDeltas({
    year1Revenue: Math.round(year1Revenue),
    installedCostTotal: Math.round(installedCostTotal),
    ixCostTotal: Math.round(ixCostTotal),
    totalDevCost: Math.round(totalDevCost),
    paybackYears: paybackYears != null ? round1(paybackYears) : null,
    ...lifecycle,
    lcoe: null,                         // not meaningful for storage
  }, baseOutputs)
}

// Attach deltas (revenue + payback + IRR + NPV + LCOE) vs the baseline.
// baseOutputs is omitted when computing the baseline itself (no deltas
// to compute). LCOE delta sign convention: NEGATIVE = better (cheaper
// per MWh), matching the slider's "lower-better" framing for capex.
function withDeltas(out, baseOutputs) {
  if (!baseOutputs) return out
  const baseRev = baseOutputs.year1Revenue || 0
  const basePay = baseOutputs.paybackYears
  const baseIrr = baseOutputs.irr
  const baseNpv = baseOutputs.npv
  const baseLcoe = baseOutputs.lcoe
  const baseEquityIrr = baseOutputs.equityIrr
  const baseDscr = baseOutputs.dscr
  return {
    ...out,
    revenueDelta: Math.round(out.year1Revenue - baseRev),
    revenueDeltaPct: baseRev > 0 ? (out.year1Revenue - baseRev) / baseRev : 0,
    paybackDelta: out.paybackYears != null && basePay != null ? round1(out.paybackYears - basePay) : null,
    irrDelta: out.irr != null && baseIrr != null ? out.irr - baseIrr : null,
    npvDelta: out.npv != null && baseNpv != null ? Math.round(out.npv - baseNpv) : null,
    lcoeDelta: out.lcoe != null && baseLcoe != null ? out.lcoe - baseLcoe : null,
    equityIrrDelta: out.equityIrr != null && baseEquityIrr != null ? out.equityIrr - baseEquityIrr : null,
    dscrDelta: out.dscr != null && baseDscr != null ? Math.round((out.dscr - baseDscr) * 100) / 100 : null,
  }
}

// ── Lifecycle financial metrics ─────────────────────────────────────────────
// All three (IRR / LCOE / NPV) are derived from the same year-by-year
// cashflow stream. Built inside the scenario engine (not the existing
// revenueEngine) so slider changes recompute synchronously without a
// re-fetch. Opex is a baked-in $20/kW/yr (industry baseline); when we
// expose an opex slider this becomes the default rather than the constant.
//
// year1Revenue includes the 6-year ITC annualization (matching the
// existing revenueEngine convention), so the cashflow stream uses
// `year1Revenue × degradation^t` for years 1-6 and `(year1Revenue -
// itcAnnualized) × degradation^t` for years 7-end. This keeps the IRR
// honest — without the ITC-out-of-cashflow correction, IRR would be
// inflated for the late years.
function computeLifecycleMetrics({
  totalDevCost,
  year1Revenue,
  itcAnnualized = 0,
  itcYears = 6,
  annualMWh = 0,
  mwAC = 0,
  degradationPct = 0.5,
  contractYears = INDUSTRY_BASELINE.contractYears,
  opexPerKwYear = INDUSTRY_BASELINE.opexPerKwYear,
  discountRate = INDUSTRY_BASELINE.discountRate,
}) {
  if (!totalDevCost || totalDevCost <= 0 || !year1Revenue || year1Revenue <= 0) {
    return {
      irr: null, lcoe: null, npv: null, lifetimeRevenue: null,
      equityIrr: null, dscr: null,
    }
  }

  const r = discountRate
  const opexY1 = mwAC * 1000 * opexPerKwYear  // $/yr
  const opexInflate = 1 + INDUSTRY_BASELINE.opexInflationPct / 100
  const degradeFactor = 1 - degradationPct / 100

  // Capital structure for leveraged returns. Debt sized at 70% of total
  // dev cost; rest is equity. Annual debt service uses standard amort:
  //   payment = P × (r(1+r)^n) / ((1+r)^n - 1)
  const debtPrincipal = totalDevCost * INDUSTRY_BASELINE.debtPct
  const equityPrincipal = totalDevCost - debtPrincipal
  const dRate = INDUSTRY_BASELINE.debtRate
  const dTerm = INDUSTRY_BASELINE.debtTermYears
  const annualDebtService = dRate > 0 && dTerm > 0
    ? debtPrincipal * (dRate * Math.pow(1 + dRate, dTerm)) / (Math.pow(1 + dRate, dTerm) - 1)
    : 0

  // Build cashflow stream. Year 0 = -capex (investment), Years 1-N = revenue - opex.
  const cashflows = [-totalDevCost]
  const equityCashflows = [-equityPrincipal]
  let lifetimeRevenue = 0
  let costNPV = totalDevCost
  let prodNPV = 0
  for (let t = 1; t <= contractYears; t++) {
    const degradation = Math.pow(degradeFactor, t - 1)
    const itcInYear = t <= itcYears ? itcAnnualized : 0
    const operatingRevenue = (year1Revenue - itcAnnualized) * degradation  // strip ITC, scale just the operations
    const totalRevenueYear = operatingRevenue + itcInYear
    const opex = opexY1 * Math.pow(opexInflate, t - 1)
    const netCashflow = totalRevenueYear - opex
    cashflows.push(netCashflow)
    // Equity cashflow = project cashflow - debt service (only during amort window)
    const debtService = t <= dTerm ? annualDebtService : 0
    equityCashflows.push(netCashflow - debtService)
    lifetimeRevenue += totalRevenueYear
    costNPV += opex / Math.pow(1 + r, t)
    prodNPV += (annualMWh * degradation) / Math.pow(1 + r, t)
  }

  // NPV at the user's discount rate.
  let npv = -totalDevCost
  for (let t = 1; t <= contractYears; t++) {
    npv += cashflows[t] / Math.pow(1 + r, t)
  }

  // DSCR: Year 1 NOI (revenue - opex, ITC excluded since it's tax flow,
  // not cash that services debt) divided by annual debt service.
  // ≥1.30 typical lender threshold; <1.20 raises eyebrows.
  const y1NOI = (year1Revenue - itcAnnualized) - opexY1
  const dscr = annualDebtService > 0 ? y1NOI / annualDebtService : null

  return {
    irr: computeIRR(cashflows),
    lcoe: prodNPV > 0 ? costNPV / prodNPV : null,
    npv: Math.round(npv),
    lifetimeRevenue: Math.round(lifetimeRevenue),
    equityIrr: computeIRR(equityCashflows),
    dscr: dscr != null ? Math.round(dscr * 100) / 100 : null,
  }
}

// Newton-Raphson IRR solver. Returns null if no convergence in 80 iters
// or if dNPV/dr collapses (e.g. all-positive or all-negative cashflows).
function computeIRR(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null
  // Quick sign-change check — IRR only exists with at least one positive
  // and one negative cashflow.
  let hasPos = false, hasNeg = false
  for (const c of cashflows) {
    if (c > 0) hasPos = true
    if (c < 0) hasNeg = true
  }
  if (!hasPos || !hasNeg) return null

  let rate = 0.10
  for (let iter = 0; iter < 80; iter++) {
    let npv = 0, dnpv = 0
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t)
      npv += cashflows[t] / denom
      if (t > 0) dnpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1)
    }
    if (Math.abs(dnpv) < 1e-12) return null
    const next = rate - npv / dnpv
    if (!Number.isFinite(next)) return null
    if (Math.abs(next - rate) < 1e-7) {
      // Clamp to plausible range — IRR > 100% or < -50% usually means
      // a degenerate cashflow stream.
      if (next > 1.0) return 1.0
      if (next < -0.5) return -0.5
      return next
    }
    rate = next
  }
  return null  // didn't converge
}

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function round1(v) {
  return Math.round(v * 10) / 10
}
