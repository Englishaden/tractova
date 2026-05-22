import { motion, useReducedMotion } from 'motion/react'
import { useRef } from 'react'

// House scroll-reveal — fades + rises + SHARPENS its children the first time
// they scroll into view, then never again (viewport once:true).
//
// Motion language modeled on the premium "tech" reveals Aden flagged in the
// Godly inspiration reel (Browser Company / "humanity transcends" / AIR /
// Linear-class sites). The earlier take popped in too fast and read cheap;
// the fix that makes it feel high-end is the CURVE + duration, not the travel:
//
//   - expo-out [0.16, 1, 0.3, 1] over 0.8s: ~80% of the motion happens in the
//     first ~0.2s, then a long, soft settle. Reads refined and unhurried, and
//     never feels laggy even when a section is already centered by the time it
//     triggers (the visible travel is front-loaded).
//   - blur(10px) → 0 ("sharpen-in"): the signature premium-tech tell — content
//     resolves into focus as it lands. Cleared imperatively on completion so
//     no filter layer lingers over the dense report (keeps text crisp + cheap).
//
// once:true is deliberate: the Lens result is a report a developer re-reads
// and scrubs through, so re-triggering on every scroll-up would be maddening.
// Reduced-motion renders children with no animation at all.
export const HOUSE_EASE = [0.16, 1, 0.3, 1]

export default function Reveal({ children, delay = 0, y = 28, amount = 0.18, className }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  if (reduce) return className ? <div className={className}>{children}</div> : <>{children}</>
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, delay, ease: HOUSE_EASE, opacity: { duration: 0.6, delay } }}
      onAnimationComplete={() => { if (ref.current) ref.current.style.filter = '' }}
    >
      {children}
    </motion.div>
  )
}
