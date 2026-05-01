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
}

// User-facing disclaimer. Must appear in UI + PDF wherever scenarios are
// surfaced. Words chosen to make the directional-sensitivity nature clear
// and to redirect users toward an advisor for IC-grade modeling.
export const SCENARIO_DISCLAIMER =
  'Scenarios are directional sensitivity analyses based on industry baseline assumptions. ' +
  'IRR / LCOE / NPV use $20/kW/yr opex baseline + 25-year project life (15 for BESS) + 8% discount. ' +
  'NOT investment-grade pro-forma — engage a financial advisor for IC-grade modeling.'

// ── Preset scenarios ────────────────────────────────────────────────────────
// One-tap "what could go right / wrong" envelopes. Multipliers are modest
// (15-25%) so the preset stays in defensible-sensitivity territory rather
// than performing best/worst-case theatrics.
//
// Applied as multipliers on the baseline inputs; UI calls applyScenario
// with the resulting numbers. Tech-aware: REC/allocation are CS-specific
// and silently no-op for C&I/BESS.
export const SCENARIO_PRESETS = {
  best: {
    label: 'Best case',
    description: 'cheaper capex/IX · stronger production · favorable pricing',
    apply: (b) => ({
      systemSizeMW:    b.systemSizeMW,
      capexPerWatt:    b.capexPerWatt   != null ? round2(b.capexPerWatt   * 0.85) : null,
      ixCostPerWatt:   b.ixCostPerWatt  != null ? round2(b.ixCostPerWatt  * 0.70) : null,
      capacityFactor:  b.capacityFactor != null ? Math.min(0.28, b.capacityFactor * 1.05) : null,
      recPricePerMwh:  b.recPricePerMwh != null ? Math.round(b.recPricePerMwh * 1.15) : null,
      programAllocation: b.programAllocation != null ? Math.min(1.25, b.programAllocation * 1.10) : null,
    }),
  },
  worst: {
    label: 'Worst case',
    description: 'cost overruns · production drag · weaker pricing',
    apply: (b) => ({
      systemSizeMW:    b.systemSizeMW,
      capexPerWatt:    b.capexPerWatt   != null ? round2(b.capexPerWatt   * 1.20) : null,
      ixCostPerWatt:   b.ixCostPerWatt  != null ? round2(b.ixCostPerWatt  * 1.50) : null,
      capacityFactor:  b.capacityFactor != null ? Math.max(0.12, b.capacityFactor * 0.92) : null,
      recPricePerMwh:  b.recPricePerMwh != null ? Math.round(b.recPricePerMwh * 0.85) : null,
      programAllocation: b.programAllocation != null ? Math.max(0.50, b.programAllocation * 0.75) : null,
    }),
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
      min: 0.80,
      max: 3.00,
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
      min: 0.02,
      max: 0.50,
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
    ]
  }

  // BESS — only size + capex/kWh + IX matter; no CF/REC sliders.
  // For now we expose the same triplet; CF/REC/allocation stay frozen.
  return common
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
  if (tech === 'commercial-industrial') {
    return {
      systemSizeMW: raw.mw,
      capacityFactor: raw.capacityFactor / 100,
      capexPerWatt: raw.installedCostPerWatt,
      ixCostPerWatt: INDUSTRY_BASELINE.ixCostPerWatt,
      recPricePerMwh: 0,
      programAllocation: INDUSTRY_BASELINE.programAllocation,
    }
  }
  if (tech === 'bess') {
    return {
      systemSizeMW: raw.mw,
      capacityFactor: null,
      capexPerWatt: null,  // BESS uses $/kWh — handled internally
      ixCostPerWatt: INDUSTRY_BASELINE.ixCostPerWatt,
      recPricePerMwh: 0,
      programAllocation: INDUSTRY_BASELINE.programAllocation,
    }
  }
  // CS
  return {
    systemSizeMW: raw.mw,
    capacityFactor: raw.capacityFactor / 100,
    capexPerWatt: raw.installedCostPerWatt,
    ixCostPerWatt: INDUSTRY_BASELINE.ixCostPerWatt,
    recPricePerMwh: raw.recPerMwh,
    programAllocation: INDUSTRY_BASELINE.programAllocation,
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
    contractYears: INDUSTRY_BASELINE.contractYears,
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
    irr: lifecycle.irr,
    lcoe: lifecycle.lcoe,
    npv: lifecycle.npv,
    lifetimeRevenue: lifecycle.lifetimeRevenue,
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
    contractYears: INDUSTRY_BASELINE.contractYears,
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
    irr: lifecycle.irr,
    lcoe: lifecycle.lcoe,
    npv: lifecycle.npv,
    lifetimeRevenue: lifecycle.lifetimeRevenue,
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
    contractYears: INDUSTRY_BASELINE.bessContractYears,
  })

  return withDeltas({
    year1Revenue: Math.round(year1Revenue),
    installedCostTotal: Math.round(installedCostTotal),
    ixCostTotal: Math.round(ixCostTotal),
    totalDevCost: Math.round(totalDevCost),
    paybackYears: paybackYears != null ? round1(paybackYears) : null,
    irr: lifecycle.irr,
    lcoe: null,                         // not meaningful for storage
    npv: lifecycle.npv,
    lifetimeRevenue: lifecycle.lifetimeRevenue,
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
  return {
    ...out,
    revenueDelta: Math.round(out.year1Revenue - baseRev),
    revenueDeltaPct: baseRev > 0 ? (out.year1Revenue - baseRev) / baseRev : 0,
    paybackDelta: out.paybackYears != null && basePay != null ? round1(out.paybackYears - basePay) : null,
    irrDelta: out.irr != null && baseIrr != null ? out.irr - baseIrr : null,
    npvDelta: out.npv != null && baseNpv != null ? Math.round(out.npv - baseNpv) : null,
    lcoeDelta: out.lcoe != null && baseLcoe != null ? out.lcoe - baseLcoe : null,
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
}) {
  if (!totalDevCost || totalDevCost <= 0 || !year1Revenue || year1Revenue <= 0) {
    return { irr: null, lcoe: null, npv: null, lifetimeRevenue: null }
  }

  const r = INDUSTRY_BASELINE.discountRate
  const opexY1 = mwAC * 1000 * INDUSTRY_BASELINE.opexPerKwYear  // $/yr
  const opexInflate = 1 + INDUSTRY_BASELINE.opexInflationPct / 100
  const degradeFactor = 1 - degradationPct / 100

  // Build cashflow stream. Year 0 = -capex (investment), Years 1-N = revenue - opex.
  const cashflows = [-totalDevCost]
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
    lifetimeRevenue += totalRevenueYear
    costNPV += opex / Math.pow(1 + r, t)
    prodNPV += (annualMWh * degradation) / Math.pow(1 + r, t)
  }

  // NPV at the standard 8% discount rate.
  let npv = -totalDevCost
  for (let t = 1; t <= contractYears; t++) {
    npv += cashflows[t] / Math.pow(1 + r, t)
  }

  return {
    irr: computeIRR(cashflows),       // decimal (0.12 = 12%)
    lcoe: prodNPV > 0 ? costNPV / prodNPV : null,  // $/MWh
    npv: Math.round(npv),              // dollars
    lifetimeRevenue: Math.round(lifetimeRevenue),
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
