import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack } from '../lib/programData'
import allCounties from '../data/allCounties.json'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useCompare, lensResultToCompareItem } from '../context/CompareContext'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'

// ─────────────────────────────────────────────────────────────────────────────
// Market Position Panel — replaces the old mini state map
// ─────────────────────────────────────────────────────────────────────────────

import { STAGE_MODIFIERS, computeSubScores, computeDisplayScore } from '../lib/scoreEngine'
import { computeRevenueProjection, hasRevenueData, computeCIRevenueProjection, hasCIRevenueData, computeBESSProjection, hasBESSRevenueData, computeHybridProjection } from '../lib/revenueEngine'
import { getIXQueueSummary, hasIXQueueData } from '../lib/ixQueueEngine'
import { getNearestSubstations, hasSubstationData } from '../lib/substationEngine'

function getMarketRank(stateId, programMap) {
  if (!programMap) return { rank: null, total: 0 }
  const ranked = Object.values(programMap)
    .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const rank = ranked.findIndex(s => s.id === stateId) + 1
  return { rank: rank || null, total: ranked.length }
}

function ArcGauge({ score }) {
  const s = (typeof score === 'number' && isFinite(score)) ? score : 0
  const pct = Math.max(0, Math.min(100, s)) / 100
  const R = 44, cx = 58, cy = 54
  // arc endpoint: sweep clockwise (sweep=1) from left to pct*180°
  const ex = cx - R * Math.cos(Math.PI * pct)
  const ey = cy - R * Math.sin(Math.PI * pct)
  // fill is always ≤ 180° of the full circle → never a large-arc in SVG terms
  const largeArc = 0

  const track = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const fill  = pct > 0.01 ? `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}` : ''

  let color = '#DC2626'
  if (s >= 70)      color = '#059669'
  else if (s >= 55) color = '#0F6E56'
  else if (s >= 40) color = '#D97706'
  else if (s >= 25) color = '#EA580C'

  return (
    <svg viewBox="0 0 116 62" className="w-full max-w-[130px]">
      <path d={track} fill="none" stroke="#E5E7EB" strokeWidth="9" strokeLinecap="round" />
      {fill && <path d={fill} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />}
      <text x="58" y="50" textAnchor="middle" fontSize="22" fontWeight="800" fill={color} fontFamily="system-ui">{s}</text>
    </svg>
  )
}

