// Phase 1 of TRACTOVA-UX-001 — Cmd-K verb grammar coverage.
//
// The parser is pure (data in / data out) so tests stay tight. We
// exercise: verb gate (`:` prefix only), verb prefix matching,
// per-verb arg parsing, autocomplete behaviour for ambiguous state
// IDs (MA vs MD vs ME), case-insensitivity, MW + tech parsing,
// invalid input, and the `:help` / verb-reference fallbacks.

import { describe, it, expect } from 'vitest'
import { parseCommand, resolveTechShortcut, VERBS } from '../../src/lib/commandParser.js'

const stateIds = ['CA', 'IL', 'MA', 'MD', 'ME', 'MN', 'NY', 'TX']
const glossaryTerms = [
  { term: 'IRR',                         pillar: 'all'     },
  { term: 'LMI (Low/Moderate Income)',   pillar: 'offtake' },
  { term: 'Interconnect Queue',          pillar: 'ix'      },
  { term: 'NTP (Notice to Proceed)',     pillar: 'stage'   },
]
const savedProjects = [
  { id: 'p1', name: 'Cumberland ME',  state: 'ME', county: 'Cumberland', mw: 5,  stage: 'Prospecting' },
  { id: 'p2', name: 'Worcester MA',   state: 'MA', county: 'Worcester',  mw: 3,  stage: 'Site Control' },
  { id: 'p3', name: 'Cook IL',        state: 'IL', county: 'Cook',       mw: 12, stage: 'Development' },
]

const ctx = { stateIds, glossaryTerms, savedProjects }

describe('parseCommand — verb gate', () => {
  it('returns null when query does not start with `:`', () => {
    expect(parseCommand('lens ME', ctx)).toBeNull()
    expect(parseCommand('', ctx)).toBeNull()
    expect(parseCommand('search me', ctx)).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(parseCommand(null, ctx)).toBeNull()
    expect(parseCommand(undefined, ctx)).toBeNull()
    expect(parseCommand(42, ctx)).toBeNull()
  })

  it('bare `:` shows the verb reference', () => {
    const r = parseCommand(':', ctx)
    expect(r.kind).toBe('verb')
    expect(r.verb).toBeNull()
    expect(r.items.length).toBe(Object.keys(VERBS).length)
    expect(r.items.every(i => i.kind === 'verb-help')).toBe(true)
  })
})

describe('parseCommand — verb prefix matching', () => {
  it('`:le` autocompletes to :lens', () => {
    const r = parseCommand(':le', ctx)
    expect(r.kind).toBe('verb')
    expect(r.items[0].label).toBe(':lens <STATE> [<MW>] [<TECH>]')
    expect(r.items[0].replaceQuery).toBe(':lens ')
  })

  it('`:po` autocompletes to :portfolio', () => {
    const r = parseCommand(':po', ctx)
    expect(r.items[0].replaceQuery).toBe(':portfolio')
  })

  it('`:foo` returns an unknown-verb error', () => {
    const r = parseCommand(':foo', ctx)
    expect(r.kind).toBe('unknown')
    expect(r.error).toMatch(/unknown verb/i)
    expect(r.items).toEqual([])
  })

  it('verb name is case-insensitive', () => {
    const r = parseCommand(':LENS ME', ctx)
    expect(r.kind).toBe('verb')
    expect(r.verb).toBe('lens')
  })
})

describe('parseCommand — :lens', () => {
  it('without args asks for a state', () => {
    const r = parseCommand(':lens', ctx)
    expect(r.kind).toBe('verb')
    expect(r.hint).toMatch(/state/i)
    expect(r.items[0].kind).toBe('verb-help')
  })

  it('with valid state builds a Lens URL', () => {
    const r = parseCommand(':lens ME', ctx)
    expect(r.kind).toBe('verb')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].path).toBe('/search?state=ME')
    expect(r.items[0].label).toContain('ME')
  })

  it('lowercase state is normalized', () => {
    const r = parseCommand(':lens me', ctx)
    expect(r.items[0].path).toBe('/search?state=ME')
  })

  it('with state + MW builds the right URL', () => {
    const r = parseCommand(':lens ME 5', ctx)
    expect(r.items[0].path).toBe('/search?state=ME&mw=5')
    expect(r.items[0].label).toMatch(/5 MW/)
  })

  it('with state + MW + tech builds the killer-feature URL', () => {
    const r = parseCommand(':lens ME 5 CS', ctx)
    expect(r.items[0].path).toBe('/search?state=ME&mw=5&technology=Community+Solar')
    expect(r.items[0].label).toMatch(/Community Solar/)
  })

  it('accepts lowercase tech', () => {
    const r = parseCommand(':lens ME 5 cs', ctx)
    expect(r.items[0].path).toContain('technology=Community+Solar')
  })

  it('accepts BESS / HYB / CI tech shortcuts', () => {
    expect(parseCommand(':lens ME 5 BESS', ctx).items[0].path).toContain('technology=BESS')
    expect(parseCommand(':lens ME 5 HYB', ctx).items[0].path).toContain('technology=Hybrid')
    expect(parseCommand(':lens ME 5 CI', ctx).items[0].path).toContain('technology=C%26I+Solar')
  })

  it('ambiguous state prefix M returns autocompletes for MA, MD, ME, MN', () => {
    const r = parseCommand(':lens M', ctx)
    expect(r.kind).toBe('verb')
    expect(r.hint).toMatch(/ambiguous|pick/i)
    const ids = r.items.map(i => i.replaceQuery.match(/:lens (\w+)/)[1])
    expect(ids).toEqual(expect.arrayContaining(['MA', 'MD', 'ME', 'MN']))
  })

  it('non-matching state ZZ returns an error', () => {
    const r = parseCommand(':lens ZZ', ctx)
    expect(r.kind).toBe('unknown')
    expect(r.error).toMatch(/no state matching/i)
  })

  it('non-positive MW is rejected', () => {
    expect(parseCommand(':lens ME -5', ctx).kind).toBe('unknown')
    expect(parseCommand(':lens ME 0', ctx).kind).toBe('unknown')
    expect(parseCommand(':lens ME abc', ctx).kind).toBe('unknown')
  })

  it('unknown tech is rejected with hint', () => {
    const r = parseCommand(':lens ME 5 FOOBAR', ctx)
    expect(r.kind).toBe('unknown')
    expect(r.error).toMatch(/unknown tech/i)
  })

  it('partial state followed by space is treated as an error, not autocomplete', () => {
    // User typed `:lens M ` and moved to the MW arg — the parser shouldn't
    // silently autocomplete since the user has committed to "M" as a state.
    const r = parseCommand(':lens M ', ctx)
    expect(r.kind).toBe('unknown')
  })
})

