import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, animate, useReducedMotion } from 'motion/react'
import { useFirstVisible } from '../motion/MotionPrimitives'

// V3.1 / Phase 3 / Phase 4 — Mini animated arc gauge for the project-bar
// score indicator. Arc fills 0 → score the first time the gauge enters
// the viewport (IntersectionObserver via useFirstVisible). Subsequent
// score changes animate normally so updates feel like the needle settling
// to a new reading. Cubic-bezier tweens (`[0.16, 1, 0.3, 1]` entrance,
// `[0.22, 1, 0.36, 1]` fill) per design-vocabulary.md § Motion. Honors
// prefers-reduced-motion — reduced users see final state immediately.
// 44×44 footprint.
export default function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
  const target = score ?? 0
  const stroke = score == null ? fallbackColor : color
  const wrapRef = useRef(null)
  const visible = useFirstVisible(wrapRef)
  const reduced = useReducedMotion()

  // Number readout — tweens from 0 to target on first visible, then
  // settles to new values on subsequent score changes.
  const mv = useMotionValue(reduced ? target : 0)
  const [display, setDisplay] = useState(reduced ? target : 0)
  const hasFiredRef = useRef(false)
  useEffect(() => {
    if (reduced) { setDisplay(target); return }
    if (!visible && !hasFiredRef.current) return
    hasFiredRef.current = true
    const controls = animate(mv, target, { duration: 0.85, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [target, visible, reduced, mv])
  useEffect(() => mv.on('change', v => setDisplay(Math.round(v))), [mv])

  // strokeDasharray target: '<score>, 100' fills <score>% of the path.
  // Until visible, hold at empty ('0, 100'). The animate prop only
  // changes when visible flips, so first reveal triggers the fill.
  const dashTarget = visible ? `${target}, 100` : '0, 100'
  return (
    <div ref={wrapRef} className="shrink-0 relative" style={{ width: 44, height: 44 }}>
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
          animate={{ strokeDasharray: dashTarget }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums leading-none" style={{ color: stroke }}>
        {score == null ? '—' : display}
      </span>
    </div>
  )
}
