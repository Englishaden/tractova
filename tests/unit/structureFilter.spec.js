import { describe, it, expect } from 'vitest'
import {
  ARCHITECTURE_OPTIONS,
  ARCHITECTURE_DEFAULT,
  STRUCTURE_OPTIONS,
  STRUCTURE_DEFAULT,
  STRUCTURE_TO_TAG,
  STRUCTURE_FROM_TAG,
  structureLabelFromTag,
  structureNoun,
  composeTechnology,
  axesFromTechnology,
  normalizeStructure,
  getStickyStructure,
  getStickyArchitecture,
} from '../../src/lib/lensFormConstants.js'

describe('Two-axis constants (architecture × structure)', () => {
  it('architecture options = Standalone PV + PV + Storage (BESS dropped), default PV', () => {
    expect(ARCHITECTURE_OPTIONS).toEqual(['Standalone PV', 'PV + Storage'])
    expect(ARCHITECTURE_DEFAULT).toBe('Standalone PV')
    expect(ARCHITECTURE_OPTIONS).not.toContain('Standalone BESS')
  })

  it('structure is a required project attribute (no "All structures"), default CS', () => {
    expect(STRUCTURE_OPTIONS).not.toContain('All structures')
    expect(STRUCTURE_DEFAULT).toBe('Community Solar')
    expect(STRUCTURE_OPTIONS[0]).toBe(STRUCTURE_DEFAULT)
    expect(STRUCTURE_OPTIONS).toEqual(['Community Solar', 'Net Metering', 'Net Billing', 'C&I Solar'])
  })

  it('every structure option maps to a tag and round-trips', () => {
    for (const label of STRUCTURE_OPTIONS) {
      const tag = STRUCTURE_TO_TAG[label]
      expect(tag).toBeTruthy()
      expect(STRUCTURE_FROM_TAG[tag]).toBe(label)
    }
  })

  it('structureLabelFromTag resolves tags and falls back to CS default', () => {
    expect(structureLabelFromTag('net_metering')).toBe('Net Metering')
    expect(structureLabelFromTag('community_solar')).toBe('Community Solar')
    expect(structureLabelFromTag('bogus')).toBe(STRUCTURE_DEFAULT)
    expect(structureLabelFromTag(undefined)).toBe(STRUCTURE_DEFAULT)
  })
})

describe('composeTechnology ⇄ axesFromTechnology (the derived mirror)', () => {
  it('composes a label for every form-producible combination', () => {
    expect(composeTechnology('Standalone PV', 'Community Solar')).toBe('Community Solar')
    expect(composeTechnology('Standalone PV', 'C&I Solar')).toBe('C&I Solar')
    expect(composeTechnology('Standalone PV', 'Net Metering')).toBe('Net Metering')
    expect(composeTechnology('PV + Storage', 'Community Solar')).toBe('Community Solar + Storage')
    expect(composeTechnology('PV + Storage', 'Net Billing')).toBe('Net Billing + Storage')
  })

  it('round-trips: compose → axesFromTechnology recovers the axes', () => {
    for (const architecture of ARCHITECTURE_OPTIONS) {
      for (const structure of STRUCTURE_OPTIONS) {
        const tech = composeTechnology(architecture, structure)
        expect(axesFromTechnology(tech)).toEqual({ architecture, structure })
      }
    }
  })

  it('normalizes legacy technology strings', () => {
    expect(axesFromTechnology('Community Solar')).toEqual({ architecture: 'Standalone PV', structure: 'Community Solar' })
    expect(axesFromTechnology('C&I Solar')).toEqual({ architecture: 'Standalone PV', structure: 'C&I Solar' })
    expect(axesFromTechnology('Hybrid')).toEqual({ architecture: 'PV + Storage', structure: 'Community Solar' })
    expect(axesFromTechnology('community-solar')).toEqual({ architecture: 'Standalone PV', structure: 'Community Solar' })
  })

  it('preserves legacy standalone BESS (merchant) as architecture=Standalone BESS', () => {
    expect(axesFromTechnology('BESS')).toEqual({ architecture: 'Standalone BESS', structure: null })
  })

  it('normalizeStructure folds the legacy C&I label into canonical C&I Solar', () => {
    expect(normalizeStructure('C&I behind-the-meter')).toBe('C&I Solar')
    expect(normalizeStructure('C&I Solar')).toBe('C&I Solar')
    expect(normalizeStructure('Community Solar')).toBe('Community Solar')
    expect(normalizeStructure(undefined)).toBe(undefined)
  })
})

describe('structureNoun — honest IX-card noun', () => {
  it('names an explicit single-structure view', () => {
    expect(structureNoun('community_solar').short).toBe('CS')
    expect(structureNoun('net_metering').short).toBe('net-metering')
    expect(structureNoun('unknown').short).toBe('DG')
  })

  it('names the lone structure when the All view has only one', () => {
    expect(structureNoun(null, [{ meteringType: 'community_solar' }]).short).toBe('CS')
    expect(structureNoun(null, [{ meteringType: 'unknown' }]).short).toBe('DG')
  })

  it('falls back to generic DG when the All view spans multiple structures', () => {
    const noun = structureNoun(null, [{ meteringType: 'net_metering' }, { meteringType: 'community_solar' }])
    expect(noun.short).toBe('DG')
  })
})

describe('sticky prefs — safe without localStorage (node)', () => {
  it('return the defaults when localStorage is unavailable', () => {
    expect(getStickyStructure()).toBe(STRUCTURE_DEFAULT)
    expect(getStickyArchitecture()).toBe(ARCHITECTURE_DEFAULT)
  })
})
