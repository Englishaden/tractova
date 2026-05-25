// scenarioEngine was slimmed in the 2026-05 signal pivot: the synthesized-$
// machinery (computeBaseline / applyScenario / getSliderConfig / presets) was
// removed with the dollar layer. Two pure non-$ helpers survive for the legacy
// saved-scenarios viewer + tech-string round-tripping — covered here.

import { describe, it, expect } from 'vitest'
import { denormalizeTech, formatScenarioSummary } from '../../src/lib/scenarioEngine.js'

describe('denormalizeTech — engine slug → display label', () => {
  it('maps each known slug to its canonical label', () => {
    expect(denormalizeTech('bess')).toBe('BESS')
    expect(denormalizeTech('commercial-industrial')).toBe('C&I Solar')
    expect(denormalizeTech('hybrid')).toBe('Hybrid')
    expect(denormalizeTech('community-solar')).toBe('Community Solar')
    expect(denormalizeTech('net-metering')).toBe('Net Metering')
  })

  it('passes already-display values through unchanged', () => {
    expect(denormalizeTech('Community Solar')).toBe('Community Solar')
    expect(denormalizeTech('Net Billing')).toBe('Net Billing')
  })

  it('is case-insensitive on the slug and null-safe', () => {
    expect(denormalizeTech('BESS')).toBe('BESS')
    expect(denormalizeTech(null)).toBe(null)
    expect(denormalizeTech(undefined)).toBe(undefined)
  })
})

describe('formatScenarioSummary — legacy saved-scenario one-liner', () => {
  const base = { inputs: { systemSizeMW: 5, capexPerWatt: 1.40, ixCostPerWatt: 0.12, recPricePerMwh: 60, programAllocation: 1, capacityFactor: 0.20 } }

  it('returns empty string when inputs are missing', () => {
    expect(formatScenarioSummary(null, base)).toBe('')
    expect(formatScenarioSummary({ inputs: null }, base)).toBe('')
  })

  it('always leads with system size MW', () => {
    const scenario = { inputs: { ...base.inputs } }
    expect(formatScenarioSummary(scenario, base)).toBe('5.0 MW')
  })

  it('surfaces only inputs that diverge from baseline', () => {
    const scenario = { inputs: { ...base.inputs, capexPerWatt: 1.10, recPricePerMwh: 90 } }
    const out = formatScenarioSummary(scenario, base)
    expect(out).toMatch(/5\.0 MW/)
    expect(out).toMatch(/\$1\.10\/W capex/)
    expect(out).toMatch(/REC \+50%/)
  })
})
