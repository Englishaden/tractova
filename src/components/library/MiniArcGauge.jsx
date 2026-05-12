import { useState, useEffect } from 'react'
import { motion, useMotionValue, animate, useReducedMotion } from 'motion/react'

// V3.1 / Phase 3 / Phase 4 — Mini animated arc gauge for the project-bar
// score indicator. Arc + number tween 0 → score on mount.
//
// Phase 4 follow-up: the IntersectionObserver gate that previously
// delayed the animation until the gauge scrolled into view was removed —
// in a long Library Cards list, the scroll-triggered "fresh animation"
// on cards the user hadn't seen yet read as disjointed. All gauges in
// the layout mount at the same time, all start animating together, all
// settle to their final state in under a second. By the time the user
// scrolls past the fold, the off-screen gauges have already finished
// animating in the background; no scroll-in re-animation.
//
// Cubic-bezier tweens (`[0.16, 1, 0.3, 1]` entrance for the arc,
// `[0.22, 1, 0.36, 1]` for the number readout) per design-vocabulary.md
// § Motion. prefers-reduced-motion shows the final state immediately.
// 44×44 footprint.
export default function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
  const target = score ?? 0
  const stroke = score == null ? fallbackColor : color
  const reduced = useReducedMotion()

  // Number readout — tween via motion value. Reduced-motion users get
  // the target immediately; everyone else sees the 0 → target settle.
  const mv = useMotionValue(reduced ? target : 0)
  const [display, setDisplay] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced) { setDisplay(target); return }
    const controls = animate(mv, target, { duration: 0.85, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [target, reduced, mv])
  useEffect(() => mv.on('change', v => setDisplay(Math.round(v))), [mv])

  return (
    <div className="shrink-0 relative" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 36 36" className="-rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="3"
        />
        <motion.path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ strokeDasharray: '0, 100' }}
          animate={{ strokeDasharray: `${target}, 100` }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums leading-none" style={{ color: stroke }}>
        {score == null ? '—' : display}
      </span>
    </div>
  )
}
