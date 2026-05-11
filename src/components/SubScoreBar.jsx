import { useState, useEffect } from 'react'
import { motion, useMotionValue, animate } from 'motion/react'
import GlossaryLabel from './ui/GlossaryLabel'

// Map sub-score display labels to canonical glossary keys so the
// GlossaryLabel tooltip resolves correctly when the visible text differs
// from the glossary term (e.g. "Interconnection" sub-score → "IX" def).
const SUBSCORE_GLOSSARY_KEYS = {
  'Offtake':         'Offtake',
  'Interconnection': 'IX',
  'Site Control':    'Site Control',
}

// V3: Terminal-style sub-score row.
// Grid layout fixes prior overflow: "INTERCONNECTION" (~148px wide at 11px / 0.12em
// tracking) was overflowing a w-[100px] container and colliding with the value.
// New: CSS grid with label column that grows to fit content (minmax) + tight gap.
// Weight inlined next to label as gray meta — no more stranded far-right %.
//
// Layout: [LABEL · weight]  [value bold]  [████ segments fill]
// V3.1: Replaced unicode-block-character bars with a gradient SVG track that
// animates on mount + on value change. The base value is threaded in so each
// bar can show its own delta badge when a scenario is active -- previously
// only the overall ArcGauge surfaced scenario impact.
export default function SubScoreBar({ label, weight, value, color, baseValue }) {
  const displayLabel = label === 'Interconnection' ? 'Interconn' : label
  const safeValue = Math.max(0, Math.min(100, value || 0))
  const delta = (typeof baseValue === 'number') ? value - baseValue : null
  const hasDelta = delta !== null && delta !== 0

  // Phase 3 — cubic-bezier tween (per design-vocabulary.md § Motion)
  // instead of the prior useSpring. Same landing-on-target rhythm,
  // no spring vocabulary. Lockstep with the ArcGauge number readout
  // so the panel animates as one.
  const mv = useMotionValue(safeValue)
  const [display, setDisplay] = useState(safeValue)
  useEffect(() => {
    const controls = animate(mv, safeValue, { duration: 0.85, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [safeValue, mv])
  useEffect(() => mv.on('change', (v) => setDisplay(Math.round(v))), [mv])

  return (
    <div
      className="font-mono text-[11px] tabular-nums items-center group/subscore"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, max-content) 38px 1fr', columnGap: '12px' }}
    >
      <span className="uppercase tracking-widest font-semibold text-ink leading-tight whitespace-nowrap">
        <GlossaryLabel
          term={SUBSCORE_GLOSSARY_KEYS[label] || label}
          displayAs={displayLabel}
          className="font-semibold text-ink"
        />
        <span className="ml-1.5 text-[9px] text-ink-muted font-normal">{weight}</span>
      </span>

      {/* Animated value + delta badge */}
      <span className="text-right relative leading-none">
        <span className="font-bold text-[13px] text-ink tabular-nums">{display}</span>
        {hasDelta && (
          <motion.span
            key={delta}  /* re-fire animation when delta changes */
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute -top-3 -right-1 text-[8px] font-bold tabular-nums px-1 py-px rounded-sm"
            style={{
              color: delta > 0 ? '#0F766E' : '#DC2626',
              background: delta > 0 ? 'rgba(15,118,110,0.10)' : 'rgba(220,38,38,0.10)',
              border: `1px solid ${delta > 0 ? 'rgba(15,118,110,0.25)' : 'rgba(220,38,38,0.25)'}`,
            }}
          >
            {delta > 0 ? '+' : ''}{delta}
          </motion.span>
        )}
      </span>

      {/* Animated gradient track */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(226,232,240,0.55)' }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${safeValue}%` }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: `linear-gradient(90deg, ${color}99 0%, ${color} 70%, ${color} 100%)`,
            boxShadow: `0 0 0 1px ${color}22 inset, 0 0 8px ${color}44`,
          }}
        >
          {/* Tiled-gradient shimmer driven by a CSS @keyframes animation
              (defined in src/index.css as `.shimmer-flow`). Motion's
              percentage-keyframe interpolation produced a perceptible
              discontinuity at the loop boundary on some browsers; CSS
              native keyframes don't. Pattern is a 50%-wide gradient tile
              that repeats; one full cycle shifts position by exactly one
              tile width, so the rendered output at the loop boundary is
              pixel-identical to the start. True seamless flow. */}
          <div
            className="absolute inset-0 pointer-events-none shimmer-flow"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.50) 50%, transparent 100%)',
              backgroundSize: '50% 100%',
              backgroundRepeat: 'repeat',
              mixBlendMode: 'overlay',
            }}
          />
        </motion.div>
      </div>
    </div>
  )
}
