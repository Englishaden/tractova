import { useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

// V3: Precision tachometer — feasibility index as a measured instrument.
// ViewBox sized generously so labels never crowd the arc or the score.
// Animated number readout — counts up/down to target on score change.
// Uses Motion's spring so the response feels like a real instrument needle
// settling, not a linear tween. Renders inside SVG <text>.
function AnimatedScoreText({ value, ...textProps }) {
  const mv = useMotionValue(value)
  const spring = useSpring(mv, { stiffness: 110, damping: 22, mass: 0.6 })
  const [display, setDisplay] = useState(value)
  useEffect(() => { mv.set(value) }, [value, mv])
  useEffect(() => spring.on('change', (v) => setDisplay(Math.round(v))), [spring])
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
    <svg viewBox="0 0 180 110" className="w-full max-w-[240px]">
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
      {/* Animated fill */}
      <motion.path
        d={fullPath}
        fill="none"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={arcLength}
        initial={false}
        animate={{
          strokeDashoffset: arcLength * (1 - pct),
          stroke: color,
        }}
        transition={{
          strokeDashoffset: { type: 'spring', stiffness: 110, damping: 22, mass: 0.6 },
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
