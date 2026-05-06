import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack, getRevenueRates, getPucDockets, getComparableDeals, getCsProjectsAsComparables, getEnergyCommunity, getHudQctDda, getNmtcLic, getCsMarketSnapshot, getSpecificYieldLineage } from '../lib/programData'
import allCounties from '../data/allCounties.json'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useCompare, lensResultToCompareItem } from '../context/CompareContext'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import RegulatoryActivityPanel from '../components/RegulatoryActivityPanel'
import ComparableDealsPanel from '../components/ComparableDealsPanel'
import CsMarketPanel from '../components/CsMarketPanel'
import SpecificYieldPanel from '../components/SpecificYieldPanel'
import CoverageBadge from '../components/CoverageBadge'
import ArcGauge from '../components/ArcGauge.jsx'
import MarketPositionPanel from '../components/MarketPositionPanel.jsx'
import SiteControlCard from '../components/SiteControlCard.jsx'
import InterconnectionCard from '../components/InterconnectionCard.jsx'
import OfftakeCard from '../components/OfftakeCard.jsx'
import MarketIntelligenceSummary from '../components/MarketIntelligenceSummary.jsx'
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/Tooltip'
import { useToast } from '../components/ui/Toast'
import TractovaLoader from '../components/ui/TractovaLoader'
import WalkingTractovaMark from '../components/WalkingTractovaMark'
import { motion, useMotionValue, useSpring, animate as motionAnimate } from 'motion/react'

// ─────────────────────────────────────────────────────────────────────────────
// Market Position Panel — replaces the old mini state map
// ─────────────────────────────────────────────────────────────────────────────

import { STAGE_MODIFIERS, computeSubScores, computeDisplayScoreRange, getOfftakeCoverageStates, safeScore } from '../lib/scoreEngine'
import { computeRevenueProjection, hasRevenueData, computeCIRevenueProjection, hasCIRevenueData, computeBESSProjection, hasBESSRevenueData, computeHybridProjection, SOLAR_RATES_AS_OF, CI_RATES_AS_OF, BESS_RATES_AS_OF } from '../lib/revenueEngine'
import { getIXQueueSummary } from '../lib/programData'
import { TECH_FILTER_TOOLTIPS } from '../lib/techDefinitions'
import GlossaryLabel from '../components/ui/GlossaryLabel'
import ScenarioStudio from '../components/ScenarioStudio'
import { computeBaseline as computeScenarioBaseline } from '../lib/scenarioEngine'
import LensTour from '../components/LensTour'
import DataLimitationsModal from '../components/DataLimitationsModal'
import IntelligenceBackground from '../components/IntelligenceBackground'

// Map sub-score display labels to canonical glossary keys so the
// GlossaryLabel tooltip resolves correctly when the visible text differs
// from the glossary term (e.g. "Interconnection" sub-score → "IX" def).
const SUBSCORE_GLOSSARY_KEYS = {
  'Offtake':         'Offtake',
  'Interconnection': 'IX',
  'Site Control':    'Site Control',
}
import { getNearestSubstations } from '../lib/substationEngine'

export function getMarketRank(stateId, programMap) {
  if (!programMap) return { rank: null, total: 0 }
  const ranked = Object.values(programMap)
    .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const rank = ranked.findIndex(s => s.id === stateId) + 1
  return { rank: rank || null, total: ranked.length }
}