function SubScoreBar({ label, weight, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
          <span className="text-[9px] text-gray-400 font-mono">{weight}</span>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-gray-700">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
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

function MarketPositionPanel({ stateProgram, countyData, programMap, stage, technology }) {
  if (!stateProgram) return null
  const { offtake, ix, site } = computeSubScores(stateProgram, countyData, stage, technology)
  const { rank, total } = getMarketRank(stateProgram.id, programMap)
  const status = STATUS_CFG[stateProgram.csStatus] || STATUS_CFG.none
  const score = computeDisplayScore(offtake, ix, site)

  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{ border: '1px solid rgba(15,110,86,0.18)', boxShadow: '0 2px 12px rgba(15,110,86,0.07), 0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Header band */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #0A5240 0%, #063629 100%)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 font-mono">Market Position</span>
          {staleDays(stateProgram.lastVerified) && (
            <span className="text-[9px] font-mono" style={{ color: 'rgba(251,191,36,0.55)' }}>
              · verified {staleDays(stateProgram.lastVerified)}d ago
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}`,
            // On dark header, lighten the bg slightly
            filter: 'brightness(1.4)',
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Three-column body */}
      <div className="bg-white grid grid-cols-3 divide-x divide-gray-100">

        {/* Left — State identity */}
        <div className="px-5 py-4 flex flex-col justify-center gap-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Target State</p>
          <h3 className="text-xl font-extrabold text-gray-900 leading-tight">{stateProgram.name}</h3>
          {stateProgram.csProgram && (
            <p className="text-xs text-primary-700 font-medium leading-snug">{stateProgram.csProgram}</p>
          )}
          {rank && (
            <p className="text-[10px] text-gray-400 mt-1">
              Ranked <span className="font-bold text-gray-700">#{rank}</span> of {total} active CS markets
            </p>
          )}
        </div>

        {/* Center — Sub-score bars */}
        <div className="px-5 py-4 flex flex-col justify-center gap-3">
          <SubScoreBar label="Offtake"         weight="40%" value={offtake} color="#0F6E56" />
          <SubScoreBar label="Interconnection" weight="35%" value={ix}      color="#BA7517" />
          <SubScoreBar label="Site Control"    weight="25%" value={site}    color="#2563EB" />
        </div>

        {/* Right — Arc gauge */}
        <div className="px-5 py-4 flex flex-col items-center justify-center gap-1">
          <ArcGauge score={score} />
          <div className="flex items-center justify-center gap-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Feasibility Index</p>
            <div className="relative group">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cursor-help">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[10px] leading-relaxed rounded-lg px-3 py-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                <p className="font-bold mb-1">Methodology</p>
                <p><span className="text-emerald-300">Offtake (40%)</span> — Program status, capacity, LMI complexity, enrollment runway</p>
                <p className="mt-0.5"><span className="text-amber-300">Interconnection (35%)</span> — Queue difficulty, study timelines, upgrade cost risk</p>
                <p className="mt-0.5"><span className="text-blue-300">Site Control (25%)</span> — Land availability, wetland risk, zoning constraints</p>
                <p className="mt-1.5 text-gray-400">Weights reflect typical decision priority: offtake viability is the first gate, IX risk is the primary capital risk, site control is increasingly commoditized.</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
const TECHNOLOGIES = ['Community Solar', 'C&I Solar', 'BESS', 'Hybrid']

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{children}</p>
  )
}

function DataRow({ label, value, highlight, valueClass }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
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
  if (s >= 7)      color = '#0F6E56'
  else if (s >= 5) color = '#BA7517'
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
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
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
        className="text-xs font-semibold px-2 py-0.5 rounded"
        style={{ background: c.bg, color: c.text }}
      >
        ~{runway.months} months{suffix}
      </span>
      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">est.</span>
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
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
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
function SiteControlCard({ siteControl, interconnection, stateName, county, stateId, mw }) {
  const { availableLand, landNotes, wetlandWarning, wetlandNotes, landUseNotes } = siteControl

  // Derive hosting capacity status from IX ease score
  const hostingStatus = (() => {
    const ease = interconnection?.easeScore
    if (ease == null) return { label: 'Unknown', color: '#6B7280', bg: 'rgba(107,114,128,0.06)', note: 'Contact serving utility for hosting capacity map' }
    if (ease >= 7) return { label: 'Available', color: '#0F6E56', bg: 'rgba(15,110,86,0.06)', note: 'Hosting capacity appears sufficient based on IX conditions' }
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
      color: availableLand ? '#0F6E56' : '#DC2626',
      bg: availableLand ? 'rgba(15,110,86,0.06)' : 'rgba(220,38,38,0.06)',
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
      color: wetlandWarning ? '#B45309' : '#0F6E56',
      bg: wetlandWarning ? 'rgba(180,83,9,0.06)' : 'rgba(15,110,86,0.06)',
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
    <div
      className="bg-white border border-gray-200 rounded-lg flex flex-col"
      style={{ borderLeft: '3px solid #2563EB' }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
          <PillarIcon type="site" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Site Control</h3>
          <p className="text-xs text-gray-400">{county} County, {stateName}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1">
        {/* Population density context */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Area Profile</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border" style={{
            ...(populationDensity === 'urban'
              ? { color: '#7C3AED', background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.20)' }
              : populationDensity === 'suburban'
              ? { color: '#2563EB', background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.20)' }
              : { color: '#0F6E56', background: 'rgba(15,110,86,0.06)', borderColor: 'rgba(15,110,86,0.20)' })
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
            low:      { label: 'Low Risk', color: '#0F6E56', bg: 'rgba(15,110,86,0.06)', border: 'rgba(15,110,86,0.20)' },
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
          const subs = getNearestSubstations(stateId, county)
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
                        background: isUtilityMatch ? 'rgba(15,110,86,0.08)' : highlight ? 'rgba(37,99,235,0.06)' : 'rgba(243,244,246,0.8)',
                        borderLeft: isUtilityMatch ? '3px solid #0F6E56' : highlight ? '3px solid #2563EB' : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold ${isUtilityMatch ? 'text-emerald-700' : highlight ? 'text-blue-700' : 'text-gray-700'}`}>{s.name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{s.utility}</span>
                        {isUtilityMatch && (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Serving Utility
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
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
    </div>
  )
}

function InterconnectionCard({ interconnection, stateProgram, stateId, mw }) {
  const { servingUtility, queueStatus, queueStatusCode, easeScore, avgStudyTimeline, queueNotes } = interconnection
  const queueSummary = getIXQueueSummary(stateId, mw)

  const TREND_ICON = { growing: '↑', stable: '→', shrinking: '↓' }
  const TREND_COLOR = { growing: '#DC2626', stable: '#D97706', shrinking: '#0F6E56' }
  const CONGESTION = {
    high:     { label: 'High Congestion',     color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    moderate: { label: 'Moderate Congestion',  color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    low:      { label: 'Low Congestion',       color: '#0F6E56', bg: 'rgba(15,110,86,0.08)' },
  }
  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${n.toLocaleString()}`

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col" style={{ borderLeft: '3px solid #BA7517' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(186,117,23,0.10)', color: '#BA7517' }}>
          <PillarIcon type="ix" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Interconnection</h3>
          <p className="text-xs text-gray-400">Queue status & utility conditions</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
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
              style={{ border: '1px solid rgba(186,117,23,0.25)', borderLeft: '3px solid #BA7517' }}
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
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#BA7517' }}>{fmt(queueSummary.estimatedUpgradeCost)}</p>
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
                    <div className="flex items-center gap-3 flex-shrink-0 text-gray-500 tabular-nums">
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
    </div>
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
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevenueProjectionSection({ stateId, mw }) {
  const proj = computeRevenueProjection(stateId, mw)
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
        style={{ border: '1px solid rgba(15,110,86,0.25)', borderLeft: '3px solid #0F6E56' }}
      >
        {/* Headline */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(15,110,86,0.06)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual Revenue</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(total)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Per MW</p>
            <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#0F6E56' }}>{fmt(proj.revenuePerMW)}</p>
          </div>
        </div>

        {/* Stream breakdown bar */}
        <div className="px-4 py-2" style={{ background: 'rgba(15,110,86,0.03)' }}>
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
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
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

function OfftakeCard({ stateProgram, revenueStack, technology, mw }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const runway = stateProgram?.runway ?? null
  const isCS = technology === 'Community Solar'

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col" style={{ borderLeft: '3px solid #0F6E56' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="offtake" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Offtake</h3>
          <p className="text-xs text-gray-400">{isCS ? 'Program status & revenue stack' : `${technology} revenue profile`}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">

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
                      <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Contact program administrator for current fill status</span>
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
                <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">{revenueStack.summary}</p>
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
            <RevenueProjectionSection stateId={stateProgram?.id} mw={mw} />
          </>
        ) : (
          /* Non-CS technology — structured analysis per tech type */
          <div className="space-y-4">
            <SectionLabel>{technology} Offtake</SectionLabel>

            {technology === 'C&I Solar' && (() => {
              const proj = computeCIRevenueProjection(stateProgram?.id, mw)
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
                      <p className="text-xs text-gray-500">Enter project MW to see C&I PPA revenue projection.</p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'BESS' && (() => {
              const proj = computeBESSProjection(stateProgram?.id, mw)
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
                      <p className="text-xs text-gray-500">Enter project MW to see BESS revenue projection.</p>
                    </div>
                  )}
                </div>
              )
            })()}

            {technology === 'Hybrid' && (() => {
              const mwNum = parseFloat(mw) || 0
              const solarMW = mwNum
              const storageMW = Math.round(mwNum * 0.5 * 10) / 10
              const proj = computeHybridProjection(stateProgram?.id, solarMW, storageMW)
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
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ITC Co-location Bonus</p>
                          <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#059669' }}>{fmt(proj.coLocationItcBonus)}</p>
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
                          <span className="text-gray-500">Co-located storage ITC uplift</span>
                          <span className="font-semibold tabular-nums" style={{ color: '#059669' }}>+10% (40% total)</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400">Hybrid assumes {proj.storageMW}MW / {proj.durationHrs}hr co-located storage. IRA Section 48 provides 40% ITC for co-located storage vs 30% standalone.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-xs text-gray-500">Enter project MW to see hybrid revenue projection.</p>
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
    </div>
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
  const signals = []

  // Program status
  if (csStatus === 'active') {
    signals.push({ label: `Active — ${capacityMW > 0 ? `${capacityMW.toLocaleString()}MW remaining` : csProgram}`, color: 'green' })
  } else if (csStatus === 'limited') {
    signals.push({ label: `Limited — ${capacityMW}MW left`, color: 'amber' })
  } else if (csStatus === 'pending') {
    signals.push({ label: 'Program pending launch', color: 'yellow' })
  } else {
    signals.push({ label: 'No CS program', color: 'gray' })
  }

  // IX difficulty
  const ixLabel = { easy: 'Easy IX', moderate: 'Moderate IX', hard: 'Hard IX', very_hard: 'Very Hard IX' }
  const ixColor = { easy: 'green', moderate: 'amber', hard: 'orange', very_hard: 'red' }
  signals.push({ label: ixLabel[ixDifficulty] || 'IX Unknown', color: ixColor[ixDifficulty] || 'gray' })

  // Queue
  if (queueStatus !== 'unknown') {
    const qLabel = { open: 'Queue Open', limited: 'Queue Limited', saturated: 'Queue Saturated' }
    const qColor = { open: 'green', limited: 'amber', saturated: 'red' }
    signals.push({ label: qLabel[queueStatus], color: qColor[queueStatus] || 'gray' })
  }

  // LMI (community solar only)
  if (technology === 'Community Solar') {
    if (!lmiRequired) {
      signals.push({ label: 'No LMI requirement', color: 'green' })
    } else if (lmiPercent >= 40) {
      signals.push({ label: `${lmiPercent}% LMI required`, color: 'orange' })
    } else {
      signals.push({ label: `${lmiPercent}% LMI required`, color: 'amber' })
    }
  }

  // Feasibility band
  if (feasibilityScore >= 70) {
    signals.push({ label: `Index ${feasibilityScore} — Top Tier`, color: 'green' })
  } else if (feasibilityScore >= 55) {
    signals.push({ label: `Index ${feasibilityScore} — Viable`, color: 'teal' })
  } else if (feasibilityScore >= 38) {
    signals.push({ label: `Index ${feasibilityScore} — Caution`, color: 'amber' })
  } else {
    signals.push({ label: `Index ${feasibilityScore} — Weak`, color: 'red' })
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
      label: 'What if IX gets harder?',
      override: { ixDifficulty: newLevel },
      detail: `Queue moves to ${newLevel.replace('_', ' ')} — add ${timelineMap[newLevel] ?? '18–30 months'} to your IX study timeline and budget ${costMap[newLevel] ?? '$1–3M'} in potential upgrade costs. At ${mwNum}MW, IX cost exposure could consume a significant portion of program enrollment value. Model this in your pro forma before advancing site control.`,
      revenueImpact: `Est. cost: +$${estUpgrade.toLocaleString()} in IX upgrades`,
      timelineImpact: `Study timeline extends to ~${timelineMap[newLevel] ?? '18–30 months'}`,
    })
  }
  if (ixIdx > 0) {
    const newLevel = IX_LEVELS[ixIdx - 1]
    scenarios.push({
      id: 'ix_easier',
      label: 'What if IX improves?',
      override: { ixDifficulty: newLevel },
      detail: `If queue conditions ease to ${newLevel.replace('_', ' ')}, interconnection timelines compress and upgrade cost risk drops sharply. This is the upside case — valuable for sensitivity modeling but don't underwrite to it without a confirmed study result.`,
    })
  }

  // Program capacity scenarios (CS only)
  if (csStatus === 'active' && capacityMW > 0 && technology === 'Community Solar') {
    const pct = capacityMW > 0 ? Math.round((mwNum / capacityMW) * 100) : null
    const pctStr = pct != null ? ` Your ${mwNum}MW project represents ~${pct}% of remaining capacity.` : ''
    scenarios.push({
      id: 'program_caps',
      label: 'What if the program caps out?',
      override: { csStatus: 'limited' },
      detail: `${csProgram ?? stateName} moves to limited capacity.${pctStr} Enrollment windows for limited-capacity programs often close within 30–60 days of announcement. Submit your application now or risk missing the window — once capped, new blocks can take 6–18 months to open.`,
    })
  }
  if (csStatus === 'limited' && technology === 'Community Solar') {
    scenarios.push({
      id: 'new_block',
      label: 'What if a new block opens?',
      override: { csStatus: 'active' },
      detail: `A new capacity block in ${stateName} would immediately unlock enrollment — historically these periods see 3–5x developer activity within the first 60 days. Position your project now so you can file on day one. Monitor the state PUC docket for block announcement filings.`,
    })
  }

  // LMI scenarios (community solar only)
  if (technology === 'Community Solar') {
    if (!lmiRequired || lmiPercent < 50) {
      scenarios.push({
        id: 'lmi_rises',
        label: 'What if LMI rises to 50%?',
        override: { lmiRequired: true, lmiPercent: 50 },
        detail: `A 50% LMI requirement means sourcing ~${Math.round(mwNum * 250)} low-income subscriber households for a ${mwNum}MW project. Budget 6–9 months for aggregator contracting and expect a 10–15% revenue haircut to attract compliant subscribers. Verify whether adders or bill credits offset this drag before proceeding.`,
      })
    }
    if (lmiRequired && lmiPercent > 0) {
      scenarios.push({
        id: 'lmi_removed',
        label: 'What if LMI req. is removed?',
        override: { lmiRequired: false, lmiPercent: 0 },
        detail: `Removing the LMI requirement opens the full commercial and residential subscriber market — dramatically easier customer acquisition and stronger bill credit economics. This is the regulatory upside case; watch for pending state PUC proceedings on LMI carveout rules.`,
      })
    }
  }

  // C&I Solar scenarios
  if (technology === 'C&I Solar') {
    scenarios.push({
      id: 'ci_ppa_drop',
      label: 'What if PPA rate drops 15%?',
      override: { ixDifficulty: ixDifficulty },
      detail: `A 15% PPA rate reduction compresses annual revenue by ~${Math.round(mwNum * 8760 * 0.17 * 0.07 * 0.15).toLocaleString()} and weakens the 25-year NPV substantially. If the offtaker demands below-market rates, evaluate whether the project still clears your return threshold — below 5.5¢/kWh is typically uneconomic in most markets.`,
    })
    scenarios.push({
      id: 'ci_rate_rise',
      label: 'What if retail rates rise 3%/yr?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Rising utility retail rates increase your offtaker's savings from the PPA and reduce re-contracting risk at term. At 3% annual escalation, the spread between your PPA and retail widens by ~50% over 10 years — this is the upside case for long-term C&I PPAs.`,
    })
    scenarios.push({
      id: 'ci_default',
      label: 'What if the offtaker defaults?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Offtaker default in year 5 means re-contracting the remaining ~${Math.round(mwNum * 8760 * 0.17 * 20 / 1000).toLocaleString()} GWh of output. Re-contracting typically takes 3–6 months and may require a 5–10% rate concession. Credit risk is the #1 C&I concern — underwrite tenant creditworthiness before signing the PPA.`,
    })
  }

  // BESS scenarios
  if (technology === 'BESS') {
    scenarios.push({
      id: 'bess_cap_drop',
      label: 'What if capacity prices drop 30%?',
      override: { ixDifficulty: ixDifficulty },
      detail: `A 30% capacity market decline reduces the largest BESS revenue stream significantly. Historical PJM/ISO-NE capacity prices have swung 40–60% between auction cycles. If capacity revenue drops, demand charge reduction and arbitrage must carry the project — stress-test your pro forma with floor-case capacity pricing.`,
    })
    scenarios.push({
      id: 'bess_degrade',
      label: 'What if degradation is 3%/yr?',
      override: { ixDifficulty: ixDifficulty },
      detail: `At 3% annual degradation vs the typical 2.5% assumption, you lose ~8% more throughput by year 10 and ~15% by year 15. This directly impacts arbitrage revenue and may trigger warranty-related capacity shortfalls. Ensure your EPC warranty guarantees a minimum round-trip efficiency floor through year 10.`,
    })
    scenarios.push({
      id: 'bess_demand_up',
      label: 'What if demand charges increase?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Rising demand charges are the BESS upside case — each $1/kW-month increase adds ~$${Math.round(mwNum * 1000 * 12).toLocaleString()} in annual revenue. Utilities in congested territories have been raising demand charges 3–8% annually. This trend favors behind-the-meter BESS economics.`,
    })
  }

  // Hybrid scenarios
  if (technology === 'Hybrid') {
    scenarios.push({
      id: 'hybrid_itc_drop',
      label: 'What if storage ITC drops to 30%?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Losing the 10% co-location bonus reduces ITC value on the storage component by ~$${Math.round(mwNum * 0.5 * 4 * 1000 * 380 * 0.10).toLocaleString()}. The co-location bonus under IRA Section 48 requires the storage to be placed in service with the solar facility — timeline delays that decouple the assets risk this adder.`,
    })
    scenarios.push({
      id: 'hybrid_clip',
      label: 'What if solar clipping is 8%+?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Solar clipping above 8% means the inverter is curtailing more generation than expected — reducing both bill credit revenue and the energy available for storage charging. Right-size the DC/AC ratio and storage duration to minimize clipping losses. Typical hybrid designs target 3–5% clipping.`,
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

function MarketIntelligenceSummary({ stateProgram, countyData, form, aiInsight }) {
  const [activeScenario, setActiveScenario] = useState(null)

  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const effectiveSub = computeSubScores(effectiveProgram, countyData, form.stage, form.technology)
  effectiveProgram.feasibilityScore = computeDisplayScore(effectiveSub.offtake, effectiveSub.ix, effectiveSub.site)
  const data = generateMarketSummary({ stateProgram: effectiveProgram, countyData, form })
  if (!data) return null

  const { verdict, verdictBg, verdictText, summary, signals } = data
  const scenarios = buildSensitivityScenarios(stateProgram, form.technology, form.mw)

  const cleanBrief = sanitizeBrief(aiInsight?.brief)
  // AI brief always shown when available — serves as base case anchor even in scenario mode
  const showAI = !!aiInsight && !!cleanBrief

  return (
    <div
      className="mb-5 rounded-lg overflow-hidden"
      style={{
        border: '1px solid rgba(124,58,237,0.18)',
        borderLeft: '4px solid #7C3AED',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      }}
    >
      {/* Dark header band */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #1E0A3C 0%, #2D1657 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Market Intelligence
          </span>
          {/* Badge: AI-powered vs scenario mode */}
          {showAI && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.28)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.45)' }}
            >
              AI Analysis
            </span>
          )}
          {activeScenario && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,6,0.20)', color: '#FCD34D', border: '1px solid rgba(217,119,6,0.35)' }}>
              Scenario Mode
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.10em] px-2.5 py-1 rounded-full"
          style={{ background: verdictBg, color: verdictText }}
        >
          {verdict}
        </span>
      </div>

      {/* Body */}
      <div className="bg-white px-5 py-4">

        {/* Analyst brief — AI when available, rule-based fallback otherwise */}
        {showAI ? (
          <div>
            {activeScenario && (
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: 'rgba(124,58,237,0.55)' }}>
                Base Analysis
              </p>
            )}
            <p className={`text-[15px] font-medium leading-relaxed ${activeScenario ? 'text-gray-400' : 'text-gray-800'}`}>
              {cleanBrief}
            </p>
          </div>
        ) : (
          <p className="text-[15px] font-medium text-gray-800 leading-relaxed">{summary}</p>
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
                <p className="text-[13px] font-medium text-gray-800 leading-relaxed">
                  {activeScenario.detail ?? summary}
                </p>
                {(activeScenario.revenueImpact || activeScenario.timelineImpact) && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {activeScenario.revenueImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                        {activeScenario.revenueImpact}
                      </span>
                    )}
                    {activeScenario.timelineImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                        {activeScenario.timelineImpact}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* AI Spotlight tiles — Primary Risk + Top Opportunity — hide in scenario mode */}
        {showAI && !activeScenario && (aiInsight.primaryRisk || aiInsight.topOpportunity) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {aiInsight.primaryRisk && (
              <div
                className="rounded-lg px-4 py-3"
                style={{
                  background: 'rgba(220,38,38,0.05)',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderLeft: '3px solid #DC2626',
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: '#DC2626' }}>
                  Primary Risk
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">{aiInsight.primaryRisk}</p>
              </div>
            )}
            {aiInsight.topOpportunity && (
              <div
                className="rounded-lg px-4 py-3"
                style={{
                  background: 'rgba(15,110,86,0.05)',
                  border: '1px solid rgba(15,110,86,0.15)',
                  borderLeft: '3px solid #0F6E56',
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: '#0F6E56' }}>
                  Top Opportunity
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">{aiInsight.topOpportunity}</p>
              </div>
            )}
          </div>
        )}

        {/* Signal tiles — always shown */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {signals.map((sig, i) => {
            const c = CHIP_COLORS[sig.color] || CHIP_COLORS.gray
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                style={{ background: c.bg, borderLeft: `3px solid ${c.dot}` }}
              >
                <span className="text-[11px] font-semibold leading-tight" style={{ color: c.text }}>{sig.label}</span>
              </div>
            )
          })}
        </div>

        {/* Immediate Action block — AI only */}
        {showAI && aiInsight.immediateAction && (
          <div
            className="mt-4 flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: 'rgba(124,58,237,0.05)',
              border: '1px solid rgba(124,58,237,0.15)',
              borderLeft: '3px solid #7C3AED',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#7C3AED' }}>
                Immediate Action — Next 30 Days
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">{aiInsight.immediateAction}</p>
            </div>
          </div>
        )}

        {/* Stage-Specific Guidance — AI only */}
        {showAI && aiInsight.stageSpecificGuidance && (
          <div
            className="mt-4 flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: 'rgba(15,110,86,0.05)',
              border: '1px solid rgba(15,110,86,0.15)',
              borderLeft: '3px solid #0F6E56',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#0F6E56' }}>
                Stage Guidance — {form.stage || 'General'}
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">{aiInsight.stageSpecificGuidance}</p>
            </div>
          </div>
        )}

        {/* Competitive Context — AI only */}
        {showAI && aiInsight.competitiveContext && (
          <div
            className="mt-4 flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: 'rgba(37,99,235,0.05)',
              border: '1px solid rgba(37,99,235,0.15)',
              borderLeft: '3px solid #2563EB',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#2563EB' }}>
                Competitive Context
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">{aiInsight.competitiveContext}</p>
            </div>
          </div>
        )}

        {/* Sensitivity Analysis — structured scenario panel */}
        {scenarios.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Sensitivity Analysis</p>
              </div>
              {activeScenario && (
                <button
                  onClick={() => setActiveScenario(null)}
                  className="text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Reset to base case
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scenarios.map((s) => {
                const delta = computeScoreDelta(stateProgram, s.override)
                const isActive = activeScenario?.id === s.id
                const positive = delta > 0
                const direction = positive ? 'upside' : delta < 0 ? 'downside' : 'neutral'
                const dirColors = {
                  upside:   { border: 'rgba(15,110,86,0.35)', bg: isActive ? 'rgba(15,110,86,0.06)' : 'white', accent: '#0F6E56' },
                  downside: { border: 'rgba(220,38,38,0.25)', bg: isActive ? 'rgba(220,38,38,0.04)' : 'white', accent: '#DC2626' },
                  neutral:  { border: 'rgba(107,114,128,0.25)', bg: isActive ? 'rgba(107,114,128,0.04)' : 'white', accent: '#6B7280' },
                }
                const dc = dirColors[direction]
                const oneLiner = s.detail.split(/[.!—]/)[0].trim()
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveScenario(isActive ? null : s)}
                    className="text-left rounded-lg p-3 transition-all duration-150"
                    style={{
                      border: `1px solid ${isActive ? dc.accent : dc.border}`,
                      background: dc.bg,
                      boxShadow: isActive ? `0 0 0 1px ${dc.accent}` : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-gray-700 leading-snug">{s.label}</span>
                      <span className={`flex-shrink-0 font-bold tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                        positive ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {positive ? '+' : ''}{delta} pts
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{oneLiner}</p>
                    {isActive && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium" style={{ color: dc.accent }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: dc.accent }} />
                        Active — details shown above
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Custom Scenario builder */}
            <CustomScenarioBuilder stateProgram={stateProgram} technology={technology} />
          </div>
        )}
      </div>
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
                className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-none"
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
                  className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-none"
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
            <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: delta > 0 ? 'rgba(15,110,86,0.06)' : delta < 0 ? 'rgba(220,38,38,0.04)' : 'rgba(107,114,128,0.04)' }}>
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
const LENS_OVERLAY_STYLES = `
  @keyframes lens-pulse {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50%       { opacity: 1;    transform: scale(1.18); }
  }
`

function LensOverlay({ visible, stateName, countyName }) {
  const C = 2 * Math.PI * 60  // circumference ≈ 376.99
  const [isShown, setIsShown] = useState(false)
  const arcRef  = useRef(null)
  const rafRef  = useRef(null)

  useEffect(() => {
    if (visible) {
      // Mount overlay and start smooth fill toward 88% over ~14s via RAF
      // RAF mutates the DOM directly — zero React re-renders during animation
      setIsShown(true)
      let startTs = null
      const FILL_DURATION = 14000 // ms to reach 88% — longer than worst-case API time

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
      // API returned — cancel RAF, snap to full via CSS transition, then dismiss
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
        background: 'rgba(7,17,12,0.88)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
      }}
    >
      {/* Sun circle */}
      <div style={{ filter: 'drop-shadow(0 0 14px rgba(217,119,6,0.55))' }}>
        <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
          {/* Track ring */}
          <circle cx="80" cy="80" r="60" stroke="rgba(255,255,255,0.08)" strokeWidth="7" fill="none" />
          {/* Progress arc — driven by RAF via ref, never causes React re-renders */}
          <circle
            ref={arcRef}
            cx="80" cy="80" r="60"
            stroke="#D97706"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C}
            style={{ transformOrigin: '80px 80px', transform: 'rotate(-90deg)' }}
          />
          {/* 8 sun rays */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180
            return (
              <line
                key={i}
                x1={80 + 12 * Math.cos(angle)} y1={80 + 12 * Math.sin(angle)}
                x2={80 + 20 * Math.cos(angle)} y2={80 + 20 * Math.sin(angle)}
                stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" opacity="0.5"
              />
            )
          })}
          {/* Pulsing center dot */}
          <circle
            cx="80" cy="80" r="7"
            fill="#D97706"
            style={{ transformOrigin: '80px 80px', animation: 'lens-pulse 1800ms ease-in-out infinite' }}
          />
        </svg>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', fontFamily: 'inherit' }}>
          TRACTOVA LENS
        </p>
        {stateName && countyName && (
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.65)', fontFamily: 'inherit' }}>
            Analyzing {stateName}&nbsp;·&nbsp;{countyName} County
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style constant (used by CountyCombobox + Search form)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm bg-transparent border-0 outline-none px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none"

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
      className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-sm cursor-pointer relative transition-all focus-within:border-primary/60"
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
          className={`flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
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
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false) }}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
              }`}
            >
              <span className={`w-3.5 h-3.5 flex-shrink-0 ${value === opt ? 'text-primary' : 'text-transparent'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              {opt}
            </li>
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
      className={`bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-sm relative transition-all focus-within:border-primary/60 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
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
          className="pointer-events-none flex-shrink-0 text-gray-400 transition-transform duration-150"
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
function SaveToast({ visible }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
      <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34B08A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Project saved to My Projects
      </div>
    </div>
  )
}

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
async function fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue, accessToken }) {
  try {
    const res = await fetch('/api/lens-insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
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
  const [showToast, setShowToast]     = useState(false)
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [saveName, setSaveName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const resultsRef = useRef(null)

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
    const [stateProgram, countyData, revenueStack] = await Promise.all([
      programMap?.[form.state] ?? getStateProgramMap().then(m => m[form.state] ?? null),
      getCountyData(form.state, form.county),
      getRevenueStack(form.state),
    ])
    const runway = stateProgram?.runway ?? null

    // Run AI fetch + 800ms display floor in parallel
    // The overlay stays up until the AI responds (typically 2–4s)
    const [aiResult] = await Promise.all([
      fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue: getIXQueueSummary(form.state, form.mw), accessToken }).catch((e) => ({ insight: null, reason: `caught: ${e.message}` })),
      new Promise(resolve => setTimeout(resolve, 800)),
    ])

    const aiInsight = aiResult?.insight ?? null

    setResults({ form: { ...form }, stateProgram, countyData, revenueStack, aiInsight })
    setAnalyzing(false)
  }

  const handleSave = () => {
    if (!results) return
    const defaultName = `${results.form.county} ${results.form.mw}MW ${results.form.technology}`
    setSaveName(defaultName)
    setSaveModal({ defaultName })
  }

  const handleSaveConfirm = async () => {
    if (!results || !user) return
    setSaving(true)
    const { error } = await supabase.from('projects').insert({
      user_id:          user.id,
      name:             saveName.trim() || `${results.form.county} ${results.form.mw}MW ${results.form.technology}`,
      state:            results.form.state,
      state_name:       results.stateProgram?.name || results.form.state,
      county:           results.form.county,
      mw:               results.form.mw,
      stage:            results.form.stage,
      technology:       results.form.technology,
      cs_program:       results.stateProgram?.csProgram || null,
      cs_status:        results.stateProgram?.csStatus || 'none',
      serving_utility:  results.countyData?.interconnection?.servingUtility || null,
      opportunity_score: results.stateProgram?.feasibilityScore || null,
    })
    setSaving(false)
    if (!error) {
      setSaveModal(null)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
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

  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5"

  return (
    <div className="min-h-screen bg-surface">
      <style>{LENS_OVERLAY_STYLES}</style>
      <LensOverlay
        visible={analyzing}
        stateName={ALL_STATES.find(s => s.id === form.state)?.name || ''}
        countyName={form.county}
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
          style={{ boxShadow: '0 2px 12px rgba(15,110,86,0.07), 0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {/* Form header band */}
          <div
            className="px-6 py-4 flex items-center gap-4 rounded-t-xl"
            style={{ background: 'linear-gradient(135deg, #0A5240 0%, #063629 100%)' }}
          >

            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 leading-none mb-1">
                Project Intelligence Search
              </p>
              <p className="text-sm font-bold text-white leading-snug">
                Enter project parameters below to run a targeted Lens analysis
              </p>
            </div>

            {/* Required field hint */}
            <p className="text-[10px] text-white/40 flex-shrink-0 hidden lg:block">All fields required</p>
          </div>

          {/* Fields */}
          <div className="px-5 py-5" style={{ background: '#EEF4F2' }}>
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
              <div className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-sm transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
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
            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
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
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0" />
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
                  {results.stateProgram?.lastUpdated && ` · Data last updated ${new Date(results.stateProgram.lastUpdated + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
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

            <MarketPositionPanel
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              programMap={programMap}
              stage={results.form.stage}
              technology={results.form.technology}
            />

            {/* Market Intelligence Summary */}
            <SectionDivider />
            <MarketIntelligenceSummary
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              form={results.form}
              aiInsight={results.aiInsight ?? null}
            />

            {/* Three pillar cards */}
            <SectionDivider />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <SiteControlCard
                siteControl={results.countyData?.siteControl}
                interconnection={results.countyData?.interconnection}
                stateName={results.stateProgram?.name || results.form.state}
                county={results.form.county}
                stateId={results.stateProgram?.id}
                mw={results.form.mw}
              />
              <InterconnectionCard
                interconnection={results.countyData?.interconnection}
                stateProgram={results.stateProgram}
                stateId={results.stateProgram?.id}
                mw={results.form.mw}
              />
              <OfftakeCard
                stateProgram={results.stateProgram}
                revenueStack={results.revenueStack}
                technology={results.form.technology}
                mw={results.form.mw}
              />
            </div>

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">Tractova intelligence is a research accelerator, not a substitute for site-specific due diligence.</span>{' '}
                Verify interconnection conditions with the serving utility, confirm wetland boundaries with a site survey, and validate program capacity with your state PUC before committing capital.
                Data is updated regularly but may not reflect the latest queue changes.
              </p>
            </div>
          </div>
        )}
      </main>

      <SaveToast visible={showToast} />

      {/* Save modal — sign-in prompt if not authed, name input if authed */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSaveModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">

            {!user ? (
              /* ── Not signed in ── */
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-4"
                />
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
