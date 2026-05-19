import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'motion/react'

// Global keyboard shortcuts + the cheat-sheet help dialog (Site-walk J1).
//
// Bindings:
//   Cmd/Ctrl+K        — open Command Palette
//   Cmd/Ctrl+Shift+L  — open palette in Lens form mode (structured State /
//                       County / MW / Tech / Stage fields). Avoids the
//                       browser address-bar conflict on plain Cmd-L.
//   Cmd/Ctrl+L        — navigate to /search (the full Lens page). Overrides
//                       browser "focus URL bar" by design — Aden's explicit
//                       request. Skipped when typing in an input.
//   Cmd/Ctrl+/        — toggle this help dialog
//   ?                 — toggle this help dialog (no modifier; only when
//                       not focused in an input)
//   g + d/l/b/g/p     — vim-style two-key navigation
//
// "g + key" follows the GitHub / Linear two-key pattern: press g to enter
// pending-mode (~1.2s window), then press the second key.
//
// The dialog also opens from inside the Cmd-K palette via the "?" button —
// CommandPalette dispatches `tractova:open-shortcuts` which we listen for.

const SHORTCUTS = [
  { keys: ['Cmd/Ctrl', 'K'],         label: 'Open Command Palette' },
  { keys: ['Cmd/Ctrl', 'Shift', 'L'], label: 'Open palette → Lens form' },
  { keys: ['Cmd/Ctrl', 'L'],         label: 'Go to Lens page (/search)' },
  { keys: ['Cmd/Ctrl', '/'],         label: 'Show this help' },
  { keys: ['?'],                     label: 'Show this help (no modifier)' },
  { keys: ['g', 'd'],                label: 'Dashboard' },
  { keys: ['g', 'l'],                label: 'Lens' },
  { keys: ['g', 'b'],                label: 'Library' },
  { keys: ['g', 'g'],                label: 'Glossary' },
  { keys: ['g', 'p'],                label: 'Profile' },
]

// Command palette verbs — the colon-shorthand power-user grammar, plus
// the equivalent chip / hotkey for users who can't (or shouldn't have to)
// memorize them. Each row is what shows in the Commands tab of the help
// dialog: invocation methods + an example + a short rationale.
const COMMANDS = [
  {
    verb: ':lens',
    label: 'Run a new Lens',
    syntax: ':lens <STATE> [<MW>] [<TECH>]',
    example: ':lens MA 5 CS',
    invoke: 'Lens chip · Cmd-Shift-L · or type :lens',
    body: 'Opens a structured State / County / MW / Tech / Stage form inside the palette. Pre-fills any args you typed in shorthand. Tech codes: CS = Community Solar, CI = C&I Solar, BESS = Battery Storage, HYB = Hybrid.',
  },
  {
    verb: ':compare',
    label: 'Open the Compare tray',
    syntax: ':compare [<NAME>]',
    example: ':compare anchor 5MW',
    invoke: 'Compare chip · or type :compare',
    body: 'Opens the side-by-side compare modal. With a name fragment, narrows to saved comparisons matching the text.',
  },
  {
    verb: ':portfolio',
    label: 'Go to Library',
    syntax: ':portfolio',
    example: ':portfolio',
    invoke: 'Library chip · g then b · or type :portfolio',
    body: 'Opens your saved projects portfolio.',
  },
  {
    verb: ':scenarios',
    label: 'Library — Scenarios tab',
    syntax: ':scenarios',
    example: ':scenarios',
    invoke: 'type :scenarios',
    body: 'Jumps directly to the Scenarios tab inside the Library — your saved Scenario Studio snapshots.',
  },
  {
    verb: ':rerun',
    label: 'Re-run a saved project',
    syntax: ':rerun <PROJECT NAME>',
    example: ':rerun Norfolk 5MW',
    invoke: 'type :rerun',
    body: 'Re-runs a saved project as a fresh Lens with the current data refresh state.',
  },
  {
    verb: ':gloss',
    label: 'Jump to glossary term',
    syntax: ':gloss <TERM>',
    example: ':gloss feasibility index',
    invoke: 'Glossary chip · type :gloss',
    body: 'Opens the Glossary anchored to a specific term.',
  },
  {
    verb: ':state',
    label: 'State snapshot on Dashboard',
    syntax: ':state <ID>',
    example: ':state IL',
    invoke: 'type :state',
    body: 'Dashboard view focused on a single state — programs, IX queue, recent policy events.',
  },
  {
    verb: ':new',
    label: 'New Lens (clear form)',
    syntax: ':new',
    example: ':new',
    invoke: 'type :new',
    body: 'Clears the current Lens form and returns to a fresh search state.',
  },
  {
    verb: '↻ Re-run',
    label: 'Re-run the last Lens',
    syntax: 'palette chip',
    example: '↻ Re-run MA · Norfolk · 5 MW',
    invoke: 'Re-run chip in palette (shows your last Lens)',
    body: 'One-click replay of the most recent palette-dispatched Lens. Stored in localStorage per user.',
  },
]

