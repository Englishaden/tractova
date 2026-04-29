import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'motion/react'
import { getStateProgramMap } from '../lib/programData'

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
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // Lazy-load states once on mount
  useEffect(() => {
    getStateProgramMap().then(setStateMap).catch(() => {})
  }, [])

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
    const all = [...NAV_ROUTES.map(r => ({ kind: 'nav', ...r })), ...states]
    if (!q.trim()) return all.slice(0, 12)
    const needle = q.trim().toLowerCase()
    return all
      .filter(it => it.label.toLowerCase().includes(needle) || it.hint?.toLowerCase().includes(needle))
      .slice(0, 16)
  }, [q, stateMap])

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
                className="fixed left-1/2 top-[20%] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-2xl outline-none overflow-hidden"
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
                    className="flex-1 bg-transparent text-sm text-ink placeholder-gray-400 outline-none"
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
                                className="font-mono text-[9px] uppercase tracking-[0.20em] flex-shrink-0 w-12"
                                style={{ color: it.kind === 'state' ? '#0F766E' : '#5A6B7A' }}
                              >
                                {it.kind === 'state' ? 'State' : 'Page'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-serif text-sm font-semibold text-ink leading-tight truncate">{it.label}</p>
                                {it.hint && (
                                  <p className="text-[11px] text-ink-muted truncate">{it.hint}</p>
                                )}
                              </div>
                              {it.score != null && (
                                <span
                                  className="font-mono text-xs font-bold tabular-nums flex-shrink-0"
                                  style={{ color: it.score >= 60 ? '#0F766E' : '#5A6B7A' }}
                                >
                                  {it.score}
                                </span>
                              )}
                              {active && (
                                <svg className="flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                    <span><span className="px-1 py-0.5 rounded border border-gray-300">↑↓</span> navigate</span>
                    <span><span className="px-1 py-0.5 rounded border border-gray-300">↵</span> open</span>
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
