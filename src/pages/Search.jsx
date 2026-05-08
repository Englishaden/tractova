import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack, getRevenueRates, getEnergyCommunity, getHudQctDda, getNmtcLic } from '../lib/programData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import MarketPositionPanel from '../components/MarketPositionPanel.jsx'
import SiteControlCard from '../components/SiteControlCard.jsx'
import InterconnectionCard from '../components/InterconnectionCard.jsx'
import OfftakeCard from '../components/OfftakeCard.jsx'
import MarketIntelligenceSummary from '../components/MarketIntelligenceSummary.jsx'
import { useToast } from '../components/ui/Toast'

// 2026-05-07 cleanup: dropped 16 leftover Search.jsx imports that
// became orphans after Sprint 2.3 extracted the panels (each panel
// now imports its own scoreEngine / revenueEngine helpers directly).
// Kept only the helpers Search.jsx itself still references.

import { getIXQueueSummary } from '../lib/programData'
import { TECH_FILTER_TOOLTIPS } from '../lib/techDefinitions'
import ScenarioStudio from '../components/ScenarioStudio'
import { computeBaseline as computeScenarioBaseline } from '../lib/scenarioEngine'
import LensTour from '../components/LensTour'
import DataLimitationsModal from '../components/DataLimitationsModal'
import IntelligenceBackground from '../components/IntelligenceBackground'
import RunIdMasthead from '../components/RunIdMasthead'
import SectionMarker from '../components/SectionMarker'
import LensScenarioRow from '../components/LensScenarioRow'
import LensOverlay, { LENS_OVERLAY_STYLES } from '../components/LensOverlay'
import FieldSelect from '../components/FieldSelect'
import CountyCombobox from '../components/CountyCombobox'
import AddToCompareButton from '../components/AddToCompareButton'
import {
  MaybeRegulatoryPanel,
  MaybeSpecificYieldPanel,
  MaybeCsMarketPanel,
  MaybeComparableDealsPanel,
} from '../components/MaybeLensPanels'

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
// SubScoreBar moved to src/components/SubScoreBar.jsx (Sprint E.3).

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
// RunIdMasthead moved to src/components/RunIdMasthead.jsx (Sprint E.3).
// SectionMarker moved to src/components/SectionMarker.jsx (Sprint E.3).
// CollapsibleCard moved to src/components/CollapsibleCard.jsx (Sprint E.3).
// CardDrilldown moved to src/components/CardDrilldown.jsx (Sprint E.3).

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

// RevenueStackBar moved to src/components/RevenueStackBar.jsx (Sprint E.3).
// RevenueProjectionSection moved to src/components/RevenueProjectionSection.jsx (Sprint E.3).
// SolarCostLineagePanel moved to src/components/SolarCostLineagePanel.jsx (Sprint E.3).

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

// BriefDrilldown moved to src/components/BriefDrilldown.jsx (Sprint E.3).

// MarketIntelligenceSummary moved to src/components/MarketIntelligenceSummary.jsx (Sprint 2.3).

// LensScenarioRow moved to src/components/LensScenarioRow.jsx (Sprint E.3).

// CustomScenarioInline moved to src/components/CustomScenarioInline.jsx (Sprint E.3).
// CustomScenarioBuilder moved to src/components/CustomScenarioBuilder.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// LENS_OVERLAY_STYLES + LensOverlay moved to src/components/LensOverlay.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// Shared style constant (used by Search form's MW input)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none"

// FieldSelect moved to src/components/FieldSelect.jsx (Sprint E.3).
// CountyCombobox moved to src/components/CountyCombobox.jsx (Sprint E.3).
// AddToCompareButton moved to src/components/AddToCompareButton.jsx (Sprint E.3).

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

// MaybeRegulatoryPanel / MaybeSpecificYieldPanel / MaybeCsMarketPanel /
// MaybeComparableDealsPanel moved to src/components/MaybeLensPanels.jsx (Sprint E.3).

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

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

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

      abortRef.current = new AbortController()
      let aiInsight = null
      try {
        const [aiResult] = await Promise.all([
          fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue: ixQueueSummary, accessToken, signal: abortRef.current.signal }),
          new Promise(resolve => setTimeout(resolve, 800)),
        ])
        aiInsight = aiResult?.insight ?? null
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[Lens] AI insight failed, showing analysis without it:', err.message)
        // AbortError or other AI failure → fall through with aiInsight=null;
        // analysis is still useful without the AI verdict.
      }

      setResults({ form: { ...form }, stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic, aiInsight })
    } catch (err) {
      // Any uncaught error in data fetching used to leave analyzing=true forever
      // (the white-screen loading hang). Surface it to the user instead.
      console.error('[Lens] analysis failed:', err)
      toast.error('Analysis failed', { description: err?.message?.slice(0, 200) || 'Please try again. If the issue persists, check your connection.' })
    } finally {
      setAnalyzing(false)
    }
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
