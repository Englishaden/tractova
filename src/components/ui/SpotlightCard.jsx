import { useRef } from 'react'

// SpotlightCard — a subtle cursor-following radial glow behind the content.
// Adapted from Skills/Spotlight Card.md, retuned for our light data surfaces:
// instead of the demo's neon hue-shift + window-fixed background, this tracks
// the pointer LOCAL to the card and paints one faint brand-tinted wash. No
// global listener, no keyframes — so it's cheap and reduced-motion-safe (a
// pointer-follow gradient isn't vestibular motion; nothing animates on its own).
//
// The glow is a backgroundImage layered over the card's own backgroundColor, so
// pass the card's solid bg/border via `style` (radial-gradient edges are
// transparent, letting the base colour show through). Resets off-card on leave.
export default function SpotlightCard({ children, className = '', glow = 'rgba(20,184,166,0.18)', size = 240, style }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  const reset = () => {
    const el = ref.current
    if (el) { el.style.setProperty('--mx', '-200px'); el.style.setProperty('--my', '-200px') }
  }
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`relative ${className}`}
      style={{
        ...style,
        backgroundImage: `radial-gradient(${size}px circle at var(--mx, -200px) var(--my, -200px), ${glow}, transparent 72%)`,
      }}
    >
      {children}
    </div>
  )
}
