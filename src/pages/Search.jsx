import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { stateById, getRunway } from '../data/statePrograms'
import { getCountyData, revenueStackByState } from '../data/countyData'
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

function computeSubScores(stateProgram, countyData) {
  if (!stateProgram) return { offtake: 0, ix: 0, site: 0 }

  // Offtake (0–100): CS status + capacity + LMI drag
  const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
  let offtake = csBase[stateProgram.csStatus] ?? 8
  if (stateProgram.csStatus === 'active' && stateProgram.capacityMW > 500) offtake += 8
  if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) offtake -= 10
  else if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 25) offtake -= 5
  offtake = Math.max(0, Math.min(100, offtake))

  // IX (0–100): difficulty rating
  const ix = { easy: 88, moderate: 65, hard: 38, very_hard: 14 }[stateProgram.ixDifficulty] ?? 50

  // Site (0–100): from countyData land + wetland signals
  let site = 60
  if (countyData?.siteControl) {
    const { availableLand, wetlandWarning } = countyData.siteControl
    if (availableLand && !wetlandWarning)  site = 82
    else if (availableLand && wetlandWarning)  site = 56
    else if (!availableLand && !wetlandWarning) site = 42
    else site = 26
  }

  return { offtake, ix, site }
}

function getMarketRank(stateId) {
  const ranked = Object.values(stateById)
    .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const rank = ranked.findIndex(s => s.id === stateId) + 1
  return { rank: rank || null, total: ranked.length }
}

function ArcGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score)) / 100
  const R = 44, cx = 58, cy = 54
  // arc endpoint from 180° sweeping clockwise by pct*180°
  const ex = cx - R * Math.cos(Math.PI * pct)
  const ey = cy - R * Math.sin(Math.PI * pct)
  const largeArc = pct > 0.5 ? 1 : 0

  const track = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const fill  = pct > 0.01 ? `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}` : ''

  let color = '#DC2626'
  if (score >= 70) color = '#059669'
  else if (score >= 55) color = '#0F6E56'
  else if (score >= 40) color = '#D97706'
  else if (score >= 25) color = '#EA580C'

  return (
    <svg viewBox="0 0 116 62" className="w-full max-w-[130px]">
      <path d={track} fill="none" stroke="#E5E7EB" strokeWidth="9" strokeLinecap="round" />
      {fill && <path d={fill} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />}
      <text x="58" y="50" textAnchor="middle" fontSize="22" fontWeight="800" fill={color} fontFamily="system-ui">{score}</text>
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

function MarketPositionPanel({ stateProgram, countyData }) {
  if (!stateProgram) return null
  const { offtake, ix, site } = computeSubScores(stateProgram, countyData)
  const { rank, total } = getMarketRank(stateProgram.id)
  const status = STATUS_CFG[stateProgram.csStatus] || STATUS_CFG.none
  const score = stateProgram.feasibilityScore || 0

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
          <SubScoreBar label="Interconnection" weight="35%" value={ix}      color="#2563EB" />
          <SubScoreBar label="Site Control"    weight="25%" value={site}    color="#D97706" />
        </div>

        {/* Right — Arc gauge */}
        <div className="px-5 py-4 flex flex-col items-center justify-center gap-1">
          <ArcGauge score={score} />
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 text-center">Feasibility Score</p>
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

function EaseScoreMeter({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400 italic">Not available</span>
  }
  const pct = score * 10
  let color = 'bg-red-400'
  if (score >= 7) color = 'bg-primary'
  else if (score >= 5) color = 'bg-yellow-400'
  else if (score >= 3) color = 'bg-orange-400'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{score} / 10</span>
    </div>
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
function SiteControlCard({ siteControl, stateName, county }) {
  const { availableLand, landNotes, wetlandWarning, wetlandNotes, landUseNotes } = siteControl

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="site" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Site Control</h3>
          <p className="text-xs text-gray-400">{county} County, {stateName}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* Land availability flag */}
        <div>
          <SectionLabel>Land Availability</SectionLabel>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
            availableLand
              ? 'bg-primary-50 text-primary-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {availableLand ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Land parcels available in this county
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limited land availability — see notes
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{landNotes}</p>
        </div>

        {/* Wetland warning */}
        <div>
          <SectionLabel>Wetland Risk</SectionLabel>
          {wetlandWarning ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Wetland warning — NWI review required
              </div>
              {wetlandNotes && <p className="text-xs text-amber-700 leading-relaxed">{wetlandNotes}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-3 py-2 rounded-md">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Low wetland risk on typical upland sites
            </div>
          )}
        </div>

        {/* Land use notes */}
        <div>
          <SectionLabel>Zoning & Land Use</SectionLabel>
          <p className="text-xs text-gray-600 leading-relaxed bg-surface rounded-md px-3 py-2">{landUseNotes}</p>
        </div>
      </div>
    </div>
  )
}

function InterconnectionCard({ interconnection, stateProgram }) {
  const { servingUtility, queueStatus, queueStatusCode, easeScore, avgStudyTimeline, queueNotes } = interconnection

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
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
          <div className="bg-surface rounded-md px-3 py-2">
            <EaseScoreMeter score={easeScore} />
            <p className="text-xs text-gray-400 mt-1.5">
              {easeScore >= 7 ? 'Strong interconnection conditions for this county.'
               : easeScore >= 5 ? 'Moderate difficulty — budget for potential upgrade costs.'
               : easeScore >= 3 ? 'Challenging territory — high upgrade costs likely.'
               : easeScore !== null ? 'Extremely difficult — avoid unless project economics are strong.'
               : 'Score not available for this county.'}
            </p>
          </div>
        </div>

        {/* Queue notes */}
        <div>
          <SectionLabel>Queue Intelligence</SectionLabel>
          <p className="text-xs text-gray-600 leading-relaxed bg-surface rounded-md px-3 py-2">{queueNotes}</p>
        </div>

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

function OfftakeCard({ stateProgram, revenueStack, technology, mw }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const runway = stateProgram ? getRunway(stateProgram) : null
  const showCSWarning = technology === 'BESS' || technology === 'C&I Solar'

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="offtake" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Offtake</h3>
          <p className="text-xs text-gray-400">Program status & revenue stack</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* CS program status */}
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
                value={stateProgram.capacityMW > 0 ? `${stateProgram.capacityMW.toLocaleString()} MW` : 'TBD'}
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
              {runway && (
                <div className="flex items-center justify-between pt-1.5">
                  <span className="text-xs text-gray-500">Est. program runway</span>
                  <RunwayBadge runway={runway} />
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

        {/* Technology note */}
        {showCSWarning && technology === 'BESS' && (
          <div className="flex items-start gap-2 bg-accent-50 border border-accent-200 rounded-md px-3 py-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-accent-700">BESS offtake depends on contracted capacity market revenue, not CS bill credits. CS program data shown is for context only.</p>
          </div>
        )}

        {/* Revenue stack */}
        {revenueStack ? (
          <div>
            <SectionLabel>Revenue Stack</SectionLabel>
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
            <p className="text-xs text-gray-400 italic">Revenue stack summary not yet seeded for this state. Check DSIRE (dsireusa.org) for incentive details.</p>
          </div>
        )}

        {/* Program notes */}
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
  if (stage === 'Interconnection' && (ixDifficulty === 'hard' || ixDifficulty === 'very_hard')) {
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
    signals.push({ label: `Score ${feasibilityScore} — Top Tier`, color: 'green' })
  } else if (feasibilityScore >= 55) {
    signals.push({ label: `Score ${feasibilityScore} — Viable`, color: 'teal' })
  } else if (feasibilityScore >= 38) {
    signals.push({ label: `Score ${feasibilityScore} — Caution`, color: 'amber' })
  } else {
    signals.push({ label: `Score ${feasibilityScore} — Weak`, color: 'red' })
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

function buildSensitivityScenarios(stateProgram, technology) {
  if (!stateProgram) return []
  const { ixDifficulty, csStatus, lmiRequired, lmiPercent, capacityMW } = stateProgram
  const ixIdx = IX_LEVELS.indexOf(ixDifficulty)
  const scenarios = []

  // IX scenarios
  if (ixIdx < IX_LEVELS.length - 1) {
    scenarios.push({
      id: 'ix_harder',
      label: 'What if IX gets harder?',
      override: { ixDifficulty: IX_LEVELS[ixIdx + 1] },
    })
  }
  if (ixIdx > 0) {
    scenarios.push({
      id: 'ix_easier',
      label: 'What if IX improves?',
      override: { ixDifficulty: IX_LEVELS[ixIdx - 1] },
    })
  }

  // Program capacity scenarios
  if (csStatus === 'active' && capacityMW > 0) {
    scenarios.push({
      id: 'program_caps',
      label: 'What if the program caps out?',
      override: { csStatus: 'limited' },
    })
  }
  if (csStatus === 'limited') {
    scenarios.push({
      id: 'new_block',
      label: 'What if a new block opens?',
      override: { csStatus: 'active' },
    })
  }

  // LMI scenarios (community solar only)
  if (technology === 'Community Solar') {
    if (!lmiRequired || lmiPercent < 50) {
      scenarios.push({
        id: 'lmi_rises',
        label: 'What if LMI rises to 50%?',
        override: { lmiRequired: true, lmiPercent: 50 },
      })
    }
    if (lmiRequired && lmiPercent > 0) {
      scenarios.push({
        id: 'lmi_removed',
        label: 'What if LMI req. is removed?',
        override: { lmiRequired: false, lmiPercent: 0 },
      })
    }
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

function MarketIntelligenceSummary({ stateProgram, countyData, form }) {
  const [activeScenario, setActiveScenario] = useState(null)

  // When a scenario is active, merge its overrides into stateProgram before generating summary
  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const data = generateMarketSummary({ stateProgram: effectiveProgram, countyData, form })
  if (!data) return null

  const { verdict, verdictBg, verdictText, summary, signals } = data
  const scenarios = buildSensitivityScenarios(stateProgram, form.technology)

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center text-primary flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Market Intelligence</span>
          {activeScenario && (
            <span className="text-[10px] font-medium text-accent-600 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-full">
              Scenario Mode
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full transition-colors"
          style={{ background: verdictBg, color: verdictText }}
        >
          {verdict}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>

        {/* Signal chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {signals.map((sig, i) => {
            const c = CHIP_COLORS[sig.color] || CHIP_COLORS.gray
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: c.bg, color: c.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                {sig.label}
              </span>
            )
          })}
        </div>

        {/* Sensitivity chips */}
        {scenarios.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Sensitivity Analysis</p>
            <div className="flex flex-wrap gap-2">
              {scenarios.map((s) => {
                const delta = computeScoreDelta(stateProgram, s.override)
                const isActive = activeScenario?.id === s.id
                const positive = delta > 0
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveScenario(isActive ? null : s)}
                    className={`flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-primary-50 border-primary/40 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary-700 hover:bg-primary-50'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span className={`font-bold tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                      positive
                        ? 'bg-green-100 text-green-700'
                        : delta < 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {positive ? '+' : ''}{delta}
                    </span>
                  </button>
                )
              })}
            </div>
            {activeScenario && (
              <p className="text-[10px] text-gray-400 mt-2.5 leading-relaxed">
                Scenario active — summary and verdict reflect modified conditions. Click again to return to base case.
              </p>
            )}
          </div>
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

  const [form, setForm] = useState({
    state: initialState,
    county: '',
    mw: '',
    stage: '',
    technology: '',
  })
  const [results, setResults]         = useState(null)
  const [showToast, setShowToast]     = useState(false)
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [saveName, setSaveName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const resultsRef = useRef(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const stateProgram = stateById[form.state] || null
    const countyData   = getCountyData(form.state, form.county)
    const revenueStack = revenueStackByState[form.state] || null

    setResults({ form: { ...form }, stateProgram, countyData, revenueStack })

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
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

  const isFormValid = form.state && form.county.trim() && form.mw && form.stage && form.technology

  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5"

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-5">
          <h1 className="text-xl font-bold text-gray-900">Tractova Lens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter a specific project to get targeted site control, interconnection, and offtake intelligence.
          </p>
        </div>

        {/* Search form */}
        <form
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
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400 hidden sm:block">
              Intelligence is generated from seeded state + county data — verify with your utility and PUC before committing capital.
            </p>
            <button
              type="submit"
              disabled={!isFormValid}
              className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Run Lens Analysis
            </button>
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
            />

            {/* Market Intelligence Summary */}
            <SectionDivider />
            <MarketIntelligenceSummary
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              form={results.form}
            />

            {/* Three pillar cards */}
            <SectionDivider />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <SiteControlCard
                siteControl={results.countyData.siteControl}
                stateName={results.stateProgram?.name || results.form.state}
                county={results.form.county}
              />
              <InterconnectionCard
                interconnection={results.countyData.interconnection}
                stateProgram={results.stateProgram}
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
