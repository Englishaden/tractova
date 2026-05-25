// Scenario engine — slimmed in the 2026-05 signal pivot.
//
// The synthesized-$ machinery (computeBaseline, applyScenario, getSliderConfig,
// SCENARIO_PRESETS, the revenueEngine pro-forma) was removed when the product
// dropped its dollar layer for the 5-pillar signal-based feasibility index.
//
// Two pure, non-$ helpers survive because the legacy saved-scenarios viewer
// (Library "Scenarios" tab) + tech-string normalization still need them:
//   - denormalizeTech: engine slug → display label (also used by Search +
//     orphanConversion for URL/tech round-tripping).
//   - formatScenarioSummary: formats an already-saved scenario_snapshots row's
//     stored inputs into a one-line "what changed" summary for the history list.

// Inverse of the old normalizeTech — engine slug → display name. The legacy
// saved scenarios stored either kebab-case slugs (older rows) or display labels
// (newer rows); this maps the slug form back to the canonical label. Passes
// already-display values through unchanged so callers don't need to know which
// form they hold.
export function denormalizeTech(slug) {
  const s = String(slug || '').toLowerCase()
  if (s === 'bess')                  return 'BESS'
  if (s === 'commercial-industrial') return 'C&I Solar'
  if (s === 'hybrid')                return 'Hybrid'
  if (s === 'community-solar')       return 'Community Solar'
  if (s === 'net-metering')          return 'Net Metering'
  return slug
}

// Format a saved scenario's stored inputs into a one-line "what diverged from
// baseline" summary. Reads only the stored numbers (no recompute) so the
// legacy Library Scenarios viewer keeps rendering historical saves after the
// $ engine was removed.
export function formatScenarioSummary(scenario, baseline) {
  if (!scenario || !baseline) return ''
  const parts = []
  const i = scenario.inputs
  const b = baseline.inputs
  if (!i || !b) return ''
  parts.push(`${(i.systemSizeMW ?? 0).toFixed(1)} MW`)
  if (i.capexPerWatt != null && b.capexPerWatt && Math.abs((i.capexPerWatt - b.capexPerWatt) / b.capexPerWatt) > 0.01) {
    parts.push(`$${i.capexPerWatt.toFixed(2)}/W capex`)
  }
  if (i.capexPerKwh != null && b.capexPerKwh && Math.abs((i.capexPerKwh - b.capexPerKwh) / b.capexPerKwh) > 0.01) {
    parts.push(`$${i.capexPerKwh.toFixed(0)}/kWh capex`)
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
