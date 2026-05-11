import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Fixed bottom-right floating ⌘K cue. Phase 1 of TRACTOVA-UX-001.
//
// Not a button — chrome. A small mono chip that signals "this software
// has keyboard shortcuts." Bloomberg-class restraint: 1px teal hairline,
// navy ink, fades to ~30% opacity after a few seconds of inactivity.
// Click dispatches the same hotkey CommandPalette listens for, so it
// works as a tap-to-open affordance on touch devices where ⌘K isn't
// reachable. Label adapts: ⌘K on Mac, Ctrl K on PC, TAP on touch.

function detectPlatform() {
  if (typeof navigator === 'undefined') return { isMac: false, showTap: false }
  const ua = navigator.userAgent || ''
  const isMac = /Mac|iPhone|iPod|iPad/.test(ua)
  // Mobile detection via UA only. We deliberately don't use
  // navigator.maxTouchPoints / 'ontouchstart' here — many Windows laptops
  // (Precision Touchpad, touch-screen Surface, etc.) report touch
  // capability but still want the keyboard shortcut affordance. Only
  // phones + tablets running mobile browsers should get "TAP".
  const showTap = /Mobi|Android|iPhone|iPod/i.test(ua) ||
                  // iPad on iPadOS 13+ reports as Mac in UA but is touch-only;
                  // distinguish via the explicit iPad string or the
                  // Mac+touch-only combination.
                  (/iPad/i.test(ua)) ||
                  (isMac && navigator.maxTouchPoints > 1)
  return { isMac, showTap }
}

const IDLE_MS = 5000

export default function CmdKHint() {
  const { user } = useAuth()
  const [idle, setIdle] = useState(false)
  const [platform] = useState(detectPlatform)

  // Idle fade — reset on any user motion, fade after 5s of stillness. The
  // chip is a calm reminder, not a hover trap; fading it keeps the corner
  // visually quiet during deep work.
  useEffect(() => {
    let timer
    const armTimer = () => {
      clearTimeout(timer)
      setIdle(false)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    armTimer()
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(ev => window.addEventListener(ev, armTimer, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach(ev => window.removeEventListener(ev, armTimer))
    }
  }, [])

  const openPalette = () => {
    // Mirror CommandPalette's hotkey listener so platform shortcut + click
    // share one code path.
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))
    } catch { /* SSR-safe */ }
  }

  const keyLabel = platform.showTap
    ? 'TAP'
    : platform.isMac ? '⌘K' : 'Ctrl K'

  // The hint is only useful to signed-in users — the palette indexes
  // saved projects, recents, and verbs that all require auth state.
  if (!user) return null

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Open command palette"
      // Hide on small screens — the Nav already exposes a Cmd-K button on
      // mobile and the chip would crowd the footer. md+ only.
      className="hidden md:flex fixed bottom-4 right-4 z-40 items-center gap-2 rounded-md px-2.5 py-1.5 transition-all duration-300 ease-out group"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)',
        border: '1px solid #14B8A6',
        boxShadow: '0 1px 0 rgba(15,118,110,0.08), 0 4px 12px rgba(10,24,40,0.06)',
        opacity: idle ? 0.32 : 1,
      }}
    >
      <span
        className="eyebrow-mono"
        style={{ color: '#5A6B7A' }}
      >COMMAND</span>
      <span
        aria-hidden="true"
        className="font-mono font-bold text-[11px] leading-none px-1.5 py-1 rounded-sm tabular-nums"
        style={{
          color: '#0F1A2E',
          background: 'rgba(20,184,166,0.10)',
          border: '1px solid rgba(15,118,110,0.18)',
          letterSpacing: keyLabel.length > 3 ? '0.04em' : '0.06em',
        }}
      >{keyLabel}</span>
    </button>
  )
}
