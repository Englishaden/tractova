import { useState, useEffect } from 'react'
import { motion, useMotionValue, animate } from 'motion/react'

// V3.1 / Phase 3 — Mini animated arc gauge for the project-bar score
// indicator. Arc fills on mount + on score change using cubic-bezier
// tweens (per design-vocabulary.md § Motion: entrances use
// `[0.16, 1, 0.3, 1]`, fills use `[0.22, 1, 0.36, 1]`). Previously
// used a `useSpring` for the number readout — replaced with an
// `animate()` tween on the same curve so the gauge and number land
// on the same beat without a spring vocabulary. 44×44 footprint.
export default function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
  const target = score ?? 0
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(mv, target, { duration: 0.85, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [target, mv])
  useEffect(() => mv.on('change', v => setDisplay(Math.round(v))), [mv])
  const stroke = score == null ? fallbackColor : color
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
