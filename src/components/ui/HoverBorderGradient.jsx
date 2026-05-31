import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// HoverBorderGradient — a teal border sheen that sweeps the perimeter on hover
// (JSX port of the Aceternity pattern, re-themed to our tokens). A conic-gradient
// layer sits behind the content; the content's own solid background masks all but
// the 1px padding ring, so only the border lights up. At rest it's a quiet static
// hairline; on hover the sheen rotates. Reduced-motion → static border, no spin.
//
// Usage (wrap any element; keep the real interactive element as the child so
// onClick/aria stay intact):
//   <HoverBorderGradient containerClassName="w-full">
//     <button …>Run a Lens</button>
//   </HoverBorderGradient>

export default function HoverBorderGradient({ children, containerClassName = '', radius = 8 }) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative p-px overflow-hidden ${containerClassName}`}
      style={{ borderRadius: radius }}
    >
      {/* rotating sheen — only visible/animated on hover */}
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-[-150%] z-0 pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(94,234,212,0.95) 35deg, transparent 80deg)' }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={hovered ? { rotate: 360, opacity: 1 } : { rotate: 0, opacity: 0 }}
          transition={hovered ? { rotate: { repeat: Infinity, ease: 'linear', duration: 2.6 }, opacity: { duration: 0.2 } } : { duration: 0.25 }}
        />
      )}
      {/* quiet static hairline at rest */}
      <span aria-hidden="true" className="absolute inset-0 z-0 rounded-[inherit]" style={{ border: '1px solid var(--hairline-teal, rgba(20,184,166,0.30))', borderRadius: radius }} />
      <div className="relative z-10" style={{ borderRadius: radius - 1 }}>
        {children}
      </div>
    </div>
  )
}
