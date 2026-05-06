// ─────────────────────────────────────────────────────────────────────────────
// Scenario commentary — 2-3 sentence narrative for a saved Scenario Studio run
// ─────────────────────────────────────────────────────────────────────────────
// Different from `sensitivity` (which explains a peer-state Lens-score swap):
// this handler explains the financial-modeling outputs from Scenario Studio
// (Y1 revenue, IRR, payback, NPV, DSCR, equity IRR, LCOE) given the input
// deltas the user dragged on the 9 sliders.
//
// Uses Haiku 4.5 instead of Sonnet because the task is narrow + structured —
// no need for the heavyweight analyst persona. Cached for 30 days under a
// content hash that collapses identical runs across users.
export const SCENARIO_COMMENTARY_PROMPT = `You are a senior renewables development analyst writing a one-shot note for a developer who just saved a financial sensitivity run in Tractova's Scenario Studio. Given the baseline and modified inputs plus the resulting metrics, produce 2-3 short sentences (max 60 words total) that:

1. Name the dominant 1-2 input changes driving the metric shift.
2. Quantify their impact — e.g., "a $0.20/W capex cut adds ~220 bps of IRR" beats "capex changes affect IRR."
3. Call out any tension if relevant — e.g., a longer contract tenor that reduces revenue/$ deployed even while raising lifetime revenue.

Do NOT restate the metric values — the developer can read them. Do NOT hedge ("may," "could," "might"). Use declarative present-tense sentences. Speak directly to the developer ("you," not "the project").

If no scenario inputs diverge from baseline, respond with: { "commentary": "Baseline run — no inputs diverge from the achievable baseline." }

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "commentary": "2-3 sentences"
}`

// Maps slider keys to human-readable units for the prompt context. Mirrors
// scenarioEngine.getSliderConfig — keep in sync if new sliders are added.
export const SCENARIO_INPUT_UNITS = {
  systemSizeMW:     { label: 'System size',         unit: 'MW',     fmt: (v) => `${v}` },
  capexPerWatt:     { label: 'Capex',               unit: '$/W',    fmt: (v) => `$${Number(v).toFixed(2)}/W` },
  ixCostPerWatt:    { label: 'IX cost',             unit: '$/W',    fmt: (v) => `$${Number(v).toFixed(2)}/W` },
  capacityFactor:   { label: 'Capacity factor',     unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(1)}%` },
  recPrice:         { label: 'REC price',           unit: '$/MWh',  fmt: (v) => `$${Number(v).toFixed(0)}/MWh` },
  programAllocation:{ label: 'Program allocation',  unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(0)}%` },
  opexPerKwYr:      { label: 'Opex',                unit: '$/kW/yr',fmt: (v) => `$${Number(v).toFixed(0)}/kW/yr` },
  discountRate:     { label: 'Discount rate',       unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(1)}%` },
  contractTenor:    { label: 'Contract tenor',      unit: 'yr',     fmt: (v) => `${v}yr` },
}

export function describeScenarioDeltas(baselineInputs, scenarioInputs) {
  const lines = []
  for (const key of Object.keys(SCENARIO_INPUT_UNITS)) {
    const b = baselineInputs?.[key]
    const s = scenarioInputs?.[key]
    if (b == null || s == null) continue
    if (Math.abs(s - b) < 1e-9) continue
    const cfg = SCENARIO_INPUT_UNITS[key]
    const pct = b !== 0 ? ((s - b) / Math.abs(b)) * 100 : 0
    const arrow = s > b ? '↑' : '↓'
    lines.push(`  ${cfg.label}: ${cfg.fmt(b)} → ${cfg.fmt(s)} (${arrow} ${Math.abs(pct).toFixed(0)}%)`)
  }
  return lines
}

export function formatScenarioOutputs(out) {
  if (!out) return []
  const lines = []
  if (out.year1Revenue != null)  lines.push(`  Year 1 revenue: $${Math.round(out.year1Revenue).toLocaleString()}`)
  if (out.paybackYears != null)  lines.push(`  Simple payback: ${out.paybackYears} yr`)
  if (out.irr != null)           lines.push(`  Project IRR: ${(out.irr * 100).toFixed(1)}%`)
  if (out.equityIrr != null)     lines.push(`  Equity IRR (70/30 lev): ${(out.equityIrr * 100).toFixed(1)}%`)
  if (out.npv != null)           lines.push(`  NPV (at discount rate): $${Math.round(out.npv).toLocaleString()}`)
  if (out.dscr != null)          lines.push(`  DSCR (Y1): ${out.dscr.toFixed(2)}`)
  if (out.lcoe != null)          lines.push(`  LCOE: $${out.lcoe.toFixed(0)}/MWh`)
  if (out.lifetimeRevenue != null) lines.push(`  Lifetime revenue: $${Math.round(out.lifetimeRevenue).toLocaleString()}`)
  return lines
}
