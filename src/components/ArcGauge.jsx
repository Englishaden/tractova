import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, animate, useReducedMotion } from 'motion/react'
import { useFirstVisible } from './motion/MotionPrimitives'

// V3: Precision tachometer — feasibility index as a measured instrument.
// Phase 4 — animated number readout gates on first viewport entry. The
// number tweens 0 → score the first time the gauge becomes visible, then
// animates between values on subsequent score changes (e.g. when the
// Lens re-runs against fresh state data). Reduced-motion users see the
// final value immediately. Cubic-bezier ease per design-vocabulary §
// Motion — "decelerating cubic curves — confident landing, no
// oscillation, no bounce".
function AnimatedScoreText({ value, visible, ...textProps }) {
  const reduced = useReducedMotion()
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  const hasFiredRef = useRef(false)
  useEffect(() => {
    if (reduced) { setDisplay(value); return }
    // First visible: tween 0 → value. Subsequent value changes: tween
    // current → new value (so updates feel like settling, not restarts).
    if (!visible && !hasFiredRef.current) return
    hasFiredRef.current = true
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [value, visible, reduced, mv])
  useEffect(() => mv.on('change', (v) => setDisplay(Math.round(v))), [mv])
  return <text {...textProps}>{display}</text>
}

// V3.1: Single-object gauge -- the previous version felt like two pieces
// (the arc plus a separate floating scale of "0/50/100" labels). Removed
// the numeric scale labels (the score itself is the readout that matters),
// tightened the score + sub-caption into a unified central composition,
// added a thin baseline rule connecting the arc's two endpoints, and kept
// the 5 micro-ticks for instrumentation feel without competing for
// attention. Arc + score now read as one coherent object.
export default function ArcGauge({ score }) {
  const s = (typeof score === 'number' && isFinite(score)) ? score : 0
  const pct = Math.max(0, Math.min(100, s)) / 100
  // viewBox widened slightly (110 tall, was 100) so ticks can sit OUTSIDE
  // the arc without clipping at the top edge.
  const R = 64, cx = 90, cy = 85
  const fullPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const arcLength = Math.PI * R
  // Phase 4 — IO-gated reveal. svgRef tracks the gauge SVG; useFirstVisible
  // flips visible=true once when the element scrolls into view. The motion
  // path uses visible to compute its strokeDashoffset target — empty when
  // not yet visible, filled once visible. Subsequent score changes animate
  // normally because the new target propagates through animate prop.
  const svgRef = useRef(null)
  const visible = useFirstVisible(svgRef)
  const targetOffset = visible ? arcLength * (1 - pct) : arcLength

  // V3 single-hue teal ramp
  let color = '#CBD5E1'
  if (s >= 75)      color = '#0F766E'
  else if (s >= 60) color = '#14B8A6'
  else if (s >= 45) color = '#2DD4BF'
  else if (s >= 25) color = '#5EEAD4'

  // 5 micro-ticks (0/25/50/75/100) -- visual instrumentation. Major ticks
  // (25/50/75) now carry small mono labels for at-a-glance score reading;
  // 0 and 100 stay unlabeled (the arc endpoints + the centered readout
  // already convey the scale).
  const tickPositions = [
    { p: 0,    labelled: false, label: null },
    { p: 0.25, labelled: true,  label: '25' },
    { p: 0.5,  labelled: true,  label: '50' },
    { p: 0.75, labelled: true,  label: '75' },
    { p: 1.0,  labelled: false, label: null },
  ]

  return (
    <svg ref={svgRef} viewBox="0 0 180 110" className="w-full max-w-[240px]">
      {/* Tick marks -- positioned OUTSIDE the arc (was crossing it before,
          which read as black lines flowing through the green fill). Inner
          tick start sits 5 units beyond the arc's outer edge; outer end
          12 units beyond. Labelled ticks (25/50/75) get a tiny mono numeral
          a few units further out — instrumentation reading, not chrome. */}
      {tickPositions.map((t, i) => {
        const angle = Math.PI * (1 - t.p)
        const isMajor = t.p === 0 || t.p === 0.5 || t.p === 1.0
        const inner = R + 5, outer = R + 12
        const labelR = R + 17
        const lx = cx + labelR * Math.cos(angle)
        const ly = cy - labelR * Math.sin(angle)
        // Tilt label baseline along the radial so the digits hug the arc
        // rather than floating arbitrarily. text-anchor middle keeps each
        // label centered on its tick.
        return (
          <g key={i}>
            <line
              x1={cx + inner * Math.cos(angle)} y1={cy - inner * Math.sin(angle)}
              x2={cx + outer * Math.cos(angle)} y2={cy - outer * Math.sin(angle)}
              stroke="#5A6B7A"
              strokeWidth={isMajor ? 1.5 : 1.1}
              strokeLinecap="round"
              opacity={isMajor ? 0.65 : 0.40}
            />
            {t.labelled && (
              <text
                x={lx} y={ly + 2}
                textAnchor="middle"
                fontSize="7" fontWeight="600"
                fill="#94A3B8"
                fontFamily="JetBrains Mono, ui-monospace, monospace"
                letterSpacing="0.5"
              >
                {t.label}
              </text>
            )}
          </g>
        )
      })}
      {/* Arc track */}
      <path d={fullPath} fill="none" stroke="#E2E8F0" strokeWidth={7} strokeLinecap="round" />
      {/* Animated fill — entry animation fires on first viewport visibility
          (see svgRef / useFirstVisible above). initial puts the arc at
          empty (strokeDashoffset = arcLength), animate transitions to the
          score's target once visible. Subsequent score changes flow
          through the same animate prop so the gauge settles to new value. */}
      <motion.path
        d={fullPath}
        fill="none"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={arcLength}
        initial={{ strokeDashoffset: arcLength, stroke: color }}
        animate={{
          strokeDashoffset: targetOffset,
          stroke: color,
        }}
        transition={{
          // Cubic-bezier fill curve per design-vocabulary.md §Motion.
          // Confident landing, no oscillation. Matches the GaugeFill
          // primitive + the ProjectTable RAF curve used elsewhere.
          strokeDashoffset: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
          stroke: { duration: 0.4, ease: 'easeOut' },
        }}
      />
      {/* Thin baseline rule connecting the arc endpoints -- visually closes
          the gauge into a single shape and gives the readout a rest line. */}
      <line
        x1={cx - R + 3} y1={cy + 0.5}
        x2={cx + R - 3} y2={cy + 0.5}
        stroke="#E2E8F0" strokeWidth={1}
      />
      {/* Score readout -- centered above the baseline. Larger (was 32, now
          38) so it dominates the composition; the number IS the gauge's
          output -- making it big enough to "be" the gauge merges it with
          the arc visually. Tighter letter-spacing pulls the digits into a
          single block-like form. */}
      <AnimatedScoreText
        value={s}
        visible={visible}
        x={cx} y={cy - 8}
        textAnchor="middle"
        fontSize="38" fontWeight="700"
        fill="#0A1828"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        letterSpacing="-2"
      />
      {/* Tiny "/100" caption directly under the score — tells the eye what
          scale this number lives on without pulling out a separate label. */}
      <text
        x={cx} y={cy + 11}
        textAnchor="middle"
        fontSize="8" fontWeight="600"
        fill="#94A3B8"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        letterSpacing="2"
      >
        / 100
      </text>
    </svg>
  )
}
