import { motion, useReducedMotion } from 'motion/react'
import { HOUSE_EASE } from './Reveal'

// Mount entrance — a gentle fade + rise on first render, on the shared
// HOUSE_EASE curve. For above-the-fold blocks that should animate in on load
// (Dashboard + Library top sections). Stagger sibling blocks via `delay`.
// Reduced-motion renders children unwrapped.
//
// Distinct from Reveal / useLensReveal, which are SCROLL-triggered — this one
// fires once on mount, regardless of scroll position.
export default function MountReveal({ children, delay = 0, className }) {
  const reduce = useReducedMotion()
  if (reduce) return className ? <div className={className}>{children}</div> : children
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: HOUSE_EASE }}
    >
      {children}
    </motion.div>
  )
}
