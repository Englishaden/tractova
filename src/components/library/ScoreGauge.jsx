import { useState, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// ── Score arc gauge ───────────────────────────────────────────────────────────
// Phase 4 — animated. Arc fills via stroke-dashoffset over a full-semicircle
// path on mount (was previously a static partial-path that snapped to value).
// Number reads via inline CountUp 0 → score on mount. ScoreGauge only renders
// when the user expands a project card, so by definition mount = reveal —
// no IntersectionObserver needed.
export default function ScoreGauge({ score }) {
  if (score == null) return null
  const r     = 34
  const cx    = 50
  const cy    = 48
  const circ  = Math.PI * r
  const pct   = Math.max(0, Math.min(score / 100, 1))
  const color = score >= 70 ? '#0F766E' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak'
  const target = circ * (1 - pct)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 64" className="w-28">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#E5E7EB" strokeWidth="7" strokeLinecap="round"
        />
        {/* Animated fill — full semicircle path, stroke-dashoffset
            interpolates from circ (empty) to circ*(1-pct) (filled). */}
        <motion.path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Score readout — CountUp inside a foreignObject would be cleaner
            but causes Safari sub-pixel jitter on SVG composition. Inline
            CountUp via React rendering of the same number, displayed via
            tspan trick: we render the digits in plain SVG <text>. The
            display value comes from a CountUp animation tracked in state. */}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">
          <ScoreDigits target={score} />
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="#9CA3AF">out of 100</text>
      </svg>
      <span className="text-[10px] font-semibold mt-0.5" style={{ color }}>{label} market</span>
    </div>
  )
}

// ScoreDigits — renders the tweened display value into an SVG <text>.
// Inline CountUp logic so we can return a plain string inside SVG <text>
// (CountUp's <span tabular-nums> wrapper isn't valid SVG content).
// Animates on mount; subsequent score changes settle to the new value.
function ScoreDigits({ target }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced) { setDisplay(target); return }
    const start = performance.now()
    const startVal = display
    const duration = 700
    let raf = 0
    const tick = (now) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = startVal + (target - startVal) * eased
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // intentionally not depending on `display` to avoid re-firing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced])
  return <>{Math.round(display)}</>
}
