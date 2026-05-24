import { describe, it, expect } from 'vitest'
import {
  STRUCTURE_OPTIONS,
  STRUCTURE_DEFAULT,
  STRUCTURE_TO_TAG,
  STRUCTURE_FROM_TAG,
  structureLabelFromTag,
  structureNoun,
  getStickyStructure,
} from '../../src/lib/lensFormConstants.js'

describe('Lens monetization-structure filter constants', () => {
  it('default is the first option (All structures)', () => {
    expect(STRUCTURE_DEFAULT).toBe('All structures')
    expect(STRUCTURE_OPTIONS[0]).toBe(STRUCTURE_DEFAULT)
  })

  it('maps every option label to a tag, All → "all"', () => {
    for (const label of STRUCTURE_OPTIONS) expect(STRUCTURE_TO_TAG[label]).toBeTruthy()
    expect(STRUCTURE_TO_TAG['All structures']).toBe('all')
    expect(STRUCTURE_TO_TAG['Community Solar']).toBe('community_solar')
    expect(STRUCTURE_TO_TAG['Net Metering']).toBe('net_metering')
  })

  it('tag → label round-trips', () => {
    for (const [label, tag] of Object.entries(STRUCTURE_TO_TAG)) {
      expect(STRUCTURE_FROM_TAG[tag]).toBe(label)
    }
  })

  it('structureLabelFromTag resolves tags and falls back to default', () => {
    expect(structureLabelFromTag('net_metering')).toBe('Net Metering')
    expect(structureLabelFromTag('community_solar')).toBe('Community Solar')
    expect(structureLabelFromTag('bogus')).toBe(STRUCTURE_DEFAULT)
    expect(structureLabelFromTag(undefined)).toBe(STRUCTURE_DEFAULT)
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
    expect(noun.label).toBe('Distribution-DG')
  })
})

describe('getStickyStructure — safe without localStorage (node)', () => {
  it('returns the default when localStorage is unavailable', () => {
    expect(getStickyStructure()).toBe(STRUCTURE_DEFAULT)
  })
})