describe('parseCommand — :state', () => {
  it('valid state opens Dashboard scoped', () => {
    const r = parseCommand(':state ME', ctx)
    expect(r.items[0].path).toBe('/?state=ME')
  })

  it('ambiguous state shows autocomplete', () => {
    const r = parseCommand(':state M', ctx)
    expect(r.kind).toBe('verb')
    expect(r.items.length).toBeGreaterThan(1)
  })

  it('empty arg asks for an ID', () => {
    const r = parseCommand(':state', ctx)
    expect(r.hint).toMatch(/state code/i)
  })

  it('non-matching ID returns error', () => {
    expect(parseCommand(':state ZZ', ctx).kind).toBe('unknown')
  })
})

describe('parseCommand — :gloss', () => {
  it('matches IRR glossary entry', () => {
    const r = parseCommand(':gloss IRR', ctx)
    expect(r.kind).toBe('verb')
    expect(r.items[0].path).toBe('/glossary#irr')
  })

  it('substring matches', () => {
    const r = parseCommand(':gloss interconnect', ctx)
    expect(r.items.some(i => i.label.toLowerCase().includes('interconnect'))).toBe(true)
  })

  it('empty arg asks for a term', () => {
    expect(parseCommand(':gloss', ctx).hint).toMatch(/term/i)
  })

  it('no match returns error', () => {
    expect(parseCommand(':gloss xyzzy', ctx).kind).toBe('unknown')
  })
})

describe('parseCommand — :rerun', () => {
  it('matches saved project name', () => {
    const r = parseCommand(':rerun cumberland', ctx)
    expect(r.kind).toBe('verb')
    expect(r.items[0].path).toBe('/search?fromProject=p1')
  })

  it('empty arg asks for a project', () => {
    expect(parseCommand(':rerun', ctx).hint).toMatch(/project/i)
  })

  it('no match returns error', () => {
    expect(parseCommand(':rerun nowhere', ctx).kind).toBe('unknown')
  })
})

describe('parseCommand — static verbs', () => {
  it(':portfolio → /library', () => {
    expect(parseCommand(':portfolio', ctx).items[0].path).toBe('/library')
  })
  it(':scenarios → /library?tab=scenarios', () => {
    expect(parseCommand(':scenarios', ctx).items[0].path).toBe('/library?tab=scenarios')
  })
  it(':new → /search?new=1', () => {
    expect(parseCommand(':new', ctx).items[0].path).toBe('/search?new=1')
  })
  it(':compare verb is removed — palette no longer parses it', () => {
    const r = parseCommand(':compare', ctx)
    expect(r.kind).toBe('unknown')
  })
  it(':help shows the verb reference', () => {
    const r = parseCommand(':help', ctx)
    expect(r.items.length).toBe(Object.keys(VERBS).length)
  })
})

describe('resolveTechShortcut', () => {
  it('maps common shortcuts case-insensitively', () => {
    expect(resolveTechShortcut('cs')).toBe('Community Solar')
    expect(resolveTechShortcut('CS')).toBe('Community Solar')
    expect(resolveTechShortcut('bess')).toBe('BESS')
    expect(resolveTechShortcut('storage')).toBe('BESS')
    expect(resolveTechShortcut('hybrid')).toBe('Hybrid')
    expect(resolveTechShortcut('ci')).toBe('C&I Solar')
  })
  it('returns null for unknown shortcuts', () => {
    expect(resolveTechShortcut('foobar')).toBeNull()
    expect(resolveTechShortcut('')).toBeNull()
    expect(resolveTechShortcut(null)).toBeNull()
  })
})
