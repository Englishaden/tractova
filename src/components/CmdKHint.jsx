import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Static ⌘K cue. Phase 1 of TRACTOVA-UX-001.
//
// Not a button — chrome. A small mono chip that signals "this software
// has keyboard shortcuts." Bloomberg-class restraint: 1px teal hairline,
// navy ink. Click dispatches the same hotkey CommandPalette listens for,
// so it works as a tap-to-open affordance on touch devices where ⌘K isn't
// reachable. Label adapts: ⌘K on Mac, Ctrl K on PC, TAP on touch.
//
// Placement (Aden 2026-05-29): the chip used to float fixed bottom-right
// and track the footer per scroll-frame, which read as "bouncing." It now
// renders statically inside the footer — anchored just above the
// "© <year> Tractova" line, in the margin gap above the footer's top
// border so it never overlaps the links row. Mounted by Footer.jsx (not a
// global fixed overlay anymore).

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
                  (/iPad/i.test(ua)) ||
                  (isMac && navigator.maxTouchPoints > 1)
  return { isMac, showTap }
}

export default function CmdKHint() {
  const { user } = useAuth()
  const [platform] = useState(detectPlatform)

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
      // Anchored to the footer (position: relative). Parks in the margin
      // gap just above the footer's top border, right-aligned over the
      // "© Tractova" cluster. md+ only — the Nav already exposes a Cmd-K
      // button on mobile and the chip would crowd the stacked footer.
      className="hidden md:flex absolute right-6 -top-6 z-20 items-center gap-2 rounded-md px-2.5 py-1.5 transition-shadow group"
      style={{
        // Solid white background — no glassmorphism (design-vocab
        // anti-pattern). The chip is chrome, not a translucent layer.
        background: '#FFFFFF',
        border: '1px solid #14B8A6',
        boxShadow: '0 1px 0 rgba(15,118,110,0.08), 0 4px 12px rgba(10,24,40,0.10)',
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
