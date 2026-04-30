import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'motion/react'
import { getStateProgramMap } from '../lib/programData'
import allCounties from '../data/allCounties.json'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// V3: Global Cmd-K command palette. Power-user shortcut signaling "data
// product, not consumer SaaS". Indexes states + core nav routes; future
// expansion: counties, utilities, saved projects.
//
// Open via Cmd/Ctrl-K (or /? in some clients). Closes on Esc / outside click.

const NAV_ROUTES = [
  { label: 'Dashboard',  hint: 'Map + state intelligence', path: '/' },
  { label: 'Lens',       hint: 'Run a new analysis',       path: '/search' },
  { label: 'Library',    hint: 'Saved projects portfolio', path: '/library' },
  { label: 'Glossary',   hint: 'Industry term reference',  path: '/glossary' },
  { label: 'Profile',    hint: 'Account + alerts',         path: '/profile' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [stateMap, setStateMap] = useState({})
  const [savedProjects, setSavedProjects] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const { user } = useAuth()

  // Lazy-load states once on mount
  useEffect(() => {
    getStateProgramMap().then(setStateMap).catch(() => {})
  }, [])

  // Load saved projects when user authenticates -- enables jump-to-project.
  useEffect(() => {
    if (!user) { setSavedProjects([]); return }
    supabase
      .from('projects')
      .select('id, name, state, county, mw, stage')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (!error && data) setSavedProjects(data)
      })
  }, [user])

  // Flatten counties into searchable items. Lazy-built but cheap (one map +
  // ~3000 rows) so we only do it when the palette opens for the first time.
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

  // Global Cmd/Ctrl-K hotkey
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset on close, focus on open
  useEffect(() => {
    if (open) {
      setQ('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const items = useMemo(() => {
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
    // Default view (no query): nav + states + projects, no counties (too noisy).
    if (!q.trim()) {
      return [
        ...NAV_ROUTES.map(r => ({ kind: 'nav', ...r })),
        ...projects.slice(0, 4),
        ...states.slice(0, 8),
      ].slice(0, 14)
    }
    // Active search: include counties (large set) but rank states + projects first.
    const needle = q.trim().toLowerCase()
    const matchFn = (it) => it.label.toLowerCase().includes(needle) || it.hint?.toLowerCase().includes(needle)
    const navMatch     = NAV_ROUTES.map(r => ({ kind: 'nav', ...r })).filter(matchFn)
    const projectMatch = projects.filter(matchFn)
    const stateMatch   = states.filter(matchFn)
    const countyMatch  = needle.length >= 2 ? countyItems.filter(matchFn).slice(0, 12) : []
    return [...navMatch, ...projectMatch, ...stateMatch, ...countyMatch].slice(0, 18)
  }, [q, stateMap, savedProjects, countyItems])

  // Clamp activeIndex when items change
  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1))
  }, [items.length, activeIndex])

  const select = (it) => {
    setOpen(false)
    if (it.path) navigate(it.path)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[activeIndex]) select(items[activeIndex]) }
  }

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
                className="fixed left-1/2 top-[20%] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-2xl outline-hidden overflow-hidden"
                style={{ border: '1px solid #E2E8F0' }}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <div className="h-[3px] w-full" style={{ background: '#14B8A6' }} />
                <RadixDialog.Title className="sr-only">Command Palette</RadixDialog.Title>
                <RadixDialog.Description className="sr-only">Quick search states and navigation</RadixDialog.Description>

                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#E2E8F0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setActiveIndex(0) }}
                    onKeyDown={onKeyDown}
                    placeholder="Jump to a state, page, or analysis…"
                    className="flex-1 bg-transparent text-sm text-ink placeholder-gray-400 outline-hidden"
                  />
                  <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">ESC</span>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-6">No matches</p>
                  ) : (
                    <ul>
                      {items.map((it, i) => {
                        const active = i === activeIndex
                        return (
                          <li key={`${it.kind}:${it.label}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIndex(i)}
                              onClick={() => select(it)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={{ background: active ? 'rgba(15,118,110,0.08)' : 'transparent' }}
                            >
                              <span
                                className="font-mono text-[9px] uppercase tracking-[0.20em] shrink-0 w-14"
                                style={{
                                  color:
                                    it.kind === 'state'   ? '#0F766E' :
                                    it.kind === 'county'  ? '#14B8A6' :
                                    it.kind === 'project' ? '#0F1A2E' :
                                                            '#5A6B7A',
                                }}
                              >
                                {it.kind === 'state'   ? 'State' :
                                 it.kind === 'county'  ? 'County' :
                                 it.kind === 'project' ? 'Project' : 'Page'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-serif text-sm font-semibold text-ink leading-tight truncate">{it.label}</p>
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
                                <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 6 15 12 9 18"/>
                                </svg>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="px-4 py-2 border-t flex items-center justify-between text-[10px] font-mono text-ink-muted" style={{ borderColor: '#E2E8F0', background: '#F9FAFB' }}>
                  <div className="flex items-center gap-3">
                    <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">↑↓</span> navigate</span>
                    <span><span className="px-1 py-0.5 rounded-sm border border-gray-300">↵</span> open</span>
                  </div>
                  <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
