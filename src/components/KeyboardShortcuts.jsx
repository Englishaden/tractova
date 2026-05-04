import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'motion/react'

// Global keyboard shortcuts + the cheat-sheet help dialog (Site-walk J1).
//
// Bindings:
//   Cmd/Ctrl+K  — open Command Palette (handled in CommandPalette.jsx, listed here for the sheet)
//   Cmd/Ctrl+L  — go to Lens (/search). Overrides browser "focus URL bar"
//                 by design — Aden's explicit request. Skipped when typing
//                 in an input/textarea/contenteditable so it doesn't fight
//                 with form fields.
//   Cmd/Ctrl+/  — toggle this help dialog
//   ?           — toggle this help dialog (no modifier; only when not focused
//                 in an input)
//   g + d       — Dashboard
//   g + l       — Lens
//   g + b       — liBrary
//   g + g       — Glossary
//   g + p       — Profile
//
// "g + key" follows the GitHub / Linear vim-style two-key pattern: press g
// to enter pending-mode (~1.5s window), then press the second key. Stays
// idle if the timeout elapses.

const SHORTCUTS = [
  { keys: ['Cmd/Ctrl', 'K'], label: 'Command Palette' },
  { keys: ['Cmd/Ctrl', 'L'], label: 'Lens' },
  { keys: ['Cmd/Ctrl', '/'], label: 'Show shortcuts' },
  { keys: ['?'],             label: 'Show shortcuts (no modifier)' },
  { keys: ['g', 'd'],        label: 'Dashboard' },
  { keys: ['g', 'l'],        label: 'Lens' },
  { keys: ['g', 'b'],        label: 'Library' },
  { keys: ['g', 'g'],        label: 'Glossary' },
  { keys: ['g', 'p'],        label: 'Profile' },
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
  // gPending tracks whether the user just pressed "g" and is mid-chord.
  // Stored as ref + state so the timer can clear cleanly on unmount.
  const gPendingRef = useRef(false)
  const gTimerRef = useRef(null)

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
                className="fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-md -translate-x-1/2 rounded-xl bg-white shadow-2xl outline-hidden overflow-hidden"
                style={{ border: '1px solid #E2E8F0' }}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <div className="h-[3px] w-full" style={{ background: '#14B8A6' }} />
                <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: '#E2E8F0' }}>
                  <RadixDialog.Title className="font-serif text-lg font-semibold text-ink leading-tight">
                    Keyboard Shortcuts
                  </RadixDialog.Title>
                  <RadixDialog.Description className="text-xs text-ink-muted mt-0.5">
                    Power-user navigation. Press <kbd className="px-1 py-0.5 rounded-sm border border-gray-300 font-mono text-[10px]">?</kbd> any time to reopen.
                  </RadixDialog.Description>
                </div>
                <ul className="px-5 py-3 max-h-[60vh] overflow-y-auto">
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
                <div
                  className="px-5 py-2 border-t flex items-center justify-between text-[10px] font-mono text-ink-muted"
                  style={{ borderColor: '#E2E8F0', background: '#F9FAFB' }}
                >
                  <span>g-prefix: press <kbd className="px-1 rounded-sm border border-gray-300">g</kbd> then a key within ~1.2s</span>
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