// Heuristic: skip shortcuts when the user is typing into a form field.
// Without this every keystroke in the Lens form / Scenario Studio sliders
// would be interpreted as a navigation command.
function isTypingTarget(target) {
  if (!target) return false
  const tag = target.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)
  // Tab inside the dialog — 'shortcuts' (keyboard navigation) or 'commands'
  // (Cmd-K verb reference). Defaults to commands since that's the harder-to-
  // memorize surface and the more frequently-asked help question.
  const [helpTab, setHelpTab] = useState('commands')
  // gPending tracks whether the user just pressed "g" and is mid-chord.
  // Stored as ref + state so the timer can clear cleanly on unmount.
  const gPendingRef = useRef(false)
  const gTimerRef = useRef(null)

  // Cross-component trigger: CommandPalette's "?" help button dispatches
  // `tractova:open-shortcuts` (optionally with a tab name) so the palette
  // can summon this dialog without sharing state through context.
  useEffect(() => {
    const onOpenShortcuts = (e) => {
      const tab = e?.detail?.tab
      if (tab === 'shortcuts' || tab === 'commands') setHelpTab(tab)
      setHelpOpen(true)
    }
    window.addEventListener('tractova:open-shortcuts', onOpenShortcuts)
    return () => window.removeEventListener('tractova:open-shortcuts', onOpenShortcuts)
  }, [])

  useEffect(() => {
    const clearGPending = () => {
      gPendingRef.current = false
      if (gTimerRef.current) {
        clearTimeout(gTimerRef.current)
        gTimerRef.current = null
      }
    }

    const onKey = (e) => {
      // Always allow help-dialog toggle even from inputs (Cmd/Ctrl+/) so
      // users can summon the cheat sheet from any context.
      const cmdOrCtrl = e.metaKey || e.ctrlKey
      if (cmdOrCtrl && e.key === '/') {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }

      // Below shortcuts: only when not typing into a field.
      if (isTypingTarget(e.target)) return

      // Cmd/Ctrl + L → Lens (override browser URL-bar focus).
      if (cmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        navigate('/search')
        return
      }

      // ? (without modifier) → toggle help.
      if (!cmdOrCtrl && e.key === '?') {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }

      // ESC closes help dialog if it's open.
      if (e.key === 'Escape' && helpOpen) {
        setHelpOpen(false)
        return
      }

      // Two-key g-prefix navigation.
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey) {
        if (gPendingRef.current) {
          // Second key in chord — resolve immediately.
          const k = e.key.toLowerCase()
          let path = null
          if (k === 'd') path = '/'
          else if (k === 'l') path = '/search'
          else if (k === 'b') path = '/library'
          else if (k === 'g') path = '/glossary'
          else if (k === 'p') path = '/profile'
          clearGPending()
          if (path) {
            e.preventDefault()
            navigate(path)
          }
          return
        }
        if (e.key === 'g' || e.key === 'G') {
          // Enter pending mode for ~1.2s.
          e.preventDefault()
          gPendingRef.current = true
          if (gTimerRef.current) clearTimeout(gTimerRef.current)
          gTimerRef.current = setTimeout(clearGPending, 1200)
          return
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearGPending()
    }
  }, [navigate, helpOpen])

  return (
    <RadixDialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
      <AnimatePresence>
        {helpOpen && (
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
                className="fixed left-1/2 top-[12%] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-2xl outline-hidden overflow-hidden flex flex-col"
                style={{ border: '1px solid #E2E8F0', maxHeight: '80vh' }}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <div className="h-[3px] w-full shrink-0" style={{ background: '#14B8A6' }} />
                <div className="px-5 pt-4 pb-2 border-b shrink-0" style={{ borderColor: '#E2E8F0' }}>
                  <RadixDialog.Title className="font-serif text-lg font-semibold text-ink leading-tight">
                    Reference
                  </RadixDialog.Title>
                  <RadixDialog.Description className="text-xs text-ink-muted mt-0.5">
                    Every command + shortcut. Press <kbd className="px-1 py-0.5 rounded-sm border border-gray-300 font-mono text-[10px]">?</kbd> any time to reopen.
                  </RadixDialog.Description>
                  {/* Tab nav */}
                  <div role="tablist" className="flex items-center gap-0 mt-3 -mb-px">
                    <HelpTabButton active={helpTab === 'commands'} onClick={() => setHelpTab('commands')}>
                      Cmd-K commands
                    </HelpTabButton>
                    <HelpTabButton active={helpTab === 'shortcuts'} onClick={() => setHelpTab('shortcuts')}>
                      Keyboard shortcuts
                    </HelpTabButton>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
                  {helpTab === 'commands' ? (
                    <ul className="space-y-3">
                      {COMMANDS.map((c, i) => (
                        <li
                          key={i}
                          className="rounded-md px-3 py-2.5"
                          style={{ background: '#FAFBFC', border: '1px solid #E2E8F0' }}
                        >
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-mono text-[12px] font-bold" style={{ color: '#0F1A2E' }}>{c.verb}</span>
                              <span className="font-serif text-[13px] font-semibold text-ink">{c.label}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-ink-muted leading-snug mb-1.5">{c.body}</p>
                          <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 text-[10px] font-mono">
                            <span className="text-gray-400 uppercase tracking-[0.16em]">Syntax</span>
                            <span className="text-ink">{c.syntax}</span>
                            <span className="text-gray-400 uppercase tracking-[0.16em]">Example</span>
                            <span className="text-ink">{c.example}</span>
                            <span className="text-gray-400 uppercase tracking-[0.16em]">Invoke</span>
                            <span className="text-ink">{c.invoke}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul>
                      {SHORTCUTS.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between py-1.5 border-b last:border-b-0"
                          style={{ borderColor: '#F1F5F9' }}
                        >
                          <span className="text-sm text-ink">{s.label}</span>
                          <span className="flex items-center gap-1">
                            {s.keys.map((k, j) => (
                              <kbd
                                key={j}
                                className="px-1.5 py-0.5 rounded-sm border border-gray-300 font-mono text-[11px] text-ink bg-white"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div
                  className="px-5 py-2 border-t flex items-center justify-between text-[10px] font-mono text-ink-muted shrink-0"
                  style={{ borderColor: '#E2E8F0', background: '#F9FAFB' }}
                >
                  {helpTab === 'shortcuts' ? (
                    <span>g-prefix: press <kbd className="px-1 rounded-sm border border-gray-300">g</kbd> then a key within ~1.2s</span>
                  ) : (
                    <span>Cmd-K opens the palette · click a chip OR type a verb</span>
                  )}
                  <span><kbd className="px-1 rounded-sm border border-gray-300">ESC</kbd></span>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}

// Help-dialog tab button — matches the eyebrow-mono tab pattern used on
// PillarDetailModal + ScenarioStudio. Active gets a navy underline.
function HelpTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 -mb-px transition-colors focus-visible:outline-none focus-visible:bg-gray-50"
      style={{
        color: active ? '#0F1A2E' : '#94A3B8',
        fontWeight: active ? 700 : 500,
        borderBottom: active ? '2px solid #0F1A2E' : '2px solid transparent',
      }}
    >
      {children}
    </button>
  )
}
