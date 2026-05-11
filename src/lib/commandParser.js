// commandParser.js — Phase 1 of TRACTOVA-UX-001.
//
// Cmd-K verb grammar. Power users type `:lens ME 5 CS` and land on a
// Lens results page in two keystrokes — that's the unforgettable thing.
//
// Pure data-in / data-out (no React, no DOM). Consumed by CommandPalette,
// covered by tests/unit/commandParser.spec.js. The parser only fires
// when `query.startsWith(':')`; everything else stays on the existing
// fuzzy-search path so we never intercept ordinary searches.
//
// Each parse returns:
//   { kind, verb, items: [...], hint?, error? }
//     kind === 'verb'     → matched a verb (items are executable picks
//                            or autocomplete suggestions)
//     kind === 'unknown'  → query started with `:` but didn't match
//                            (items always empty, error explains)
//   or `null` when the query isn't a verb path.
//
// Items shape (consumed by the palette renderer):
//   { kind, label, hint, path? , replaceQuery?, action? }
//     `path`         → navigate on Enter
//     `replaceQuery` → rewrite the input box on Enter (autocomplete)
//     `action`       → app-side action token (e.g. 'open-compare', 'new-lens')

export const VERBS = {
  lens:      { syntax: ':lens <STATE> [<MW>] [<TECH>]', summary: 'Run a new Lens analysis' },
  portfolio: { syntax: ':portfolio',                    summary: 'Open Library' },
  scenarios: { syntax: ':scenarios',                    summary: 'Library — Scenarios tab' },
  compare:   { syntax: ':compare',                      summary: 'Open Compare tray' },
  rerun:     { syntax: ':rerun <project>',              summary: 'Re-run Lens for a saved project' },
  gloss:     { syntax: ':gloss <TERM>',                 summary: 'Jump to a glossary term' },
  state:     { syntax: ':state <ID>',                   summary: 'State snapshot on Dashboard' },
  new:       { syntax: ':new',                          summary: 'New Lens analysis (clear form)' },
  help:      { syntax: ':help',                         summary: 'Verb reference' },
}

// Tech shortcuts → canonical Search.jsx values (TECHNOLOGIES in Search.jsx).
// Case-insensitive lookup — input is uppercased + spaces stripped before
// matching. Keep keys short + memorable; this is the "two-keystroke" promise.
const TECH_MAP = {
  CS:                'Community Solar',
  COMMUNITY:         'Community Solar',
  'COMMUNITY-SOLAR': 'Community Solar',
  CI:                'C&I Solar',
  'C&I':             'C&I Solar',
  'C&ISOLAR':        'C&I Solar',
  COMMERCIAL:        'C&I Solar',
  BESS:              'BESS',
  BATTERY:           'BESS',
  STORAGE:           'BESS',
  HYB:               'Hybrid',
  HYBRID:            'Hybrid',
}

