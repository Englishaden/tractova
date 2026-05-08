import { useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

// V3.1: Mini animated arc gauge for the project-bar score indicator.
// Replaces the static rounded-square bubble. Arc fills on mount + on
// score change with a spring; the number itself animates the same way
// (matches the ArcGauge pattern in Search.jsx so the visual language
// stays consistent across the app). Sized for inline use in the
// collapsed project row -- 44x44 footprint, same as the old bubble.
export default function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
  const target = score ?? 0
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 110, damping: 22, mass: 0.6 })
  const [display, setDisplay] = useState(0)
  useEffect(() => { mv.set(target) }, [target, mv])
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring])
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
