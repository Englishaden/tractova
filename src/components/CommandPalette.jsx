import { useState, useEffect, useId, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'motion/react'
import { getStateProgramMap } from '../lib/programData'
import allCounties from '../data/allCounties.json'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
// Import from the data module, NOT from pages/Glossary — keeping a
// static dep on the page module would force its lazy chunk into the
// main bundle (the build used to warn INEFFECTIVE_DYNAMIC_IMPORT).
import { GLOSSARY_TERMS, toSlug } from '../data/glossaryTerms'
import { parseCommand } from '../lib/commandParser'
import { listSavedComparisons } from '../lib/savedComparisons'
import PaletteLensForm from './lens/PaletteLensForm'
import { findState } from '../lib/lensFormConstants'

// Cmd-K global palette. Power-user spine of the app — every repeated
// action gets a verb (see commandParser.js). Two modes:
//   1. Verb mode  — query starts with ':'. Parser drives everything.
//   2. Fuzzy mode — default. Indexes states / counties / saved projects
//                   / glossary terms (the long-standing behaviour).
//
// Open via Cmd/Ctrl-K. Closes on Esc / outside click. Cmd+Enter on
// any item opens in a new tab. Tab autocompletes the current
// suggestion (rewrites the input box). Recent-actions footer surfaces
// the last 5 picks, scoped to the signed-in user.

const NAV_ROUTES = [
  { label: 'Dashboard',  hint: 'Map + state intelligence', path: '/' },
  { label: 'Lens',       hint: 'Run a new analysis',       path: '/search' },
  { label: 'Library',    hint: 'Saved projects portfolio', path: '/library' },
  { label: 'Glossary',   hint: 'Industry term reference',  path: '/glossary' },
  { label: 'Profile',    hint: 'Account + alerts',         path: '/profile' },
]

const RECENTS_KEY_PREFIX = 'tractova_cmdk_recents__'
const RECENTS_MAX = 10
const RECENTS_SHOW = 5

function loadRecents(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(RECENTS_KEY_PREFIX + userId)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : []
  } catch { return [] }
}

function pushRecent(userId, item) {
  if (!userId || !item || (!item.path && !item.action)) return
  const key = RECENTS_KEY_PREFIX + userId
  const entry = {
    label: item.label,
    hint:  item.hint || '',
    path:  item.path || null,
    action: item.action || null,
    kind:  item.kind,
    ts:    Date.now(),
  }
  try {
    const prev = loadRecents(userId)
    // De-dup by path/action — most recent wins.
    const fingerprint = entry.path || `action:${entry.action}`
    const filtered = prev.filter(p => (p.path || `action:${p.action}`) !== fingerprint)
    const next = [entry, ...filtered].slice(0, RECENTS_MAX)
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* localStorage quota — drop silently */ }
}

// Last-lens shortcut storage. Separate key from `recents` so the "↻
// Re-run" chip always reflects the most recent Lens (which may not be
// the most recent palette action — user might have run a Lens, then
// hopped to Library, then come back to the palette).
const LAST_LENS_KEY_PREFIX = 'tractova_cmdk_last_lens__'

