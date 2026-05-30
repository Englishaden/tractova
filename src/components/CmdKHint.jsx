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
// Position (Aden 2026-05-30, third pass): it must "move with the scroll but
// not jump around." The earlier footer-CLAMP recomputed `bottom` every
// scroll frame and lifted the chip as the footer approached — that lift WAS
// the bounce. So now the chip is a plain position:fixed element at a CONSTANT
// bottom (CSS handles the scroll-follow — zero JS per frame, zero jitter).
// To avoid sitting on top of the footer at the very bottom, it simply FADES
// out (opacity, smooth) once the footer scrolls into view — detected with an
// IntersectionObserver, so there's still no per-frame work. Its right edge is
// aligned (on resize only) to the max-w content container so it rests above
// the "© Tractova" cluster.

const CONTAINER_MAX = 1440 // --container-dashboard
const SIDE_PAD = 24        // px-6 on the content container
const BOTTOM = 16          // constant rest distance from the viewport bottom

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
  // Right offset only — recomputed on resize, never on scroll (so no
  // per-frame React work, hence no bounce).
  const [right, setRight] = useState(SIDE_PAD)
  // Faded when the footer is in view, so the chip never overlaps it.
  const [nearFooter, setNearFooter] = useState(false)

  useEffect(() => {
    const computeRight = () => {
      const sideMargin = Math.max(0, (window.innerWidth - CONTAINER_MAX) / 2)
      setRight(Math.round(sideMargin + SIDE_PAD))
    }
    computeRight()
    window.addEventListener('resize', computeRight, { passive: true })
    return () => window.removeEventListener('resize', computeRight)
  }, [])

  // Fade the chip out as the footer approaches — IntersectionObserver fires
  // only on enter/leave, not every frame. rootMargin extends the root 24px
  // past the viewport bottom so the fade gets a head start before overlap.
  useEffect(() => {
    if (!user) return
    const footer = document.querySelector('footer')
    if (!footer || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setNearFooter(entry.isIntersecting),
      { root: null, rootMargin: '0px 0px 24px 0px', threshold: 0 },
    )
    io.observe(footer)
    return () => io.disconnect()
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
      aria-hidden={nearFooter}
      tabIndex={nearFooter ? -1 : 0}
      // md+ only — the Nav already exposes a Cmd-K button on mobile and the
      // chip would crowd the stacked footer. Only `opacity` animates.
      className="hidden md:flex fixed z-40 items-center gap-2 rounded-md px-2.5 py-1.5 transition-opacity duration-300 ease-out group"
      style={{
        // Solid white background — no glassmorphism (design-vocab
        // anti-pattern). The chip is chrome, not a translucent layer.
        background: '#FFFFFF',
        border: '1px solid #14B8A6',
        boxShadow: '0 1px 0 rgba(15,118,110,0.08), 0 4px 12px rgba(10,24,40,0.10)',
        bottom: BOTTOM,
        right,
        opacity: nearFooter ? 0 : 1,
        pointerEvents: nearFooter ? 'none' : 'auto',
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