function slugify(term) {
  return String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Public — exported for tests + consumer code that needs the mapping.
export function resolveTechShortcut(raw) {
  if (!raw) return null
  const key = String(raw).toUpperCase().replace(/\s+/g, '')
  return TECH_MAP[key] || null
}

// Top-level entry. Returns null when the query isn't a verb path.
// `ctx` carries app-side data the parser needs to validate args:
//   { stateIds: string[], glossaryTerms: {term, pillar}[], savedProjects: {id,name,state,county,mw,stage}[] }
export function parseCommand(query, ctx = {}) {
  if (typeof query !== 'string' || !query.startsWith(':')) return null

  const stateIds       = new Set((ctx.stateIds || []).map(s => String(s).toUpperCase()))
  const glossaryTerms  = ctx.glossaryTerms  || []
  const savedProjects  = ctx.savedProjects  || []

  // Trim verb body. Multiple spaces collapse to single.
  const body = query.slice(1).replace(/\s+/g, ' ').replace(/^\s+/, '')
  // Catch the trailing-space case (`:lens ME `) — the trailing space is
  // meaningful because it means "the user is mid-typing the next arg".
  const hasTrailingSpace = /[ ]$/.test(body)
  const trimmed = body.trim()

  if (!trimmed) {
    // Bare `:` — show verb reference.
    return {
      kind: 'verb',
      verb: null,
      hint: 'Type a verb',
      items: verbReferenceItems(),
    }
  }

  const parts    = trimmed.split(' ')
  const verbName = parts[0].toLowerCase()
  const rawArgs  = parts.slice(1)

  if (!VERBS[verbName]) {
    // Prefix-match — user typed `:le`, suggest `:lens`.
    const matches = Object.keys(VERBS).filter(v => v.startsWith(verbName))
    if (matches.length > 0) {
      return {
        kind: 'verb',
        verb: null,
        hint: matches.length === 1 ? 'Press Tab to complete' : 'Pick a verb',
        items: matches.map(v => ({
          kind: 'verb-help',
          label: VERBS[v].syntax,
          hint: VERBS[v].summary,
          replaceQuery: verbTakesArgs(v) ? `:${v} ` : `:${v}`,
        })),
      }
    }
    return {
      kind: 'unknown',
      verb: null,
      error: `Unknown verb \`:${verbName}\`. Type :help for the reference.`,
      items: [],
    }
  }

  switch (verbName) {
    case 'help':      return runHelp()
    case 'portfolio': return runStaticVerb('portfolio', 'Open Library',                  'Saved projects portfolio', '/library')
    case 'scenarios': return runStaticVerb('scenarios', 'Open Library — Scenarios',      'Scenario snapshots tab',    '/library?tab=scenarios')
    case 'new':       return runStaticVerb('new',       'Start a new Lens analysis',     'Clear form',                '/search?new=1')
    case 'compare':   return runCompare()
    case 'state':     return runState(rawArgs, stateIds)
    case 'gloss':     return runGloss(rawArgs, glossaryTerms)
    case 'rerun':     return runRerun(rawArgs, savedProjects)
    case 'lens':      return runLens(rawArgs, stateIds, hasTrailingSpace)
    default:
      return { kind: 'unknown', verb: verbName, error: `Verb :${verbName} not wired`, items: [] }
  }
}

// ── Per-verb runners ───────────────────────────────────────────────────

// Argless verbs land directly on a route; arg-verbs need a trailing
// space so the user can keep typing their args after autocomplete.
const ARGLESS_VERBS = new Set(['portfolio', 'scenarios', 'compare', 'new', 'help'])
function verbTakesArgs(v) { return !ARGLESS_VERBS.has(v) }

function verbReferenceItems() {
  return Object.entries(VERBS).map(([v, m]) => ({
    kind: 'verb-help',
    label: m.syntax,
    hint:  m.summary,
    replaceQuery: verbTakesArgs(v) ? `:${v} ` : `:${v}`,
  }))
}

function runHelp() {
  return { kind: 'verb', verb: 'help', hint: 'Verb reference', items: verbReferenceItems() }
}

function runStaticVerb(verb, label, hint, path) {
  return {
    kind: 'verb',
    verb,
    items: [{ kind: 'verb-go', label, hint, path }],
  }
}

function runCompare() {
  return {
    kind: 'verb',
    verb: 'compare',
    items: [{ kind: 'verb-go', label: 'Open Compare tray', hint: 'Side-by-side projects', action: 'open-compare' }],
  }
}

function runState(rawArgs, stateIds) {
  const id = (rawArgs[0] || '').toUpperCase()
  if (!id) {
    return {
      kind: 'verb',
      verb: 'state',
      hint: 'Need a 2-letter state code',
      items: [{ kind: 'verb-help', label: ':state <ID>', hint: 'e.g. :state ME', replaceQuery: ':state ' }],
    }
  }
  if (stateIds.has(id)) {
    return {
      kind: 'verb',
      verb: 'state',
      items: [{ kind: 'verb-go', label: `State ${id}`, hint: 'Dashboard scoped to this state', path: `/?state=${id}` }],
    }
  }
  const candidates = [...stateIds].filter(s => s.startsWith(id)).slice(0, 6)
  if (candidates.length === 0) {
    return { kind: 'unknown', verb: 'state', error: `No state matching \`${id}\``, items: [] }
  }
  return {
    kind: 'verb',
    verb: 'state',
    hint: candidates.length > 1 ? 'Ambiguous — pick one' : 'Pick a state',
    items: candidates.map(c => ({
      kind: 'verb-go',
      label: `State ${c}`,
      hint: 'Dashboard scoped to this state',
      path: `/?state=${c}`,
    })),
  }
}

function runGloss(rawArgs, glossaryTerms) {
  const needle = rawArgs.join(' ').trim().toLowerCase()
  if (!needle) {
    return {
      kind: 'verb',
      verb: 'gloss',
      hint: 'Need a term',
      items: [{ kind: 'verb-help', label: ':gloss <TERM>', hint: 'e.g. :gloss IRR', replaceQuery: ':gloss ' }],
    }
  }
  const matches = glossaryTerms
    .filter(t => t && t.term && t.term.toLowerCase().includes(needle))
    .slice(0, 8)
  if (matches.length === 0) {
    return { kind: 'unknown', verb: 'gloss', error: `No glossary term matching \`${needle}\``, items: [] }
  }
  return {
    kind: 'verb',
    verb: 'gloss',
    items: matches.map(t => ({
      kind: 'verb-go',
      label: t.term,
      hint:  `Glossary · ${t.pillar === 'all' ? 'all pillars' : (t.pillar || 'term')}`,
      path:  `/glossary#${slugify(t.term)}`,
    })),
  }
}

function runRerun(rawArgs, savedProjects) {
  const needle = rawArgs.join(' ').trim().toLowerCase()
  if (!needle) {
    return {
      kind: 'verb',
      verb: 'rerun',
      hint: 'Need a project name',
      items: [{ kind: 'verb-help', label: ':rerun <project>', hint: 'e.g. :rerun Cumberland', replaceQuery: ':rerun ' }],
    }
  }
  const matches = savedProjects
    .filter(p => p && p.name && p.name.toLowerCase().includes(needle))
    .slice(0, 8)
  if (matches.length === 0) {
    return { kind: 'unknown', verb: 'rerun', error: `No saved project matching \`${needle}\``, items: [] }
  }
  return {
    kind: 'verb',
    verb: 'rerun',
    items: matches.map(p => ({
      kind: 'verb-go',
      label: `Re-run ${p.name}`,
      hint:  `${p.county || '—'}, ${p.state || '?'} · ${p.mw || '?'} MW · ${p.stage || 'no stage'}`,
      path:  `/search?fromProject=${encodeURIComponent(p.id)}`,
    })),
  }
}

function runLens(rawArgs, stateIds, hasTrailingSpace) {
  const stateRaw = (rawArgs[0] || '').toUpperCase()
  const mwRaw    = rawArgs[1]
  const techRaw  = rawArgs.slice(2).join(' ')

  if (!stateRaw) {
    return {
      kind: 'verb',
      verb: 'lens',
      hint: 'Need a state',
      items: [{ kind: 'verb-help', label: ':lens <STATE> [<MW>] [<TECH>]', hint: 'e.g. :lens ME 5 CS', replaceQuery: ':lens ' }],
    }
  }

  // Resolve / autocomplete the state. We treat short prefixes as
  // "user is still typing" — but only if the user hasn't yet typed a
  // space after the state token. `:lens M ` with a trailing space means
  // they think M is final; treat that as an error case.
  const stateValid = stateIds.has(stateRaw)
  if (!stateValid) {
    const candidates = [...stateIds].filter(s => s.startsWith(stateRaw)).slice(0, 6)
    // If user typed the state followed by a space (i.e. moved on to MW),
    // and the state isn't valid, that's an error — not an autocomplete.
    const userMovedOn = hasTrailingSpace && rawArgs.length === 1
    if (candidates.length === 0 || userMovedOn) {
      return { kind: 'unknown', verb: 'lens', error: `No state matching \`${stateRaw}\``, items: [] }
    }
    return {
      kind: 'verb',
      verb: 'lens',
      hint: candidates.length > 1 ? 'Ambiguous state — pick one' : 'Complete the state',
      items: candidates.map(c => ({
        kind: 'verb-help',
        label: `:lens ${c}`,
        hint:  'Pick this state, then add MW + tech',
        replaceQuery: `:lens ${c} `,
      })),
    }
  }

  let mw = ''
  if (mwRaw != null && mwRaw !== '') {
    const n = Number(mwRaw)
    if (!Number.isFinite(n) || n <= 0) {
      return { kind: 'unknown', verb: 'lens', error: `MW \`${mwRaw}\` is not a positive number`, items: [] }
    }
    mw = String(n)
  }

  let tech = null
  if (techRaw) {
    tech = resolveTechShortcut(techRaw)
    if (!tech) {
      return { kind: 'unknown', verb: 'lens', error: `Unknown tech \`${techRaw}\`. Try CS, BESS, HYB, or CI.`, items: [] }
    }
  }

  const params = new URLSearchParams()
  params.set('state', stateRaw)
  if (mw)   params.set('mw', mw)
  if (tech) params.set('technology', tech)
  const labelBits = [stateRaw, mw ? `${mw} MW` : null, tech].filter(Boolean).join(' · ')
  return {
    kind: 'verb',
    verb: 'lens',
    items: [{
      kind: 'verb-go',
      label: `Run Lens — ${labelBits}`,
      hint:  'Press Enter to open Lens',
      path:  `/search?${params.toString()}`,
    }],
  }
}