// AnimatedScoreText + ArcGauge moved to src/components/ArcGauge.jsx (Sprint 2.3).


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
export function SubScoreBar({ label, weight, value, color, baseValue }) {
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

export const STATUS_CFG = {
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
export function sanitizeBrief(text) {
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

// MarketPositionPanel moved to src/components/MarketPositionPanel.jsx (Sprint 2.3).

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
        className="text-[11px] font-bold tracking-[0.20em] uppercase shrink-0"
        style={{ color: '#0F1A2E', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        § {String(index).padStart(2, '0')} · {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
      {sublabel && (
        <span
          className="text-[10px] tracking-[0.18em] uppercase shrink-0"
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
export function CollapsibleCard({
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
export function CardDrilldown({ accentColor, label = 'Methodology & sources', children }) {
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

export function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{children}</p>
  )
}

export function DataRow({ label, value, highlight, valueClass }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${valueClass || (highlight ? 'text-primary' : 'text-gray-800')}`}>
        {value}
      </span>
    </div>
  )
}

export function EaseArcGauge({ score }) {
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

export function QueueBadge({ statusCode }) {
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

export function RunwayBadge({ runway }) {
  const c = RUNWAY_COLORS[runway.urgency] || RUNWAY_COLORS.moderate
  const suffix = runway.urgency === 'watch' ? ' — watch' : runway.urgency === 'urgent' ? ' — act now' : ''
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-sm"
        style={{ background: c.bg, color: c.text }}
        title="Runway = remaining capacity ÷ annual-average enrollment rate. Real CS programs cluster enrollment around tax-credit deadlines + project milestones, so a Q4 rush can exhaust capacity faster than the annual average suggests. Treat this as a planning horizon, not a deadline."
      >
        ~{runway.months} months{suffix}
      </span>
      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">est.</span>
    </div>
  )
}

export function CSStatusBadge({ csStatus }) {
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
// SiteControlCard moved to src/components/SiteControlCard.jsx (Sprint 2.3).

// InterconnectionCard moved to src/components/InterconnectionCard.jsx (Sprint 2.3).

export function RevenueStackBar({ revenueStack }) {
  const segments = [
    { label: 'ITC Base',  value: revenueStack.itcBase,          color: '#1D4ED8' },
    { label: 'ITC Adder', value: revenueStack.itcAdder,         color: '#D97706' },
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

export function RevenueProjectionSection({ stateId, mw, rates }) {
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-gray-500 cursor-help inline-flex items-center gap-1">
                  Capacity factor
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>NREL PVWatts state average</p>
                <p>Capacity factor varies materially by state — fixed-tilt PV in CO (~20%) vs MA (~16.5%) vs MN (~16%). We seed per-state averages from NREL PVWatts and refresh quarterly.</p>
                <p className="mt-1.5 text-gray-400">Site-specific factors (tilt, orientation, soiling, snow loss) can shift this ±2 pts. A real PVsyst run on the candidate parcel is the bankable number.</p>
              </TooltipContent>
            </Tooltip>
            <span className="font-semibold text-gray-700 tabular-nums">{proj.capacityFactor}% <span className="font-normal text-gray-400 text-[10px]">· NREL PVWatts</span></span>
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

// ── Solar capex $/W per-state data lineage ──────────────────────────────────
// Five visual variants disclose where each state sits on the observed-vs-
// synthesized axis:
//
//   Tier A · STRONG    (n>=40)   teal panel, full p10–p90 percentile grid
//   Tier A · MODEST    (n=10–39) teal panel + "modest sample" caveat line
//   Tier A · THIN      (n=3–9)   amber-tinged teal; suppress p10/p90
//                                 (false precision at thin n); mandatory caveat
//   Tier B · THIN      (n<3)     amber panel + "below floor" copy
//   Tier B · STRUCTURAL          amber panel + "incentive design" copy.
//                                 SREC-strike states (IL/PA/OR/DE/WA) generate
//                                 no LBNL paper trail regardless of program
//                                 maturity — surfaced via the [TIER_B:STRUCTURAL]
//                                 prefix on revenue_rates.notes (migration 052).
//
// Tier-B prefixes are parsed from rates.notes; absent prefix renders as a
// legacy single Tier-B variant (graceful degrade for any state added pre-052).
function parseTierBPrefix(notes) {
  if (!notes || typeof notes !== 'string') return { kind: 'legacy', stripped: notes || '' }
  const m = notes.match(/^\[TIER_B:(THIN|STRUCTURAL)([^\]]*)\]\s*(.*)$/s)
  if (!m) return { kind: 'legacy', stripped: notes }
  return { kind: m[1].toLowerCase(), meta: m[2].trim(), stripped: m[3] }
}

export function SolarCostLineagePanel({ rates, stateName }) {
  if (!rates) return null
  const stateLabel = stateName || rates.state_id || ''
  const synthValue = rates.installed_cost_per_watt
  const lineage = rates.solar_cost_lineage
  if (synthValue == null) return null

  const fmtDollar = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}/W`)

  // ── Tier A branch (observed lineage row exists) ──
  if (lineage) {
    const tier = lineage.confidence_tier || 'strong'  // legacy rows default to strong
    const isThin = tier === 'thin'
    const isModest = tier === 'modest'

    // Visual treatment shifts only at thin tier (amber-tinged).
    const containerStyle = isThin
      ? { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(217,119,6,0.04)' }
      : { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(15,118,110,0.04)' }
    const badgeStyle = isThin
      ? { background: 'rgba(217,119,6,0.10)', color: '#0F766E', border: '1px solid rgba(217,119,6,0.30)' }
      : { background: 'rgba(15,118,110,0.10)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.30)' }
    const badgeLabel = (
      tier === 'strong' ? 'Tier A · LBNL observed'
      : tier === 'modest' ? 'Tier A · LBNL observed (modest sample)'
      : 'Tier A · LBNL observed (thin sample)'
    )

    return (
      <div className="pt-2 border-t border-gray-100">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
          Solar capex $/W — observed data lineage for {stateLabel}
        </p>
        <div className="rounded-md border px-3 py-2.5" style={containerStyle}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={badgeStyle}>
              {badgeLabel}
            </span>
            <span className="text-[10px] text-gray-500">vintage {lineage.vintage_window} · n={lineage.install_count}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-700">
            <div>Sample size · <span className="font-semibold tabular-nums">{lineage.install_count} projects</span></div>
            <div>Bracket · <span className="font-semibold">0.5–5 MW non-res</span></div>
            <div>Median (p50) · <span className="font-semibold tabular-nums">{fmtDollar(lineage.p50_per_watt)}</span></div>
            <div>p25–p75 band · <span className="font-semibold tabular-nums">{fmtDollar(lineage.p25_per_watt)} – {fmtDollar(lineage.p75_per_watt)}</span></div>
            {/* p10/p90 suppressed in thin tier — at n=3–9 they're essentially min/max,
                conveying false precision. Strong + Modest still show them. */}
            {!isThin && (
              <div className="sm:col-span-2 text-[9px] text-gray-500">p10 {fmtDollar(lineage.p10_per_watt)} · p90 {fmtDollar(lineage.p90_per_watt)}</div>
            )}
          </div>
          {isModest && (
            <p className="mt-1.5 text-[10px] text-gray-600 italic">
              Sample is below the n≥40 statistical-significance threshold; treat percentiles as directional. p25–p75 band is the load-bearing signal.
            </p>
          )}
          {isThin && (
            <p className="mt-1.5 text-[10px] text-gray-600 italic">
              Thin sample (n&lt;10). Median is best-available observed signal but a single project can move the percentile materially. Use as anchor, not as ground truth. Tier reassessed each October from the freshest LBNL TTS release.
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-teal-200/60 text-[10px] text-gray-700">
            <span className="font-semibold text-ink">→ Tractova 2026 anchor:</span> <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span>
            <span className="text-gray-500"> · explicit forward extrapolation from observed median (NREL +22% YoY 2023→2024 + FEOC + reshoring + logistics layers — see methodology paragraph below).</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <a href="https://emp.lbl.gov/tracking-the-sun" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">LBNL Tracking the Sun ↗</a>
          </div>
        </div>
      </div>
    )
  }

  // ── Tier B branch (no observed lineage row — synthesis only) ──
  // Parse the [TIER_B:THIN n=N] or [TIER_B:STRUCTURAL incentive=SREC] prefix
  // from rates.notes (migration 052 backfill). Two distinct copy variants;
  // legacy/no-prefix renders the original single-variant copy.
  const tierB = parseTierBPrefix(rates.notes)

  let bodyCopy
  let badgeLabel
  let metaLabel
  if (tierB.kind === 'structural') {
    badgeLabel = 'Tier B · regional analog · structural data gap'
    metaLabel  = 'incentive design generates no LBNL paper trail'
    bodyCopy = (
      <>{stateLabel}'s primary CS incentive is per-MWh REC strike rather than per-W upfront rebate, so installations do not generate an LBNL TTS paper trail. No sample-size threshold can unlock this — the gap is structural to the program's incentive design. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor (NREL Q1 2023 CS MMP $1.76 + explicit 2023→2026 forward layers).</>
    )
  } else if (tierB.kind === 'thin') {
    badgeLabel = 'Tier B · regional analog · sample below n≥3 floor'
    metaLabel  = `${tierB.meta || 'n<3'} observed projects in window`
    bodyCopy = (
      <>{stateLabel} has fewer than 3 observed projects in the LBNL TTS public CSV (0.5–5 MW large non-residential bracket, last 3 install years) — below the n≥3 floor for publication. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor.</>
    )
  } else {
    // Legacy / no-prefix fallback — graceful degrade for any state added pre-052.
    badgeLabel = 'Tier B · regional analog'
    metaLabel  = 'no qualifying LBNL TTS sample'
    bodyCopy = (
      <>{stateLabel} has insufficient observed sample in the LBNL Tracking the Sun public CSV. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor (NREL Q1 2023 CS MMP $1.76 + explicit 2023→2026 forward layers).</>
    )
  }

  return (
    <div className="pt-2 border-t border-gray-100">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
        Solar capex $/W — synthesis basis for {stateLabel}
      </p>
      <div className="rounded-md border px-3 py-2.5" style={{ borderColor: 'rgba(217,119,6,0.30)', background: 'rgba(217,119,6,0.04)' }}>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.30)' }}>
            {badgeLabel}
          </span>
          <span className="text-[10px] text-gray-500">{metaLabel}</span>
        </div>
        <p className="text-[10px] text-gray-700 leading-relaxed">
          {bodyCopy}
        </p>
        {tierB.stripped && (
          <p className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] text-gray-600 leading-relaxed">
            <span className="font-semibold text-ink">State-specific basis:</span> {tierB.stripped}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <a href="https://emp.lbl.gov/tracking-the-sun" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">LBNL TTS (national reference) ↗</a>
        </div>
      </div>
    </div>
  )
}

// OfftakeCard moved to src/components/OfftakeCard.jsx (Sprint 2.3).

// generateMarketSummary moved to src/lib/lensHelpers.js (Sprint 2.3).

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity analysis — score delta + scenario builder
// ─────────────────────────────────────────────────────────────────────────────
export function computeScoreDelta(base, override) {
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

export function buildSensitivityScenarios(stateProgram, technology, mw) {
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
      // Bill credit revenue: MW × 8760 hr × CF = annual MWh; × 1000 → kWh;
      // × $/kWh bill credit. The earlier expression dropped the MWh→kWh
      // conversion and rendered a $79/yr haircut for a 5MW project.
      // Aden flagged 2026-05-04: this should be ~$79K/yr, not $79/yr.
      const annualMWh = mwNum * 8760 * 0.17
      const billCreditRevenue = annualMWh * 1000 * 0.085 // $0.085/kWh blended bill credit
      const revenueHaircut = Math.round(billCreditRevenue * 0.125) // ~12.5% of bill credit revenue
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
export const CHIP_COLORS = {
  green:  { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  teal:   { bg: '#CCFBF1', text: '#134E4A', dot: '#0D9488' },
  amber:  { bg: '#FEF3C7', text: '#78350F', dot: '#D97706' },
  yellow: { bg: '#FEF9C3', text: '#713F12', dot: '#CA8A04' },
  orange: { bg: '#FFEDD5', text: '#7C2D12', dot: '#EA580C' },
  red:    { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626' },
  gray:   { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
}

// V3 §9.3 — Site-walk Session 5 (review item #12, option A).
// Collapsible drill-down row for the Analyst Brief sub-sections (Primary Risk,
// Top Opportunity, Stage Guidance, Competitive Context). The brief and
// Immediate Action stay always-visible above; everything else collapses behind
// a chevron so the brief reads at a glance instead of as a wall of text.
// Closed-state still shows the topic eyebrow + accent rule so users can see
// what's available without clicking. ~12 LOC component, no new dependencies.
export function BriefDrilldown({ label, accent, eyebrowColor, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pl-4 mt-2" style={{ position: 'relative' }}>
      <div className="absolute left-0 top-2 bottom-0 w-[2px]" style={{ background: accent }} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-1.5 w-full text-left transition-opacity hover:opacity-80"
        aria-expanded={open}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke={eyebrowColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold m-0" style={{ color: eyebrowColor }}>
          {label}
        </p>
      </button>
      {open && (
        <div className="pb-2 pt-0.5 ml-[17px]">
          {children}
        </div>
      )}
    </div>
  )
}

// MarketIntelligenceSummary moved to src/components/MarketIntelligenceSummary.jsx (Sprint 2.3).

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
      // Asymptotic progress: p = CEIL * (1 - exp(-elapsed / TAU))
      // CEIL = 95% — never reached, so the snap-to-100 on API completion
      //              always has 5+ points of headroom for a clean landing.
      // TAU  = 8000ms — calibrated against the ~15s typical Lens runtime.
      //              At 15s, p ≈ 79%; at 30s, p ≈ 93%; at ∞, p → 95.
      // The RAF loop never exits while visible, so the halo physically
      // cannot stall — even on a 60s slow run the arc keeps creeping
      // forward in tiny sub-pixel increments.
      const CEIL = 95
      const TAU  = 8000

      const tick = (ts) => {
        if (!startTs) startTs = ts
        const elapsed = ts - startTs
        const p = CEIL * (1 - Math.exp(-elapsed / TAU))
        if (arcRef.current) {
          arcRef.current.style.transition = 'none'
          arcRef.current.style.strokeDashoffset = C * (1 - p / 100)
        }
        rafRef.current = requestAnimationFrame(tick)
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
          Est. ~15s · Cancel anytime
        </p>
      </div>

      {/* Once-per-session walking brand-mark cameo — appears during the
          loading state ~2.5s after it opens, walks across the bottom of
          the screen, pauses briefly, walks off. Sessionstorage-gated so
          it only fires once per browser session. Honors prefers-reduced-
          motion. Renders here AND on Profile; whichever surface the user
          hits first that session gets the cameo. */}
      <WalkingTractovaMark />

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
function FieldSelect({ label, labelIcon, value, onChange, options, placeholder, required, optionTooltips = {} }) {
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
              className={`flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
              }`}
            >
              <span className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${value === opt ? 'text-primary' : 'text-transparent'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block">{opt}</span>
                {optionTooltips[opt] && (
                  <span className="block text-[10px] text-gray-400 leading-snug mt-0.5">{optionTooltips[opt]}</span>
                )}
              </span>
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
    }).catch(err => {
      // Curation-gated panel: hide on error (matches "no rows" behavior so
      // the user doesn't see an error chip for a panel that may legitimately
      // be empty pre-revenue). Log for devtools visibility.
      console.warn('[MaybeRegulatoryPanel] getPucDockets failed:', err)
    })
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

function MaybeSpecificYieldPanel({ state, stateName, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getSpecificYieldLineage(state).then(snap => {
      if (!cancelled) setShow(!!snap && snap.total_count >= 3)
    }).catch(err => {
      // cs_specific_yield table may not exist yet (migration 053 pending).
      // Hide gracefully — matches the "no data" empty case.
      console.warn('[MaybeSpecificYieldPanel] getSpecificYieldLineage failed:', err)
    })
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <SpecificYieldPanel state={state} stateName={stateName} mw={mw} />
    </>
  )
}

function MaybeCsMarketPanel({ state, stateName, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getCsMarketSnapshot(state).then(snap => {
      if (!cancelled) setShow(!!snap && snap.projectCount > 0)
    }).catch(err => {
      // cs_projects table may not exist yet (migration 050 pending). Hide
      // gracefully — matches the "no projects" empty case.
      console.warn('[MaybeCsMarketPanel] getCsMarketSnapshot failed:', err)
    })
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <CsMarketPanel state={state} stateName={stateName} mw={mw} />
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
    // 2026-05-05 (option 3): panel now backed by cs_projects + curated. Check
    // BOTH for visibility — panel renders if either source has matches. The
    // panel's own merge dedupes when both have overlapping rows.
    Promise.all([
      getCsProjectsAsComparables({ state, technology, mwRange }).catch(() => []),
      getComparableDeals({ state, technology, mwRange }).catch(() => []),
    ]).then(([cs, curated]) => {
      if (!cancelled) setShow((cs?.length || 0) + (curated?.length || 0) > 0)
    }).catch(err => {
      console.warn('[MaybeComparableDealsPanel] merged probe failed:', err)
    })
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
  // Look up the most recent saved project matching the current Lens
  // context (state + county + tech). When found, scenarios saved from
  // the Studio attach to that project_id so the Library card can show
  // the "Scenarios: N" chip. Falls back to null = ad-hoc scenario.
  const [matchingProjectId, setMatchingProjectId] = useState(null)
  const toast = useToast()
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [dataLimitationsOpen, setDataLimitationsOpen] = useState(false)
  const [saveName, setSaveName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // ESC closes save modal + confirm-clear modal — both are hand-rolled
  // (not Radix Dialog) so they need explicit keyboard handling for parity
  // with the rest of the app's modal accessibility.
  useEffect(() => {
    if (!saveModal && !confirmClear) return
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return
      if (saveModal) setSaveModal(null)
      if (confirmClear) setConfirmClear(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [saveModal, confirmClear])
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

  // Match Lens results → existing saved project so saved scenarios
  // attach to the project_id (Library chip flow). Re-runs each time
  // the Lens context changes. Most-recent match wins.
  useEffect(() => {
    if (!user || !results?.form?.state || !results?.form?.county) {
      setMatchingProjectId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('state', results.form.state)
        .eq('county', results.form.county)
        .eq('technology', results.form.technology || '')
        .order('saved_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      setMatchingProjectId(data?.[0]?.id ?? null)
    })()
    return () => { cancelled = true }
  }, [user, results?.form?.state, results?.form?.county, results?.form?.technology])

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

  // Auto-submit when the URL carries enough context to run the analysis
  // (state + county + mw). Used by:
  //   - Library card "Re-Analyze in Lens" link
  //   - Library Scenarios tab "Open in Lens to save →" link (exploration scenarios)
  //   - Direct URL share / bookmark
  // Stage + technology are optional — the analysis still computes without
  // them (stage defaults to "no modifier", technology defaults to CS).
  // Removing those from the gate eliminates a class of "I clicked the
  // link but it didn't run" footguns when context is incomplete.
  const autoSubmitFired = useRef(false)
  useEffect(() => {
    if (autoSubmitFired.current || !programMap) return
    if (initialState && initialCounty && initialMW) {
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

            // Auto-promote orphan scenarios. If the user explored several
            // scenarios in the Studio before deciding to save the project,
            // those rows have project_id=null and would otherwise be
            // invisible in the Library card. Sweep up any orphans that
            // match this exact Lens context (state + county + tech) and
            // were saved within the last 7 days, attaching them to the
            // newly-created project. The 7-day window prevents truly
            // stale orphans from getting linked retroactively. Failure
            // here must NOT block the save flow — it's a courtesy attach.
            try {
              const since = new Date(Date.now() - 7 * 86400000).toISOString()
              const { data: promoted } = await supabase
                .from('scenario_snapshots')
                .update({ project_id: newId })
                .eq('user_id', liveUser.id)
                .is('project_id', null)
                .eq('state_id', payload.state)
                .eq('county_name', payload.county)
                .eq('technology', payload.technology)
                .gte('created_at', since)
                .select('id')
              if (promoted?.length) {
                toast.success(`${promoted.length} scenario${promoted.length === 1 ? '' : 's'} attached to this project`, {
                  eyebrow: '◆ Scenarios linked',
                })
              }
            } catch (err) { console.warn('[Save to Library] orphan auto-promote failed:', err.message) }
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
    <div className="min-h-screen bg-surface relative">
      <style>{LENS_OVERLAY_STYLES}</style>
      {/* Ambient intelligence layer (no Tractova mark cameo on Lens —
          result panel is content-dense and a cameo crossing mid-read
          would pull focus from Feasibility Index / Analyst Brief /
          Scenario Studio. The ambient z-0 layer sits behind the white
          result cards + navy form panel without competing for attention. */}
      <IntelligenceBackground />
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
                Run a targeted intelligence report
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
                optionTooltips={TECH_FILTER_TOOLTIPS}
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
                  data-tour-id="save"
                  className="flex items-center gap-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 px-4 py-2 rounded-lg hover:border-primary hover:text-primary transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save as Project
                </button>
              </div>
            </div>

            <SectionMarker index={1} label="Market Position" sublabel="composite feasibility · sensitivity scenarios" />

            <div data-tour-id="composite">
              <MarketPositionPanel
                stateProgram={results.stateProgram}
                countyData={results.countyData}
                programMap={programMap}
                stage={results.form.stage}
                technology={results.form.technology}
                activeScenario={activeScenario}
                ixQueueSummary={results.ixQueueSummary}
              />
            </div>

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
              ixQueueSummary={results.ixQueueSummary}
            />

            {/* §2.5: Scenario Studio — interactive sensitivity layer over an
                "achievable baseline." Phase 2 launch feature. Sits between
                Analyst Brief (qualitative) and Pillar Diagnostics (atomized
                signals) so the user moves: AI narrative → quantitative
                sensitivity → component scores. Pre-computed baseline reuses
                revenueEngine via scenarioEngine.computeBaseline. */}
            <SectionMarker index={3} label="Scenario Studio" sublabel="sensitivity · year-1 revenue + payback" />
            <div data-tour-id="scenario">
              <ScenarioStudio
                baseline={computeScenarioBaseline({
                  stateId: results.stateProgram?.id || results.form.state,
                  technology: results.form.technology,
                  mw: results.form.mw,
                  rates: results.revenueRates,
                })}
                user={user}
                projectId={matchingProjectId}
                countyName={results.form.county || ''}
              />
            </div>

            {/* Pillar Diagnostics — same SectionMarker treatment as the other
                § sections (Market Position / Analyst Brief / Scenario Studio)
                so the four sections read as a single typographic family on a
                consistent white surface. items-start: cards size independently. */}
            <SectionMarker index={4} label="Pillar Diagnostics" sublabel="offtake · interconnect · site" />
            <div
              data-tour-id="pillars"
              className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start"
            >
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
                geospatial={results.countyData?.geospatial}
                stateName={results.stateProgram?.name || results.form.state}
                county={results.form.county}
                stateId={results.stateProgram?.id}
                mw={results.form.mw}
                substations={results.substations}
              />
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
            <MaybeSpecificYieldPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              mw={results.form.mw}
            />
            <MaybeCsMarketPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              mw={results.form.mw}
            />
            <MaybeComparableDealsPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              technology={results.form.technology}
              mw={results.form.mw}
            />

            {/* First-time-Pro guided tour. Inert unless `?onboarding=1` is in
                the URL AND localStorage doesn't show prior completion. The
                anchors above (data-tour-id="composite|pillars|scenario|save")
                are the four spotlights it walks through. */}
            <LensTour resultsReady={!!results} />

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">Tractova intelligence is a research accelerator, not a substitute for site-specific due diligence.</span>{' '}
                Verify interconnection conditions with the serving utility, confirm wetland boundaries with a site survey, and validate program capacity with your state PUC before committing capital.
                Data is updated regularly but may not reflect the latest queue changes.{' '}
                <button
                  type="button"
                  onClick={() => setDataLimitationsOpen(true)}
                  className="inline-flex items-center gap-1 underline font-medium hover:text-gray-700 transition-colors cursor-pointer"
                  style={{ color: '#0F766E' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Data limitations →
                </button>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* V3: SaveToast replaced by global ToastProvider (Radix Toast +
          Motion). Removed import of legacy SaveToast component below. */}

      {/* Data limitations modal — surfaces the top 5 audit-identified
          caveats one click away from the Lens disclaimer. Opens on
          "Data limitations →" click in the bottom CTA block. */}
      <DataLimitationsModal open={dataLimitationsOpen} onOpenChange={setDataLimitationsOpen} />

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
