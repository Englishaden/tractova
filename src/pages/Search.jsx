import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack, getRevenueRates, getPucDockets, getComparableDeals, getEnergyCommunity, getHudQctDda, getNmtcLic } from '../lib/programData'
import allCounties from '../data/allCounties.json'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useCompare, lensResultToCompareItem } from '../context/CompareContext'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import RegulatoryActivityPanel from '../components/RegulatoryActivityPanel'
import ComparableDealsPanel from '../components/ComparableDealsPanel'
import CoverageBadge from '../components/CoverageBadge'
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/Tooltip'
import { useToast } from '../components/ui/Toast'
import TractovaLoader from '../components/ui/TractovaLoader'
import { motion, useMotionValue, useSpring, animate as motionAnimate } from 'motion/react'

// ─────────────────────────────────────────────────────────────────────────────
// Market Position Panel — replaces the old mini state map
// ─────────────────────────────────────────────────────────────────────────────

import { STAGE_MODIFIERS, computeSubScores, computeDisplayScore, getOfftakeCoverageStates } from '../lib/scoreEngine'
import { computeRevenueProjection, hasRevenueData, computeCIRevenueProjection, hasCIRevenueData, computeBESSProjection, hasBESSRevenueData, computeHybridProjection } from '../lib/revenueEngine'
import { getIXQueueSummary } from '../lib/programData'
import { getNearestSubstations } from '../lib/substationEngine'

