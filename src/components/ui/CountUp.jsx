import { useState, useEffect } from 'react'
import { animate, useReducedMotion } from 'motion/react'

// Count-up: animates a number 0 → value on mount. Reduced-motion renders the
// final value instantly. Thousands-separated; `decimals` controls precision
// (0 for counts, 1 for MW totals). Optional suffix (e.g. " MW").
//
// Shared by the Dashboard MetricsBar and the Library so every headline figure
// ticks up with the same curve + feel (one canonical source, no drift).
export default function CountUp({ value, suffix = '', decimals = 0 }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(() => (reduce ? value : 0))
  useEffect(() => {
    if (reduce) { setDisplay(value); return }
    const controls = animate(0, value, {
      duration: 1.0,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, reduce])
  const text = decimals > 0
    ? display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(display).toLocaleString()
  return <span className="tabular-nums">{text}{suffix}</span>
}
