// Phase 0 — Motion primitives for the Tractova UI/UX overhaul.
//
// Five reusable motion components that downstream phases compose into
// gauge fills, section reveals, page transitions, and hover micro-
// interactions. Every primitive short-circuits to its final/static state
// when the user has `prefers-reduced-motion: reduce` set, matching the
// IntelligenceBackground contract.
//
// Why these five:
//   - PageTransition: smooth route changes (motion as a design material)
//   - RevealOnScroll: section-by-section appearance, staggered children
//   - HoverLift: card + chip micro-interactions, Linear-class polish
//   - CountUp: animated tabular numerics for score reveals
//   - GaugeFill: svg stroke-dashoffset for ArcGauge / ScoreGauge

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────
// PageTransition — fade + 8px slide on route change.
//
// Wraps <Routes> in App.jsx. Keyed on pathname so AnimatePresence sees a
// new child per route. exitBeforeEnter for non-overlapping transitions.
// Suspense MUST mount inside this wrapper so lazy routes don't double-
// mount during the transition.
// ─────────────────────────────────────────────────────────────────────────
export function PageTransition({ children }) {
  const location = useLocation()
  const reduced = useReducedMotion()
  if (reduced) return <div key={location.pathname}>{children}</div>
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// RevealOnScroll — fade in + 12px lift on first viewport entry.
//
// Uses IntersectionObserver; fires once per mount. Stagger children by
// passing `delay={index * 0.06}` from the parent. Honors reduced-motion
// by rendering immediately without animation.
// ─────────────────────────────────────────────────────────────────────────
export function RevealOnScroll({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (reduced) { setVisible(true); return }
    if (!ref.current) return
    const el = ref.current
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.unobserve(el)
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const MotionTag = motion[Tag] || motion.div
  return (
    <MotionTag
      ref={ref}
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </MotionTag>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// HoverLift — translateY + shadow deepen on hover.
//
// Wraps a card or button. Honors reduced-motion by being a no-op wrapper.
// Use sparingly: layout-affecting transforms on dense grids look noisy.
// ─────────────────────────────────────────────────────────────────────────
export function HoverLift({ children, lift = 2, className = '', as: Tag = 'div' }) {
  const reduced = useReducedMotion()
  if (reduced) {
    const Component = Tag
    return <Component className={className}>{children}</Component>
  }
  const MotionTag = motion[Tag] || motion.div
  return (
    <MotionTag
      className={className}
      whileHover={{ y: -lift, boxShadow: '0 6px 16px -8px rgba(15,23,42,0.12)' }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CountUp — animate a numeric value from 0 (or fromValue) to value.
//
// 700ms default duration with ease-out so the final value lands
// definitively. Renders as tabular-nums so digit width doesn't shift.
// Reduced-motion users see the final value immediately.
// ─────────────────────────────────────────────────────────────────────────
export function CountUp({ value, duration = 700, fromValue = 0, decimals = 0, suffix = '', className = '' }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : fromValue)
  const targetRef = useRef(value)

  useEffect(() => {
    targetRef.current = value
    if (reduced || value == null || !Number.isFinite(value)) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const startVal = display
    let raf = 0
    const tick = (now) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = startVal + (targetRef.current - startVal) * eased
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // intentionally not depending on `display` to avoid re-firing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced])

  if (value == null || !Number.isFinite(value)) return <span className={className}>—</span>
  const rounded = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()
  return <span className={`tabular-nums ${className}`}>{rounded}{suffix}</span>
}

// ─────────────────────────────────────────────────────────────────────────
// useFirstVisible — IntersectionObserver hook that flips visible=true once
// when the element enters the viewport, then disconnects. Reused by the
// Phase 4 gauges (ArcGauge / MiniArcGauge / ScoreGauge) to gate the fill
// animation on first reveal — otherwise the arc animates every time the
// component re-renders (e.g. on score change), which feels twitchy and
// burns frames. Reduced-motion users always read visible=true so they
// skip the gating entirely and see the final state immediately.
// ─────────────────────────────────────────────────────────────────────────
export function useFirstVisible(ref, { threshold = 0.15, rootMargin = '0px' } = {}) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (reduced) { setVisible(true); return }
    if (!ref.current) return
    const el = ref.current
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.unobserve(el)
      }
    }, { threshold, rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, reduced, threshold, rootMargin])
  return visible
}

// ─────────────────────────────────────────────────────────────────────────
// GaugeFill — animate an SVG arc by interpolating stroke-dashoffset.
//
// Wraps an existing <circle> or <path> element pattern; the consumer
// provides totalLength (computed via getTotalLength on the arc) and the
// target fillPct (0-1). The component animates stroke-dashoffset from
// totalLength (empty) to (1-fillPct)*totalLength.
//
// Designed to be composed inside ArcGauge / ScoreGauge / MiniArcGauge in
// Phase 4 — for now the primitive is exported and unit-testable in
// isolation.
// ─────────────────────────────────────────────────────────────────────────
export function GaugeFill({ totalLength, fillPct, duration = 900, children }) {
  const reduced = useReducedMotion()
  const finalOffset = totalLength * (1 - Math.max(0, Math.min(1, fillPct)))
  if (reduced) {
    return <g style={{ strokeDasharray: totalLength, strokeDashoffset: finalOffset }}>{children}</g>
  }
  return (
    <motion.g
      initial={{ strokeDashoffset: totalLength }}
      animate={{ strokeDashoffset: finalOffset }}
      transition={{ duration: duration / 1000, ease: [0.22, 1, 0.36, 1] }}
      style={{ strokeDasharray: totalLength }}
    >
      {children}
    </motion.g>
  )
}
