import { motion, useReducedMotion } from 'motion/react'

// Scroll-reveal wrapper — fades + rises its children in the FIRST time they
// scroll into view, then never again (viewport once:true). The once-only
// behavior is deliberate: the Lens result is a dense report a developer
// re-reads and scrubs through, so re-triggering on every scroll-up would be
// maddening. Reduced-motion renders children with no animation at all.
//
// House-motion primitive — shared across surfaces so the whole app reveals
// with one consistent easing + feel.
export default function Reveal({ children, delay = 0, y = 16, amount = 0.15, className }) {
  const reduce = useReducedMotion()
  if (reduce) return className ? <div className={className}>{children}</div> : <>{children}</>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
