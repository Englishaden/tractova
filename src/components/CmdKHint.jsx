import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Floating ⌘K cue. Phase 1 of TRACTOVA-UX-001.
//
// Not a button — chrome. A small mono chip that signals "this software
// has keyboard shortcuts." Bloomberg-class restraint: 1px teal hairline,
// navy ink. Click dispatches the same hotkey CommandPalette listens for,
// so it works as a tap-to-open affordance on touch devices where ⌘K isn't
// reachable. Label adapts: ⌘K on Mac, Ctrl K on PC, TAP on touch.
//
// Position (Aden 2026-05-30): position:fixed so it FOLLOWS the viewport as
// you scroll (no per-content jumping), but its bottom is CLAMPED so it never
// drops into / overlaps the footer — once the footer scrolls into view the
// chip rests just above it. Right edge is aligned to the max-w content
// container so at rest it sits above the "© Tractova" cluster. There is
// deliberately NO CSS transition on `bottom`: the clamp tracks scroll 1:1,
// which reads as the chip anchoring to the page near the bottom rather than
// easing (an easing transition fought the per-frame updates = the old
// "bounce"). Opacity is the only animated property.

const CONTAINER_MAX = 1440 // --container-dashboard
const SIDE_PAD = 24        // px-6 on the content container
const GAP = 16             // breathing room above the footer / viewport edge

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
  const [pos, setPos] = useState({ bottom: GAP, right: SIDE_PAD })

  // Track position against scroll + resize. bottom lifts to clear the footer
  // once it enters the viewport; right aligns to the centered content edge.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      const vw = window.innerWidth
      // Horizontal: sit above the content container's right padding edge.
      const sideMargin = Math.max(0, (vw - CONTAINER_MAX) / 2)
      const right = Math.round(sideMargin + SIDE_PAD)
      // Vertical: rest at GAP from the viewport bottom; when the footer comes
      // into view, lift so the chip parks GAP above the footer's top edge.
      const footer = document.querySelector('footer')
      let bottom = GAP
      if (footer) {
        const top = footer.getBoundingClientRect().top
        bottom = Math.max(GAP, Math.round(vh - top + GAP))
      }
      setPos((prev) => (prev.bottom === bottom && prev.right === right ? prev : { bottom, right }))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [user])

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
      // md+ only — the Nav already exposes a Cmd-K button on mobile and the
      // chip would crowd the stacked footer. No transition on `bottom`
      // (see file header); the chip just re-renders per scroll frame.
      className="hidden md:flex fixed z-40 items-center gap-2 rounded-md px-2.5 py-1.5 group"
      style={{
        // Solid white background — no glassmorphism (design-vocab
        // anti-pattern). The chip is chrome, not a translucent layer.
        background: '#FFFFFF',
        border: '1px solid #14B8A6',
        boxShadow: '0 1px 0 rgba(15,118,110,0.08), 0 4px 12px rgba(10,24,40,0.10)',
        bottom: pos.bottom,
        right: pos.right,
      }}
    >
      <span className="eyebrow-mono" style={{ color: '#5A6B7A' }}>COMMAND</span>
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