function getMarketRank(stateId, programMap) {
  if (!programMap) return { rank: null, total: 0 }
  const ranked = Object.values(programMap)
    .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const rank = ranked.findIndex(s => s.id === stateId) + 1
  return { rank: rank || null, total: ranked.length }
}

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
function ArcGauge({ score }) {
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
function SubScoreBar({ label, weight, value, color, baseValue }) {
  const displayLabel = label === 'Interconnection' ? 'Interconn' : label
  const safeValue = Math.max(0, Math.min(100, value || 0))
  const delta = (typeof baseValue === 'number') ? value - baseValue : null
  const hasDelta = delta !== null && delta !== 0

  // Animated number counter -- mirrors the AnimatedScoreText pattern used by
  // the ArcGauge so the whole panel animates in unison.
  const mv = useMotionValue(safeValue)
  const spring = useSpring(mv, { stiffness: 110, damping: 22, mass: 0.6 })
  const [display, setDisplay] = useState(safeValue)
  useEffect(() => { mv.set(safeValue) }, [safeValue, mv])
  useEffect(() => spring.on('change', (v) => setDisplay(Math.round(v))), [spring])

  return (
    <div
      className="font-mono text-[11px] tabular-nums items-center group/subscore"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, max-content) 38px 1fr', columnGap: '12px' }}
    >
      <span className="uppercase tracking-widest font-semibold text-ink leading-tight whitespace-nowrap">
        {displayLabel}
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

const STATUS_CFG = {
  active:  { label: 'Active Program',   bg: 'rgba(5,150,105,0.10)',  text: '#065F46', border: 'rgba(5,150,105,0.25)' },
  limited: { label: 'Limited Capacity', bg: 'rgba(180,83,9,0.10)',   text: '#92400E', border: 'rgba(180,83,9,0.25)' },
  pending: { label: 'Pending Launch',   bg: 'rgba(202,138,4,0.12)',  text: '#854D0E', border: 'rgba(202,138,4,0.30)' },
  none:    { label: 'No Program',       bg: 'rgba(0,0,0,0.05)',      text: '#6B7280', border: 'rgba(0,0,0,0.12)' },
}

// Returns days-since if > 14, otherwise null (signal only shown when stale)
function staleDays(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  return days > 14 ? days : null
}

// Guards against raw JSON leaking into the analyst brief (e.g. from truncated
// API responses cached in sessionStorage before the parser fix was deployed).
function sanitizeBrief(text) {
  if (!text) return null
  const t = text.trim()
  if (!t.startsWith('{')) return t
  // Looks like raw JSON — try to recover just the brief value
  try {
    const parsed = JSON.parse(t)
    if (typeof parsed.brief === 'string' && !parsed.brief.trim().startsWith('{')) return parsed.brief
  } catch (_) {}
  const m = t.match(/"brief"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : null
}

// V3 redesign: editorial-intelligence "research note" hero block.
// Drops the dark gradient banner. Mono eyebrow strip up top with metadata,
// then asymmetric two-column body: tachometer left, identity + sub-scores right.
// §7.4: accepts activeScenario prop. When active, gauge renders the override score
// with a delta indicator. Toggle row renders below this panel via the parent.
function MarketPositionPanel({ stateProgram, countyData, programMap, stage, technology, activeScenario }) {
  if (!stateProgram) return null
  // Apply scenario override if active — recompute sub-scores from the override state
  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const { offtake, ix, site, coverage } = computeSubScores(effectiveProgram, countyData, stage, technology)
  const { rank, total } = getMarketRank(stateProgram.id, programMap)
  const status = STATUS_CFG[effectiveProgram.csStatus] || STATUS_CFG.none
  const score = computeDisplayScore(offtake, ix, site)
  // Base-case score for delta calculation
  const baseSubs = computeSubScores(stateProgram, countyData, stage, technology)
  const baseScore = computeDisplayScore(baseSubs.offtake, baseSubs.ix, baseSubs.site)
  const delta = activeScenario ? score - baseScore : 0
  // When state/county is outside our curated coverage, surface that to match
  // the honesty already in the revenue panel ("model not available"). Without
  // this, the user sees a feasibility number that looks researched but is
  // actually an estimated baseline.
  const offtakeCoverageStates = coverage?.offtake === 'fallback' ? getOfftakeCoverageStates(technology) : null
  const siteFallback = coverage?.site === 'fallback'
  const hasCoverageNote = offtakeCoverageStates || siteFallback

  // "AS OF" timestamp — institutional research-note convention
  const latestDate = (() => {
    const v = stateProgram.lastVerified ? new Date(stateProgram.lastVerified) : null
    const u = stateProgram.updatedAt    ? new Date(stateProgram.updatedAt)    : null
    return (v && u) ? (v > u ? v : u) : (v || u)
  })()
  const asOf = latestDate
    ? latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    : null
  const ageDays = latestDate ? Math.floor((Date.now() - latestDate) / 86400000) : null
  const isStale = ageDays != null && ageDays > 14

  // Verdict tag mapped to the score
  const verdict = score >= 70 ? { label: 'Strong Fit',    color: '#0F766E' }
                : score >= 55 ? { label: 'Viable',         color: '#0F766E' }
                : score >= 38 ? { label: 'Caution',        color: '#D97706' }
                : score >= 18 ? { label: 'High Friction',  color: '#DC2626' }
                :               { label: 'Not Recommended', color: '#DC2626' }

  return (
    <article
      className="bg-white rounded-lg mb-6 overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Top teal accent rail — V3 brand signature */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }} />

      {/* Eyebrow metadata strip — research-note convention */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Tractova Lens · Market Position
          </span>
          {asOf && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${isStale ? 'text-amber-600' : 'text-gray-400'}`}>
                As of {asOf}
              </span>
            </>
          )}
          {rank && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
                Rank <span className="font-bold text-gray-700">#{rank}</span> of {total}
              </span>
            </>
          )}
          <span className="text-gray-300 text-[9px]">/</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            {(technology || '').toUpperCase()}
          </span>
          {/* §7.4: scenario indicator in the eyebrow when active */}
          {activeScenario && (
            <>
              <span className="text-gray-300 text-[9px]">/</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 font-bold"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#92400E', border: '1px solid rgba(245,158,11,0.40)' }}>
                ◆ Scenario · {activeScenario.label.replace('What if ', '').replace('?', '')}
              </span>
            </>
          )}
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
          style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}` }}
        >
          {status.label}
        </span>
      </div>

      {/* Body — asymmetric grid: 5 cols gauge / 7 cols identity + sub-scores */}
      <div className="grid grid-cols-1 md:grid-cols-12">
        {/* Left — gauge */}
        <div className="md:col-span-5 px-6 py-7 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-3 text-gray-400">
            Feasibility Index
          </p>
          <ArcGauge score={score} />
          {/* §7.4: delta indicator when a scenario is active */}
          {activeScenario && delta !== 0 && (
            <span
              className="mt-1 font-mono text-[12px] font-bold tabular-nums"
              style={{ color: delta > 0 ? '#0F766E' : '#DC2626' }}
            >
              {delta > 0 ? '↑' : '↓'} {delta > 0 ? '+' : ''}{delta} vs base ({baseScore})
            </span>
          )}
          <div
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] font-bold"
            style={{ color: verdict.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdict.color }} />
            {verdict.label}
          </div>
        </div>

        {/* Right — identity + sub-scores */}
        <div className="md:col-span-7 px-6 py-7 flex flex-col gap-6">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400">
                Target State
              </p>
              <CoverageBadge tier={stateProgram.coverageTier} />
            </div>
            <h2 className="font-serif font-semibold text-ink leading-[0.95]" style={{ fontSize: '34px', letterSpacing: '-0.02em' }}>
              {stateProgram.name}
            </h2>
            {stateProgram.csProgram && (
              <p className="text-sm font-medium mt-1.5" style={{ color: '#0F766E' }}>
                {stateProgram.csProgram}
              </p>
            )}
          </div>

          {/* Sub-scores */}
          <div className="pt-5 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400">
                Sub-Scores
              </p>
              {/* V3: Radix-portal tooltip — was a hand-rolled absolute-positioned div
                  that overflowed on narrow viewports. Portal renders to document.body
                  and Radix handles viewport collision avoidance. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Methodology" className="cursor-help" onClick={(e) => e.preventDefault()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="text-[10px]">
                  <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>Methodology</p>
                  <p><span className="text-teal-300 font-mono">OFFTAKE 40%</span> — Program status, capacity, LMI complexity, enrollment runway</p>
                  <p className="mt-0.5"><span className="text-amber-300 font-mono">INTERCONN 35%</span> — Queue difficulty, study timelines, upgrade cost risk</p>
                  <p className="mt-0.5"><span className="text-blue-300 font-mono">SITE CTRL 25%</span> — Land availability, wetland risk, zoning constraints</p>
                  <p className="mt-1.5 text-gray-400">Offtake viability is the first gate. IX risk is the primary capital risk. Site control is increasingly commoditized.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <SubScoreBar label="Offtake"         weight="40%" value={offtake} baseValue={baseSubs.offtake} color="#0F766E" />
            <SubScoreBar label="Interconnection" weight="35%" value={ix}      baseValue={baseSubs.ix}      color="#D97706" />
            <SubScoreBar label="Site Control"    weight="25%" value={site}    baseValue={baseSubs.site}    color="#2563EB" />
            {hasCoverageNote && (
              <div
                className="mt-2 flex items-start gap-1.5 px-2 py-1.5 rounded-sm"
                style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.18)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-[10px] leading-snug" style={{ color: '#78350F' }}>
                  <span className="font-bold uppercase tracking-wider text-[9px]">Limited coverage — directional only</span>
                  <span className="block mt-0.5 font-normal space-y-0.5">
                    {offtakeCoverageStates && (
                      <span className="block">
                        <strong>Offtake:</strong> {technology} economics are curated for {offtakeCoverageStates.join(', ')}. {stateProgram.name} uses an estimated baseline.
                      </span>
                    )}
                    {siteFallback && (
                      <span className="block">
                        <strong>Site Control:</strong> County-level land/wetland/zoning data not yet seeded for this geography. Score uses a national baseline; verify locally before committing capital.
                      </span>
                    )}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ALL_STATES = [
  { id: 'AL', name: 'Alabama' }, { id: 'AK', name: 'Alaska' },
  { id: 'AZ', name: 'Arizona' }, { id: 'AR', name: 'Arkansas' },
  { id: 'CA', name: 'California' }, { id: 'CO', name: 'Colorado' },
  { id: 'CT', name: 'Connecticut' }, { id: 'DE', name: 'Delaware' },
  { id: 'FL', name: 'Florida' }, { id: 'GA', name: 'Georgia' },
  { id: 'HI', name: 'Hawaii' }, { id: 'ID', name: 'Idaho' },
  { id: 'IL', name: 'Illinois' }, { id: 'IN', name: 'Indiana' },
  { id: 'IA', name: 'Iowa' }, { id: 'KS', name: 'Kansas' },
  { id: 'KY', name: 'Kentucky' }, { id: 'LA', name: 'Louisiana' },
  { id: 'ME', name: 'Maine' }, { id: 'MD', name: 'Maryland' },
  { id: 'MA', name: 'Massachusetts' }, { id: 'MI', name: 'Michigan' },
  { id: 'MN', name: 'Minnesota' }, { id: 'MS', name: 'Mississippi' },
  { id: 'MO', name: 'Missouri' }, { id: 'MT', name: 'Montana' },
  { id: 'NE', name: 'Nebraska' }, { id: 'NV', name: 'Nevada' },
  { id: 'NH', name: 'New Hampshire' }, { id: 'NJ', name: 'New Jersey' },
  { id: 'NM', name: 'New Mexico' }, { id: 'NY', name: 'New York' },
  { id: 'NC', name: 'North Carolina' }, { id: 'ND', name: 'North Dakota' },
  { id: 'OH', name: 'Ohio' }, { id: 'OK', name: 'Oklahoma' },
  { id: 'OR', name: 'Oregon' }, { id: 'PA', name: 'Pennsylvania' },
  { id: 'RI', name: 'Rhode Island' }, { id: 'SC', name: 'South Carolina' },
  { id: 'SD', name: 'South Dakota' }, { id: 'TN', name: 'Tennessee' },
  { id: 'TX', name: 'Texas' }, { id: 'UT', name: 'Utah' },
  { id: 'VT', name: 'Vermont' }, { id: 'VA', name: 'Virginia' },
  { id: 'WA', name: 'Washington' }, { id: 'WV', name: 'West Virginia' },
  { id: 'WI', name: 'Wisconsin' }, { id: 'WY', name: 'Wyoming' },
]

const STAGES = ['Prospecting', 'Site Control', 'Pre-Development', 'Development', 'NTP (Notice to Proceed)', 'Construction', 'Operational']
const TECHNOLOGIES = ['Community Solar', 'Hybrid', '---', 'C&I Solar', 'BESS']

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
// V3.1: Bloomberg-style run-id masthead at the top of every Lens result.
// Signals research-grade character: this analysis ran at a specific moment,
// in a specific region, with a specific input set. Reads instantly to anyone
// who's used a real intelligence terminal.
function RunIdMasthead({ form }) {
  if (!form) return null
  const now = new Date()
  const dateCode = now.toISOString().slice(2, 10).replace(/-/g, '.')      // 26.04.30
  const tsCode   = now.toISOString().slice(0, 16).replace('T', ' ')        // 2026-04-30 19:47
  const stateCode  = (form.state || 'XX').toUpperCase()
  const countyCode = (form.county || '').replace(/\s+/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const techCode   = (form.technology || 'CS').replace(/\s+/g, '').toUpperCase()
  const runId = `LX-${dateCode}-${stateCode}${countyCode}`

  return (
    <div
      className="flex items-center justify-between gap-4 mb-4 px-4 py-2 rounded-md flex-wrap"
      style={{
        background: 'linear-gradient(90deg, #0F1A2E 0%, #0A132A 100%)',
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.30em] shrink-0"
          style={{ color: '#5EEAD4' }}
        >
          ◆ Run · {runId}
        </span>
        <span className="text-[9px] hidden sm:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {tsCode} UTC
        </span>
        <span className="text-[9px] hidden md:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
        <span
          className="text-[9px] hidden md:inline"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {techCode}
        </span>
      </div>
      <span
        className="text-[9px] font-medium tracking-[0.20em] uppercase shrink-0"
        style={{ color: 'rgba(94,234,212,0.65)' }}
      >
        Tractova · Lens v3
      </span>
    </div>
  )
}

// V3.1: Editorial section marker. Mono "§ NN · Label" on the left, a hairline
// rule fills the middle, optional mono sublabel on the right. Replaces flat
// SectionDivider lines in the results flow with research-note typography.
function SectionMarker({ index, label, sublabel, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'mb-3' : 'mt-8 mb-4'}`}>
      <span
        className="text-[9px] font-bold tracking-[0.28em] uppercase shrink-0"
        style={{ color: '#0F1A2E', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        § {String(index).padStart(2, '0')} · {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
      {sublabel && (
        <span
          className="text-[9px] tracking-[0.22em] uppercase shrink-0"
          style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {sublabel}
        </span>
      )}
    </div>
  )
}

// V3.1: Whole-card collapsible wrapper for the 3 main Lens cards
// (SC / IX / Offtake). Header (eyebrow + title + caption) always
// visible and clickable. Body animates height open/close. Default
// state is expanded so first impression is unchanged; users can
// collapse to compress the layout. items-start on the parent grid
// keeps heights independent so a collapsed card doesn't stretch.
function CollapsibleCard({
  accentColor,
  eyebrow,
  title,
  caption,
  defaultExpanded = false,
  children,
}) {
  const [open, setOpen] = useState(defaultExpanded)
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full text-left px-5 pt-4 pb-3 transition-colors hover:bg-gray-50/50 focus:outline-hidden focus-visible:bg-gray-50/80"
        style={{ borderBottom: open ? '1px solid #F3F4F6' : '1px solid transparent' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: accentColor }}>
                {eyebrow}
              </p>
            )}
            <h3 className="font-serif text-xl font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
              {title}
            </h3>
            {caption && (
              <p className="font-mono text-[10px] text-gray-400 tracking-wide mt-0.5">
                {caption}
              </p>
            )}
          </div>
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? accentColor : '#94A3B8'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 mt-1.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </div>
      </button>
      <motion.div
        initial={false}
        animate={open ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: 'hidden' }}
      >
        {children}
      </motion.div>
    </section>
  )
}

// V3.1: Reusable expandable footer for the 3 main Lens cards (SC / IX / Offtake).
// Compact view never regresses -- this lives BELOW the existing card body.
// Click toggles a motion-animated drawer revealing methodology / sources /
// comparable benchmarks. Accent color matches each card's editorial eyebrow.
function CardDrilldown({ accentColor, label = 'Methodology & sources', children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full px-5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors hover:bg-gray-50/60 focus:outline-hidden focus-visible:bg-gray-50/80"
      >
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold transition-colors"
          style={{ color: open ? accentColor : '#5A6B7A' }}
        >
          {label}
        </span>
        <motion.svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? accentColor : '#94A3B8'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <motion.div
        initial={false}
        animate={open
          ? { height: 'auto', opacity: 1 }
          : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-5 pt-1 pb-4 space-y-3 text-[11px] text-gray-600 leading-snug">
          {children}
        </div>
      </motion.div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{children}</p>
  )
}

function DataRow({ label, value, highlight, valueClass }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${valueClass || (highlight ? 'text-primary' : 'text-gray-800')}`}>
        {value}
      </span>
    </div>
  )
}

function EaseArcGauge({ score }) {
  const s = (typeof score === 'number' && isFinite(score)) ? score : null
  if (s === null) {
    return <span className="text-xs text-gray-400 italic">Not available</span>
  }
  const pct = Math.max(0, Math.min(10, s)) / 10
  const R = 44, cx = 58, cy = 54
  const ex = cx - R * Math.cos(Math.PI * pct)
  const ey = cy - R * Math.sin(Math.PI * pct)
  // fill is always ≤ 180° of the full circle → never a large-arc in SVG terms
  const track = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const fill  = pct > 0.01 ? `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${ex} ${ey}` : ''

  let color = '#DC2626'
  if (s >= 7)      color = '#0F766E'
  else if (s >= 5) color = '#D97706'
  else if (s >= 3) color = '#EA580C'

  return (
    <svg viewBox="0 0 116 62" className="w-full max-w-[120px]">
      <path d={track} fill="none" stroke="#E5E7EB" strokeWidth="9" strokeLinecap="round" />
      {fill && <path d={fill} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />}
      <text x="58" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill={color} fontFamily="system-ui">{s}/10</text>
    </svg>
  )
}

function QueueBadge({ statusCode }) {
  const map = {
    open:      { label: 'Open', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited:   { label: 'Limited', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    saturated: { label: 'Saturated', cls: 'bg-red-50 text-red-700 border-red-200' },
    unknown:   { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[statusCode] || map.unknown
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
}

function RunwayBadge({ runway }) {
  const c = RUNWAY_COLORS[runway.urgency] || RUNWAY_COLORS.moderate
  const suffix = runway.urgency === 'watch' ? ' — watch' : runway.urgency === 'urgent' ? ' — act now' : ''
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-sm"
        style={{ background: c.bg, color: c.text }}
      >
        ~{runway.months} months{suffix}
      </span>
      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">est.</span>
    </div>
  )
}

function CSStatusBadge({ csStatus }) {
  const map = {
    active:  { label: 'Active Program', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited: { label: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Pending Launch', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    none:    { label: 'No Program', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[csStatus] || map.none
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function PillarIcon({ type }) {
  if (type === 'site') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  if (type === 'ix') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
  if (type === 'offtake') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Cards
// ─────────────────────────────────────────────────────────────────────────────
function SiteControlCard({ siteControl, interconnection, stateName, county, stateId, mw, substations }) {
  if (!siteControl) return null
  const { availableLand, landNotes, wetlandWarning, wetlandNotes, landUseNotes } = siteControl

  // Derive hosting capacity status from IX ease score
  const hostingStatus = (() => {
    const ease = interconnection?.easeScore
    if (ease == null) return { label: 'Unknown', color: '#6B7280', bg: 'rgba(107,114,128,0.06)', note: 'Contact serving utility for hosting capacity map' }
    if (ease >= 7) return { label: 'Available', color: '#0F766E', bg: 'rgba(15,118,110,0.06)', note: 'Hosting capacity appears sufficient based on IX conditions' }
    if (ease >= 4) return { label: 'Constrained', color: '#B45309', bg: 'rgba(180,83,9,0.06)', note: 'Hosting capacity may be limited — upgrades possible' }
    return { label: 'Constrained', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', note: 'Significant hosting constraints — expect upgrade costs' }
  })()

  // Derive population density from land notes
  const populationDensity = (() => {
    const notes = (landNotes || '').toLowerCase()
    if (notes.includes('urban') || notes.includes('densely') || notes.includes('metropolitan') || notes.includes('city')) return 'urban'
    if (notes.includes('suburban') || notes.includes('fringe') || notes.includes('mixed')) return 'suburban'
    return 'rural'
  })()

  const tiles = [
    {
      label: 'Land',
      status: availableLand ? 'Available' : 'Limited',
      color: availableLand ? '#0F766E' : '#DC2626',
      bg: availableLand ? 'rgba(15,118,110,0.06)' : 'rgba(220,38,38,0.06)',
      note: landNotes,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      label: 'Wetland',
      status: wetlandWarning ? 'Warning' : 'Low Risk',
      color: wetlandWarning ? '#B45309' : '#0F766E',
      bg: wetlandWarning ? 'rgba(180,83,9,0.06)' : 'rgba(15,118,110,0.06)',
      note: wetlandNotes || (wetlandWarning ? null : 'Low wetland risk on typical upland sites'),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
      ),
    },
    {
      label: 'Zoning',
      status: landUseNotes ? 'Restricted' : '—',
      color: landUseNotes ? '#B45309' : '#6B7280',
      bg: landUseNotes ? 'rgba(180,83,9,0.06)' : 'rgba(107,114,128,0.06)',
      note: landUseNotes,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/>
        </svg>
      ),
    },
    {
      label: 'Hosting',
      status: hostingStatus.label,
      color: hostingStatus.color,
      bg: hostingStatus.bg,
      note: hostingStatus.note,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
  ]

  return (
    <CollapsibleCard
      accentColor="#2563EB"
      eyebrow="03 / Site Control"
      title={`${county} County`}
      caption={stateName.toUpperCase()}
    >
      {/* Body */}
      <div className="px-5 py-4">
        {/* Population density context */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Area Profile</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border" style={{
            ...(populationDensity === 'urban'
              ? { color: '#7C3AED', background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.20)' }
              : populationDensity === 'suburban'
              ? { color: '#2563EB', background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.20)' }
              : { color: '#0F766E', background: 'rgba(20,184,166,0.06)', borderColor: 'rgba(20,184,166,0.25)' })
          }}>
            {populationDensity.charAt(0).toUpperCase() + populationDensity.slice(1)}
          </span>
          <span className="text-[9px] text-gray-400">
            {populationDensity === 'urban' ? '· Higher land costs, rooftop focus' : populationDensity === 'suburban' ? '· Mixed land availability' : '· Large parcels typically available'}
          </span>
        </div>

        {/* 4-factor risk tile grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
              style={{ background: t.bg, borderTop: `3px solid ${t.color}` }}
            >
              <div className="flex items-center gap-1.5" style={{ color: t.color }}>
                {t.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">{t.status}</span>
              {t.note && (
                <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{t.note}</p>
              )}
            </div>
          ))}
        </div>

        {/* Site Risk Assessment — synthesize all signals */}
        {(() => {
          const hostingRisk = hostingStatus.label === 'Constrained'
          const riskCount = [!availableLand, wetlandWarning, !!landUseNotes, hostingRisk].filter(Boolean).length
          const riskLevel = riskCount <= 1 ? 'low' : riskCount === 2 ? 'moderate' : 'elevated'
          const riskConfig = {
            low:      { label: 'Low Risk', color: '#0F766E', bg: 'rgba(15,118,110,0.06)', border: 'rgba(15,118,110,0.20)' },
            moderate: { label: 'Moderate Risk', color: '#B45309', bg: 'rgba(180,83,9,0.06)', border: 'rgba(180,83,9,0.20)' },
            elevated: { label: 'Elevated Risk', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.20)' },
          }
          const rc = riskConfig[riskLevel]

          const guidance = []
          if (!availableLand) guidance.push('Land supply is constrained — expect competitive pricing on available parcels and longer site acquisition timelines.')
          if (wetlandWarning) guidance.push('Wetland presence may require USACE Section 404 permits and jurisdictional delineation studies, adding 3–6 months and $20K–$50K to pre-development.')
          if (landUseNotes) guidance.push('Zoning restrictions may limit array placement or require special-use permits — review county ordinances early before committing to lease terms.')
          if (guidance.length === 0) guidance.push(`${county} County shows favorable site conditions. Standard due diligence recommended — confirm parcel-level suitability during site walks.`)

          return (
            <div
              className="rounded-lg px-3.5 py-3 mt-1"
              style={{ background: rc.bg, border: `1px solid ${rc.border}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rc.color }}>
                  {rc.label}
                </span>
                <span className="text-[9px] text-gray-400">·</span>
                <span className="text-[9px] text-gray-400">{riskCount} of 4 risk factors flagged</span>
              </div>
              {guidance.map((g, i) => (
                <p key={i} className="text-[11px] text-gray-600 leading-relaxed mt-1">{g}</p>
              ))}
            </div>
          )
        })()}

        {/* Nearest substations */}
        {(() => {
          const subs = substations
          if (!subs) return null
          const servingUtil = interconnection?.servingUtility?.toLowerCase() || ''
          const mwNum = parseFloat(mw) || 5
          return (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nearest Substations</span>
              </div>
              <div className="space-y-1.5">
                {subs.map((s, i) => {
                  const isUtilityMatch = servingUtil && s.utility?.toLowerCase().includes(servingUtil.split(' ')[0].toLowerCase())
                  const highlight = isUtilityMatch || i === 0
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                      style={{
                        background: isUtilityMatch ? 'rgba(20,184,166,0.08)' : highlight ? 'rgba(37,99,235,0.06)' : 'rgba(243,244,246,0.8)',
                        borderLeft: isUtilityMatch ? '3px solid #0F766E' : highlight ? '3px solid #2563EB' : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold ${isUtilityMatch ? 'text-emerald-700' : highlight ? 'text-blue-700' : 'text-gray-700'}`}>{s.name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{s.utility}</span>
                        {isUtilityMatch && (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Serving Utility
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        {s.distanceMiles != null && (
                          <span className={`font-semibold ${isUtilityMatch ? 'text-emerald-700' : highlight ? 'text-blue-700' : 'text-gray-600'}`}>{s.distanceMiles} mi</span>
                        )}
                        <span className="text-gray-400">{s.capacityMw} MW</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[9px] text-gray-400 mt-1.5">
                Distances from county centroid. Source: EIA Form 860. {mwNum <= 5 ? '138kV substations are typical POI for sub-5MW projects.' : mwNum <= 20 ? '138–230kV substations typical for this project size.' : '230kV+ substations may be needed for projects above 20MW.'} Verify POI with utility.
              </p>
            </div>
          )
        })()}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#2563EB" label="Methodology · sources · verification">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#1D4ED8' }}>How each tile is derived</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">Land</span> · curated from state PUC filings + USGS land-cover overlay; binary "available" assumes typical greenfield/brownfield siting profile</li>
            <li><span className="font-semibold text-ink">Wetland</span> · EPA NWI (National Wetlands Inventory) check at county centroid; site-level wetlands require per-parcel survey</li>
            <li><span className="font-semibold text-ink">Zoning</span> · surfaced when county code references solar overlay districts, agricultural setbacks, or special-use permits in our notes layer</li>
            <li><span className="font-semibold text-ink">Hosting</span> · proxy from IX ease score until utility hosting-capacity maps are integrated per-territory</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#1D4ED8' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://www.fws.gov/program/national-wetlands-inventory" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">EPA NWI ↗</a>
            <a href="https://www.eia.gov/electricity/data/eia860/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">EIA Form 860 ↗</a>
            <a href="https://www.usgs.gov/centers/eros/science/national-land-cover-database" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">USGS NLCD ↗</a>
          </div>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Site control flags are screening signals. Always confirm with a per-site survey (Phase I ESA, parcel-level wetland delineation, county zoning verification) before committing capital.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}

function InterconnectionCard({ interconnection, stateProgram, stateId, mw, queueSummary }) {
  if (!interconnection) return null
  const { servingUtility, queueStatus, queueStatusCode, easeScore, avgStudyTimeline, queueNotes } = interconnection

  const TREND_ICON = { growing: '↑', stable: '→', shrinking: '↓' }
  const TREND_COLOR = { growing: '#DC2626', stable: '#D97706', shrinking: '#0F766E' }
  const CONGESTION = {
    high:     { label: 'High Congestion',     color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    moderate: { label: 'Moderate Congestion',  color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    low:      { label: 'Low Congestion',       color: '#0F766E', bg: 'rgba(15,118,110,0.08)' },
  }
  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${n.toLocaleString()}`

  return (
    <CollapsibleCard
      accentColor="#D97706"
      eyebrow="02 / Interconnection"
      title={servingUtility || 'Utility TBD'}
      caption="QUEUE & UPGRADE COST CONDITIONS"
    >
      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Utility + queue */}
        <div>
          <SectionLabel>Serving Utility</SectionLabel>
          <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
            <DataRow label="Utility" value={servingUtility} />
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">Queue status</span>
              <QueueBadge statusCode={queueStatusCode} />
            </div>
            <DataRow label="Avg study timeline" value={avgStudyTimeline} />
          </div>
        </div>

        {/* Ease score */}
        <div>
          <SectionLabel>Ease Score</SectionLabel>
          <div className="bg-surface rounded-md px-3 py-3 flex flex-col items-center">
            <EaseArcGauge score={easeScore} />
            <p className="text-xs text-gray-400 mt-1 text-center">
              {easeScore >= 7 ? 'Strong interconnection conditions for this county.'
               : easeScore >= 5 ? 'Moderate difficulty — budget for potential upgrade costs.'
               : easeScore >= 3 ? 'Challenging territory — high upgrade costs likely.'
               : easeScore !== null ? 'Extremely difficult — avoid unless project economics are strong.'
               : 'Score not available for this county.'}
            </p>
          </div>
        </div>

        {/* ISO Queue Data — real numbers from public queue reports */}
        {queueSummary && (
          <div>
            <SectionLabel>Queue Data · {queueSummary.iso}</SectionLabel>
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
            >
              {/* Congestion headline */}
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: CONGESTION[queueSummary.congestionLevel].bg }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CONGESTION[queueSummary.congestionLevel].color }}>
                    {CONGESTION[queueSummary.congestionLevel].label}
                  </span>
                  <span className="text-[10px] text-gray-400">·</span>
                  <span className="text-[10px] text-gray-500 tabular-nums">{queueSummary.totalProjects} solar projects in queue</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-700">{queueSummary.totalMW.toLocaleString()} MW</span>
              </div>

              {/* Aggregate stats */}
              <div className="px-4 py-2.5 grid grid-cols-3 gap-3 bg-white border-b border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{queueSummary.avgStudyMonths}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">mo avg study</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{queueSummary.avgWithdrawalPct}%</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">withdrawal</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#D97706' }}>{fmt(queueSummary.estimatedUpgradeCost)}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">est. upgrade</p>
                </div>
              </div>

              {/* Per-utility breakdown */}
              <div className="px-4 py-2.5 bg-white space-y-2">
                {queueSummary.utilities.map(u => (
                  <div key={u.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-gray-700 truncate">{u.name}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: TREND_COLOR[u.queueTrend] }}>
                        {TREND_ICON[u.queueTrend]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-gray-500 tabular-nums">
                      <span>{u.projectsInQueue} proj</span>
                      <span>{u.avgStudyMonths}mo</span>
                      <span>${(u.avgUpgradeCostMW / 1000).toFixed(0)}K/MW</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-1.5 border-t border-gray-100">
                <p className="text-[9px] text-gray-400">Aggregated from public ISO queue filings. Solar projects &lt;25MW. Updated Q1 2026.</p>
              </div>
            </div>
          </div>
        )}

        {/* Queue notes */}
        {queueNotes && (
          <div>
            <SectionLabel>County Queue Notes</SectionLabel>
            <p className="text-xs text-gray-600 leading-relaxed bg-surface rounded-md px-3 py-2">{queueNotes}</p>
          </div>
        )}

        {/* State-level IX note */}
        {stateProgram?.ixNotes && (
          <div>
            <SectionLabel>State-Level IX Context</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">{stateProgram.ixNotes}</p>
          </div>
        )}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#D97706" label="Ease score methodology · ISO benchmarks">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>How the 1–10 ease score is computed</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">Queue saturation</span> · projects-in-queue / available capacity by serving utility</li>
            <li><span className="font-semibold text-ink">Study timeline</span> · weighted avg system-impact study months across territory</li>
            <li><span className="font-semibold text-ink">Withdrawal rate</span> · % of historical queue applications that withdrew pre-IA execution</li>
            <li><span className="font-semibold text-ink">Upgrade cost severity</span> · $/MW from utility-published cluster results</li>
          </ul>
          <p className="text-[10px] text-gray-500 italic mt-1.5">10 = fast-track-ready (e.g. MISO post-reform); 1 = severely constrained (e.g. PJM saturated zones).</p>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>ISO benchmarks (2024)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">PJM</p>
              <p className="text-amber-900 font-semibold">$1.5M/MW</p>
              <p className="text-amber-700/70 text-[9px]">30 mo avg study</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">MISO</p>
              <p className="text-amber-900 font-semibold">~$500K/MW</p>
              <p className="text-amber-700/70 text-[9px]">12 mo (fast-track)</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">CAISO</p>
              <p className="text-amber-900 font-semibold">$0.8M/MW</p>
              <p className="text-amber-700/70 text-[9px]">18–24 mo</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">NYISO</p>
              <p className="text-amber-900 font-semibold">$1.0M/MW</p>
              <p className="text-amber-700/70 text-[9px]">20–28 mo</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://www.pjm.com/planning/services-requests/interconnection-queues" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">PJM Queue ↗</a>
            <a href="https://www.misoenergy.org/planning/resource-utilization/GIQ/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">MISO GIQ ↗</a>
            <a href="https://www.caiso.com/planning/Pages/QueueManagement/Default.aspx" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">CAISO Queue ↗</a>
            <a href="https://www.nyiso.com/interconnections" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">NYISO IX ↗</a>
          </div>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Ease score is a leading indicator. Confirm interconnection economics with a system-impact study before committing capital — actual upgrade costs vary 2–3× from cluster-average benchmarks.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}

function RevenueStackBar({ revenueStack }) {
  const segments = [
    { label: 'ITC Base',  value: revenueStack.itcBase,          color: '#2563EB' },
    { label: 'ITC Adder', value: revenueStack.itcAdder,         color: '#3B82F6' },
    { label: 'IREC',      value: revenueStack.irecMarket,       color: '#7C3AED' },
    { label: 'Net Meter', value: revenueStack.netMeteringStatus, color: '#059669' },
  ]
  // Parse leading number from string like "30%" or "26%"
  const parse = (v) => { const m = String(v || '').match(/(\d+(\.\d+)?)/) ; return m ? parseFloat(m[1]) : null }
  const nums = segments.map(s => parse(s.value))
  const total = nums.reduce((a, b) => a + (b || 0), 0)
  if (total === 0) return null
  const widths = nums.map(n => ((n || 0) / total) * 100)

  return (
    <div className="mb-3">
      <div className="h-3 rounded-full overflow-hidden flex">
        {segments.map((s, i) => (
          <div key={s.label} style={{ width: `${widths[i]}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevenueProjectionSection({ stateId, mw, rates }) {
  const proj = computeRevenueProjection(stateId, mw, rates)
  if (!proj) {
    if (!hasRevenueData(stateId)) return null
    return (
      <div>
        <SectionLabel>Revenue Projection</SectionLabel>
        <p className="text-xs text-gray-400 italic">Enter project MW above to see estimated annual revenue.</p>
      </div>
    )
  }

  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
  const streams = [
    { label: 'Bill Credits', value: proj.billCreditRevenue, color: '#059669', detail: `${proj.billCreditCentsKwh}¢/kWh` },
    { label: 'REC / SREC',   value: proj.recRevenue,        color: '#7C3AED', detail: proj.recPerMwh > 0 ? `$${proj.recPerMwh}/MWh` : 'N/A' },
    { label: 'ITC (ann.)',    value: proj.itcAnnualized,     color: '#2563EB', detail: `${proj.itcTotalPct}% over 6yr` },
  ]
  const total = proj.annualGrossRevenue

  return (
    <div>
      <SectionLabel>Revenue Projection</SectionLabel>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(20,184,166,0.25)', borderLeft: '3px solid #0F766E' }}
      >
        {/* Headline */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(20,184,166,0.06)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual Revenue</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(total)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Per MW</p>
            <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#0F766E' }}>{fmt(proj.revenuePerMW)}</p>
          </div>
        </div>

        {/* Stream breakdown bar */}
        <div className="px-4 py-2" style={{ background: 'rgba(20,184,166,0.03)' }}>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            {streams.map(s => s.value > 0 && (
              <div
                key={s.label}
                className="rounded-full"
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {streams.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[10px] text-gray-500">{s.label}</span>
                <span className="text-[10px] font-semibold text-gray-700 tabular-nums">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail rows */}
        <div className="px-4 py-2.5 space-y-1.5 bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Annual generation</span>
            <span className="font-semibold text-gray-700 tabular-nums">{proj.annualMWh.toLocaleString()} MWh</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Capacity factor</span>
            <span className="font-semibold text-gray-700 tabular-nums">{proj.capacityFactor}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Installed cost (est.)</span>
            <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.installedCostTotal)} <span className="font-normal text-gray-400">@ ${proj.installedCostPerWatt}/W</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">ITC value (one-time)</span>
            <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
            <span className="text-gray-500">25-year NPV <span className="text-gray-400">(8% discount)</span></span>
            <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv25)}</span>
          </div>
        </div>

        {/* Source note */}
        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-[9px] text-gray-400 leading-relaxed">{proj.notes}</p>
          <p className="text-[9px] text-gray-300 mt-0.5">Estimates only — actual revenue depends on contracted rates, PPA terms, and market conditions.</p>
        </div>
      </div>
    </div>
  )
}

function OfftakeCard({ stateProgram, revenueStack, technology, mw, rates, energyCommunity, nmtcLic, hudQctDda, county }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const runway = stateProgram?.runway ?? null
  const isCS = technology === 'Community Solar'

  return (
    <CollapsibleCard
      accentColor="#0F766E"
      eyebrow="01 / Offtake"
      title={isCS ? (stateProgram?.csProgram || 'No CS Program') : `${technology}`}
      caption={isCS ? 'PROGRAM STATUS · REVENUE STACK' : 'REVENUE PROFILE'}
    >
      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {isCS ? (
          <>
            {/* CS program status — only for Community Solar */}
            <div>
              <SectionLabel>Community Solar Program</SectionLabel>
              {hasProgram ? (
                <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-500">Program</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-800 text-right max-w-[180px] leading-tight">{stateProgram.csProgram}</span>
                      <CSStatusBadge csStatus={stateProgram.csStatus} />
                    </div>
                  </div>
                  <DataRow
                    label="Capacity remaining"
                    value={stateProgram.capacityMW > 0 ? `${stateProgram.capacityMW.toLocaleString()} MW` : '—'}
                    highlight
                  />
                  <DataRow
                    label="LMI allocation required"
                    value={stateProgram.lmiRequired ? `Yes — ${stateProgram.lmiPercent}%` : 'No'}
                  />
                  {mw && stateProgram.capacityMW > 0 && (
                    <DataRow
                      label="Project share of remaining"
                      value={`${((parseFloat(mw) / stateProgram.capacityMW) * 100).toFixed(1)}%`}
                    />
                  )}
                  {runway ? (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-xs text-gray-500">Est. program runway</span>
                      <RunwayBadge runway={runway} />
                    </div>
                  ) : stateProgram?.csStatus !== 'none' && (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-xs text-gray-500">Est. program runway</span>
                      <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-sm">Contact program administrator for current fill status</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-3">
                  <p className="text-xs font-medium text-gray-600">No active community solar program in this state.</p>
                  {stateProgram?.programNotes && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{stateProgram.programNotes}</p>
                  )}
                </div>
              )}
            </div>

            {/* Revenue stack — only for Community Solar */}
            {revenueStack ? (
              <div>
                <SectionLabel>Revenue Stack</SectionLabel>
                <RevenueStackBar revenueStack={revenueStack} />
                <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
                  <DataRow label="ITC base" value={revenueStack.itcBase} highlight />
                  <DataRow label="ITC adders" value={revenueStack.itcAdder} />
                  <DataRow label="REC / I-REC market" value={revenueStack.irecMarket} />
                  <DataRow label="Net metering / credit" value={revenueStack.netMeteringStatus} />
                </div>
                {/* Federal ITC bonus credits panel — Energy Community + §48(e) Cat 1
                    stack on top of the base 30% ITC. A project hitting both adders
                    can reach 50% effective ITC. Live-pulled, both rows verified per
                    county. */}
                <div className="mt-2 px-3 py-2.5 rounded-md border border-teal-100 bg-teal-50/40 space-y-2">
                  {/* Energy Community row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
                        Energy Community (+10% ITC)
                      </div>
                      {energyCommunity?.isEnergyCommunity ? (
                        <>
                          <div className="text-xs font-semibold text-teal-900">
                            ✓ Eligible — {[
                              energyCommunity.qualifiesViaCoalClosure && `${energyCommunity.coalClosureTractCount} coal-closure tract${energyCommunity.coalClosureTractCount === 1 ? '' : 's'}`,
                              energyCommunity.qualifiesViaMsa && (energyCommunity.msaAreaName ? `MSA: ${energyCommunity.msaAreaName}` : 'Statistical area'),
                            ].filter(Boolean).join(' · ')}
                          </div>
                          <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                            Adds 10% to ITC for projects in {energyCommunity.countyName || 'this county'}. Brownfield sites qualify separately.
                          </div>
                        </>
                      ) : energyCommunity === null ? (
                        <>
                          <div className="text-xs text-gray-700">Not flagged in Treasury data</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                            County not in MSA / coal-closure layers. Brownfield qualification still possible at site level.
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">Loading…</div>
                      )}
                    </div>
                    <a
                      href="https://energycommunities.gov/energy-community-tax-credit-bonus/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                    >
                      Source ↗
                    </a>
                  </div>

                  {/* §48(e) Category 1 row */}
                  <div className="pt-2 border-t border-teal-100/60 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
                        §48(e) Cat 1 LIC (+10% ITC)
                      </div>
                      {nmtcLic?.isEligible ? (
                        <>
                          <div className="text-xs font-semibold text-teal-900">
                            ✓ Eligible — {nmtcLic.qualifyingTractsCount} of {nmtcLic.totalTractsInCounty} tract{nmtcLic.totalTractsInCounty === 1 ? '' : 's'} qualify as NMTC LIC
                          </div>
                          <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                            Project sited in any of these tracts adds 10% to ITC (≤5 MW only). Stacks with Energy Community above.
                            {nmtcLic.qualifyingViaPoverty > 0 && nmtcLic.qualifyingViaLowMfi > 0 && (
                              <> Via poverty: {nmtcLic.qualifyingViaPoverty} · via low MFI: {nmtcLic.qualifyingViaLowMfi}.</>
                            )}
                          </div>
                        </>
                      ) : nmtcLic ? (
                        <>
                          <div className="text-xs text-gray-700">No qualifying NMTC LIC tracts in this county</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                            Categories 3-4 (low-income residential / economic benefit) may still qualify — verify with tax counsel.
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">Loading…</div>
                      )}
                    </div>
                    <a
                      href="https://www.energy.gov/diversity/low-income-communities-bonus-credit-program"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                    >
                      Source ↗
                    </a>
                  </div>

                  {/* HUD QCT / Non-Metro DDA row -- LIHTC instrument, NOT ITC.
                      Folded into the same teal-stack panel because it's another
                      federal geographic-designation incentive overlay, but
                      excluded from the ITC ceiling math below since it's a
                      different tax credit. */}
                  <div className="pt-2 border-t border-teal-100/60 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-800 mb-1">
                        HUD QCT / Non-Metro DDA (LIHTC)
                      </div>
                      {hudQctDda && (hudQctDda.qctCount > 0 || hudQctDda.isNonMetroDda) ? (
                        <>
                          <div className="text-xs font-semibold text-teal-900">
                            ✓ Designated — {[
                              hudQctDda.qctCount > 0 && `${hudQctDda.qctCount} Qualified Census Tract${hudQctDda.qctCount === 1 ? '' : 's'}`,
                              hudQctDda.isNonMetroDda && (hudQctDda.ddaName || 'non-metro DDA'),
                            ].filter(Boolean).join(' · ')}
                          </div>
                          <div className="text-[10px] text-teal-700 mt-0.5 leading-snug">
                            LIHTC bonus credit eligibility for hybrid CS + affordable-housing structures. Strong overlap with state CS LMI carve-outs (NY VDER, IL Shines low-income tier, MA SMART LMI adder). Different instrument from ITC — does not stack into the ceiling below.
                          </div>
                        </>
                      ) : hudQctDda ? (
                        <>
                          <div className="text-xs text-gray-700">No QCT or non-metro DDA in {county || 'this county'}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                            Metro-area DDAs are designated at ZCTA level — verify per-site at huduser.gov for metropolitan projects.
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">Loading…</div>
                      )}
                    </div>
                    <a
                      href="https://www.huduser.gov/portal/qct/index.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                    >
                      Source ↗
                    </a>
                  </div>

                  {/* Combined ITC summary — only shown if at least one bonus applies.
                      LIHTC is intentionally excluded since it's a separate instrument. */}
                  {(energyCommunity?.isEnergyCommunity || nmtcLic?.isEligible) && (
                    <div className="pt-2 border-t border-teal-200/60 flex items-baseline justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-teal-900">
                        Combined ITC ceiling
                      </span>
                      <span className="font-serif text-base font-bold text-teal-900">
                        Up to {30 + (energyCommunity?.isEnergyCommunity ? 10 : 0) + (nmtcLic?.isEligible ? 10 : 0)}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">{revenueStack.summary}</p>
                {revenueStack.dsireProgramUrl && (
                  <p className="text-[10px] text-gray-400 mt-1.5 px-1 leading-relaxed">
                    Verified against{' '}
                    <a
                      href={revenueStack.dsireProgramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono uppercase tracking-[0.14em] text-teal-700 hover:text-teal-900 underline"
                    >
                      DSIRE
                    </a>
                    {revenueStack.dsireLastVerified && (
                      <span> · last checked {new Date(revenueStack.dsireLastVerified).toISOString().slice(0, 10)}</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <SectionLabel>Revenue Stack</SectionLabel>
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">ITC base (federal)</span>
                    <span className="font-semibold text-gray-700">30%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">State-specific incentive details available at <a href="https://dsireusa.org" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline hover:text-teal-700">dsireusa.org</a></p>
                </div>
              </div>
            )}

            {/* Revenue Projection — quantitative $/MW estimate */}
            <RevenueProjectionSection stateId={stateProgram?.id} mw={mw} rates={rates} />
          </>
        ) : (
          /* Non-CS technology — structured analysis per tech type */
          <div className="space-y-4">
            <SectionLabel>{technology} Offtake</SectionLabel>

            {technology === 'C&I Solar' && (() => {
              const proj = computeCIRevenueProjection(stateProgram?.id, mw, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(37,99,235,0.25)', borderLeft: '3px solid #2563EB' }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(37,99,235,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual PPA Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Offtaker Savings</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#2563EB' }}>{proj.savingsPercent}%</p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">PPA rate</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.ppaRateCentsKwh}¢/kWh</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">vs. utility retail rate</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.retailRateCentsKwh}¢/kWh</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Annual escalator</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.escalatorPct}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ITC (one-time)</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)} <span className="font-normal text-gray-400">({proj.itcPct}%)</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                          <span className="text-gray-500">25-year NPV <span className="text-gray-400">(8% discount)</span></span>
                          <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv25)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">C&I success depends on anchor tenant credit quality and contract length. PPA rates are state-level estimates.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see C&I PPA revenue projection.'
                          : `C&I PPA revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for C&I; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'BESS' && (() => {
              const proj = computeBESSProjection(stateProgram?.id, mw, 4, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.25)', borderLeft: '3px solid #7C3AED' }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(124,58,237,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payback</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#7C3AED' }}>{proj.paybackYears ? `${proj.paybackYears}yr` : '—'}</p>
                        </div>
                      </div>
                      {/* Three revenue stream tiles */}
                      <div className="grid grid-cols-3 gap-px bg-gray-100">
                        {[
                          { label: 'Capacity Market', value: fmt(proj.capacityRevenue), sub: `$${proj.capacityPerKwYear}/kW-yr`, color: '#7C3AED' },
                          { label: 'Demand Charge', value: fmt(proj.demandChargeRevenue), sub: `$${proj.demandChargePerKwMonth}/kW-mo`, color: '#8B5CF6' },
                          { label: 'Arbitrage', value: fmt(proj.arbitrageRevenue), sub: `$${proj.arbitragePerMwh}/MWh`, color: '#A78BFA' },
                        ].map(s => (
                          <div key={s.label} className="bg-white px-3 py-2.5 text-center">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{s.label}</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">{s.sub}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ISO/RTO region</span>
                          <span className="font-semibold text-gray-700">{proj.isoRegion}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Duration</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{proj.durationHrs}-hour ({proj.mwh} MWh)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Installed cost</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.installedCostTotal)} <span className="font-normal text-gray-400">@ ${proj.installedCostPerKwh}/kWh</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">ITC (one-time)</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)} <span className="font-normal text-gray-400">({proj.itcPct}%)</span></span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                          <span className="text-gray-500">15-year NPV <span className="text-gray-400">(8% discount)</span></span>
                          <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv15)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">Revenue depends on {proj.isoRegion} capacity market pricing — historically volatile. 15-year NPV reflects battery lifecycle.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see BESS revenue projection.'
                          : `BESS revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for BESS; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'Hybrid' && (() => {
              const mwNum = parseFloat(mw) || 0
              const solarMW = mwNum
              const storageMW = Math.round(mwNum * 0.5 * 10) / 10
              const proj = computeHybridProjection(stateProgram?.id, solarMW, storageMW, 4, rates)
              const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
              return (
                <div className="space-y-3">
                  {proj ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(5,150,105,0.25)', borderLeft: '3px solid #059669' }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(5,150,105,0.05)' }}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Combined Revenue</p>
                          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(proj.annualGrossRevenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Revenue / MW</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#059669' }}>{fmt(proj.revenuePerMW)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-gray-100">
                        <div className="bg-white px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Solar ({proj.solarMW} MW)</p>
                          <p className="text-sm font-bold tabular-nums" style={{ color: '#059669' }}>{fmt(proj.solarAnnualRevenue)}<span className="text-[9px] font-normal text-gray-400 ml-1">/yr</span></p>
                        </div>
                        <div className="bg-white px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Storage ({proj.storageMW} MW / {proj.durationHrs}hr)</p>
                          <p className="text-sm font-bold tabular-nums" style={{ color: '#7C3AED' }}>{fmt(proj.storageAnnualRevenue)}<span className="text-[9px] font-normal text-gray-400 ml-1">/yr</span></p>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 space-y-1.5 bg-white">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Total installed cost</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.totalInstalledCost)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Solar 25yr NPV</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.solarNpv25)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Storage 15yr NPV</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.storageNpv15)}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">Hybrid assumes {proj.storageMW}MW / {proj.durationHrs}hr co-located storage. ITC applied at 30% for both solar and storage components.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">
                        {(parseFloat(mw) || 0) === 0
                          ? 'Enter project MW above to see hybrid revenue projection.'
                          : `Hybrid revenue model not available for ${stateProgram?.name || 'this state'}. Tractova currently covers IL, NY, MA, MN, CO, NJ, ME, MD for hybrid; coverage is expanding.`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Program notes — shown for all tech types */}
        {hasProgram && stateProgram.programNotes && (
          <div>
            <SectionLabel>Developer Notes</SectionLabel>
            <p className="text-xs text-gray-600 leading-relaxed">{stateProgram.programNotes}</p>
          </div>
        )}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#0F766E" label="Revenue stack methodology · ITC bonus rules · sources">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>Revenue stack composition</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">ITC base</span> · 30% federal Investment Tax Credit (IRA §48). Available to all utility-scale projects meeting prevailing wage / apprenticeship requirements.</li>
            <li><span className="font-semibold text-ink">ITC adders</span> · stack on the 30% base — Energy Community (+10%), §48(e) Cat 1 LIC (+10%, ≤5MW). Combined ceiling reaches 50% effective ITC for projects qualifying for both.</li>
            <li><span className="font-semibold text-ink">IREC / SREC market</span> · state-level renewable energy certificates. Tradable, $/MWh varies wildly by state (NJ $250, MA $30, IL $80 typical 2024).</li>
            <li><span className="font-semibold text-ink">Net metering / bill credit</span> · the per-kWh value of generation injected into the grid. Subject to NEM tariff rules — see precedent: CA NEM 3.0 cut bill credits 57% in Apr 2023.</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>IRA bonus eligibility (§48 ITC)</p>
          <div className="grid grid-cols-1 gap-1.5 text-[10px]">
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">Energy Community (+10%)</p>
              <p className="text-teal-900 mt-0.5">County-level eligibility via coal-closure tract OR fossil-fuel MSA designation. Brownfield sites qualify separately at site level.</p>
            </div>
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">§48(e) Cat 1 LIC (+10%)</p>
              <p className="text-teal-900 mt-0.5">Project sited in NMTC Low-Income Community tract (poverty rate ≥ 20% OR median income ≤ 80% area). Cap: 5 MW. Allocated annually via Treasury auction.</p>
            </div>
            <div className="rounded-md border border-teal-200/60 bg-teal-50/40 px-2.5 py-1.5">
              <p className="font-mono uppercase tracking-wider text-teal-800 text-[9px] font-bold">HUD QCT / Non-Metro DDA (LIHTC)</p>
              <p className="text-teal-900 mt-0.5">Separate tax credit instrument (LIHTC ≠ ITC). Relevant for hybrid CS + affordable housing financing structures. Does not stack into the ITC ceiling.</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://programs.dsireusa.org/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">DSIRE ↗</a>
            <a href="https://energycommunities.gov/energy-community-tax-credit-bonus/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">DOE Energy Communities ↗</a>
            <a href="https://www.energy.gov/diversity/low-income-communities-bonus-credit-program" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">§48(e) Bonus ↗</a>
            <a href="https://www.huduser.gov/portal/qct/index.html" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">HUD QCT/DDA ↗</a>
            <a href="https://www.irs.gov/credits-deductions/businesses/investment-tax-credit-itc" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">IRS §48 ITC ↗</a>
          </div>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Tariff rates change quarterly. Verify CS program enrollment terms, IRA bonus designations, and current bill-credit values directly with state PUC and tax counsel before committing capital.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Intelligence Summary — pure logic
// ─────────────────────────────────────────────────────────────────────────────
function generateMarketSummary({ stateProgram, countyData, form }) {
  if (!stateProgram) return null

  const { csStatus, csProgram, capacityMW, lmiRequired, lmiPercent, ixDifficulty, feasibilityScore } = stateProgram
  const queueStatus = countyData?.interconnection?.queueStatusCode || 'unknown'
  const { mw, technology, stage, county } = form
  const mwNum = parseFloat(mw) || 0

  // ── Verdict ────────────────────────────────────────────────────────────────
  let verdict, verdictBg, verdictText
  if (feasibilityScore >= 70 && csStatus === 'active' && (ixDifficulty === 'easy' || ixDifficulty === 'moderate')) {
    verdict = 'STRONG FIT';      verdictBg = '#DCFCE7'; verdictText = '#14532D'
  } else if (feasibilityScore >= 55 && (csStatus === 'active' || csStatus === 'limited') && ixDifficulty !== 'very_hard') {
    verdict = 'VIABLE';          verdictBg = '#D1FAE5'; verdictText = '#065F46'
  } else if (feasibilityScore >= 38 || csStatus === 'pending') {
    verdict = 'PROCEED WITH CAUTION'; verdictBg = '#FEF3C7'; verdictText = '#78350F'
  } else if (feasibilityScore >= 18) {
    verdict = 'HIGH FRICTION';   verdictBg = '#FFEDD5'; verdictText = '#7C2D12'
  } else {
    verdict = 'NOT RECOMMENDED'; verdictBg = '#FEE2E2'; verdictText = '#7F1D1D'
  }

  // ── Headline sentence ───────────────────────────────────────────────────────
  let headline = ''
  const stateName = stateProgram.name

  if (csStatus === 'active') {
    if (ixDifficulty === 'easy' && feasibilityScore >= 70) {
      headline = `${stateName} is running an active ${csProgram} with easy interconnection access — among the most developer-friendly markets in the country right now.`
    } else if (ixDifficulty === 'easy') {
      headline = `${stateName} has an active ${csProgram} and easy IX conditions — a clean market for a ${mw}MW project.`
    } else if (ixDifficulty === 'moderate' && feasibilityScore >= 65) {
      headline = `${stateName} combines an active ${csProgram} with moderate IX conditions — strong fundamentals for experienced developers willing to manage queue timelines.`
    } else if (ixDifficulty === 'moderate') {
      headline = `${stateName} has an active ${csProgram}. IX is moderate here — manageable, but budget for study delays and potential upgrade costs.`
    } else if (ixDifficulty === 'hard') {
      headline = `${stateName} has a strong CS program, but interconnection is the limiting factor in ${county} County. Extended study timelines and upgrade costs are real risks — underwrite them before committing.`
    } else {
      headline = `${stateName} has an active ${csProgram}, but IX conditions here are severely constrained. Only projects with exceptional economics can absorb the interconnection risk.`
    }
  } else if (csStatus === 'limited') {
    if (ixDifficulty === 'easy' || ixDifficulty === 'moderate') {
      headline = `Program capacity is tightening in ${stateName} — ${capacityMW}MW remaining in ${csProgram}. IX is workable, but move quickly before the current block closes.`
    } else {
      headline = `${stateName} has limited program capacity (${capacityMW}MW remaining) and difficult IX conditions — a double constraint that demands careful underwriting.`
    }
  } else if (csStatus === 'pending') {
    headline = `No active CS program in ${stateName} yet — legislation is in place but program rules are still being developed at the PUC. Early-mover positioning has value, but there is no live offtake path today.`
  } else {
    if (technology === 'Community Solar') {
      headline = `No community solar framework exists in ${stateName}. This market is not viable for CS development without a policy change — monitor for legislative activity.`
    } else {
      headline = `${stateName} has no community solar program, but ${technology} projects may still find a path through direct utility contracts or virtual PPAs depending on the county.`
    }
  }

  // ── Project-specific qualifier ──────────────────────────────────────────────
  let qualifier = ''
  if (csStatus === 'active' && capacityMW > 0 && mwNum > 0) {
    const pct = ((mwNum / capacityMW) * 100)
    if (pct < 0.5) {
      qualifier = ` At ${mw}MW, your project is a negligible draw on the ${capacityMW.toLocaleString()}MW remaining — no capacity risk.`
    } else if (pct < 3) {
      qualifier = ` At ${mw}MW, you'd represent ${pct.toFixed(1)}% of remaining capacity — a small, low-risk position.`
    } else if (pct < 10) {
      qualifier = ` At ${mw}MW, your project consumes ${pct.toFixed(1)}% of remaining capacity — meaningful exposure to program fluctuations worth monitoring.`
    } else {
      qualifier = ` At ${mw}MW, your project would take ${pct.toFixed(1)}% of remaining capacity — significant concentration risk if the program contracts or pauses enrollment.`
    }
  }

  // ── LMI note ────────────────────────────────────────────────────────────────
  let lmiNote = ''
  if (technology === 'Community Solar' && lmiRequired) {
    if (lmiPercent >= 50) {
      lmiNote = ` The ${lmiPercent}% LMI requirement is a real execution constraint — subscriber sourcing complexity will affect your timeline and cost structure.`
    } else if (lmiPercent >= 30) {
      lmiNote = ` LMI allocation at ${lmiPercent}% is required — factor in subscriber program costs and sourcing timelines.`
    } else {
      lmiNote = ` ${lmiPercent}% LMI allocation required — manageable with the right subscriber program partner.`
    }
  }

  // ── Stage note ──────────────────────────────────────────────────────────────
  let stageNote = ''
  if (stage === 'Pre-Development' && (ixDifficulty === 'hard' || ixDifficulty === 'very_hard')) {
    stageNote = ` In active interconnection here, model upgrade costs before your next milestone — the ease score is a leading indicator.`
  } else if ((stage === 'Prospecting' || stage === 'Site Control') && csStatus === 'limited') {
    stageNote = ` At this stage, confirm program availability directly with your state PUC before committing resources to site control.`
  } else if (stage === 'Prospecting' && csStatus === 'pending') {
    stageNote = ` Early pipeline positioning makes sense, but don't commit capital until program rules are finalized.`
  }

  const summary = headline + qualifier + lmiNote + stageNote

  // ── Signal chips ─────────────────────────────────────────────────────────────
  // V3: cut signals that restate the header status badge, IX card badge, or score
  // gauge. Only emit signals that add context not visible elsewhere on the page.
  const signals = []

  // Capacity-as-percentage of remaining program capacity (unique — not in any card)
  if (csStatus === 'active' && capacityMW > 0 && mwNum > 0) {
    const pct = (mwNum / capacityMW) * 100
    if (pct >= 10) {
      signals.push({ label: `${pct.toFixed(1)}% of remaining capacity`, color: 'red' })
    } else if (pct >= 3) {
      signals.push({ label: `${pct.toFixed(1)}% of remaining capacity`, color: 'amber' })
    }
  }

  // Limited program with concrete MW left (urgency signal not in header)
  if (csStatus === 'limited' && capacityMW > 0) {
    signals.push({ label: `${capacityMW.toLocaleString()}MW left in program`, color: 'amber' })
  }

  // Pending program — urgency signal
  if (csStatus === 'pending') {
    signals.push({ label: 'No live offtake path yet', color: 'yellow' })
  }

  // Queue (only when status differs from IX difficulty signal — adds dimension)
  if (queueStatus !== 'unknown') {
    const qLabel = { open: 'Queue Open', limited: 'Queue Limited', saturated: 'Queue Saturated' }
    const qColor = { open: 'green', limited: 'amber', saturated: 'red' }
    if (qLabel[queueStatus]) {
      signals.push({ label: qLabel[queueStatus], color: qColor[queueStatus] || 'gray' })
    }
  }

  // LMI subscriber count derivative (concrete number — more useful than the % alone)
  if (technology === 'Community Solar' && lmiRequired && lmiPercent > 0 && mwNum > 0) {
    const lmiMW = mwNum * (lmiPercent / 100)
    const approxSubscribers = Math.round(lmiMW * 1000 / 2)
    const color = lmiPercent >= 40 ? 'orange' : 'amber'
    signals.push({ label: `~${approxSubscribers.toLocaleString()} LMI subscribers to source`, color })
  }

  return { verdict, verdictBg, verdictText, summary, signals }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity analysis — score delta + scenario builder
// ─────────────────────────────────────────────────────────────────────────────
function computeScoreDelta(base, override) {
  const modified = { ...base, ...override }

  // IX sub-score (35pt range): easy=33, moderate=24, hard=14, very_hard=5
  const ixSub = { easy: 33, moderate: 24, hard: 14, very_hard: 5 }
  const ixDelta = (ixSub[modified.ixDifficulty] ?? 0) - (ixSub[base.ixDifficulty] ?? 0)

  // CS status sub-score (40pt range)
  const csSub = { active: 34, limited: 21, pending: 11, none: 2 }
  const csDelta = (csSub[modified.csStatus] ?? 0) - (csSub[base.csStatus] ?? 0)

  // LMI penalty (within offtake pillar)
  const lmiPen = (pct, req) => {
    if (!req) return 0
    if (pct >= 50) return -7
    if (pct >= 40) return -5
    if (pct >= 30) return -3
    return pct > 0 ? -1 : 0
  }
  const lmiDelta = lmiPen(modified.lmiPercent ?? base.lmiPercent, modified.lmiRequired ?? base.lmiRequired)
                 - lmiPen(base.lmiPercent, base.lmiRequired)

  const raw = Math.round(ixDelta + csDelta + lmiDelta)
  const newScore = Math.max(5, Math.min(95, base.feasibilityScore + raw))
  return newScore - base.feasibilityScore
}

const IX_LEVELS = ['easy', 'moderate', 'hard', 'very_hard']

function buildSensitivityScenarios(stateProgram, technology, mw) {
  if (!stateProgram) return []
  const { ixDifficulty, csStatus, lmiRequired, lmiPercent, capacityMW, name: stateName, csProgram } = stateProgram
  const ixIdx = IX_LEVELS.indexOf(ixDifficulty)
  const mwNum = parseFloat(mw) || 5
  const scenarios = []

  // IX scenarios
  if (ixIdx < IX_LEVELS.length - 1) {
    const newLevel = IX_LEVELS[ixIdx + 1]
    const timelineMap = { moderate: '12–18 months', hard: '18–30 months', very_hard: '30–48+ months' }
    const costMap = { moderate: '$500K–$1.5M', hard: '$1–3M', very_hard: '$3–6M+' }
    const upgradeCostMap = { moderate: 85000, hard: 150000, very_hard: 350000 }
    const estUpgrade = Math.round((upgradeCostMap[newLevel] ?? 150000) * mwNum)
    scenarios.push({
      id: 'ix_harder',
      label: 'IX cost shock',
      override: { ixDifficulty: newLevel },
      precedent: 'PJM 2024 cluster: $1.5M/MW avg upgrade · 30 mo avg study',
      detail: `Queue conditions deteriorate to ${newLevel.replace('_', ' ')} — same trajectory PJM's 2024 cluster studies showed (avg 30 mo, $1.5M/MW upgrades, ~28% withdrawal rate). Add ${timelineMap[newLevel] ?? '18–30 months'} to your IX study timeline and budget ${costMap[newLevel] ?? '$1–3M'} in potential upgrade costs. At ${mwNum}MW, IX cost exposure could consume a significant portion of program enrollment value.`,
      revenueImpact: `Est. cost: +$${estUpgrade.toLocaleString()} in IX upgrades`,
      timelineImpact: `Study timeline extends to ~${timelineMap[newLevel] ?? '18–30 months'}`,
    })
  }
  if (ixIdx > 0) {
    const newLevel = IX_LEVELS[ixIdx - 1]
    const savingsMap = { easy: 350000, moderate: 150000, hard: 85000 }
    const estSavings = Math.round((savingsMap[newLevel] ?? 150000) * mwNum)
    const timelineSavingsMap = { easy: '6–9 months', moderate: '9–14 months', hard: '14–20 months' }
    scenarios.push({
      id: 'ix_easier',
      label: 'IX fast-track',
      override: { ixDifficulty: newLevel },
      precedent: 'MISO 2023 fast-track: 12 mo studies · sub-$500K/MW',
      detail: `Queue conditions ease to ${newLevel.replace('_', ' ')} — what MISO showed in 2023 with their fast-track cluster reform: 12 mo studies, sub-$500K/MW upgrades. Interconnection timelines compress and upgrade cost risk drops sharply. This is the upside case — valuable for sensitivity modeling but don't underwrite to it without a confirmed study result.`,
      revenueImpact: `Est. savings: $${estSavings.toLocaleString()} on IX upgrades`,
      timelineImpact: `Study timeline compresses to ~${timelineSavingsMap[newLevel] ?? '12–18 months'}`,
    })
  }

  // Program capacity scenarios (CS only)
  if (csStatus === 'active' && capacityMW > 0 && technology === 'Community Solar') {
    const pct = capacityMW > 0 ? Math.round((mwNum / capacityMW) * 100) : null
    const pctStr = pct != null ? ` Your ${mwNum}MW project represents ~${pct}% of remaining capacity.` : ''
    scenarios.push({
      id: 'program_caps',
      label: 'Program cap-out',
      override: { csStatus: 'limited' },
      precedent: 'NJ SuSI 2023: capped in 6 weeks · 18 mo gap before next block',
      detail: `${csProgram ?? stateName} moves to limited capacity — same dynamic NJ's SuSI program saw in 2023 (capped in 6 weeks of opening, 18 mo gap before the next block).${pctStr} Enrollment windows for limited-capacity programs often close within 30–60 days of announcement. Submit your application now or risk missing the window.`,
      revenueImpact: `Risk: enrollment window closes in ~30–60 days`,
      timelineImpact: `Re-open delay: 6–18 months until next block`,
    })
  }
  if (csStatus === 'limited' && technology === 'Community Solar') {
    scenarios.push({
      id: 'new_block',
      label: 'New block opens',
      override: { csStatus: 'active' },
      precedent: 'MA SMART 2024 reopen: 60-day filing rush · 3–5× developer activity',
      detail: `A new capacity block in ${stateName} would immediately unlock enrollment — historically these periods see 3–5x developer activity within the first 60 days, like MA SMART's 2024 reopening. Position your project now so you can file on day one. Monitor the state PUC docket for block announcement filings.`,
      revenueImpact: `Upside: full enrollment economics restored`,
      timelineImpact: `First-mover advantage: ~60-day filing window`,
    })
  }

  // LMI scenarios (community solar only)
  if (technology === 'Community Solar') {
    if (!lmiRequired || lmiPercent < 50) {
      const lmiSubs = Math.round(mwNum * 250)
      const revenueHaircut = Math.round(mwNum * 8760 * 0.17 * 0.085 * 0.125) // ~12.5% of bill credit revenue
      scenarios.push({
        id: 'lmi_rises',
        label: 'LMI carveout raised to 50%',
        override: { lmiRequired: true, lmiPercent: 50 },
        precedent: 'NY VDER 2023: 50% LMI carveout · 9 mo aggregator ramp',
        detail: `A 50% LMI requirement means sourcing ~${lmiSubs.toLocaleString()} low-income subscriber households for a ${mwNum}MW project — same shift NY VDER saw in 2023 when carveouts were raised. Budget 6–9 months for aggregator contracting and expect a 10–15% revenue haircut to attract compliant subscribers.`,
        revenueImpact: `Est. revenue haircut: ~$${revenueHaircut.toLocaleString()}/yr`,
        timelineImpact: `Adds 6–9 months for aggregator contracting`,
      })
    }
    if (lmiRequired && lmiPercent > 0) {
      scenarios.push({
        id: 'lmi_removed',
        label: 'LMI carveout removed',
        override: { lmiRequired: false, lmiPercent: 0 },
        precedent: 'CO Comm Solar Garden: full retail subscriber pool · no LMI minimum',
        detail: `Removing the LMI requirement opens the full commercial and residential subscriber market — what CO Community Solar Gardens have always allowed. Dramatically easier customer acquisition and stronger bill credit economics. This is the regulatory upside case; watch for pending state PUC proceedings on LMI carveout rules.`,
        revenueImpact: `Upside: ~10–15% lift on bill credit revenue`,
        timelineImpact: `Subscriber acquisition compresses by 4–6 months`,
      })
    }
  }

  // C&I Solar scenarios
  if (technology === 'C&I Solar') {
    const ciAnnualMWh = mwNum * 8760 * 0.17
    const ciDropRevenue = Math.round(ciAnnualMWh * 1000 * 0.07 * 0.15)
    scenarios.push({
      id: 'ci_ppa_drop',
      label: 'PPA rate −15%',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'CA NEM 3.0 (Apr 2023): −57% bill credit reset',
      detail: `A 15% PPA rate reduction compresses annual revenue and weakens the 25-year NPV substantially — small relative to CA's NEM 3.0 reset (Apr 2023, −57% bill credit) but illustrative of the same regulatory pressure on offtaker demand for below-market rates. Below 5.5¢/kWh is typically uneconomic in most markets.`,
      revenueImpact: `Annual revenue: -$${ciDropRevenue.toLocaleString()}`,
      timelineImpact: `25-year NPV impact: significant downside`,
    })
    scenarios.push({
      id: 'ci_rate_rise',
      label: 'Retail rate +3%/yr',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Northeast IOUs 2020–2024: 3–5% annual rate hikes',
      detail: `Rising utility retail rates increase your offtaker's savings from the PPA and reduce re-contracting risk at term. The 3–5% trajectory matches Northeast IOUs from 2020–2024 (PSEG, Eversource, ConEd). At 3% annual escalation, the spread between your PPA and retail widens by ~50% over 10 years — this is the upside case for long-term C&I PPAs.`,
      revenueImpact: `Spread widens ~50% over 10 years`,
      timelineImpact: `Stronger re-contracting position at term`,
    })
    const ciDefaultGWh = Math.round(ciAnnualMWh * 20 / 1000)
    scenarios.push({
      id: 'ci_default',
      label: 'Offtaker default (yr 5)',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Industry trend: re-contracting takes 3–6 mo · 5–10% rate concession',
      detail: `Offtaker default in year 5 means re-contracting the remaining output. Re-contracting typically takes 3–6 months and may require a 5–10% rate concession. Credit risk is the #1 C&I concern — underwrite tenant creditworthiness before signing the PPA.`,
      revenueImpact: `Re-contracting concession: 5–10% rate haircut`,
      timelineImpact: `Re-contracting takes 3–6 months · ~${ciDefaultGWh.toLocaleString()} GWh exposed`,
    })
  }

  // BESS scenarios
  if (technology === 'BESS') {
    const bessCapDropPerYear = Math.round(mwNum * 1000 * 65 * 0.30) // 30% of $65/kW-yr
    scenarios.push({
      id: 'bess_cap_drop',
      label: 'Capacity prices −30%',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'PJM 2024 BRA: capacity prices swung 30–60% between cycles',
      detail: `A 30% capacity market decline reduces the largest BESS revenue stream significantly. PJM's 2024 base residual auction showed capacity prices can swing 40–60% between cycles, and ISO-NE has seen similar volatility. If capacity revenue drops, demand charge reduction and arbitrage must carry the project — stress-test your pro forma with floor-case capacity pricing.`,
      revenueImpact: `Capacity revenue: -$${bessCapDropPerYear.toLocaleString()}/yr`,
      timelineImpact: `Persists through next ISO auction cycle (3 years)`,
    })
    scenarios.push({
      id: 'bess_degrade',
      label: 'Degradation 3%/yr (vs 2.5% pro forma)',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Industry empirical: real-world cells 3% vs assumed 2.5%',
      detail: `At 3% annual degradation vs the typical 2.5% assumption, you lose ~8% more throughput by year 10 and ~15% by year 15. Real-world Tesla Megapack and CATL deployments have shown closer to 3% than the 2.5% modeled in most pro formas. This directly impacts arbitrage revenue and may trigger warranty-related capacity shortfalls.`,
      revenueImpact: `~15% throughput loss by year 15`,
      timelineImpact: `Warranty risk inflection: years 8–10`,
    })
    const bessDemandUpside = Math.round(mwNum * 1000 * 12)
    scenarios.push({
      id: 'bess_demand_up',
      label: 'Demand charges rise',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'CA IOUs 2020–2023: 3–8% annual demand charge increase',
      detail: `Rising demand charges are the BESS upside case. CA IOUs (PG&E, SCE, SDG&E) have raised commercial demand charges 3–8% annually from 2020–2023. This trend favors behind-the-meter BESS economics.`,
      revenueImpact: `Upside: +$${bessDemandUpside.toLocaleString()}/yr per $1/kW-mo increase`,
      timelineImpact: `Compounds over 25-year asset life`,
    })
  }

  // Hybrid scenarios
  if (technology === 'Hybrid') {
    const hybridITCLoss = Math.round(mwNum * 0.5 * 4 * 1000 * 380 * 0.10)
    scenarios.push({
      id: 'hybrid_itc_drop',
      label: 'What if storage ITC drops to 30%?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Losing the 10% co-location bonus reduces ITC value on the storage component. The co-location bonus under IRA Section 48 requires the storage to be placed in service with the solar facility — timeline delays that decouple the assets risk this adder.`,
      revenueImpact: `One-time ITC loss: -$${hybridITCLoss.toLocaleString()}`,
      timelineImpact: `Risk window: any decoupling of solar/storage COD`,
    })
    scenarios.push({
      id: 'hybrid_clip',
      label: 'What if solar clipping is 8%+?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Solar clipping above 8% means the inverter is curtailing more generation than expected — reducing both bill credit revenue and the energy available for storage charging. Right-size the DC/AC ratio and storage duration to minimize clipping losses. Typical hybrid designs target 3–5% clipping.`,
      revenueImpact: `~3–5% revenue reduction from clipping above target`,
      timelineImpact: `Mitigated via DC/AC ratio + storage duration tuning`,
    })
  }

  return scenarios.slice(0, 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Intelligence Summary — component
// ─────────────────────────────────────────────────────────────────────────────
const CHIP_COLORS = {
  green:  { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  teal:   { bg: '#CCFBF1', text: '#134E4A', dot: '#0D9488' },
  amber:  { bg: '#FEF3C7', text: '#78350F', dot: '#D97706' },
  yellow: { bg: '#FEF9C3', text: '#713F12', dot: '#CA8A04' },
  orange: { bg: '#FFEDD5', text: '#7C2D12', dot: '#EA580C' },
  red:    { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626' },
  gray:   { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
}

// §7.4: scenario state lifted to SearchContent; we read it from props now.
function MarketIntelligenceSummary({ stateProgram, countyData, form, aiInsight, activeScenario, scenarioRationale, setScenarioRationale, rationaleLoading, setRationaleLoading }) {
  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const effectiveSub = computeSubScores(effectiveProgram, countyData, form.stage, form.technology)
  effectiveProgram.feasibilityScore = computeDisplayScore(effectiveSub.offtake, effectiveSub.ix, effectiveSub.site)
  const data = generateMarketSummary({ stateProgram: effectiveProgram, countyData, form })

  // Brief feedback loop: when a scenario toggles, pulse a "Brief Updated"
  // indicator AND smooth-scroll the brief into view -- but only if it
  // isn't already visible. Visibility check is read FIRST and the scroll
  // call only fires when needed; this fixes a mobile flash where the page
  // would snap up only to settle in place when the brief was already on
  // screen. Previously a sole opacity dim was the only signal -- too
  // subtle for first-time users to notice.
  const articleRef = useRef(null)
  const [pulseKey, setPulseKey] = useState(0)
  useEffect(() => {
    if (!activeScenario) return
    setPulseKey(k => k + 1)
    if (!articleRef.current) return
    const rect = articleRef.current.getBoundingClientRect()
    // Treat "visible" generously -- brief is in-frame if its top is at
    // least partially within the upper 80% of the viewport.
    const isVisible = rect.top >= 0 && rect.top < window.innerHeight * 0.80
    if (isVisible) return
    articleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeScenario?.id])

  // Fetch AI rationale when a scenario activates. Cleared on deactivation.
  useEffect(() => {
    if (!activeScenario || !stateProgram) {
      setScenarioRationale(null)
      return
    }
    let cancelled = false
    setRationaleLoading(true)
    setScenarioRationale(null)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setRationaleLoading(false); return }
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'sensitivity',
            state: form.state,
            county: form.county,
            mw: form.mw,
            stage: form.stage,
            technology: form.technology,
            scenario: activeScenario.label,
            override: activeScenario.override,
            baseScore: stateProgram.feasibilityScore,
            newScore: effectiveProgram.feasibilityScore,
            stateProgram,
            countyData,
          }),
        })
        if (cancelled) return
        if (!res.ok) { setRationaleLoading(false); return }
        const json = await res.json()
        if (!cancelled) {
          setScenarioRationale(json.rationale || null)
          setRationaleLoading(false)
        }
      } catch {
        if (!cancelled) setRationaleLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeScenario?.id])

  if (!data) return null

  const { verdict, verdictBg, verdictText, summary, signals } = data
  const scenarios = buildSensitivityScenarios(stateProgram, form.technology, form.mw)

  const cleanBrief = sanitizeBrief(aiInsight?.brief)
  // AI brief always shown when available — serves as base case anchor even in scenario mode
  const showAI = !!aiInsight && !!cleanBrief

  return (
    <article
      ref={articleRef}
      className="mb-6 bg-white rounded-lg overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* V3 redesign: editorial-research-note pattern.
          Top teal hairline rail, then mono eyebrow strip, then pull-quote AI brief
          with drop-cap. Replaces the prior navy header band entirely. */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }} />

      {/* Eyebrow metadata strip */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Analyst Brief
          </span>
          {showAI && (
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
                  style={{ background: 'rgba(20,184,166,0.10)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.30)' }}>
              ◆ Claude · Sonnet 4.6
            </span>
          )}
          {activeScenario && (
            <motion.span
              key={pulseKey}
              initial={{ scale: 1, boxShadow: '0 0 0 0 rgba(245,158,11,0.55)' }}
              animate={{ scale: [1, 1.06, 1], boxShadow: ['0 0 0 0 rgba(245,158,11,0.55)', '0 0 0 6px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0)'] }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#92400E', border: '1px solid rgba(245,158,11,0.30)' }}
            >
              Scenario Mode · Brief Updated
            </motion.span>
          )}
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
          style={{ background: verdictBg, color: verdictText }}
        >
          {verdict}
        </span>
      </div>

      {/* Body — editorial composition */}
      <div className="px-6 py-6">

        {/* AI brief as a pull-quote with serif drop-cap.
            This is the differentiated value the user is paying for —
            present it with conviction, not in a chrome-heavy chatbot tile. */}
        {showAI ? (
          <div className={`relative ${activeScenario ? 'opacity-60' : ''}`}>
            {activeScenario && (
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-2" style={{ color: '#0F766E' }}>
                — Base Analysis —
              </p>
            )}
            <p
              className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85] first-letter:font-serif"
              style={{ letterSpacing: '-0.005em' }}
            >
              {cleanBrief}
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85]">
            {summary}
          </p>
        )}

        {/* Scenario overlay — shown when a scenario is active */}
        {activeScenario && (() => {
          const delta = computeScoreDelta(stateProgram, activeScenario.override)
          const positive = delta > 0
          return (
            <div
              className="mt-4 rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
            >
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(217,119,6,0.08)' }}>
                <div className="flex items-center gap-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: '#92400E' }}>
                    Scenario · {activeScenario.label.replace('What if ', '').replace('?', '')}
                  </span>
                </div>
                <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded ${
                  positive ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Score impact: {positive ? '+' : ''}{delta} pts
                </span>
              </div>
              <div className="px-4 py-3 bg-white">
                {/* Precedent anchor — what real-world event/market this scenario mirrors.
                    Makes scenarios concrete instead of abstract "what ifs". */}
                {activeScenario.precedent && (
                  <div className="mb-2.5 flex items-baseline gap-2 flex-wrap">
                    <span className="text-[8px] font-bold uppercase tracking-[0.20em] px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.25)' }}>
                      Precedent
                    </span>
                    <span className="text-[11px] font-mono leading-snug" style={{ color: '#7C3500' }}>
                      {activeScenario.precedent}
                    </span>
                  </div>
                )}
                <p className="text-[13px] font-medium text-gray-800 leading-relaxed">
                  {activeScenario.detail ?? summary}
                </p>
                {(activeScenario.revenueImpact || activeScenario.timelineImpact) && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {activeScenario.revenueImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200">
                        {activeScenario.revenueImpact}
                      </span>
                    )}
                    {activeScenario.timelineImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border bg-amber-50 text-amber-700 border-amber-200">
                        {activeScenario.timelineImpact}
                      </span>
                    )}
                  </div>
                )}
                {/* V3: AI rationale block -- teal accent (was violet) */}
                {(rationaleLoading || scenarioRationale) && (
                  <div
                    className="mt-3 pt-3 rounded-sm px-3 py-2"
                    style={{
                      borderTop: '1px dashed rgba(20,184,166,0.30)',
                      background: 'rgba(20,184,166,0.04)',
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(15,118,110,0.85)' }}>
                      AI Rationale
                    </p>
                    {rationaleLoading ? (
                      <div className="flex items-center gap-2.5 py-0.5">
                        <TractovaLoader size={28} />
                        <p className="text-[11px] text-gray-500 leading-tight">Analyzing scenario impact…</p>
                      </div>
                    ) : (
                      <p className="text-[12px] text-gray-700 leading-relaxed">{scenarioRationale}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* V3: AI Spotlight as side-rule blocks (no fill, just left rule + eyebrow + body)
            Editorial pattern -- looks like a sidebar in a research note, not a colored card */}
        {showAI && !activeScenario && (aiInsight.primaryRisk || aiInsight.topOpportunity) && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-5 border-t border-gray-100">
            {aiInsight.primaryRisk && (
              <div className="pl-4" style={{ borderLeft: '2px solid #DC2626' }}>
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: '#DC2626' }}>
                  Primary Risk
                </p>
                <p className="text-[13px] text-ink leading-[1.55]">{aiInsight.primaryRisk}</p>
              </div>
            )}
            {aiInsight.topOpportunity && (
              <div className="pl-4" style={{ borderLeft: '2px solid #0F766E' }}>
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
                  Top Opportunity
                </p>
                <p className="text-[13px] text-ink leading-[1.55]">{aiInsight.topOpportunity}</p>
              </div>
            )}
          </div>
        )}

        {/* V3: Ticker-tape signal strip -- mono caps, hairline-divided, no boxed cards */}
        {signals.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400 mb-2">
              Decision Signals
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
              {signals.map((sig, i) => {
                const c = CHIP_COLORS[sig.color] || CHIP_COLORS.gray
                return (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="w-1 h-3" style={{ background: c.dot }} />
                    <span className="text-ink">{sig.label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* V3: Immediate Action — editorial side-rule block (was filled tile) */}
        {showAI && aiInsight.immediateAction && (
          <div className="mt-6 pt-5 border-t border-gray-100 pl-4" style={{ borderLeftWidth: 0, position: 'relative' }}>
            <div className="absolute left-0 top-5 bottom-0 w-[2px]" style={{ background: '#14B8A6' }} />
            <div className="flex items-start gap-3 ml-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-1">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: '#0F766E' }}>
                  Immediate Action — Next 30 Days
                </p>
                <p className="text-[14px] text-ink leading-[1.55] font-medium">{aiInsight.immediateAction}</p>
              </div>
            </div>
          </div>
        )}

        {/* V3 §9.2: Stage Guidance — editorial side-rule pattern (matches the
            Primary Risk / Top Opportunity / Immediate Action rhythm above).
            No filled box, no inline icon — mono caps eyebrow + ink body carry
            the institutional feel. */}
        {showAI && aiInsight.stageSpecificGuidance && (
          <div className="mt-5 pt-5 border-t border-gray-100 pl-4" style={{ position: 'relative' }}>
            <div className="absolute left-0 top-5 bottom-0 w-[2px]" style={{ background: '#0F766E' }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
              Stage Guidance — {form.stage || 'General'}
            </p>
            <p className="text-[14px] text-ink leading-[1.55]">{aiInsight.stageSpecificGuidance}</p>
          </div>
        )}

        {/* V3 §9.2: Competitive Context — same editorial pattern, blue accent
            (intentional category-encoding per V3 §7.4 — distinct from teal
            site/offtake and amber IX/caution). */}
        {showAI && aiInsight.competitiveContext && (
          <div className="mt-5 pt-5 border-t border-gray-100 pl-4" style={{ position: 'relative' }}>
            <div className="absolute left-0 top-5 bottom-0 w-[2px]" style={{ background: '#2563EB' }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: '#1D4ED8' }}>
              Competitive Context
            </p>
            <p className="text-[14px] text-ink leading-[1.55]">{aiInsight.competitiveContext}</p>
          </div>
        )}

        {/* §7.4: Sensitivity panel + CustomScenarioBuilder MOVED to LensScenarioRow
            (rendered next to the gauge in MarketPositionPanel) so toggling
            updates the score in place — no scroll-up required. The rationale
            (when a scenario is active) still surfaces via the scenario overlay
            block above. */}
      </div>
    </article>
  )
}

// V3 §7.4: Scenario toggle row — sits directly under MarketPositionPanel.
// Toggling a scenario lifts the override into shared state so the gauge above
// re-renders with the new score in place. No more scroll-up to see impact.
function LensScenarioRow({ stateProgram, technology, mw, activeScenario, setActiveScenario, countyData, formForApi, programMap }) {
  const [customOpen, setCustomOpen] = useState(false)
  if (!stateProgram) return null
  const scenarios = buildSensitivityScenarios(stateProgram, technology, mw)
  const isCustomActive = activeScenario?.id === 'custom'
  if (scenarios.length === 0 && !stateProgram) return null

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5A6B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold text-ink">
            What If — Sensitivity Scenarios
          </p>
        </div>
        {activeScenario && (
          <button
            onClick={() => { setActiveScenario(null); setCustomOpen(false) }}
            className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-sm transition-colors"
            style={{ color: '#0F766E' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sensitivity scenarios">
        {scenarios.map(scn => {
          const isActive = activeScenario?.id === scn.id
          const button = (
            <button
              key={scn.id}
              onClick={() => setActiveScenario(isActive ? null : scn)}
              aria-pressed={isActive}
              aria-label={`Sensitivity scenario: ${scn.label}`}
              className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-sm transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
              style={isActive
                ? { background: '#0F1A2E', color: '#5EEAD4', border: '1px solid #14B8A6' }
                : { background: 'white', color: '#0A1828', border: '1px solid #E2E8F0' }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#14B8A6'; e.currentTarget.style.color = '#0F766E' } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#0A1828' } }}
            >
              {scn.label.replace('What if ', '').replace('?', '')}
            </button>
          )
          // Wrap in tooltip when there's a precedent so hover surfaces the
          // real-world anchor without requiring a click. Plain button for
          // legacy scenarios without precedent (e.g. ad-hoc custom).
          return scn.precedent ? (
            <Tooltip key={scn.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="text-[10px] max-w-xs">
                <p className="font-bold mb-1" style={{ color: '#FBBF24' }}>Precedent</p>
                <p className="text-gray-300">{scn.precedent}</p>
              </TooltipContent>
            </Tooltip>
          ) : button
        })}
        {/* + Peer state toggle — opens inline state-mirror picker.
            Replaces the previous "+ Custom" two-dropdown overrider, which
            was abstract and felt useless next to the precedent-anchored
            preset chips. Now: pick another state, the scenario applies
            its full profile and surfaces a concrete diff. */}
        <button
          onClick={() => { setCustomOpen(o => !o); if (isCustomActive) setActiveScenario(null) }}
          aria-expanded={customOpen}
          aria-pressed={isCustomActive}
          aria-label="Compare this market to a peer state"
          className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-sm transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
          style={isCustomActive
            ? { background: '#0F1A2E', color: '#5EEAD4', border: '1px solid #14B8A6' }
            : { background: 'white', color: '#0A1828', border: '1px dashed #94A3B8' }}
        >
          {customOpen || isCustomActive ? '− Peer state' : '+ Peer state'}
        </button>
      </div>

      {/* Inline peer-state picker — drives the same lifted activeScenario state */}
      {customOpen && (
        <CustomScenarioInline
          stateProgram={stateProgram}
          technology={technology}
          activeScenario={activeScenario}
          setActiveScenario={setActiveScenario}
          programMap={programMap}
        />
      )}
    </div>
  )
}

// V3 §7.5: Inline custom scenario builder. Drives the same activeScenario state
// so toggling a custom override updates the gauge above just like preset scenarios.
// V3.1: Peer-state mode replaces the previous two-dropdown "Custom" builder.
// Instead of free-form IX/CS overrides (abstract, not market-anchored), the
// user picks another real state and the scenario applies that state's full
// profile to the current view. Reads as: "What would this market look like
// if it adopted California's NEM 3.0? Massachusetts SMART? Illinois LMI
// requirements?" -- the same precedent-anchored framing used by the preset
// chips, just with the user choosing the precedent instead of us proposing it.
function CustomScenarioInline({ stateProgram, technology, activeScenario, setActiveScenario, programMap }) {
  const isActive = activeScenario?.id === 'custom'
  const peerStateId = isActive ? (activeScenario.peerStateId || '') : ''
  // V3.1: native <select> rendered as the OS chrome list (white,
  // unstyled, system-default). Replaced with a custom popup list so
  // each option can show the peer's program/IX/LMI as styled mono
  // captions and the open list matches the rest of the app.
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  // Eligible peers: any state with a real CS program, excluding self.
  const peerOptions = Object.values(programMap || {})
    .filter(s => s.id && s.id !== stateProgram?.id)
    .filter(s => s.csStatus && s.csStatus !== 'none')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const selectedPeer = peerStateId ? programMap?.[peerStateId] : null

  const handlePick = (peerId) => {
    if (!peerId) {
      if (isActive) setActiveScenario(null)
      return
    }
    const peer = programMap?.[peerId]
    if (!peer || !stateProgram) return

    const override = {
      ixDifficulty: peer.ixDifficulty,
      csStatus:     peer.csStatus,
      lmiRequired:  peer.lmiRequired,
      lmiPercent:   peer.lmiPercent,
      capacityMW:   peer.capacityMW,
    }

    // Structured diff: each row keeps {field, from, to, tone} so the UI
    // can render a proper labeled comparison row instead of a plain string
    // bullet list. Tone is teal when the shift is generally favorable to
    // the operator (looser CS, lower LMI, easier IX, more capacity), amber
    // otherwise. Used downstream in the diff readout component.
    const IX_RANK = { easy: 4, moderate: 3, hard: 2, very_hard: 1 }
    const CS_RANK = { active: 4, limited: 3, pending: 2, none: 1 }
    const fmtIX = (v) => v ? v.replace('_', ' ') : '—'
    const fmtMW = (v) => v ? (v >= 1000 ? `${(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`) : '—'

    const diffs = []
    if (peer.ixDifficulty && peer.ixDifficulty !== stateProgram.ixDifficulty) {
      const tone = (IX_RANK[peer.ixDifficulty] || 0) >= (IX_RANK[stateProgram.ixDifficulty] || 0) ? 'good' : 'bad'
      diffs.push({ field: 'IX Difficulty', from: fmtIX(stateProgram.ixDifficulty), to: fmtIX(peer.ixDifficulty), tone })
    }
    if (peer.csStatus && peer.csStatus !== stateProgram.csStatus) {
      const tone = (CS_RANK[peer.csStatus] || 0) >= (CS_RANK[stateProgram.csStatus] || 0) ? 'good' : 'bad'
      diffs.push({ field: 'CS Status', from: stateProgram.csStatus || '—', to: peer.csStatus, tone })
    }
    if ((peer.lmiPercent || 0) !== (stateProgram.lmiPercent || 0)) {
      // Lower LMI = easier subscriber sourcing for the developer
      const tone = (peer.lmiPercent || 0) < (stateProgram.lmiPercent || 0) ? 'good' : 'bad'
      diffs.push({ field: 'LMI Carveout', from: `${stateProgram.lmiPercent || 0}%`, to: `${peer.lmiPercent || 0}%`, tone })
    }
    if ((peer.capacityMW || 0) !== (stateProgram.capacityMW || 0)) {
      const tone = (peer.capacityMW || 0) > (stateProgram.capacityMW || 0) ? 'good' : 'bad'
      diffs.push({ field: 'Program Capacity', from: fmtMW(stateProgram.capacityMW), to: fmtMW(peer.capacityMW), tone })
    }

    // Compact prose summary for the active-scenario overlay panel below.
    const diffSummary = diffs.length > 0
      ? diffs.map(d => `${d.field} ${d.from} → ${d.to}`).join('; ')
      : ''

    setActiveScenario({
      id: 'custom',
      peerStateId: peerId,
      label: `Peer profile · ${peer.name}`,
      override,
      precedent: `${peer.name} profile${peer.csProgram ? ` (${peer.csProgram})` : ''} applied to ${stateProgram.name || 'this market'}`,
      detail: diffs.length > 0
        ? `What if ${stateProgram.name || 'this market'} adopted ${peer.name}'s policy + IX profile? ${diffs.length} key shift${diffs.length === 1 ? '' : 's'}: ${diffSummary}. Useful for benchmarking how a peer state's regulatory environment would reshape this county's feasibility.`
        : `${peer.name}'s policy and IX profile is identical to this state on the dimensions our model tracks -- no score impact expected.`,
      revenueImpact: peer.csProgram ? `Adopt ${peer.csProgram} program rules` : null,
      timelineImpact: peer.ixDifficulty
        ? `Adopt ${peer.name}-equivalent IX cluster timing`
        : null,
      diffs,
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-ink-muted">
          Compare to peer state
        </p>
        <p className="font-mono text-[9px] text-gray-400">
          {peerOptions.length} states with active programs
        </p>
      </div>
      {/* Styled custom dropdown — open list matches the rest of the app's
          field selectors (FieldSelect, CountyCombobox). Each option is
          a 2-line row: state name on top, mono-caps caption with the
          peer's program / IX / LMI shape underneath. */}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-left transition-colors focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 hover:border-gray-300"
        >
          <div className="flex items-center justify-between gap-2">
            {selectedPeer ? (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink leading-tight truncate">
                  {selectedPeer.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted truncate mt-0.5">
                  {[
                    selectedPeer.csProgram,
                    selectedPeer.ixDifficulty && `IX ${selectedPeer.ixDifficulty.replace('_', ' ')}`,
                    (selectedPeer.lmiPercent || 0) > 0 && `${selectedPeer.lmiPercent}% LMI`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">Select a peer state to mirror its profile…</span>
            )}
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-150 ${pickerOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {pickerOpen && (
          <ul
            role="listbox"
            className="absolute z-50 left-0 top-full mt-1.5 w-full bg-white border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
          >
            {/* Clear option, only when something is selected */}
            {peerStateId && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handlePick(''); setPickerOpen(false) }}
                className="px-3.5 py-2 text-[11px] uppercase font-mono tracking-[0.18em] text-gray-400 hover:bg-gray-50 hover:text-gray-600 cursor-pointer transition-colors border-b border-gray-100"
              >
                ✕ Clear peer comparison
              </li>
            )}
            {peerOptions.map((s) => {
              const isCurrent = s.id === peerStateId
              return (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={isCurrent}
                  onMouseDown={(e) => { e.preventDefault(); handlePick(s.id); setPickerOpen(false) }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                    isCurrent ? 'bg-teal-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-teal-700' : 'text-transparent'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-tight truncate ${isCurrent ? 'font-semibold text-teal-800' : 'font-medium text-ink'}`}>
                      {s.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted truncate mt-0.5">
                      {[
                        s.csProgram,
                        s.ixDifficulty && `IX ${s.ixDifficulty.replace('_', ' ')}`,
                        (s.lmiPercent || 0) > 0 && `${s.lmiPercent}% LMI`,
                      ].filter(Boolean).join(' · ') || 'Active CS · profile shape unavailable'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Live diff readout once a peer is selected. Each row is a structured
          field/from/to comparison rendered as a labeled grid -- field name on
          the left in mono caps, before-value in muted ink, an arrow keyed to
          the tone (teal for favorable shifts, amber for unfavorable), then the
          after-value. Replaces the previous bullet-list-of-strings render. */}
      {isActive && Array.isArray(activeScenario?.diffs) && activeScenario.diffs.length > 0 && (
        <div
          className="mt-3 rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(20,184,166,0.04) 0%, rgba(20,184,166,0.08) 100%)',
            border: '1px solid rgba(20,184,166,0.22)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ borderBottom: '1px solid rgba(20,184,166,0.18)' }}
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.20em]" style={{ color: '#0F766E' }}>
              Profile shifts
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-500 tabular-nums">
              {activeScenario.diffs.length} change{activeScenario.diffs.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {activeScenario.diffs.map((d) => {
              const arrowColor = d.tone === 'good' ? '#0F766E' : '#B45309'
              const toBg       = d.tone === 'good' ? 'rgba(15,118,110,0.10)' : 'rgba(180,83,9,0.10)'
              const toBorder   = d.tone === 'good' ? 'rgba(15,118,110,0.28)' : 'rgba(180,83,9,0.28)'
              const toText     = d.tone === 'good' ? '#0F766E' : '#92400E'
              return (
                <div
                  key={d.field}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: 'minmax(0, 110px) minmax(0, 1fr) 14px minmax(0, 1fr)' }}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-muted whitespace-nowrap">
                    {d.field}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 truncate">
                    {d.from}
                  </span>
                  <span aria-hidden className="flex items-center justify-center" style={{ color: arrowColor }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                  <span
                    className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-sm justify-self-start truncate"
                    style={{ color: toText, background: toBg, border: `1px solid ${toBorder}` }}
                  >
                    {d.to}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {isActive && Array.isArray(activeScenario?.diffs) && activeScenario.diffs.length === 0 && (
        <p className="mt-2 text-[11px] text-ink-muted italic">
          Peer profile matches this state on every dimension we model — no shift to evaluate.
        </p>
      )}

      <p className="font-mono text-[9px] text-ink-muted mt-2 leading-snug">
        Applies the peer state's IX difficulty, CS status, LMI carveout, and program cap. Index updates live in the gauge above.
      </p>
    </div>
  )
}

// ── Custom Scenario Builder ─────────────────────────────────────────────────
function CustomScenarioBuilder({ stateProgram, technology }) {
  const [open, setOpen] = useState(false)
  const [customIX, setCustomIX] = useState(stateProgram?.ixDifficulty || 'moderate')
  const [customCS, setCustomCS] = useState(stateProgram?.csStatus || 'active')

  if (!stateProgram) return null

  const override = {}
  if (customIX !== stateProgram.ixDifficulty) override.ixDifficulty = customIX
  if (customCS !== stateProgram.csStatus) override.csStatus = customCS
  const hasChange = Object.keys(override).length > 0
  const delta = hasChange ? computeScoreDelta(stateProgram, override) : 0

  return (
    <div className="mt-3 rounded-lg" style={{ border: '1px dashed rgba(107,114,128,0.25)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-500">Custom Scenario</span>
        </div>
        <svg
          className={`transition-transform duration-200 text-gray-400 ${open ? 'rotate-180' : ''}`}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(107,114,128,0.12)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">IX Difficulty</label>
              <select
                value={customIX}
                onChange={e => setCustomIX(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-sm border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-hidden"
              >
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="very_hard">Very Hard</option>
              </select>
            </div>
            {technology === 'Community Solar' && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">CS Program Status</label>
                <select
                  value={customCS}
                  onChange={e => setCustomCS(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-sm border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-hidden"
                >
                  <option value="active">Active</option>
                  <option value="limited">Limited</option>
                  <option value="pending">Pending</option>
                  <option value="none">None</option>
                </select>
              </div>
            )}
          </div>

          {hasChange && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: delta > 0 ? 'rgba(15,118,110,0.06)' : delta < 0 ? 'rgba(220,38,38,0.04)' : 'rgba(107,114,128,0.04)' }}>
              <span className={`text-xs font-bold tabular-nums ${delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                Index impact: {delta > 0 ? '+' : ''}{delta} pts
              </span>
              <span className="text-[10px] text-gray-400">vs. current base case</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Lens fullscreen overlay — sun-fill animation shown while analyzing
// Progress fills slowly to 88% while waiting, then completes when API returns.
// Single pass only — never loops.
// ─────────────────────────────────────────────────────────────────────────────
// V3 §9.1 — Loading overlay rebuilt around the brand mark.
// Animations: scanline travels down the T's vertical stem (2.4s loop),
// the two survey baseline tick marks pulse in sequence (1.6s loop, staggered),
// and a thin teal halo arc fills counter-clockwise around the mark over 14s.
const LENS_OVERLAY_STYLES = `
  @keyframes tractova-scan {
    0%, 100% { transform: translateY(0); opacity: 0; }
    20%      { opacity: 0.95; }
    50%      { transform: translateY(8px); opacity: 0.7; }
    80%      { opacity: 0.95; }
  }
  @keyframes tractova-tick-left {
    0%, 100% { opacity: 0.25; }
    20%, 50% { opacity: 1; }
  }
  @keyframes tractova-tick-right {
    0%, 100% { opacity: 0.25; }
    50%, 80% { opacity: 1; }
  }
  @keyframes tractova-glow {
    0%, 100% { filter: drop-shadow(0 0 14px rgba(20,184,166,0.35)); }
    50%      { filter: drop-shadow(0 0 22px rgba(20,184,166,0.65)); }
  }
`

function LensOverlay({ visible, stateName, countyName, onCancel }) {
  const HALO_R = 78
  const C = 2 * Math.PI * HALO_R  // halo circumference ≈ 489.97
  const [isShown, setIsShown] = useState(false)
  const arcRef  = useRef(null)
  const rafRef  = useRef(null)

  useEffect(() => {
    if (visible) {
      setIsShown(true)
      let startTs = null
      const FILL_DURATION = 14000

      const tick = (ts) => {
        if (!startTs) startTs = ts
        const elapsed = ts - startTs
        const p = Math.min(88, (elapsed / FILL_DURATION) * 88)
        if (arcRef.current) {
          arcRef.current.style.transition = 'none'
          arcRef.current.style.strokeDashoffset = C * (1 - p / 100)
        }
        if (p < 88) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
      if (arcRef.current) {
        arcRef.current.style.transition = 'stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)'
        arcRef.current.style.strokeDashoffset = 0
      }
      const dismissTimer = setTimeout(() => setIsShown(false), 750)
      return () => clearTimeout(dismissTimer)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isShown) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(10,19,42,0.94)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
      }}
    >
      {/* Brand mark + halo (200x200 viewBox) */}
      <div style={{ animation: 'tractova-glow 3.2s ease-in-out infinite' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
          {/* Halo track (faint) */}
          <circle cx="100" cy="100" r={HALO_R} stroke="rgba(20,184,166,0.10)" strokeWidth="1.5" fill="none" />
          {/* Halo progress arc — RAF-driven, fills counter-clockwise */}
          <circle
            ref={arcRef}
            cx="100" cy="100" r={HALO_R}
            stroke="#14B8A6"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C}
            style={{ transformOrigin: '100px 100px', transform: 'rotate(-90deg)' }}
          />

          {/* The brand mark — scaled-up version of TractovaMark from Nav.
              Original viewBox is 26x26; centering at (100,100) with scale 4.6x
              puts mark from (40,40) to (160,160), 120x120. */}
          <g transform="translate(40, 40) scale(4.615)">
            {/* Rounded navy square background */}
            <rect width="26" height="26" rx="5" fill="#0F1A2E" />
            {/* Horizontal baseline of the T */}
            <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
            {/* Vertical stem (this is what the scanline travels through) */}
            <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
            {/* Survey tick marks — animated in sequence */}
            <rect x="6"   y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
              style={{ animation: 'tractova-tick-left 1.6s ease-in-out infinite' }} />
            <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
              style={{ animation: 'tractova-tick-right 1.6s ease-in-out infinite' }} />
          </g>

          {/* Scanline traveling down the T stem.
              In SVG coords (after the g transform), the stem runs roughly
              from (94,84) to (108,138) — 14px wide, 54px tall. The scanline
              is a thin teal-glow rect that translates down via CSS keyframe. */}
          <g style={{
            transformOrigin: '100px 100px',
            animation: 'tractova-scan 2.4s ease-in-out infinite',
          }}>
            <rect x="92" y="83" width="16" height="3"
              fill="#5EEAD4"
              style={{ filter: 'drop-shadow(0 0 4px rgba(94,234,212,0.85))' }} />
          </g>
        </svg>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
        <p style={{
          margin: 0,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: '#5EEAD4',
          fontFamily: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`,
        }}>
          Tractova Lens · Intelligence Fetch
        </p>
        {stateName && countyName ? (
          <p style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: `'Source Serif 4', 'Source Serif Pro', Georgia, serif`,
            letterSpacing: '-0.018em',
            lineHeight: 1.2,
          }}>
            Analyzing {stateName}&nbsp;·&nbsp;{countyName} County
          </p>
        ) : (
          <p style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: `'Source Serif 4', 'Source Serif Pro', Georgia, serif`,
            letterSpacing: '-0.018em',
          }}>
            Fetching market intelligence
          </p>
        )}
        <p style={{
          margin: 0,
          fontSize: '10px',
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.32)',
          fontFamily: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`,
        }}>
          Est. ~14s · Cancel anytime
        </p>
      </div>

      {/* Cancel button — V3 ghost-on-dark */}
      {visible && onCancel && (
        <button
          onClick={onCancel}
          style={{
            padding: '8px 22px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'all 150ms',
            fontFamily: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`,
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'rgba(20,184,166,0.45)'
            e.target.style.color = '#5EEAD4'
            e.target.style.background = 'rgba(20,184,166,0.08)'
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.15)'
            e.target.style.color = 'rgba(255,255,255,0.55)'
            e.target.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          Cancel · ESC
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style constant (used by CountyCombobox + Search form)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none"

// ─────────────────────────────────────────────────────────────────────────────
// Custom select dropdown (replaces native <select> for Stage + Technology)
// ─────────────────────────────────────────────────────────────────────────────
function FieldSelect({ label, labelIcon, value, onChange, options, placeholder, required }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div
      ref={ref}
      onClick={() => setOpen((o) => !o)}
      className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs cursor-pointer relative transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15"
    >
      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5 flex items-center gap-1.5 pointer-events-none select-none">
        {labelIcon}{label}
      </p>

      {/* Hidden native input for form validation */}
      <input type="text" value={value} onChange={() => {}} required={required} className="sr-only" tabIndex={-1} />

      {/* Display row */}
      <div className="flex items-center justify-between gap-1 text-sm py-0.5 pointer-events-none select-none">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <ul
          className="absolute z-50 left-0 top-full mt-2 w-full min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            opt === '---' ? (
              <li key="divider" className="px-3 py-1.5 pointer-events-none select-none">
                <div className="border-t border-gray-200" />
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mt-1.5">Other</p>
              </li>
            ) : (
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false) }}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
              }`}
            >
              <span className={`w-3.5 h-3.5 shrink-0 ${value === opt ? 'text-primary' : 'text-transparent'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              {opt}
            </li>
            )
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Searchable county combobox
// ─────────────────────────────────────────────────────────────────────────────
function CountyCombobox({ stateId, value, onValueChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // allCounties keys are state abbreviations → string[]
  const counties = allCounties[stateId] || []

  // Keep query in sync when parent resets value (e.g. state change)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = counties.filter(name =>
    name.toLowerCase().includes(query.toLowerCase())
  )

  const handleInput = (e) => {
    setQuery(e.target.value)
    onValueChange(e.target.value)
    if (!open) setOpen(true)
  }

  const handleSelect = (name) => {
    setQuery(name)
    onValueChange(name)
    setOpen(false)
  }

  const disabled = !stateId
  const placeholder = disabled ? 'Select a state first' : 'Search counties…'

  return (
    <div
      ref={containerRef}
      onClick={() => { if (!disabled && !open) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
      className={`bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs relative transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5 flex items-center gap-1.5 pointer-events-none select-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        County
      </p>

      {/* Closed: mimic FieldSelect display row. Open: show text input */}
      <div className="flex items-center justify-between gap-1 py-0.5">
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search counties…"
            disabled={disabled}
            required
            onClick={(e) => e.stopPropagation()}
            className={inputCls + ' flex-1'}
          />
        ) : (
          <span className={`text-sm pointer-events-none select-none ${query ? 'text-gray-900' : 'text-gray-400'}`}>
            {query || placeholder}
          </span>
        )}
        <svg
          className="pointer-events-none shrink-0 text-gray-400 transition-transform duration-150"
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Hidden input for form validation when open=false and no value yet */}
      <input type="text" value={value} onChange={() => {}} required className="sr-only" tabIndex={-1} />

      {open && stateId && (
        <ul className="absolute z-50 left-0 top-full mt-2 w-full bg-white border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}>
          {filtered.length > 0 ? filtered.map(name => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(name) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary ${
                value === name ? 'bg-primary-50 text-primary font-medium' : 'text-gray-800'
              }`}
            >
              {name}
            </li>
          )) : (
            <li className="px-3 py-2 text-xs text-gray-400 italic">No matching county</li>
          )}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Save confirmation toast
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Add-to-compare button (wired to CompareContext)
// ─────────────────────────────────────────────────────────────────────────────
function AddToCompareButton({ results }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = lensResultToCompareItem(results)
  const inCompare = isInCompare(item.id)
  const atLimit = !inCompare && items.length >= MAX_ITEMS

  const handleClick = () => {
    if (inCompare) { remove(item.id); return }
    add(item)
  }

  return (
    <button
      onClick={handleClick}
      disabled={atLimit}
      title={atLimit ? `Compare tray full (max ${MAX_ITEMS})` : undefined}
      className={`flex items-center gap-2 border text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
        inCompare
          ? 'border-primary bg-primary-50 text-primary'
          : atLimit
            ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      {inCompare ? 'In Compare' : 'Add to Compare'}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Insight fetch helper — calls /api/lens-insight, returns insight or null
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue, accessToken, signal }) {
  try {
    const res = await fetch('/api/lens-insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      signal,
      body: JSON.stringify({
        state:        form.state,
        county:       form.county,
        mw:           form.mw,
        stage:        form.stage,
        technology:   form.technology,
        stateProgram,
        countyData,
        revenueStack,
        runway,
        ixQueue,
      }),
    })
    if (!res.ok) return { insight: null, reason: `http_${res.status}` }
    const data = await res.json()
    return { insight: data.insight ?? null, reason: data.reason ?? (data.insight ? 'ok' : 'null_insight') }
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return { insight: null, reason: `fetch_error: ${err.message}` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paywall gate — renders UpgradePrompt until subscription is confirmed Pro
export default function Search() {
  const { isPro, loading: subLoading } = useSubscription()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="Tractova Lens" />
  return <SearchContent />
}

// ─────────────────────────────────────────────────────────────────────────────
// Curation-gated panel wrappers — hide both panel AND its preceding divider
// until at least one row exists for that state. Avoids empty-state UI while
// curation cadence is light (pre-revenue). Admin tabs stay available so
// curation infrastructure is preserved for when Pro user count justifies it.
// Both wrappers piggyback on programData's withCache so the duplicate fetch
// is free after the panel itself fetches.
// ─────────────────────────────────────────────────────────────────────────────
function MaybeRegulatoryPanel({ state, stateName }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getPucDockets({ state }).then(rows => {
      if (!cancelled) setShow((rows || []).length > 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <RegulatoryActivityPanel state={state} stateName={stateName} mode="lens" />
    </>
  )
}

function MaybeComparableDealsPanel({ state, stateName, technology, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    const targetMW = parseFloat(mw)
    const mwRange = targetMW > 0 ? [Math.max(0.1, targetMW * 0.5), targetMW * 2.0] : undefined
    getComparableDeals({ state, technology, mwRange }).then(rows => {
      if (!cancelled) setShow((rows || []).length > 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [state, technology, mw])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <ComparableDealsPanel state={state} stateName={stateName} technology={technology} mw={mw} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Search content (only mounts when user is confirmed Pro)
// ─────────────────────────────────────────────────────────────────────────────
function SearchContent() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const initialState = (() => {
    const param = searchParams.get('state')?.toUpperCase()
    return param && ALL_STATES.some(s => s.id === param) ? param : ''
  })()
  const initialCounty = searchParams.get('county') || ''
  const initialMW = searchParams.get('mw') || ''
  const initialStage = searchParams.get('stage') || ''
  const initialTechnology = searchParams.get('technology') || ''

  const [form, setForm] = useState({
    state: initialState,
    county: initialCounty,
    mw: initialMW,
    stage: initialStage,
    technology: initialTechnology,
  })
  const [programMap, setProgramMap]   = useState(null)
  const [results, setResults]         = useState(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const toast = useToast()
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [saveName, setSaveName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  // V3 §7.4: lift sensitivity scenario state to SearchContent so both
  // MarketPositionPanel (gauge) and MarketIntelligenceSummary (rationale) read the same live state.
  // Toggling a scenario re-renders the gauge in place — no scroll-up needed.
  const [activeScenario, setActiveScenario] = useState(null)
  const [scenarioRationale, setScenarioRationale] = useState(null)
  const [rationaleLoading, setRationaleLoading] = useState(false)
  // Reset scenario on a new analysis
  useEffect(() => { setActiveScenario(null); setScenarioRationale(null) }, [results?.form?.state, results?.form?.county, results?.form?.mw, results?.form?.stage, results?.form?.technology])
  const resultsRef = useRef(null)
  const abortRef = useRef(null)

  // ESC to cancel analysis
  useEffect(() => {
    if (!analyzing) return
    const handler = (e) => { if (e.key === 'Escape') abortRef.current?.abort() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [analyzing])

  // Load live state program map on mount — used for market rank + handleSubmit
  useEffect(() => {
    getStateProgramMap().then(setProgramMap).catch(console.error)
  }, [])

  // Restore from sessionStorage on mount (URL param takes priority)
  useEffect(() => {
    if (initialState) return
    try {
      const savedForm = sessionStorage.getItem('tractova_lens_form')
      if (savedForm) setForm(JSON.parse(savedForm))
      const savedResults = sessionStorage.getItem('tractova_lens_results')
      if (savedResults) setResults(JSON.parse(savedResults))
    } catch { /* ignore parse errors */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync form to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('tractova_lens_form', JSON.stringify(form))
  }, [form])

  // Sync results to sessionStorage
  useEffect(() => {
    if (results) sessionStorage.setItem('tractova_lens_results', JSON.stringify(results))
    else sessionStorage.removeItem('tractova_lens_results')
  }, [results])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Auto-submit when all URL params are present (e.g. from Library "Re-Analyze in Lens")
  const autoSubmitFired = useRef(false)
  useEffect(() => {
    if (autoSubmitFired.current || !programMap) return
    if (initialState && initialCounty && initialMW && initialStage && initialTechnology) {
      autoSubmitFired.current = true
      formRef.current?.requestSubmit()
    }
  }, [programMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const formRef = useRef(null)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setResults(null)
    setAnalyzing(true)

    // Get JWT for the API call
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ''

    // Resolve live data from Supabase (cached — fast after first load)
    const [stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic] = await Promise.all([
      programMap?.[form.state] ?? getStateProgramMap().then(m => m[form.state] ?? null),
      getCountyData(form.state, form.county),
      getRevenueStack(form.state),
      getIXQueueSummary(form.state, form.mw),
      getNearestSubstations(form.state, form.county),
      getRevenueRates(form.state),
      getEnergyCommunity(form.state, form.county),
      getHudQctDda(form.state, form.county),
      getNmtcLic(form.state, form.county),
    ])
    const runway = stateProgram?.runway ?? null

    // AI fetch with abort support — ESC or cancel button can abort this
    abortRef.current = new AbortController()
    let aiInsight = null
    try {
      const [aiResult] = await Promise.all([
        fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue: ixQueueSummary, accessToken, signal: abortRef.current.signal }),
        new Promise(resolve => setTimeout(resolve, 800)),
      ])
      aiInsight = aiResult?.insight ?? null
    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled — still show results without AI insight
        setResults({ form: { ...form }, stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic, aiInsight: null })
        setAnalyzing(false)
        return
      }
    }

    setResults({ form: { ...form }, stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic, aiInsight })
    setAnalyzing(false)
  }

  const handleSave = () => {
    if (!results) return
    const defaultName = `${results.form.county} ${results.form.mw}MW ${results.form.technology}`
    setSaveName(defaultName)
    setSaveError(null)
    setSaveModal({ defaultName })
  }

  const handleSaveConfirm = async () => {
    if (!results) return
    setSaving(true)
    setSaveError(null)
    try {
      // Re-fetch the live session at click time. The `user` from context can be
      // stale if the supabase auth session expired silently while the tab was idle.
      const { data: { session } } = await supabase.auth.getSession()
      const liveUser = session?.user
      if (!liveUser) {
        setSaveError('Your session expired. Please sign in again.')
        setSaving(false)
        return
      }

      const mwNum = parseFloat(results.form.mw)
      const payload = {
        user_id:          liveUser.id,
        name:             saveName.trim() || `${results.form.county} ${results.form.mw}MW ${results.form.technology}`,
        state:            results.form.state,
        state_name:       results.stateProgram?.name || results.form.state,
        county:           results.form.county,
        mw:               isNaN(mwNum) ? null : mwNum,
        stage:            results.form.stage,
        technology:       results.form.technology,
        cs_program:       results.stateProgram?.csProgram || null,
        cs_status:        results.stateProgram?.csStatus || 'none',
        serving_utility:  results.countyData?.interconnection?.servingUtility || null,
        ix_difficulty:    results.stateProgram?.ixDifficulty || null,
        opportunity_score: results.stateProgram?.feasibilityScore ?? null,
      }

      // Schema-cache-resilient insert: if the production projects table is
      // missing a column (e.g. migration 011 hasn't been run yet), PostgREST
      // returns a "Could not find the 'X' column" error. We detect that,
      // strip the offending column from the payload, and retry. Worst case
      // we save the bare-minimum core fields (user_id, name, state, county,
      // mw, stage) and log which fields were dropped so we know what to
      // backfill once the migration runs.
      const droppedFields = []
      let attempt = { ...payload }
      // Cap retries so we can't loop forever on a different error class
      for (let i = 0; i < 12; i++) {
        const { data: insertedRows, error } = await supabase
          .from('projects')
          .insert(attempt)
          .select('id')
        if (!error) {
          setSaving(false)
          setSaveModal(null)
          toast.success('Project saved to Library', {
            eyebrow: '◆ Saved',
            description: `${payload.name} · ${payload.county} County, ${payload.state}`,
          })
          if (droppedFields.length) {
            console.warn('[Save to Library] saved without these fields (run migration 011 in Supabase to enable):', droppedFields)
          }
          // Audit log: emit a 'created' event so the Library Audit tab has
          // a record of project birth. Silent on failure.
          const newId = insertedRows?.[0]?.id
          if (newId) {
            try {
              const { logProjectEvent } = await import('../lib/projectEvents')
              await logProjectEvent({
                projectId: newId,
                userId: user.id,
                kind: 'created',
                detail: `Project saved: ${payload.name} · ${payload.county} County, ${payload.state} · ${payload.mw} MW · ${payload.stage || 'no stage'}`,
                meta: { stage: payload.stage, mw: payload.mw, score: payload.opportunity_score },
              })
            } catch (_err) { /* audit failure must not block save */ }
          }
          return
        }
        // Match BOTH the PostgREST schema-cache error and the native PG missing-column error
        const m = error.message?.match(/['"]([^'"]+)['"]\s+column/i)
                 || error.message?.match(/column\s+['"]?([a-z_]+)['"]?\s+(?:of relation|does not exist)/i)
        if (m && Object.prototype.hasOwnProperty.call(attempt, m[1])) {
          droppedFields.push(m[1])
          delete attempt[m[1]]
          continue
        }
        // Different error -- surface it
        console.error('[Save to Library] insert failed:', error)
        setSaving(false)
        setSaveError(error.message || 'Could not save project. Please try again.')
        return
      }
      // Hit the retry cap without success
      setSaving(false)
      setSaveError('Save failed after multiple attempts. Please refresh and try again.')
    } catch (err) {
      console.error('[Save to Library] unexpected error:', err)
      setSaving(false)
      setSaveError(err?.message || 'Unexpected error. Please try again.')
    }
  }

  const handleClearAll = () => {
    setForm({ state: '', county: '', mw: '', stage: '', technology: '' })
    setResults(null)
    setConfirmClear(false)
    sessionStorage.removeItem('tractova_lens_form')
    sessionStorage.removeItem('tractova_lens_results')
  }

  const isFormValid = form.state && form.county.trim() && form.mw && form.stage && form.technology
  const hasAnyInput = form.state || form.county || form.mw || form.stage || form.technology || results

  // V3: form labels use ink-muted for institutional feel (was text-primary-700 emerald)
  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5"

  return (
    <div className="min-h-screen bg-surface">
      <style>{LENS_OVERLAY_STYLES}</style>
      <LensOverlay
        visible={analyzing}
        stateName={ALL_STATES.find(s => s.id === form.state)?.name || ''}
        countyName={form.county}
        onCancel={() => abortRef.current?.abort()}
      />
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Tractova Lens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter a specific project to get targeted site control, interconnection, and offtake intelligence.
          </p>
        </div>

        {/* Search form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200/80"
          style={{ boxShadow: '0 2px 12px rgba(20,184,166,0.08), 0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {/* V3: Brand-navy header band (was old dark-emerald). Matches Library banner / MetricsBar. */}
          <div
            className="px-6 py-5 flex items-center gap-4 rounded-t-xl relative"
            style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
          >
            {/* Top teal accent rail — V3 brand signature */}
            <div className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />

            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.32)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] leading-none mb-1.5"
                style={{ color: '#5EEAD4' }}>
                Tractova Lens · New Analysis
              </p>
              <h2 className="font-serif text-lg font-semibold text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
                Run a targeted feasibility report
              </h2>
            </div>

            {/* Required field hint */}
            <p className="font-mono text-[10px] shrink-0 hidden lg:block uppercase tracking-[0.16em]"
              style={{ color: 'rgba(255,255,255,0.40)' }}>
              All fields required
            </p>
          </div>

          {/* Fields — V3 paper background, no longer green-tinted */}
          <div className="px-5 py-5 bg-paper rounded-b-xl">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

              {/* State */}
              <FieldSelect
                label="State"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                value={ALL_STATES.find(s => s.id === form.state)?.name || ''}
                onChange={(name) => {
                  const s = ALL_STATES.find(s => s.name === name)
                  setForm((f) => ({ ...f, state: s?.id || '', county: '' }))
                }}
                options={ALL_STATES.map(s => s.name)}
                placeholder="Select state…"
                required
              />

              {/* County */}
              <CountyCombobox
                stateId={form.state}
                value={form.county}
                onValueChange={(val) => setForm((f) => ({ ...f, county: val }))}
              />

              {/* MW */}
              <div className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 focus-within:ring-2 focus-within:ring-primary/10">
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Project Size (MW AC)
                </label>
                <input
                  type="number"
                  value={form.mw}
                  onChange={set('mw')}
                  placeholder="e.g. 5"
                  min="0.1"
                  step="0.1"
                  required
                  className={inputCls + ' w-full'}
                />
              </div>

              {/* Development stage */}
              <FieldSelect
                label="Development Stage"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                value={form.stage}
                onChange={(val) => setForm((f) => ({ ...f, stage: val }))}
                options={STAGES}
                placeholder="Select stage…"
                required
              />

              {/* Technology */}
              <FieldSelect
                label="Technology Type"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>}
                value={form.technology}
                onChange={(val) => setForm((f) => ({ ...f, technology: val }))}
                options={TECHNOLOGIES}
                placeholder="Select type…"
                required
              />
            </div>
          </div>

          {/* Submit row */}
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-gray-400 hidden sm:block flex-1">
              Intelligence is generated from seeded state + county data — verify with your utility and PUC before committing capital.
            </p>
            <div className="flex items-center gap-3 ml-auto shrink-0">
              {/* Clear All — two-step inline confirm */}
              {hasAnyInput && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200"
                >
                  Clear All
                </button>
              )}
              {confirmClear && (
                <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="text-gray-600">Clear all inputs?</span>
                  <button type="button" onClick={handleClearAll} className="font-semibold text-red-600 hover:underline">Yes, clear</button>
                  <button type="button" onClick={() => setConfirmClear(false)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              )}
              <button
                type="submit"
                disabled={!isFormValid || analyzing}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px] justify-center"
              >
                {analyzing ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    Run Lens Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Results panel */}
        {results && (
          <div ref={resultsRef}>
            {/* Bloomberg-style run-id masthead — research-grade character */}
            <RunIdMasthead form={results.form} />
            <SectionDivider />
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {results.form.county} County, {results.stateProgram?.name || results.form.state}
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.mw} MW AC</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.technology}</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.stage}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Intelligence as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {(() => {
                    const sp = results.stateProgram
                    const v = sp?.lastVerified ? new Date(sp.lastVerified) : null
                    const u = sp?.updatedAt    ? new Date(sp.updatedAt)    : null
                    const latest = (v && u) ? (v > u ? v : u) : (v || u)
                    if (!latest) return null
                    const diffDays = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24))
                    const rel = diffDays === 0 ? 'today' : diffDays === 1 ? 'yesterday' : diffDays < 7 ? `${diffDays}d ago` : diffDays < 30 ? `${Math.floor(diffDays / 7)}w ago` : `${Math.floor(diffDays / 30)}mo ago`
                    const full = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    return <span className="group relative cursor-default"> · Data verified {rel}<span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-[10px] bg-gray-800 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none">{full}</span></span>
                  })()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Add to Compare */}
                <AddToCompareButton results={results} />

                {/* Save as Project */}
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 px-4 py-2 rounded-lg hover:border-primary hover:text-primary transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save as Project
                </button>
              </div>
            </div>

            <SectionMarker index={1} label="Market Position" sublabel="composite feasibility · sensitivity scenarios" />

            <MarketPositionPanel
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              programMap={programMap}
              stage={results.form.stage}
              technology={results.form.technology}
              activeScenario={activeScenario}
            />

            {/* §7.4: Scenario toggle row — sits with the gauge so toggling updates the gauge in place */}
            <LensScenarioRow
              stateProgram={results.stateProgram}
              technology={results.form.technology}
              mw={results.form.mw}
              activeScenario={activeScenario}
              setActiveScenario={setActiveScenario}
              countyData={results.countyData}
              formForApi={results.form}
              programMap={programMap}
            />

            {/* Market Intelligence Summary */}
            <SectionMarker index={2} label="Analyst Brief" sublabel="claude · sonnet 4.6" />
            <MarketIntelligenceSummary
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              form={results.form}
              aiInsight={results.aiInsight ?? null}
              activeScenario={activeScenario}
              scenarioRationale={scenarioRationale}
              setScenarioRationale={setScenarioRationale}
              rationaleLoading={rationaleLoading}
              setRationaleLoading={setRationaleLoading}
            />

            {/* Three pillar cards in a navy-tinted dossier band — visually
                groups Offtake / IX / Site Control as the analytical core of
                the Lens, and reduces the long-white-scroll feel without any
                pattern or imagery. items-start: cards size independently. */}
            <div
              className="rounded-xl px-5 py-5 mt-8 mb-6"
              style={{
                background: 'linear-gradient(180deg, rgba(15,26,46,0.022) 0%, rgba(15,26,46,0.045) 100%)',
                border: '1px solid rgba(15,26,46,0.08)',
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <span
                  className="text-[9px] font-bold tracking-[0.28em] uppercase"
                  style={{ color: '#0F1A2E', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  § 03 · Pillar Diagnostics
                </span>
                <span
                  className="text-[9px] tracking-[0.22em] uppercase"
                  style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  offtake · interconnect · site
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <OfftakeCard
                  stateProgram={results.stateProgram}
                  revenueStack={results.revenueStack}
                  technology={results.form.technology}
                  mw={results.form.mw}
                  rates={results.revenueRates}
                  energyCommunity={results.energyCommunity}
                  nmtcLic={results.nmtcLic}
                  hudQctDda={results.hudQctDda}
                  county={results.form.county}
                />
                <InterconnectionCard
                  interconnection={results.countyData?.interconnection}
                  stateProgram={results.stateProgram}
                  stateId={results.stateProgram?.id}
                  mw={results.form.mw}
                  queueSummary={results.ixQueueSummary}
                />
                <SiteControlCard
                  siteControl={results.countyData?.siteControl}
                  interconnection={results.countyData?.interconnection}
                  stateName={results.stateProgram?.name || results.form.state}
                  county={results.form.county}
                  stateId={results.stateProgram?.id}
                  mw={results.form.mw}
                  substations={results.substations}
                />
              </div>
            </div>

            {/* Federal LIHTC moved into the OfftakeCard's federal-bonus stack
                so all three geographic-designation incentives (Energy
                Community, §48(e) NMTC LIC, HUD QCT/DDA) live in one panel. */}

            {/* V3 Wave 2 — curation-gated panels.
                Regulatory + Comparable Deals are dormant until admin
                curates content. The wrappers below hide both panel
                AND its preceding divider until at least one row exists
                for that state -- avoiding empty-state UI while we're
                pre-revenue and curation cadence is light. Admin tab
                stays available so curation infrastructure is ready
                when we have paying users to justify the labor. */}
            <MaybeRegulatoryPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
            />
            <MaybeComparableDealsPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              technology={results.form.technology}
              mw={results.form.mw}
            />

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">Tractova intelligence is a research accelerator, not a substitute for site-specific due diligence.</span>{' '}
                Verify interconnection conditions with the serving utility, confirm wetland boundaries with a site survey, and validate program capacity with your state PUC before committing capital.
                Data is updated regularly but may not reflect the latest queue changes.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* V3: SaveToast replaced by global ToastProvider (Radix Toast +
          Motion). Removed import of legacy SaveToast component below. */}

      {/* Save modal — sign-in prompt if not authed, name input if authed */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSaveModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">

            {!user ? (
              /* ── Not signed in ── */
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">Sign in to save projects</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                  Create a free account to save projects and access them from any device.
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSaveModal(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <Link
                    to="/signup"
                    onClick={() => setSaveModal(null)}
                    className="flex-1 text-center text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create Account
                  </Link>
                  <Link
                    to="/signin"
                    onClick={() => setSaveModal(null)}
                    className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              </>
            ) : (
              /* ── Signed in: name the project ── */
              <>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Name this project</h3>
                <p className="text-xs text-gray-400 mb-4">You can edit the name before saving.</p>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
                  autoFocus
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-4"
                />
                {saveError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-700 font-medium">Save failed</p>
                    <p className="text-xs text-red-600 mt-0.5 leading-snug">{saveError}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSaveModal(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfirm}
                    disabled={!saveName.trim() || saving}
                    className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {saving ? 'Saving…' : 'Save Project'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