function loadLastLens(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(LAST_LENS_KEY_PREFIX + userId)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveLastLens(userId, payload) {
  if (!userId || !payload) return
  try {
    localStorage.setItem(LAST_LENS_KEY_PREFIX + userId, JSON.stringify({ ...payload, ts: Date.now() }))
  } catch { /* quota — drop silently */ }
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [stateMap, setStateMap] = useState({})
  const [savedProjects, setSavedProjects] = useState([])
  const [savedComparisons, setSavedComparisons] = useState([])
  const [recents, setRecents] = useState([])
  const [lastLens, setLastLens] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  // Palette mode: 'normal' = chip strip + search input + results list.
  // 'lens' = chip strip + structured Lens form (state/county/mw/tech/stage).
  // Entered via the Lens chip, the Cmd-Shift-L hotkey (Slice β), or the
  // colon shorthand `:lens ...` which parses args + pre-fills the form.
  const [mode, setMode] = useState('normal')
  const [lensInitial, setLensInitial] = useState({})
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const { user } = useAuth()
  // Phase 3 a11y — combobox/listbox/option pattern needs stable ids so
  // aria-controls / aria-activedescendant can point at the right nodes.
  const listboxUid = useId()
  const listboxId  = `cmdk-listbox-${listboxUid}`
  const optionId   = (i) => `cmdk-option-${listboxUid}-${i}`

  useEffect(() => {
    getStateProgramMap().then(setStateMap).catch(err => {
      console.warn('[CommandPalette] getStateProgramMap failed:', err)
    })
  }, [])

  useEffect(() => {
    if (!user) { setSavedProjects([]); setSavedComparisons([]); setRecents([]); setLastLens(null); return }
    setRecents(loadRecents(user.id))
    setLastLens(loadLastLens(user.id))
    supabase
      .from('projects')
      .select('id, name, state, county, mw, stage')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (!error && data) setSavedProjects(data)
      })
    // Saved comparisons feed the `:compare` verb's expanded item list.
    // Lightweight read (≤ 50 rows) so prefetching at sign-in beats deferring
    // until the palette opens.
    listSavedComparisons().then(setSavedComparisons)
  }, [user])

  // County items — flattened on demand. Cheap (~3000 rows mapped once).
  const countyItems = useMemo(() => {
    if (!Object.keys(stateMap).length) return []
    const stateNameById = Object.fromEntries(Object.values(stateMap).map(s => [s.id, s.name]))
    const out = []
    for (const stateId of Object.keys(allCounties)) {
      const stateName = stateNameById[stateId] || stateId
      for (const county of allCounties[stateId]) {
        out.push({
          kind: 'county',
          label: `${county}, ${stateId}`,
          hint: `${stateName} · run Lens`,
          path: `/search?state=${stateId}&county=${encodeURIComponent(county)}`,
        })
      }
    }
    return out
  }, [stateMap])

  const glossaryItems = useMemo(() => {
    return GLOSSARY_TERMS.map(t => ({
      kind: 'glossary',
      label: t.term,
      hint: `Glossary · ${t.pillar === 'all' ? 'all pillars' : t.pillar}`,
      path: `/glossary#${toSlug(t.term)}`,
    }))
  }, [])

  // Global Cmd/Ctrl-K hotkey
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      // On open: focus the input. DON'T reset mode here — that would
      // override the Cmd-Shift-L handler's setMode('lens') that fires
      // in the same render cycle. Mode resets happen on CLOSE so the
      // next open starts clean unless a hotkey explicitly chose a mode.
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      // On close: reset to normal mode + clear input so the next Cmd-K
      // open is a fresh palette. Cmd-Shift-L sets mode='lens' AFTER
      // setOpen(true) — which only triggers this effect on the CLOSE
      // transition, never the open transition.
      setMode('normal')
      setQ('')
      setActiveIndex(0)
      setLensInitial({})
    }
  }, [open])

  // Cmd-Shift-L → open palette directly into Lens form mode. Avoids
  // Cmd-L which is the browser address-bar shortcut on Mac/Windows.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setOpen(true)
        setMode('lens')
        setLensInitial({})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Detect `:lens` shorthand and route into the structured form with
  // any parsed args pre-filled. This preserves the keyboard-grammar
  // power-user path (`:lens MA 5 CS`) while delivering the same
  // structured form for everyone — the form pre-fills + focuses the
  // next empty field (typically County, since shorthand doesn't carry
  // it). Per Aden: no auto-submit; let the user pick the county.
  useEffect(() => {
    if (mode !== 'normal') return
    if (!q.startsWith(':lens')) return
    const after = q.slice(5).trim()
    // Only switch into form mode after the user clearly meant `:lens`
    // (with a space or no further chars). Avoids hijacking partial
    // typing like `:lensf` or future verbs starting with `:lens`.
    if (after.length === 0 || q[5] === ' ' || q.length === 5) {
      const parts = after.split(/\s+/).filter(Boolean)
      const stateGuess = parts[0] ? findState(parts[0]) : null
      const mwGuess    = parts[1] && /^\d+(\.\d+)?$/.test(parts[1]) ? parts[1] : ''
      const techGuess  = resolveTechFromShorthand(parts.slice(2).join(' '))
      setLensInitial({
        stateId: stateGuess?.id || '',
        mw:      mwGuess,
        tech:    techGuess,
      })
      setMode('lens')
      setQ('')
    }
  }, [q, mode])

  // ── Item list assembly ──────────────────────────────────────────────
  // Two paths: verb mode (q.startsWith(':')) vs fuzzy mode (default).
  const isVerbMode = q.startsWith(':')

  const parserCtx = useMemo(() => ({
    stateIds: Object.keys(stateMap || {}),
    glossaryTerms: GLOSSARY_TERMS,
    savedProjects,
    savedComparisons,
  }), [stateMap, savedProjects, savedComparisons])

  const verbResult = useMemo(() => {
    if (!isVerbMode) return null
    return parseCommand(q, parserCtx)
  }, [isVerbMode, q, parserCtx])

  const items = useMemo(() => {
    // Verb mode — parser is authoritative.
    if (isVerbMode) return verbResult?.items || []

    // Fuzzy mode — preserve the existing ranking + behaviour.
    const states = Object.values(stateMap || {}).map(s => ({
      kind: 'state',
      label: s.name,
      hint: s.csProgram || (s.csStatus === 'none' ? 'No program' : 'CS program'),
      score: s.feasibilityScore,
      path: `/search?state=${s.id}`,
      stateId: s.id,
    }))
    const projects = savedProjects.map(p => ({
      kind: 'project',
      label: p.name,
      hint: `${p.county || '—'}, ${p.state || '?'} · ${p.mw || '?'} MW · ${p.stage || 'no stage'}`,
      path: '/library',
    }))
    if (!q.trim()) {
      return [
        ...NAV_ROUTES.map(r => ({ kind: 'nav', ...r })),
        ...projects.slice(0, 4),
        ...states.slice(0, 6),
        ...glossaryItems.slice(0, 4),
      ].slice(0, 16)
    }
    const needle = q.trim().toLowerCase()
    const matchFn = it => it.label.toLowerCase().includes(needle) || it.hint?.toLowerCase().includes(needle)
    const navMatch      = NAV_ROUTES.map(r => ({ kind: 'nav', ...r })).filter(matchFn)
    const projectMatch  = projects.filter(matchFn)
    const stateMatch    = states.filter(matchFn)
    const glossaryMatch = glossaryItems.filter(matchFn).slice(0, 8)
    const countyMatch   = needle.length >= 2 ? countyItems.filter(matchFn).slice(0, 10) : []
    return [...navMatch, ...projectMatch, ...stateMatch, ...glossaryMatch, ...countyMatch].slice(0, 20)
  }, [isVerbMode, verbResult, q, stateMap, savedProjects, countyItems, glossaryItems])

  // Clamp activeIndex when items change
  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1))
  }, [items.length, activeIndex])

  // Chip strip dispatch — one-click verb entry. Mirrors what users
  // would type with the colon shorthand but without the memorization
  // tax.
  const handleChipSelect = useCallback((verb) => {
    if (verb === 'lens') {
      setMode('lens')
      setLensInitial({})
      setQ('')
      return
    }
    if (verb === 'library') {
      if (user) pushRecent(user.id, { label: 'Library', hint: 'Saved portfolio', path: '/library', kind: 'nav' })
      setOpen(false)
      navigate('/library')
      return
    }
    if (verb === 'compare') {
      setOpen(false)
      try { window.dispatchEvent(new CustomEvent('tractova:open-compare')) } catch { /* SSR-safe */ }
      return
    }
    if (verb === 'glossary') {
      if (user) pushRecent(user.id, { label: 'Glossary', hint: 'Term reference', path: '/glossary', kind: 'nav' })
      setOpen(false)
      navigate('/glossary')
      return
    }
  }, [user, navigate])

  // Re-run chip — navigates directly to the most recent palette-dispatched
  // Lens URL. Bypasses the form because the URL signature already encodes
  // all required params; Search.jsx will auto-submit on signature change.
  const handleReRunLens = useCallback(() => {
    if (!lastLens?.path) return
    if (user) pushRecent(user.id, lastLens)
    setOpen(false)
    navigate(lastLens.path)
  }, [lastLens, user, navigate])

  // Structured Lens form submission. Builds the same /search?... URL
  // the colon shorthand would have built, but with the County (the bit
  // the shorthand never carried). Persists to localStorage so the
  // Re-run chip can pick it up on the next palette open.
  const handleLensSubmit = useCallback(({ stateId, stateName, county, mw, tech, stage }) => {
    const params = new URLSearchParams()
    params.set('state', stateId)
    params.set('county', county)
    params.set('mw', String(mw))
    params.set('technology', tech)
    params.set('stage', stage)
    const path = `/search?${params.toString()}`
    const label = `${stateName || stateId} · ${county} · ${mw} MW`
    const hint = `${tech} · ${stage.split(' (')[0]}`
    if (user) {
      pushRecent(user.id, { label: `Lens — ${label}`, hint, path, kind: 'verb-go' })
      saveLastLens(user.id, { label, hint, path })
      setLastLens({ label, hint, path })
    }
    setOpen(false)
    navigate(path)
  }, [user, navigate])

  const handleLensCancel = useCallback(() => {
    setMode('normal')
    setLensInitial({})
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const select = useCallback((it, { newTab = false } = {}) => {
    if (!it) return
    // Autocomplete — rewrite the query, keep palette open.
    if (it.replaceQuery != null) {
      setQ(it.replaceQuery)
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    if (it.action === 'open-compare') {
      setOpen(false)
      if (user) pushRecent(user.id, it)
      // CompareTray listens for this — opens its modal if items > 0.
      try { window.dispatchEvent(new CustomEvent('tractova:open-compare')) } catch { /* SSR-safe */ }
      return
    }
    if (it.action === 'load-compare' && it.savedId) {
      setOpen(false)
      if (user) pushRecent(user.id, it)
      // CompareTray listens for this — fetches the snapshot, hydrates
      // CompareContext, opens the modal. Detached from the parser so the
      // parser stays pure / synchronous.
      try {
        window.dispatchEvent(new CustomEvent('tractova:load-compare', { detail: { savedId: it.savedId } }))
      } catch { /* SSR-safe */ }
      return
    }
    if (it.path) {
      if (user) pushRecent(user.id, it)
      setOpen(false)
      if (newTab) {
        window.open(it.path, '_blank', 'noopener')
      } else {
        navigate(it.path)
      }
      // Refresh recents view next time palette opens
      if (user) setRecents(loadRecents(user.id))
    }
  }, [navigate, user])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActiveIndex(i => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter')     { e.preventDefault(); if (items[activeIndex]) select(items[activeIndex], { newTab: e.metaKey || e.ctrlKey }) }
    else if (e.key === 'Tab')       {
      // Tab → autocomplete via the active item's replaceQuery, if any.
      const it = items[activeIndex]
      if (it && it.replaceQuery != null) {
        e.preventDefault()
        setQ(it.replaceQuery)
        setActiveIndex(0)
      }
    }
  }

  // Verb mode error message (parser returned kind: 'unknown')
  const verbError = isVerbMode && verbResult && verbResult.kind === 'unknown' ? verbResult.error : null
  const verbHint  = isVerbMode && verbResult && verbResult.hint ? verbResult.hint : null

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50"
                style={{ background: 'rgba(10,24,40,0.55)', backdropFilter: 'blur(4px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                // Position: top offset + max-height must sum to ≤ 100vh so the
                // bottom edge always stays on-screen. The previous version
                // had `top-[10vh]` + `maxHeight: calc(100vh - 4rem)` whose
                // sum could exceed 110vh − clip on lower zooms / shorter
                // viewports. New math: top = 8vh (proportional headroom that
                // scales with the viewport), max-height = 92vh − 1rem so the
                // bottom edge lands at most (8vh + 92vh − 1rem) = (100vh −
                // 1rem) from the top. Result: always at least 16px of
                // breathing room at the bottom, at any zoom or screen size.
                // Results body is the only flex-shrinking section; everything
                // else stays at its natural size.
                className="fixed left-1/2 top-[8vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-2xl outline-hidden overflow-hidden flex flex-col"
                style={{ border: '1px solid #E2E8F0', maxHeight: 'calc(92vh - 1rem)' }}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <div className="h-[3px] w-full shrink-0" style={{ background: mode === 'lens' ? '#0F766E' : isVerbMode ? '#0F1A2E' : '#14B8A6' }} />
                <RadixDialog.Title className="sr-only">Command Palette</RadixDialog.Title>
                <RadixDialog.Description className="sr-only">Quick search or run a Cmd-K verb</RadixDialog.Description>

                {/* Verb chip strip — persistent one-click entry into Lens /
                    Library / Compare / Glossary. Re-run last chip surfaces
                    the most recent palette-dispatched Lens. Replaces the
                    colon-shorthand memorization tax. */}
                <VerbChipStrip
                  mode={mode}
                  lastLens={lastLens}
                  onSelect={handleChipSelect}
                  onReRunLens={handleReRunLens}
                  onHelp={() => {
                    // Close palette + open the command reference dialog.
                    // KeyboardShortcuts.jsx listens for this custom event
                    // and switches to the Commands tab by default.
                    setOpen(false)
                    try {
                      window.dispatchEvent(new CustomEvent('tractova:open-shortcuts', { detail: { tab: 'commands' } }))
                    } catch { /* SSR-safe */ }
                  }}
                />

                <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: '#E2E8F0', display: mode === 'lens' ? 'none' : 'flex' }}>
                  {isVerbMode ? (
                    // Terminal-style mono prompt — reads as `:>` in a research
                    // terminal, signaling we're in the keyboard-grammar mode.
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-mono font-bold text-[11px] leading-none"
                      style={{ color: '#0F1A2E', letterSpacing: '-0.04em' }}
                    >:&gt;</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  )}
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setActiveIndex(0) }}
                    onKeyDown={onKeyDown}
                    placeholder={isVerbMode ? 'Type a verb (try :help)' : 'Jump to a state, page, or analysis… (type : for verbs)'}
                    className="flex-1 bg-transparent text-sm text-ink placeholder-gray-400 outline-hidden focus-visible:outline-1 focus-visible:outline-teal-500/30 focus-visible:outline-offset-2 rounded-sm"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={items.length > 0}
                    aria-controls={listboxId}
                    aria-activedescendant={items.length > 0 ? optionId(activeIndex) : undefined}
                    aria-label={isVerbMode ? 'Command palette — verb mode' : 'Command palette — jump to a state, page, or analysis'}
                  />
                  <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">ESC</span>
                </div>

                {mode === 'lens' && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <PaletteLensForm
                      initial={lensInitial}
                      onSubmit={handleLensSubmit}
                      onCancel={handleLensCancel}
                    />
                  </div>
                )}

                {/* Verb-mode hint / error banner. Left-bar accent like a
                    Bloomberg status line — color carries the severity, the
                    eyebrow-mono label carries the meaning. */}
                {mode === 'normal' && (verbHint || verbError) && (
                  <div
                    className="flex items-center gap-2 px-4 py-1.5 border-b eyebrow-mono shrink-0"
                    style={{
                      background: verbError ? 'rgba(220,38,38,0.05)' : '#F9FAFB',
                      borderColor: '#E2E8F0',
                      color: verbError ? '#B91C1C' : '#5A6B7A',
                      borderLeft: `2px solid ${verbError ? '#DC2626' : '#0F766E'}`,
                    }}
                    role={verbError ? 'alert' : 'status'}
                  >
                    {verbError || verbHint}
                  </div>
                )}

                {/* Results — the only flex-shrinking section. flex-1 +
                    min-h-0 lets it absorb whatever space remains after the
                    fixed-size rows (header, banner, recents, footer).
                    Hidden in lens-form mode (the form takes over the body). */}
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ display: mode === 'lens' ? 'none' : 'block' }}>
                  {items.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-6">
                      {verbError ? 'No matches' : 'No matches'}
                    </p>
                  ) : (
                    <ul id={listboxId} role="listbox" aria-label="Command palette results">
                      {items.map((it, i) => {
                        const active = i === activeIndex
                        const isAutocomplete = it.replaceQuery != null
                        return (
                          <li key={`${it.kind}:${it.label}:${i}`} role="option" aria-selected={active} id={optionId(i)}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIndex(i)}
                              onClick={(e) => select(it, { newTab: e.metaKey || e.ctrlKey })}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={{ background: active ? 'rgba(15,118,110,0.08)' : 'transparent' }}
                              tabIndex={-1}
                            >
                              <span
                                className="font-mono text-[9px] uppercase tracking-[0.20em] shrink-0 w-16"
                                style={{ color: kindColor(it.kind) }}
                              >
                                {kindLabel(it.kind)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-tight truncate ${isAutocomplete ? 'font-mono' : 'font-serif font-semibold'} text-ink`}>{it.label}</p>
                                {it.hint && (
                                  <p className="text-[11px] text-ink-muted truncate">{it.hint}</p>
                                )}
                              </div>
                              {it.score != null && (
                                <span
                                  className="font-mono text-xs font-bold tabular-nums shrink-0"
                                  style={{ color: it.score >= 60 ? '#0F766E' : '#5A6B7A' }}
                                >
                                  {it.score}
                                </span>
                              )}
                              {active && (
                                isAutocomplete ? (
                                  <span className="font-mono text-[10px] text-ink-muted shrink-0 px-1 py-0.5 rounded-sm border border-gray-300">TAB</span>
                                ) : (
                                  <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 6 15 12 9 18"/>
                                  </svg>
                                )
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {/* Recent actions — scoped to user, top 5, hidden when verb mode or empty */}
                {mode === 'normal' && !isVerbMode && !q.trim() && recents.length > 0 && (
                  <div className="border-t shrink-0 max-h-[28vh] overflow-y-auto" style={{ borderColor: '#E2E8F0', background: '#FAFBFC' }}>
                    <div className="px-4 pt-2 pb-1 eyebrow-mono" style={{ color: '#5A6B7A' }}>RECENT</div>
                    <ul>
                      {recents.slice(0, RECENTS_SHOW).map((r, i) => (
                        <li key={`recent:${r.label}:${i}`}>
                          <button
                            type="button"
                            onClick={(e) => select({ ...r, kind: 'recent' }, { newTab: e.metaKey || e.ctrlKey })}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white"
                          >
                            <span
                              className="font-mono text-[9px] uppercase tracking-[0.20em] shrink-0 w-16"
                              style={{ color: '#5A6B7A' }}
                            >Recent</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-serif text-sm font-semibold text-ink leading-tight truncate">{r.label}</p>
                              {r.hint && <p className="text-[11px] text-ink-muted truncate">{r.hint}</p>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="px-4 py-2 border-t flex items-center justify-between text-[10px] font-mono text-ink-muted shrink-0" style={{ borderColor: '#E2E8F0', background: '#F9FAFB' }}>
                  {mode === 'lens' ? (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">TAB</span> next field</span>
                        <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">↵</span> run Lens</span>
                        <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">ESC</span> cancel</span>
                      </div>
                      <span>Lens — Quick Run</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">↑↓</span> navigate</span>
                        <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">↵</span> open</span>
                        <span className="hidden sm:inline"><span className="px-1 py-0.5 rounded-sm border border-gray-300">⌘↵</span> new tab</span>
                        <span className="hidden sm:inline"><span className="px-1 py-0.5 rounded-sm border border-gray-300">TAB</span> complete</span>
                        <span className="hidden sm:inline"><span className="px-1 py-0.5 rounded-sm border border-gray-300">:</span> verbs</span>
                      </div>
                      <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}

function kindColor(kind) {
  switch (kind) {
    case 'state':     return '#0F766E'
    case 'county':    return '#14B8A6'
    case 'project':   return '#0F1A2E'
    case 'glossary':  return '#B45309'    // amber-700 — reference / explainer category
    case 'verb-help': return '#0F1A2E'
    case 'verb-go':   return '#0F766E'
    case 'recent':    return '#5A6B7A'
    default:          return '#5A6B7A'
  }
}

function kindLabel(kind) {
  switch (kind) {
    case 'state':     return 'State'
    case 'county':    return 'County'
    case 'project':   return 'Project'
    case 'glossary':  return 'Glossary'
    case 'verb-help': return 'Verb'
    case 'verb-go':   return 'Verb'
    case 'recent':    return 'Recent'
    default:          return 'Page'
  }
}

// Resolve the tech token from the colon-shorthand (CS / CI / BESS / HYB
// codes OR a partial name match) into the canonical TECHNOLOGIES_FLAT
// value used by the form chip group. Returns '' when no match.
function resolveTechFromShorthand(raw) {
  if (!raw) return ''
  const norm = raw.trim().toUpperCase()
  if (!norm) return ''
  // Aliases match the parser's table in commandParser.js (lines 40-53).
  if (norm === 'CS' || norm.startsWith('COMMUNITY')) return 'Community Solar'
  if (norm === 'CI' || norm.startsWith('C&I') || norm.startsWith('COMMERCIAL')) return 'C&I Solar'
  if (norm === 'BESS' || norm === 'BATTERY' || norm === 'STORAGE') return 'BESS'
  if (norm === 'HYB' || norm.startsWith('HYBRID')) return 'Hybrid'
  return ''
}

// Verb chip strip — persistent affordance at the top of the palette.
// Bloomberg-style tab-bar; one-click verb entry replaces the colon
// memorization. Active chip is highlighted via a teal accent rail; the
// rest stay slate. Re-run last chip only renders when localStorage has
// a previous Lens dispatch under the user's key.
function VerbChipStrip({ mode, lastLens, onSelect, onReRunLens, onHelp }) {
  const chips = [
    { key: 'lens',     label: 'Lens',     hint: 'Run a new analysis' },
    { key: 'library',  label: 'Library',  hint: 'Saved portfolio' },
    { key: 'compare',  label: 'Compare',  hint: 'Side-by-side' },
    { key: 'glossary', label: 'Glossary', hint: 'Term reference' },
  ]
  return (
    <div
      className="flex items-center gap-1 px-3 py-2 border-b shrink-0 overflow-x-auto"
      style={{ borderColor: '#E2E8F0', background: '#FAFBFC' }}
    >
      {chips.map((c) => {
        const active = c.key === 'lens' && mode === 'lens'
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            title={c.hint}
            className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-sm transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
            style={
              active
                ? { background: '#0F766E', color: 'white', border: '1px solid #0F766E' }
                : { background: 'white', color: '#475569', border: '1px solid #E2E8F0' }
            }
          >
            {c.label}
          </button>
        )
      })}
      {lastLens && lastLens.path && (
        <button
          type="button"
          onClick={onReRunLens}
          title={`Re-run last Lens — ${lastLens.label || 'most recent'}`}
          className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-sm transition-colors shrink-0 ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 flex items-center gap-1.5"
          style={{ background: 'white', color: '#0F766E', border: '1px solid rgba(20,184,166,0.45)' }}
        >
          <span aria-hidden="true">↻</span>
          <span className="truncate max-w-[180px]">Re-run {lastLens.label || 'last'}</span>
        </button>
      )}
      {/* Help button — dispatches a custom event the KeyboardShortcuts
          dialog listens for. Anchored to the right edge so the chip
          strip reads "verbs on the left · ↻ re-run · ? help on the right". */}
      <button
        type="button"
        onClick={onHelp}
        title="Command reference (Cmd-K commands + keyboard shortcuts)"
        aria-label="Open command reference"
        className={`cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] font-semibold w-7 h-7 rounded-sm transition-colors shrink-0 ${lastLens && lastLens.path ? '' : 'ml-auto'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 flex items-center justify-center`}
        style={{ background: 'white', color: '#475569', border: '1px solid #E2E8F0' }}
      >
        ?
      </button>
    </div>
  )
}
