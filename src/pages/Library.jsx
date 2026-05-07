import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import FilterSelect from '../components/ui/FilterSelect'
import TechLabel from '../components/ui/TechLabel'
import { TECH_FILTER_TOOLTIPS } from '../lib/techDefinitions'
import { getStateProgramMap, getCountyData, getStateProgramDeltas } from '../lib/programData'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { useCompare, libraryProjectToCompareItem } from '../context/CompareContext'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../components/ui/Dialog'
import TractovaLoader from '../components/ui/TractovaLoader'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { logProjectEvent } from '../lib/projectEvents'
import { TECH_COLORS } from '../lib/v3Tokens'
import IntelligenceBackground from '../components/IntelligenceBackground'
import WalkingTractovaMark from '../components/WalkingTractovaMark'
import { getAlerts } from '../lib/alertHelpers'
import { buildExportRows, buildMethodologySheet, buildGlossarySheet } from '../lib/exportHelpers'
import ProjectCard from '../components/ProjectCard.jsx'
import ScenariosView from '../components/ScenariosView.jsx'
// ProjectPDFExport is lazy-loaded on first click — keeps initial bundle lean

// ── Stage / tech badge styles ────────────────────────────────────────────────
const STAGE_BADGE = {
  'Prospecting':            'bg-gray-100 text-gray-600 border-gray-200',
  'Site Control':           'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-Development':        'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Development':            'bg-teal-50 text-teal-800 border-teal-200',
  'NTP (Notice to Proceed)':'bg-purple-50 text-purple-700 border-purple-200',
  'Construction':           'bg-accent-50 text-accent-700 border-accent-200',
  'Operational':            'bg-teal-50 text-teal-800 border-teal-200',
}

const TECH_BADGE = {
  'Community Solar': 'bg-teal-50 text-teal-800 border-teal-200',
  'C&I Solar':       'bg-blue-50 text-blue-700 border-blue-200',
  'BESS':            'bg-accent-50 text-accent-700 border-accent-200',
  'Hybrid':          'bg-purple-50 text-purple-700 border-purple-200',
}

const PIPELINE_STAGES = [
  'Prospecting',
  'Site Control',
  'Pre-Development',
  'Development',
  'NTP (Notice to Proceed)',
  'Construction',
  'Operational',
]

const PIPELINE_SHORT = [
  'Prospect',
  'Site Ctrl',
  'Pre-Dev',
  'Dev',
  'NTP',
  'Construct',
  'Operating',
]

// ── Normalize Supabase row → camelCase ──────────────────────────────────────
function normalize(row) {
  return {
    id:               row.id,
    name:             row.name,
    state:            row.state,
    stateName:        row.state_name,
    county:           row.county,
    mw:               row.mw,
    stage:            row.stage,
    technology:       row.technology,
    csProgram:        row.cs_program,
    csStatus:         row.cs_status,
    servingUtility:   row.serving_utility,
    feasibilityScore: row.opportunity_score,
    ixDifficulty:     row.ix_difficulty,
    notes:            row.notes || '',
    savedAt:          row.saved_at,
    lastObservedScore: row.last_observed_score ?? null,
  }
}

function Badge({ label, map }) {
  const cls = map[label] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-sm border font-medium ${cls}`}>{label}</span>
  )
}

// ── Score arc gauge ───────────────────────────────────────────────────────────
export function ScoreGauge({ score }) {
  if (score == null) return null
  const r    = 34
  const cx   = 50
  const cy   = 48
  const circ = Math.PI * r
  // arc fill uses dasharray on a full-semicircle path (always 0 large-arc, sweep=1)
  const pct  = Math.max(0, Math.min(score / 100, 1))
  const ex   = cx - r * Math.cos(Math.PI * pct)
  const ey   = cy - r * Math.sin(Math.PI * pct)
  const arcD = pct > 0.01 ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}` : ''
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FCD34D' : '#F87171'
  const label = score >= 70 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 64" className="w-28">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#E5E7EB" strokeWidth="7" strokeLinecap="round"
        />
        {arcD && (
          <path d={arcD} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">{score}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="#9CA3AF">out of 100</text>
      </svg>
      <span className="text-[10px] font-semibold mt-0.5" style={{ color }}>{label} market</span>
    </div>
  )
}

// ── IX difficulty display ────────────────────────────────────────────────────
export const IX_STYLES = {
  easy:      'bg-teal-50 text-teal-800 border-teal-200',
  moderate:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  hard:      'bg-orange-50 text-orange-700 border-orange-200',
  very_hard: 'bg-red-50 text-red-700 border-red-200',
}
export const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }

// ── CS status display ────────────────────────────────────────────────────────
export const CS_STATUS_STYLES = {
  active:  'bg-teal-50 text-teal-800 border-teal-200',
  limited: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  none:    'bg-red-50 text-red-700 border-red-200',
}
export const CS_STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }

// ── Pipeline progress ────────────────────────────────────────────────────────
export function PipelineProgress({ stage }) {
  const activeIdx = PIPELINE_STAGES.indexOf(stage)
  return (
    <div>
      <div className="flex items-center">
        {PIPELINE_STAGES.map((s, i) => {
          const done    = i < activeIdx
          const current = i === activeIdx
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
                    done    ? 'bg-teal-700 border-teal-700' :
                    current ? 'border-teal-700 ring-2 ring-teal-700/30' :
                              ''
                  }`}
                  style={(!done && !current) ? { background: '#F3F4F6', borderColor: '#D1D5DB' } :
                         current             ? { background: 'rgba(15,118,110,0.15)' } : {}}
                />
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 ${done ? 'bg-teal-700' : ''}`}
                  style={!done ? { background: '#E5E7EB' } : {}}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex mt-1.5">
        {PIPELINE_SHORT.map((label, i) => {
          const current = i === activeIdx
          return (
            <div
              key={label}
              className={`flex-1 last:flex-none text-center text-[8.5px] leading-tight font-medium truncate px-0.5 ${current ? 'text-teal-700 font-bold' : ''}`}
              style={!current ? { color: '#9CA3AF' } : {}}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Export shared schema ─────────────────────────────────────────────────────
// Single source of truth for the XLSX project sheet. Sub-score columns are
// computed on export via scoreEngine so the spreadsheet matches the in-app
// Lens values exactly. CSV format was dropped 2026-05-03 (Site-walk Session 5);
// XLSX with Methodology + Glossary tabs is the only export path now.
const EXPORT_HEADERS = [
  // Identity
  'Name', 'State', 'County', 'MW AC', 'Technology', 'Stage',
  // Scores (composite + sub-scores from scoreEngine.computeSubScores)
  'Feasibility Index', 'Offtake Sub-score', 'IX Sub-score', 'Site Sub-score',
  // Program
  'CS Status', 'CS Program', 'Program Capacity Remaining (MW)', 'LMI Required (%)', 'Program Runway (months)',
  // IX
  'IX Difficulty', 'IX Notes (truncated)',
  // Site (Path B geospatial — NWI + SSURGO)
  'Wetland-richness Index (%)', 'Prime Farmland (%)',
  // Operations
  'Serving Utility', 'Est. Annual Revenue ($/MW/yr)',
  // Meta
  'Risk Flags', 'Saved Date',
]

// ── XLSX export ──────────────────────────────────────────────────────────────
// Lazy-loads xlsx on first click so the dependency stays out of the main
// bundle. Output is a 3-sheet workbook:
//   1. Projects — full data table including sub-scores from scoreEngine
//   2. Methodology & Sources — pillar→source→URL hyperlink reference
//   3. Glossary — terms used in Sheet 1, mirrors the in-app Glossary page
async function exportXLSX(projects, stateProgramMap = {}, countyDataMap = {}) {
  const rows = buildExportRows(projects, stateProgramMap, countyDataMap)
  const XLSX = await import('xlsx')

  // ── Sheet 1: Projects ──
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows])
  ws['!cols'] = [
    { wch: 28 }, // Name
    { wch: 12 }, // State
    { wch: 16 }, // County
    { wch: 8 },  // MW AC
    { wch: 16 }, // Technology
    { wch: 18 }, // Stage
    { wch: 10 }, // Feas Idx
    { wch: 12 }, // Offtake
    { wch: 10 }, // IX
    { wch: 10 }, // Site
    { wch: 10 }, // CS Status
    { wch: 22 }, // CS Program
    { wch: 14 }, // Program Capacity
    { wch: 10 }, // LMI %
    { wch: 12 }, // Runway
    { wch: 12 }, // IX Diff
    { wch: 50 }, // IX Notes
    { wch: 14 }, // Wetland %
    { wch: 14 }, // Prime Farmland %
    { wch: 22 }, // Serving Utility
    { wch: 18 }, // Revenue
    { wch: 36 }, // Alerts
    { wch: 12 }, // Saved
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  // USD whole-dollars on revenue column. Column letter for "Est. Annual
  // Revenue" is U (21st column) given the new header order — was P pre-Session 5.
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws[`U${r}`]
    if (cell && typeof cell.v === 'number') cell.z = '"$"#,##0'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Projects')
  XLSX.utils.book_append_sheet(wb, buildMethodologySheet(XLSX), 'Methodology & Sources')
  XLSX.utils.book_append_sheet(wb, buildGlossarySheet(XLSX), 'Glossary')
  XLSX.writeFile(wb, `tractova-projects-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Inline stage picker ───────────────────────────────────────────────────────
export function StagePicker({ stage, projectId, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (newStage) => {
    setOpen(false)
    if (newStage === stage) return
    const previous = stage || '(unset)'
    await supabase.from('projects').update({ stage: newStage }).eq('id', projectId)
    onChange(newStage)
    // Audit log -- silent on failure (migration may not be applied yet).
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await logProjectEvent({
        projectId,
        userId: user.id,
        kind: 'stage_change',
        detail: `Stage advanced: ${previous} → ${newStage}`,
        meta: { previous, next: newStage },
      })
    }
  }

  const stageCls = STAGE_BADGE[stage] || 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label="Edit project stage"
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm border font-medium transition-opacity hover:opacity-80 ${stageCls}`}
      >
        {stage}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <ul
          // V3: z-100 to definitively sit above adjacent project cards.
          // Parent card now drops overflow-hidden when collapsed so the
          // dropdown can extend below the card boundary.
          className="absolute z-100 top-full mt-1 left-0 rounded-lg overflow-hidden min-w-[210px]"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 36px rgba(0,0,0,0.18)' }}
        >
          {PIPELINE_STAGES.map((s) => (
            <li key={s}>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                style={s === stage
                  ? { fontWeight: 600, background: 'rgba(20,184,166,0.08)', color: '#0F766E' }
                  : { color: '#374151' }}
                onMouseEnter={(e) => { if (s !== stage) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={(e) => { if (s !== stage) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: s === stage ? '#0F766E' : '#D1D5DB' }}
                />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Compare chip (icon-only button, sits in card right controls) ─────────────
export function CompareChip({ project, stateProgram = null, countyData = null }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = libraryProjectToCompareItem(project, stateProgram, countyData)
  const inCompare = isInCompare(item.id)
  const atLimit = !inCompare && items.length >= MAX_ITEMS

  const handleClick = (e) => {
    e.stopPropagation()
    if (inCompare) { remove(item.id); return }
    add(item)
  }

  const tooltipText = inCompare ? 'Remove from compare' : atLimit ? `Compare tray full (max ${MAX_ITEMS})` : 'Add to compare'

  return (
    <button
      onClick={handleClick}
      disabled={atLimit}
      aria-label={tooltipText}
      className={`group relative p-1 transition-colors ${
        inCompare
          ? 'text-teal-700'
          : atLimit
            ? 'text-gray-200 cursor-not-allowed'
            : 'text-gray-300 hover:text-teal-700'
      }`}
    >
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-gray-900 text-white text-[9px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-10">
        {tooltipText}
      </span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </button>
  )
}

// ── Share Deal Memo button -- generates token-protected public URL ───────
// Posts to /api/lens-insight 'memo-create' with a pre-generated AI memo +
// project snapshot. Server returns { token, url, expiresAt }. We copy the
// fully-qualified URL to clipboard and show a toast.
export function ShareDealMemoButton({ project, stateProgram, countyData, stage, liveScore, shareCount = 0, onShareSuccess, selectedScenario = null }) {
  const [sharing, setSharing] = useState(false)
  // Persistent share confirmation panel -- the transient toast is easy to
  // miss, especially if the user is mid-scroll. We hold the URL inline until
  // the user explicitly dismisses it so they can copy-again or verify.
  const [sharedUrl, setSharedUrl] = useState(null)
  const [copyState, setCopyState] = useState('idle') // 'idle' | 'copied'

  const handleShare = async (e) => {
    e.stopPropagation()
    setSharing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setSharing(false); return }

      // Step 1: generate AI memo (re-uses the existing 'deal-memo' action).
      let memo = null
      try {
        const memoRes = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'deal-memo',
            project: { ...project, stage, technology: project.technology },
            stateProgram,
            countyData,
          }),
        })
        if (memoRes.ok) {
          const json = await memoRes.json()
          memo = json.memo || null
        }
      } catch { /* fall through with null memo -- still creates a shareable snapshot */ }

      // Step 2: store snapshot + get token.
      const stateOverride = stateProgram ? { ...stateProgram, feasibilityScore: liveScore ?? stateProgram.feasibilityScore } : stateProgram
      const createRes = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'memo-create',
          project,
          stateProgram: stateOverride,
          countyData,
          memo: memo || { recommendation: 'No AI memo generated; viewing project context only.' },
          // Optional saved scenario — when the user has one selected on this
          // card (Include in PDF toggle), it rides the same share so the
          // recipient sees the deal memo + scenario in a single link.
          scenario: selectedScenario || null,
        }),
      })
      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}))
        console.error('[Memo Share] create failed:', errJson)
        setSharing(false)
        return
      }
      const { url } = await createRes.json()
      const fullUrl = `${window.location.origin}${url}`
      let copied = false
      try {
        await navigator.clipboard.writeText(fullUrl)
        copied = true
      } catch { /* clipboard may be blocked; the link is still visible inline */ }

      // Bump the per-project share count locally + flag audit timeline to
      // refetch. Both are passed through onShareSuccess so the parent's state
      // can drive the count pill AND key-bump the timeline.
      if (typeof onShareSuccess === 'function') onShareSuccess()

      // Persist the URL inline so the user can re-copy or verify even if
      // they missed the toast.
      setSharedUrl(fullUrl)
      setCopyState(copied ? 'copied' : 'idle')

      // Toast still fires for users who like the auto-feedback.
      try {
        const evt = new CustomEvent('tractova:toast', { detail: {
          kind: 'success',
          eyebrow: '◆ Memo Link Copied',
          title: copied ? 'Shareable URL copied to clipboard' : 'Shareable URL ready below',
          description: `Expires in 90 days · capped at 100 views`,
        } })
        window.dispatchEvent(evt)
      } catch {}
    } finally {
      setSharing(false)
    }
  }

  const handleCopyAgain = async () => {
    if (!sharedUrl) return
    try {
      await navigator.clipboard.writeText(sharedUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1800)
    } catch {}
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.30)' }}
          title="Copy a read-only shareable link to this Deal Memo (90-day expiry)"
        >
          {sharing ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-teal-300 border-t-teal-700 animate-spin" />
              Building link…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share Link
            </>
          )}
        </button>
        {shareCount > 0 && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm"
            style={{ color: '#5A6B7A', background: 'rgba(90,107,122,0.08)' }}
            title={`${shareCount} active share link${shareCount === 1 ? '' : 's'} (excludes expired)`}
          >
            Shared {shareCount}×
          </span>
        )}
      </div>

      {/* Persistent share confirmation -- shows the URL inline so users who
          miss the transient toast still have the link visible until they
          dismiss the panel. Click "Copy" to re-copy without re-generating. */}
      {sharedUrl && (
        <div
          className="rounded-lg px-3 py-2.5 w-full max-w-[420px]"
          style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold" style={{ color: '#0F766E' }}>
              ◆ {copyState === 'copied' ? 'Copied to clipboard' : 'Share link ready'}
            </p>
            <button
              onClick={() => setSharedUrl(null)}
              aria-label="Dismiss share link"
              className="text-[11px] text-ink-muted hover:text-ink"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={sharedUrl}
              onClick={(e) => e.target.select()}
              className="flex-1 text-[11px] font-mono bg-white px-2 py-1 rounded-sm border border-gray-200 text-ink truncate"
            />
            <button
              onClick={handleCopyAgain}
              className="text-[10px] font-mono uppercase tracking-[0.16em] font-semibold px-2 py-1 rounded-sm text-white"
              style={{ background: '#0F766E' }}
            >
              {copyState === 'copied' ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-ink-muted mt-1.5 leading-relaxed">
            Anyone with this link can view the frozen memo · expires in 90 days · 100-view cap
          </p>
        </div>
      )}
    </div>
  )
}

// ── Utility Outreach Kit — consultant-grade pre-application packet ──────────
// Generates a project-tailored outreach packet (email + study-process intel +
// attachments checklist + follow-up playbook + phone talking points + notes)
// the developer can send to the serving utility within minutes. Pro-gated
// via the existing isPro check on /api/lens-insight.
//
// V3 §Wave 2 — workflow artifacts, not just analysis. The output is a tool
// the developer literally uses, not another summary.
export function UtilityOutreachButton({ project, stateProgram, countyData, stage }) {
  const [generating, setGenerating] = useState(false)
  const [open, setOpen]             = useState(false)
  const [kit, setKit]               = useState(null)
  const [error, setError]           = useState(null)
  // copyKey -> 'idle' | 'copied'  (shared across copy buttons via a small map)
  const [copyState, setCopyState]   = useState({})

  const flashCopy = (key) => {
    setCopyState((s) => ({ ...s, [key]: 'copied' }))
    setTimeout(() => setCopyState((s) => ({ ...s, [key]: 'idle' })), 1800)
  }

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      flashCopy(key)
    } catch { /* clipboard blocked -- soft-fail */ }
  }

  const handleGenerate = async (e) => {
    e.stopPropagation()
    if (kit) { setOpen(true); return }   // already generated -- just re-open
    setGenerating(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Sign-in required'); setGenerating(false); return }

      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'utility-outreach',
          project: { ...project, stage, technology: project.technology },
          stateProgram,
          countyData,
        }),
      })

      // Defensive parse: a Vercel platform timeout (504) returns an HTML
      // error page, not JSON. Read the body once as text, then try to
      // parse -- if it fails, surface a clean message instead of "Unexpected
      // token 'A'" from a raw JSON.parse error.
      const rawBody = await res.text()
      let json = null
      try { json = JSON.parse(rawBody) } catch {}

      if (!res.ok) {
        if (res.status === 504) {
          setError('Generation timed out. The model took too long — please retry.')
        } else if (res.status === 429) {
          setError('Rate limit hit. Wait a minute and retry.')
        } else if (res.status === 403) {
          setError('Pro subscription required.')
        } else {
          setError(json?.error || `Server error (${res.status}). Please retry.`)
        }
        setGenerating(false)
        return
      }

      if (!json) {
        // 200 OK but body wasn't JSON -- shouldn't happen, but be loud if it does.
        setError('Server returned a non-JSON response. Please retry.')
        setGenerating(false)
        return
      }

      if (!json.kit) {
        setError(json.reason || 'Generation failed. Please retry.')
        setGenerating(false)
        return
      }

      setKit(json.kit)
      setOpen(true)
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const fullEmailText = kit ? `Subject: ${kit.email?.subject || ''}\n\n${kit.email?.greeting || ''}\n\n${kit.email?.body || ''}\n\n${kit.email?.signOff || ''}` : ''
  const fullKitText = kit ? buildPlainTextKit(kit) : ''

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(37,99,235,0.08)', color: '#1D4ED8', border: '1px solid rgba(37,99,235,0.30)' }}
        title="Generate a tailored utility outreach packet (email + study intel + checklists)"
      >
        {generating ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-blue-700 animate-spin" />
            Drafting kit…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Outreach Kit
          </>
        )}
      </button>

      {error && (
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-red-600">{error}</span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-5xl! p-0! w-[94vw]! max-h-[92vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          aria-describedby={undefined}
        >
          {kit && (
            <div className="flex flex-col max-h-[92vh]">

              {/* ── Flagship header — full-bleed navy gradient with topo accent ── */}
              <div
                className="relative px-8 pt-6 pb-7 shrink-0"
                style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 50%, #0F1A2E 100%)' }}
              >
                {/* Top teal rail — V3 brand signature */}
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 25%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.55) 75%, transparent 100%)' }} />
                {/* Subtle parcel-grid overlay echoing the Tractova mark */}
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                  style={{ backgroundImage: 'linear-gradient(to right, #5EEAD4 1px, transparent 1px), linear-gradient(to bottom, #5EEAD4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] font-semibold mb-2.5"
                      style={{ color: '#5EEAD4' }}>
                      ◆ Tractova · Utility Outreach Kit
                    </p>
                    <h2 className="font-serif text-3xl font-semibold text-white tracking-tight mb-1.5"
                      style={{ letterSpacing: '-0.02em' }}>
                      {project.name || `${project.county} County · ${project.mw} MW`}
                    </h2>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
                      Pre-application packet for{' '}
                      <span className="font-semibold" style={{ color: '#FFFFFF' }}>{kit.utilityContext?.utility || 'Serving Utility'}</span>
                      {kit.utilityContext?.iso ? <> · <span className="font-mono text-[12px]">{kit.utilityContext.iso}</span></> : null}
                      {project.stage ? <> · {project.stage} stage</> : null}
                    </p>
                  </div>
                  <DialogClose asChild>
                    <button
                      className="text-white/40 hover:text-white/90 transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center -mt-1 -mr-2 shrink-0"
                      aria-label="Close"
                    >×</button>
                  </DialogClose>
                </div>
              </div>

              {/* ── Scrollable body — paper background, generous padding ── */}
              <div
                className="overflow-y-auto px-8 py-7 space-y-6 flex-1"
                style={{ background: '#FAFAF7' }}
              >

                {/* Utility context — cartographic intel strip */}
                {kit.utilityContext && (
                  <div
                    className="rounded-xl bg-white"
                    style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                  >
                    <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-1 h-3.5 rounded-full" style={{ background: '#14B8A6' }} />
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold text-ink-muted">
                        Utility Intelligence
                      </p>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                      {kit.utilityContext.studyProcess && (
                        <ContextRow label="Study Process" value={kit.utilityContext.studyProcess} />
                      )}
                      {kit.utilityContext.typicalQueueWait && (
                        <ContextRow label="Typical Queue Wait" value={kit.utilityContext.typicalQueueWait} />
                      )}
                      {kit.utilityContext.relevantTariffNote && (
                        <ContextRow label="Tariff / Schedule" value={kit.utilityContext.relevantTariffNote} />
                      )}
                    </div>
                  </div>
                )}

                {/* Email block — letterhead treatment, the centerpiece */}
                {kit.email && (
                  <KitSection
                    eyebrow="01 / Pre-Application Email"
                    sublabel="Bracketed fields are placeholders — find-and-replace before sending"
                    copyKey="email"
                    copyText={fullEmailText}
                    copyState={copyState.email}
                    onCopy={copy}
                  >
                    <div
                      className="rounded-xl bg-white relative overflow-hidden"
                      style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                    >
                      {/* Subject strip */}
                      <div className="px-6 py-3 border-b border-gray-100 flex items-baseline gap-3 flex-wrap"
                        style={{ background: 'rgba(20, 184, 166, 0.04)' }}>
                        <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold text-ink-muted shrink-0">Subject</span>
                        <span className="text-[13px] font-medium text-ink">{kit.email.subject}</span>
                      </div>
                      {/* Body — letterhead style */}
                      <div className="px-6 py-5 text-[13.5px] leading-[1.7] text-ink whitespace-pre-wrap">
                        <p className="mb-4">{kit.email.greeting}</p>
                        <p className="mb-4">{kit.email.body}</p>
                        <p className="font-mono text-[12px] leading-relaxed text-ink-muted whitespace-pre-wrap">{kit.email.signOff}</p>
                      </div>
                    </div>
                  </KitSection>
                )}

                {/* Three-up bento: checklist · playbook · talking points */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* Attachments checklist */}
                  {Array.isArray(kit.attachmentsChecklist) && kit.attachmentsChecklist.length > 0 && (
                    <KitSection
                      eyebrow="02 / Attachments"
                      compact
                      copyKey="attach"
                      copyText={kit.attachmentsChecklist.map((s, i) => `${i + 1}. ${s}`).join('\n')}
                      copyState={copyState.attach}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ol className="space-y-2.5 text-[13px] text-ink">
                          {kit.attachmentsChecklist.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="font-mono text-[10px] tabular-nums font-semibold mt-1 shrink-0" style={{ color: '#0F766E' }}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </KitSection>
                  )}

                  {/* Follow-up playbook */}
                  {Array.isArray(kit.followUpPlaybook) && kit.followUpPlaybook.length > 0 && (
                    <KitSection
                      eyebrow="03 / Follow-Up Playbook"
                      compact
                      copyKey="followup"
                      copyText={kit.followUpPlaybook.join('\n')}
                      copyState={copyState.followup}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ol className="space-y-3 text-[13px] text-ink">
                          {kit.followUpPlaybook.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="w-5 h-5 rounded-full text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: '#0F766E' }}>
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </KitSection>
                  )}

                  {/* Phone talking points */}
                  {Array.isArray(kit.phoneTalkingPoints) && kit.phoneTalkingPoints.length > 0 && (
                    <KitSection
                      eyebrow="04 / Phone Talking Points"
                      compact
                      copyKey="talk"
                      copyText={kit.phoneTalkingPoints.map(s => `• ${s}`).join('\n')}
                      copyState={copyState.talk}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ul className="space-y-2.5 text-[13px] text-ink">
                          {kit.phoneTalkingPoints.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="mt-1.5 leading-none shrink-0" style={{ color: '#14B8A6' }}>▸</span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </KitSection>
                  )}

                </div>

                {/* Notes — amber heads-up callout */}
                {kit.notes && (
                  <div
                    className="rounded-xl px-5 py-4 flex gap-4"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.28)' }}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(245,158,11,0.16)', color: '#B45309' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#B45309' }}>
                        Heads Up · {kit.utilityContext?.utility || 'This Utility'}
                      </p>
                      <p className="text-[13px] text-ink leading-relaxed">{kit.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer — full-bleed paper, primary CTA + dismiss ── */}
              <div
                className="px-8 py-4 flex items-center justify-between gap-4 shrink-0"
                style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}
              >
                <p className="text-[11px] text-ink-muted leading-relaxed flex-1">
                  Review carefully before sending. Tractova synthesizes from public ISO + utility data; verify specifics against the utility's own application portal.
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <DialogClose asChild>
                    <button className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold text-ink-muted hover:text-ink px-3 py-2">
                      Close
                    </button>
                  </DialogClose>
                  <button
                    onClick={() => copy('all', fullKitText)}
                    className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-4 py-2 rounded-lg text-white transition-transform hover:-translate-y-px"
                    style={{ background: '#0F1A2E', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.18)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    {copyState.all === 'copied' ? 'Copied' : 'Copy entire kit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ContextRow({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted mb-0.5">{label}</p>
      <p className="text-[12px] text-ink leading-relaxed">{value}</p>
    </div>
  )
}

function KitSection({ eyebrow, sublabel, copyKey, copyText, copyState, onCopy, compact = false, children }) {
  return (
    <section className={compact ? 'flex flex-col h-full' : ''}>
      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-2.5'}`}>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: '#0F766E' }}>
            {eyebrow}
          </p>
          {sublabel && (
            <p className="text-[10px] text-ink-muted mt-0.5 italic">{sublabel}</p>
          )}
        </div>
        <button
          onClick={() => onCopy(copyKey, copyText)}
          className="font-mono text-[9.5px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-md transition-colors shrink-0"
          style={{
            color: copyState === 'copied' ? '#0F766E' : '#5A6B7A',
            border: '1px solid',
            borderColor: copyState === 'copied' ? 'rgba(15,118,110,0.40)' : 'rgba(90,107,122,0.22)',
            background: copyState === 'copied' ? 'rgba(15,118,110,0.07)' : 'transparent',
          }}
        >
          {copyState === 'copied' ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {compact ? <div className="flex-1">{children}</div> : children}
    </section>
  )
}

// Plain-text serializer for the entire kit -- used by the "Copy entire kit"
// button so the developer can paste the whole packet into Notion / Docs.
function buildPlainTextKit(kit) {
  const lines = []
  if (kit.utilityContext) {
    lines.push(`UTILITY: ${kit.utilityContext.utility || ''}${kit.utilityContext.iso ? ` (${kit.utilityContext.iso})` : ''}`)
    if (kit.utilityContext.studyProcess)      lines.push(`Study process: ${kit.utilityContext.studyProcess}`)
    if (kit.utilityContext.typicalQueueWait)  lines.push(`Typical queue wait: ${kit.utilityContext.typicalQueueWait}`)
    if (kit.utilityContext.relevantTariffNote) lines.push(`Tariff/schedule: ${kit.utilityContext.relevantTariffNote}`)
    lines.push('')
  }
  if (kit.email) {
    lines.push('--- PRE-APPLICATION EMAIL ---')
    lines.push(`Subject: ${kit.email.subject || ''}`)
    lines.push('')
    lines.push(kit.email.greeting || '')
    lines.push('')
    lines.push(kit.email.body || '')
    lines.push('')
    lines.push(kit.email.signOff || '')
    lines.push('')
  }
  if (Array.isArray(kit.attachmentsChecklist) && kit.attachmentsChecklist.length) {
    lines.push('--- ATTACHMENTS CHECKLIST ---')
    kit.attachmentsChecklist.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }
  if (Array.isArray(kit.followUpPlaybook) && kit.followUpPlaybook.length) {
    lines.push('--- FOLLOW-UP PLAYBOOK ---')
    kit.followUpPlaybook.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }
  if (Array.isArray(kit.phoneTalkingPoints) && kit.phoneTalkingPoints.length) {
    lines.push('--- PHONE TALKING POINTS ---')
    kit.phoneTalkingPoints.forEach((s) => lines.push(`• ${s}`))
    lines.push('')
  }
  if (kit.notes) {
    lines.push('--- NOTES ---')
    lines.push(kit.notes)
  }
  return lines.join('\n')
}

// ── Project card ─────────────────────────────────────────────────────────────
// V3 fix: countyData now comes from LibraryContent's centralized map (the
// same instance the sort + score-change logic reads), so the card's visible
// score and the sort's ranking score are guaranteed identical. Local fetch
// fallback retained for safety in case map hasn't populated yet.
// V3.1: Mini animated arc gauge for the project-bar score indicator.
// Replaces the static rounded-square bubble. Arc fills on mount + on
// score change with a spring; the number itself animates the same way
// (matches the ArcGauge pattern in Search.jsx so the visual language
// stays consistent across the app). Sized for inline use in the
// collapsed project row -- 44x44 footprint, same as the old bubble.
export function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
  const target = score ?? 0
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 110, damping: 22, mass: 0.6 })
  const [display, setDisplay] = useState(0)
  useEffect(() => { mv.set(target) }, [target, mv])
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring])
  const stroke = score == null ? fallbackColor : color
  return (
    <div className="shrink-0 relative" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 36 36" className="-rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="3"
        />
        <motion.path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ strokeDasharray: '0, 100' }}
          animate={{ strokeDasharray: `${target}, 100` }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums leading-none" style={{ color: stroke }}>
        {score == null ? '—' : display}
      </span>
    </div>
  )
}

// ── Weekly Summary Card ──────────────────────────────────────────────────────
// V3: TECH_COLORS now imported from lib/v3Tokens at top of file (kept name to avoid render-call churn).

// V3: per-user-per-day cache so Library load doesn't re-spend tokens.
// Mirrors the per-state news-pulse pattern. Date in key handles 24h TTL.
const _portfolioInsightCache = new Map()

function WeeklySummaryCard({ projects, stateProgramMap }) {
  const { user } = useAuth()
  const cacheKey = user ? `${user.id}::${new Date().toISOString().slice(0, 10)}` : null
  const [collapsed, setCollapsed] = useState(false)
  const [aiInsight, setAiInsight] = useState(cacheKey ? (_portfolioInsightCache.get(cacheKey) ?? null) : null)
  const [aiLoading, setAiLoading] = useState(false)

  // Compute per-project scores
  const scored = useMemo(() => projects.map(p => {
    const sp = stateProgramMap[p.state]
    if (!sp) return { ...p, score: 0 }
    const subs = computeSubScores(sp, null, p.stage, p.technology)
    // 2026-05-05 root-cause fix: Object.values(subs) spread `coverage` (the
    // 4th key, an object) as the `weights` argument to computeDisplayScore.
    // `weights.offtake = 'researched'` (string), so the multiplication
    // returned NaN, poisoning every downstream aggregate. Destructure
    // explicitly. Profile.jsx had the same bug — fixed in lockstep.
    return { ...p, score: safeScore(subs.offtake, subs.ix, subs.site) }
  }), [projects, stateProgramMap])

  // Portfolio health score (MW-weighted avg of valid scores).
  //
  // 2026-05-05 fix: when stateProgramMap[p.state] is undefined for a project
  // (state not in curated map, or stateProgramMap still hydrating), the
  // computeSubScores call returns NaN values which poisoned the weighted
  // average and rendered "NaN" in the Portfolio Health chip. Filter to
  // finite scores before aggregation; fall back to 0 when nothing valid.
  const healthScore = useMemo(() => {
    const valid = scored.filter(p => Number.isFinite(p.score))
    if (!valid.length) return 0
    const totalMW = valid.reduce((s, p) => s + (parseFloat(p.mw) || 1), 0)
    if (totalMW === 0) return 0
    const weighted = valid.reduce((s, p) => s + ((parseFloat(p.mw) || 1) * p.score), 0)
    return Math.round(weighted / totalMW)
  }, [scored])

  // MW by technology
  const techBreakdown = useMemo(() => {
    const map = {}
    scored.forEach(p => {
      const tech = p.technology || 'Community Solar'
      map[tech] = (map[tech] || 0) + (parseFloat(p.mw) || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [scored])
  const totalMW = techBreakdown.reduce((s, [, mw]) => s + mw, 0)

  // V3: Risk concentration — % of portfolio MW exposed to single state/program/tech
  const concentration = useMemo(() => {
    if (!scored.length) return null
    const total = scored.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
    if (total === 0) return null
    const groupBy = (keyFn) => {
      const map = {}
      scored.forEach(p => {
        const k = keyFn(p) || 'Unknown'
        map[k] = (map[k] || 0) + (parseFloat(p.mw) || 0)
      })
      const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0]
      return top ? { name: top[0], pct: Math.round((top[1] / total) * 100) } : null
    }
    return {
      state:   groupBy(p => p.state),
      program: groupBy(p => stateProgramMap[p.state]?.csProgram),
      tech:    groupBy(p => p.technology || 'Community Solar'),
    }
  }, [scored, stateProgramMap])

  const concColor = (pct) => pct >= 70 ? { text: '#DC2626', bg: '#FEE2E2', label: 'High' }
    : pct >= 40 ? { text: '#B45309', bg: '#FEF3C7', label: 'Moderate' }
    : { text: '#059669', bg: '#D1FAE5', label: 'Diversified' }

  const healthColor = healthScore > 65 ? 'text-teal-800' : healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
  const healthBg = healthScore > 65 ? 'bg-teal-50' : healthScore >= 40 ? 'bg-amber-50' : 'bg-red-50'

  const handleGenerateInsight = async () => {
    setAiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = scored.map(p => ({
        name: p.name, state: p.state, county: p.county, mw: p.mw,
        stage: p.stage, technology: p.technology, score: p.score
      }))
      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'portfolio', projects: payload })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.summary) {
          setAiInsight(data)
          if (cacheKey) _portfolioInsightCache.set(cacheKey, data)
        }
      }
    } catch { /* silently fail */ }
    setAiLoading(false)
  }

  // V3: auto-fire portfolio insight on first load per user-per-day. The
  // manual button still works for on-demand regeneration. Skips if portfolio
  // is too small to be meaningful (<2 projects) or if we already have today's
  // cached version. Pro-only -- request returns 403 silently for free users.
  useEffect(() => {
    if (!cacheKey) return
    if (aiInsight) return            // already loaded (from cache or previous run)
    if (aiLoading) return            // in flight
    if (scored.length < 2) return    // not enough portfolio to analyze
    if (!stateProgramMap || !Object.keys(stateProgramMap).length) return
    handleGenerateInsight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, scored.length, Object.keys(stateProgramMap).length])

  // Geographic breakdown
  // 2026-05-05 fix: same NaN-guard pattern as healthScore. Only push finite
  // scores into the per-state scores array so a single bad row doesn't NaN
  // the avgScore for the whole state.
  const geoBreakdown = useMemo(() => {
    const map = {}
    scored.forEach(p => {
      const st = p.state_name || p.state || 'Unknown'
      if (!map[st]) map[st] = { count: 0, mw: 0, avgScore: 0, scores: [] }
      map[st].count++
      map[st].mw += parseFloat(p.mw) || 0
      if (Number.isFinite(p.score)) map[st].scores.push(p.score)
    })
    Object.values(map).forEach(v => {
      v.avgScore = v.scores.length
        ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
        : 0
    })
    return Object.entries(map).sort((a, b) => b[1].mw - a[1].mw)
  }, [scored])

  return (
    <div className="rounded-xl overflow-hidden mb-4 bg-white border border-gray-200 shadow-xs">
      {/* V3: Navy header chrome — institutional treatment matching MetricsBar */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left relative"
        style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
      >
        {/* Top teal accent rail */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.30)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Portfolio Intelligence</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{projects.length} projects · {totalMW.toFixed(1)} MW across {geoBreakdown.length} state{geoBreakdown.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <svg
          className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!collapsed && (
        <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid rgba(15,26,46,0.08)' }}>
          {/* Row 1: Health gauge + Total MW + Risk Concentration (V3: dropped Avg Score + Risk Spread) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Health Score — large gauge */}
            <div className="rounded-xl px-4 py-4 flex flex-col items-center justify-center" style={{ background: healthScore > 65 ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : healthScore >= 40 ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Portfolio Health</p>
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={healthScore > 65 ? '#0F766E' : healthScore >= 40 ? '#D97706' : '#DC2626'} strokeWidth="3" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold font-mono tabular-nums ${healthColor}`}>{healthScore}</span>
              </div>
              <p className="text-[9px] font-medium mt-1" style={{ color: healthScore > 65 ? '#059669' : healthScore >= 40 ? '#B45309' : '#DC2626' }}>
                {healthScore > 65 ? 'Strong' : healthScore >= 40 ? 'Moderate' : 'At Risk'}
              </p>
            </div>

            {/* KPI: Total MW + project count combined */}
            <div className="rounded-xl px-4 py-4 bg-gray-50 border border-gray-100 flex flex-col justify-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Total Capacity</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-gray-900 leading-none">{totalMW.toFixed(1)}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">MW AC across {scored.length} project{scored.length !== 1 ? 's' : ''}</p>
            </div>

            {/* V3: Portfolio Risk Concentration — replaces Avg Score + Risk Spread */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">Risk Concentration</p>
              {concentration ? (
                <div className="space-y-1.5">
                  {[
                    { label: 'Single state',   data: concentration.state },
                    { label: 'Single program', data: concentration.program },
                    { label: 'Single tech',    data: concentration.tech },
                  ].map(({ label, data }) => data && (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${data.pct}%`, background: concColor(data.pct).text }}
                        />
                      </div>
                      <span
                        className="text-[10px] font-bold font-mono tabular-nums w-9 text-right"
                        style={{ color: concColor(data.pct).text }}
                      >
                        {data.pct}%
                      </span>
                    </div>
                  ))}
                  {concentration.state && (
                    <p className="text-[9px] text-gray-400 mt-1.5 leading-tight">
                      Top exposure: {concentration.state.name} ({concentration.state.pct}% of MW)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400">Add projects to compute</p>
              )}
            </div>
          </div>

          {/* Row 2: MW by Technology + Geographic Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MW by Technology — donut-style */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-3">MW by Technology</p>
              {totalMW > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      {(() => {
                        let offset = 0
                        return techBreakdown.map(([tech, mw]) => {
                          const pct = (mw / totalMW) * 100
                          const el = <circle key={tech} cx="18" cy="18" r="14" fill="none" stroke={TECH_COLORS[tech] || '#6B7280'} strokeWidth="4" strokeDasharray={`${pct * 0.88} ${88 - pct * 0.88}`} strokeDashoffset={-offset * 0.88} strokeLinecap="round" />
                          offset += pct
                          return el
                        })
                      })()}
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">{totalMW.toFixed(0)}</span>
                      <span className="text-[8px] text-gray-400">MW</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {techBreakdown.map(([tech, mw]) => (
                      <div key={tech} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <span className="w-2 h-2 rounded-xs shrink-0" style={{ background: TECH_COLORS[tech] || '#6B7280' }} />
                          {tech}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums text-gray-700">{mw.toFixed(1)} MW</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No MW data</p>
              )}
            </div>

            {/* Geographic Breakdown */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-3">Geographic Spread</p>
              <div className="space-y-2">
                {geoBreakdown.slice(0, 5).map(([state, data]) => (
                  <div key={state} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-700 w-8 shrink-0">{state}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${totalMW > 0 ? (data.mw / totalMW) * 100 : 0}%`, background: data.avgScore > 65 ? '#0F766E' : data.avgScore >= 40 ? '#D97706' : '#DC2626' }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-gray-500 w-14 text-right shrink-0">{data.mw.toFixed(1)} MW</span>
                    <span className="text-[9px] font-bold tabular-nums w-6 text-right shrink-0" style={{ color: data.avgScore > 65 ? '#0F766E' : data.avgScore >= 40 ? '#B45309' : '#DC2626' }}>{data.avgScore}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: AI Insight */}
          <div className="rounded-xl border border-gray-100 overflow-hidden" style={{ background: 'linear-gradient(135deg, #F0FDF9, #ECFDF5)' }}>
            {aiInsight ? (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F766E, #10B981)' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">AI Portfolio Insight</p>
                </div>
                <p className="text-xs leading-relaxed text-gray-700">{aiInsight.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiInsight.topRecommendation && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-teal-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100 shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-teal-700 mb-0.5">Top Recommendation</p>
                        <p className="text-[11px] leading-relaxed text-gray-700">{aiInsight.topRecommendation}</p>
                      </div>
                    </div>
                  )}
                  {aiInsight.riskAssessment && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-amber-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100 shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Risk Assessment</p>
                        <p className="text-[11px] leading-relaxed text-gray-700">{aiInsight.riskAssessment}</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGenerateInsight}
                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            ) : aiLoading ? (
              <div className="px-4 py-8 flex items-center justify-center">
                <TractovaLoader
                  size={64}
                  label="Generating Portfolio Insight"
                  sublabel="Analyzing scoring · IX risk · concentration"
                />
              </div>
            ) : (
              <button
                onClick={handleGenerateInsight}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-4 text-xs font-semibold text-teal-800 hover:bg-teal-50/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F766E, #10B981)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                Generate AI Portfolio Insight
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Empty-state onboarding ───────────────────────────────────────────────────
// Surfaces the platform's live-data promise on the very first render a new
// Pro lands on /library: a "Live markets right now" strip pulling the most-
// recently-updated active CS states from the already-loaded stateProgramMap,
// each clickable into a pre-filled Lens. The 3-value-prop card and primary
// CTAs stay below — but the user's first action becomes "click a real
// state to see Lens in motion" instead of "start typing into the form."
function EmptyStateOnboarding({ stateProgramMap, lastRefresh }) {
  // Top 4 active CS states by recency. Sort by max(lastVerified, updatedAt)
  // descending so we surface what we've most recently re-verified — the
  // freshest of the live coverage. csStatus filter keeps the showcase to
  // states a user can actually run a Lens on with confidence.
  const liveMarkets = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    const tsOf = (s) => {
      const v = s.lastVerified ? new Date(s.lastVerified).getTime() : 0
      const u = s.updatedAt    ? new Date(s.updatedAt).getTime()    : 0
      return v > u ? v : u
    }
    return states
      .filter((s) => s.csStatus === 'active')
      .map((s) => ({ ...s, _ts: tsOf(s) }))
      .filter((s) => s._ts > 0)
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 4)
  }, [stateProgramMap])

  return (
    <div
      className="rounded-2xl mt-2 mx-auto max-w-3xl px-8 py-10"
      style={{
        background: 'linear-gradient(180deg, rgba(20,184,166,0.04) 0%, rgba(20,184,166,0.08) 100%)',
        border: '1px solid rgba(20,184,166,0.20)',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
            boxShadow: '0 6px 18px rgba(20,184,166,0.30)',
          }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: '#0F766E' }}>
          Step 1 · Build your portfolio
        </p>
        <h2 className="font-serif text-2xl font-semibold text-ink" style={{ letterSpacing: '-0.018em' }}>
          Save your first project
        </h2>
        <p className="text-sm mt-2 max-w-md text-gray-600 leading-relaxed">
          Run a Lens analysis on any state + county, then click <span className="text-ink font-semibold">Save as Project</span>.
          Saved projects unlock alerts, weekly digest, and live re-scoring as market data shifts.
        </p>

        {/* Live-data freshness stamp — proves the live-data promise on the
            very first render. Mirrors the Library hero stamp once projects
            exist; here we show it pre-projects to set expectations. */}
        {lastRefresh && (
          <div className="flex items-center gap-2 mt-3">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: lastRefresh.isStale ? '#D97706' : '#0F766E', boxShadow: lastRefresh.isStale ? 'none' : '0 0 4px rgba(20,184,166,0.7)' }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: lastRefresh.isStale ? '#92400E' : '#0F766E' }}>
              Live data refreshed {lastRefresh.date}
            </span>
          </div>
        )}

        {/* Live markets strip — most-recently-verified active CS states.
            Each card click opens /search with the state pre-selected (county
            and tech stay user-chosen). The user's first interaction becomes
            "click a real state and see Lens in motion" instead of staring
            at an empty form.

            Skeleton placeholders render while stateProgramMap hydrates so
            the layout stays stable on first paint — without this guard the
            strip silently disappears for the ~200-500ms it takes Supabase
            to return state_programs, creating a jarring late-paint shift. */}
        <div className="w-full max-w-2xl mt-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-bold" style={{ color: '#0F766E' }}>
              ◆ Live markets right now
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
              most recently verified
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {liveMarkets.length === 0 ? (
              // Skeleton — 4 placeholder cards while stateProgramMap loads
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`mkt-skel-${i}`}
                  className="rounded-lg px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(20,184,166,0.10)',
                    minHeight: 90,
                  }}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="h-2 w-6 rounded-sm bg-gray-200/80 animate-pulse" />
                    <div className="h-2 w-10 rounded-sm bg-gray-200/60 animate-pulse" />
                  </div>
                  <div className="h-3 w-3/4 rounded-sm bg-gray-200/80 mb-1.5 animate-pulse" />
                  <div className="h-2 w-1/2 rounded-sm bg-gray-200/60 animate-pulse" />
                </div>
              ))
            ) : (
              liveMarkets.map((s) => {
                const ageDays = Math.max(0, Math.floor((Date.now() - s._ts) / 86400000))
                const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1d ago' : `${ageDays}d ago`
                const capacityLabel = s.capacityMW > 0
                  ? (s.capacityMW >= 1000 ? `${(s.capacityMW / 1000).toFixed(1)}k MW` : `${s.capacityMW} MW`)
                  : null
                return (
                  <Link
                    key={s.id}
                    to={`/search?state=${s.id}`}
                    className="group/mkt rounded-lg px-3 py-2.5 text-left transition-all hover:-translate-y-px"
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(20,184,166,0.20)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.55)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.20)' }}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-bold text-ink">
                        {s.id}
                      </span>
                      <span className="font-mono text-[9px] text-gray-400 tabular-nums">
                        {ageLabel}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-ink leading-tight truncate">{s.name}</p>
                    {capacityLabel && (
                      <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                        {capacityLabel} remaining
                      </p>
                    )}
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] mt-1.5 transition-colors" style={{ color: '#0F766E' }}>
                      Run Lens →
                    </p>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Three value props — what saved projects unlock. Anchors the
            empty state's "why save?" question after the live-markets
            strip has answered "where do I start?" */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 w-full max-w-2xl">
          {[
            { icon: 'M12 2 L2 7 L12 12 L22 7 z M2 17 L12 22 L22 17 M2 12 L12 17 L22 12', label: 'Live re-scoring', body: 'Feasibility index recomputes as program capacity, IX queues, and tariffs shift.' },
            { icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z', label: 'Alerts on change', body: 'Email when CS programs cap, SREC markets move, or upgrade costs spike.' },
            { icon: 'M3 3v18h18 M9 17V9 M14 17V5 M19 17v-4', label: 'Portfolio analytics', body: 'AI-generated weekly insight + concentration risk + portfolio health score.' },
          ].map(p => (
            <div key={p.label} className="rounded-lg px-3 py-3 text-left" style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center mb-1.5" style={{ background: 'rgba(20,184,166,0.12)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={p.icon} />
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-ink leading-tight">{p.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0F766E' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Open Tractova Lens
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
          >
            Or browse Markets on the Move →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Paywall gate ─────────────────────────────────────────────────────────────
export default function Library() {
  const { isPro, loading: subLoading } = useSubscription()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="Library" />
  return <LibraryContent />
}

function LibraryContent() {
  const { user, loading: authLoading } = useAuth()
  // ?preview=empty bypasses the loaded projects array and renders the
  // empty-state onboarding card. Lets the admin/owner preview the new-user
  // experience without deleting saved projects. URL-flag only -- doesn't
  // touch the database.
  const previewEmpty = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'empty'
  const [projects,        setProjects]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [hasFetched,      setHasFetched]      = useState(false)
  const [error,           setError]           = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  // Bulk-operations state — Set of selected project IDs. When non-empty,
  // the floating bulk toolbar appears above the project grid and each card
  // shows a persistent checkbox in the corner. Cleared after any bulk op
  // completes (delete / export / add-to-compare).
  const [selectedIds,     setSelectedIds]     = useState(() => new Set())
  const [bulkConfirm,     setBulkConfirm]     = useState(false)  // bulk-delete confirm modal
  const { add: addToCompare, items: compareItems, MAX_ITEMS: COMPARE_MAX } = useCompare()
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [stateDeltaMap,   setStateDeltaMap]   = useState(new Map()) // state_id -> { delta, prevScore, latestAt, ... }
  const [countyDataMap,   setCountyDataMap]   = useState({}) // key `${state}::${county}` -> countyData
  const [sortBy,          setSortBy]          = useState('saved')    // saved|score|mw|alerts
  const [filterState,     setFilterState]     = useState('')
  const [filterTech,      setFilterTech]      = useState('')
  const [filterStage,     setFilterStage]     = useState('')
  const [pipelineExpanded, setPipelineExpanded] = useState(false)
  const [shareCountMap,   setShareCountMap]   = useState({})         // project_id -> int (active, non-expired tokens)
  const [scenariosMap,    setScenariosMap]    = useState({})         // project_id -> [{id, name, scenario_inputs, baseline_inputs, outputs, created_at, state_id, county_name, technology}, ...]
  const [orphanScenarios, setOrphanScenarios] = useState([])         // [{... same shape, project_id: null}] — scenarios saved without a linked project
  const [viewMode,        setViewMode]        = useState('projects') // 'projects' | 'scenarios' — top-level toggle

  // ?tab=scenarios URL handling so external links (e.g. the "view in Library →"
  // confirmation card in ScenarioStudio) can land directly on the Scenarios
  // tab. Only applies on mount; in-page toggle still drives state afterwards.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'scenarios') setViewMode('scenarios')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load live state program map for alert detection
  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
  }, [])

  // V3 Wave 1.4: load state-level WoW score deltas. Empty Map until snapshot
  // history accrues (~2 weeks after migration 038). Project cards show ↑/↓
  // pt arrows when their state has moved; silent when delta is null.
  useEffect(() => {
    getStateProgramDeltas().then(setStateDeltaMap).catch(console.error)
  }, [])

  // Freshness signal — mirrors Dashboard hero (`e2c8b48`). Computed from
  // already-loaded stateProgramMap. Pulls max(lastVerified, updatedAt)
  // across active CS states; amber if older than 14 days (= a Sunday cron
  // missed). The Library is the daily-driver surface for retention, so a
  // visible "data refreshed" stamp here keeps the live-data promise on
  // the user's main return loop, not just first-impression dashboard.
  const lastRefresh = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    if (!states.length) return null
    let latest = 0
    for (const s of states) {
      if (s.csStatus === 'none') continue
      const v = s.lastVerified ? new Date(s.lastVerified).getTime() : 0
      const u = s.updatedAt    ? new Date(s.updatedAt).getTime()    : 0
      if (v > latest) latest = v
      if (u > latest) latest = u
    }
    if (!latest) return null
    const ageDays = Math.floor((Date.now() - latest) / 86400000)
    return {
      date:    new Date(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      ageDays,
      isStale: ageDays > 14,
    }
  }, [stateProgramMap])

  // Centralize county data fetch -- previously each ProjectCard fetched its
  // own, leaving the sort logic with no county info and ranking projects
  // by a different score than the cards displayed. Single map fixes that
  // and serves as the canonical source for sort + score_change + cards.
  useEffect(() => {
    if (!projects.length) return
    const seen = new Set()
    const pending = []
    for (const p of projects) {
      if (!p.state || !p.county) continue
      const key = `${p.state}::${p.county}`
      if (seen.has(key) || countyDataMap[key]) continue
      seen.add(key)
      pending.push(getCountyData(p.state, p.county).then(d => [key, d]).catch(() => null))
    }
    if (!pending.length) return
    Promise.all(pending).then(results => {
      const updates = {}
      for (const r of results) { if (r) updates[r[0]] = r[1] }
      if (Object.keys(updates).length) setCountyDataMap(prev => ({ ...prev, ...updates }))
    })
  }, [projects.length])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    // Only show the loading skeleton on the very first fetch —
    // subsequent re-fires (e.g. Supabase auth refresh on window focus)
    // silently update data without collapsing expanded cards.
    if (!hasFetched) setLoading(true)
    supabase
      .from('projects')
      .select('*')
      .order('saved_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return }
        setProjects((data || []).map(normalize))
        setLoading(false)
        setHasFetched(true)
      })
  }, [user, authLoading])

  // Per-project active share-token counts -- powers the "Shared X times"
  // trust signal next to the Share Link button. Counts only non-expired
  // tokens so the number reflects what's actually accessible to recipients.
  // RLS limits the read to the owner; if migration 017 is missing, the
  // query just returns an error and we leave the map empty.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('share_tokens')
          .select('project_id, expires_at')
          .gt('expires_at', new Date().toISOString())
        if (cancelled || error || !data) return
        const counts = {}
        for (const row of data) {
          counts[row.project_id] = (counts[row.project_id] || 0) + 1
        }
        setShareCountMap(counts)
      } catch { /* table missing or RLS denial -- silent */ }
    })()
    return () => { cancelled = true }
  }, [user, projects.length])

  // All scenarios for the user — one batched query, then split into
  // per-project map (for the Library card chip) + orphan list (for the
  // Library "Scenarios" view tab). Orphans are scenarios saved during
  // Lens exploration BEFORE the user committed the project to Library;
  // pre-Phase-2.6 they were invisible. Now they surface in the global
  // Scenarios view + auto-promote to a project on next save (Search.jsx).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('scenario_snapshots')
          .select('id, project_id, name, baseline_inputs, scenario_inputs, outputs, created_at, state_id, county_name, technology')
          .order('created_at', { ascending: false })
        if (cancelled || error || !data) return
        const grouped = {}
        const orphans = []
        for (const row of data) {
          if (row.project_id) {
            if (!grouped[row.project_id]) grouped[row.project_id] = []
            grouped[row.project_id].push(row)
          } else {
            orphans.push(row)
          }
        }
        setScenariosMap(grouped)
        setOrphanScenarios(orphans)
      } catch { /* table missing or RLS denial -- silent */ }
    })()
    return () => { cancelled = true }
  }, [user, projects.length])

  // V3 §4.3 audit log: detect score shifts since last observation and log
  // them as 'score_change' events. Runs once when both projects + state map
  // are loaded; updates last_observed_score in the same op so we don't
  // re-fire on subsequent loads. Threshold: 5 points absolute. Migration 016
  // backs this; if it hasn't run, the column is missing and the update
  // call silently fails -- no event logged but the app keeps working.
  useEffect(() => {
    if (!user || !projects.length || !Object.keys(stateProgramMap).length) return
    let cancelled = false
    const SCORE_DELTA_THRESHOLD = 5
    ;(async () => {
      // Pre-fetch alert_triggered events from last 30 days to dedupe.
      // One query for all projects beats N round-trips.
      let recentAlertKeys = new Set()
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: rows } = await supabase
          .from('project_events')
          .select('project_id, meta')
          .eq('user_id', user.id)
          .eq('kind', 'alert_triggered')
          .gte('created_at', since)
        if (rows) {
          for (const r of rows) {
            const fp = r?.meta?.fingerprint
            if (fp) recentAlertKeys.add(`${r.project_id}::${fp}`)
          }
        }
      } catch { /* dedupe table missing -> we'll just log a few duplicates once */ }

      for (const p of projects) {
        if (cancelled) return
        const sp = stateProgramMap[p.state]
        if (!sp) continue
        try {
          const cd = countyDataMap[`${p.state}::${p.county}`] || null
          const subs = computeSubScores(sp, cd, p.stage, p.technology)
          const liveScore = safeScore(subs.offtake, subs.ix, subs.site)
          const previous = p.lastObservedScore
          if (previous == null) {
            // First observation -- just seed the column, don't log an event.
            await supabase.from('projects').update({ last_observed_score: liveScore }).eq('id', p.id)
          } else {
            const delta = liveScore - previous
            if (Math.abs(delta) >= SCORE_DELTA_THRESHOLD) {
              const direction = delta > 0 ? 'rose' : 'fell'
              await logProjectEvent({
                projectId: p.id,
                userId: user.id,
                kind: 'score_change',
                detail: `Index ${direction}: ${previous} → ${liveScore} (${delta > 0 ? '+' : ''}${delta} pts) for ${p.technology || 'project'} at ${p.stage || 'no stage'}`,
                meta: { previous, current: liveScore, delta, technology: p.technology, stage: p.stage },
              })
              await supabase.from('projects').update({ last_observed_score: liveScore }).eq('id', p.id)
            }
          }

          // alert_triggered audit events: log each NEW alert (not seen in
          // the last 30 days for this project). Skip 'info' level alerts
          // ('Data Refreshed') -- they're noise for an audit trail; the
          // audit log captures material risk events, not data freshness.
          const alerts = getAlerts(p, stateProgramMap, countyDataMap)
          for (const alert of alerts) {
            if (alert.level === 'info') continue
            const fingerprint = `${alert.level}::${alert.pillar || 'general'}::${alert.label}`
            const key = `${p.id}::${fingerprint}`
            if (recentAlertKeys.has(key)) continue
            recentAlertKeys.add(key) // suppress duplicates within this same load
            await logProjectEvent({
              projectId: p.id,
              userId: user.id,
              kind: 'alert_triggered',
              detail: `${alert.label} (${alert.pillar || 'general'}): ${alert.detail}`,
              meta: { fingerprint, level: alert.level, pillar: alert.pillar, label: alert.label },
            })
          }
        } catch { /* per-project failure must not block others */ }
      }
    })()
    return () => { cancelled = true }
  }, [user, projects.length, Object.keys(stateProgramMap).length, Object.keys(countyDataMap).length])

  // V3 fix: sort by score now uses the SAME inputs as the card display
  // (state map + countyData + stage + technology). Previously sort passed
  // null for countyData while cards passed real data, so a card showing
  // "84" could sort below a card showing "76" -- which is what the user
  // saw and rightly flagged as broken.
  const liveScoreFor = (p) => {
    const sp = stateProgramMap[p.state]
    if (!sp) return -1
    const cd = countyDataMap[`${p.state}::${p.county}`] || null
    const subs = computeSubScores(sp, cd, p.stage, p.technology)
    return safeScore(subs.offtake, subs.ix, subs.site)
  }

  const displayProjects = useMemo(() => {
    let filtered = projects
    if (filterState) filtered = filtered.filter(p => p.state === filterState)
    if (filterTech)  filtered = filtered.filter(p => p.technology === filterTech)
    if (filterStage) filtered = filtered.filter(p => p.stage === filterStage)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score')  return liveScoreFor(b) - liveScoreFor(a)
      if (sortBy === 'mw')     return (parseFloat(b.mw) || 0) - (parseFloat(a.mw) || 0)
      if (sortBy === 'alerts') return getAlerts(b, stateProgramMap, countyDataMap).length - getAlerts(a, stateProgramMap, countyDataMap).length
      return new Date(b.savedAt) - new Date(a.savedAt)
    })
  }, [projects, filterState, filterTech, filterStage, sortBy, stateProgramMap, countyDataMap])

  // Mirror displayProjects into a ref so the bulk select-all callback can
  // read the current list without re-binding on every filter change.
  const selectAllRef = useRef([])
  useEffect(() => { selectAllRef.current = displayProjects }, [displayProjects])
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectAllRef.current.map((p) => p.id)))
  }, [])
  const allSelected = displayProjects.length > 0 && selectedIds.size >= displayProjects.length

  // Stage change locally + immediate score-change check (don't wait for next
  // Library reload). User feedback: stage changes the visible score, so the
  // audit log should reflect that pairing in the same moment.
  const handleStageChange = useCallback(async (id, newStage) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage } : p))
    if (!user) return
    const project = projects.find(p => p.id === id)
    if (!project) return
    const sp = stateProgramMap[project.state]
    if (!sp) return
    try {
      const cd = countyDataMap[`${project.state}::${project.county}`] || null
      const subs = computeSubScores(sp, cd, newStage, project.technology)
      const newScore = safeScore(subs.offtake, subs.ix, subs.site)
      const previous = project.lastObservedScore
      if (previous == null) {
        await supabase.from('projects').update({ last_observed_score: newScore }).eq('id', id)
        setProjects(prev => prev.map(p => p.id === id ? { ...p, lastObservedScore: newScore } : p))
        return
      }
      const delta = newScore - previous
      if (Math.abs(delta) >= 5) {
        await logProjectEvent({
          projectId: id,
          userId: user.id,
          kind: 'score_change',
          detail: `Index ${delta > 0 ? 'rose' : 'fell'}: ${previous} → ${newScore} (${delta > 0 ? '+' : ''}${delta} pts) following stage change to ${newStage}`,
          meta: { previous, current: newScore, delta, trigger: 'stage_change', stage: newStage },
        })
        await supabase.from('projects').update({ last_observed_score: newScore }).eq('id', id)
        setProjects(prev => prev.map(p => p.id === id ? { ...p, lastObservedScore: newScore } : p))
      }
    } catch { /* per-project failure must not block UI */ }
  }, [user, projects, stateProgramMap, countyDataMap])

  const handleRequestRemove = (id, name) => setConfirmRemove({ id, name })

  const handleConfirmRemove = async () => {
    const { error } = await supabase.from('projects').delete().eq('id', confirmRemove.id)
    if (!error) setProjects((prev) => prev.filter((p) => p.id !== confirmRemove.id))
    setConfirmRemove(null)
  }

  // ── Bulk-operation handlers ────────────────────────────────────────────────
  // Toggle selection for one project. Used by the per-card checkbox.
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Bulk delete. Single Supabase round-trip via .in() filter, then prune
  // local state. Existing single-card removal flow stays intact via the
  // `confirmRemove` modal; this is purely additive.
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) { setBulkConfirm(false); return }
    const { error } = await supabase.from('projects').delete().in('id', ids)
    if (!error) {
      setProjects((prev) => prev.filter((p) => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    }
    setBulkConfirm(false)
  }, [selectedIds])

  // Bulk export to XLSX. Reuses the export utility on a filtered subset.
  // CSV path was retired 2026-05-03 — see Site-walk Session 5.
  const handleBulkExportXLSX = useCallback(() => {
    const subset = projects.filter((p) => selectedIds.has(p.id))
    if (subset.length === 0) return
    exportXLSX(subset, stateProgramMap, countyDataMap)
    setSelectedIds(new Set())
  }, [projects, selectedIds, stateProgramMap, countyDataMap])

  // Bulk add to Compare tray. Capped at MAX_ITEMS=5 (CompareContext rule);
  // remaining slots after current items determine how many more we can add.
  // Already-in-tray items are silently skipped by add().
  const handleBulkAddToCompare = useCallback(() => {
    const subset = projects.filter((p) => selectedIds.has(p.id))
    const slotsLeft = COMPARE_MAX - compareItems.length
    let added = 0
    let skipped = 0
    for (const p of subset) {
      if (added >= slotsLeft) { skipped += subset.length - added; break }
      const sp = stateProgramMap[p.state]
      // Pull the same countyData mapping the per-card CompareChip uses so
      // bulk-added items get sub-scores + geospatial pcts when the data has
      // been fetched. Falls through to null for cards never expanded — the
      // Library compare row renders "—" in that case (matches existing
      // behavior; sub-scores fill in once countyData populates and the row
      // is re-added).
      const cd = countyDataMap[`${p.state}::${p.county}`] || null
      const item = libraryProjectToCompareItem(p, sp, cd)
      const ok = addToCompare(item)
      if (ok) added += 1
      else skipped += 1
    }
    setSelectedIds(new Set())
  }, [projects, selectedIds, stateProgramMap, addToCompare, compareItems.length, COMPARE_MAX])

  if (authLoading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
          <div className="mt-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your saved deals. Add projects from Tractova Lens results.</p>
          </div>
          <div className="flex flex-col items-center justify-center text-center py-24">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Sign in to view your projects</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">Your saved projects are tied to your account and sync across devices.</p>
            <div className="flex items-center gap-3 mt-5">
              <Link to="/signin" className="text-sm font-semibold text-white bg-teal-700 px-4 py-2 rounded-lg hover:bg-teal-800 transition-colors">Sign In</Link>
              <Link to="/signup" className="text-sm font-medium text-gray-600 border border-gray-200 bg-white px-4 py-2 rounded-lg hover:border-gray-300 transition-colors">Create Account</Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper relative">
      {/* Ambient intelligence layer + Tractova mark cameo — matches Profile's
          treatment so the daily-driver Library surface feels alive. Library
          is high-traffic so we use a lower trigger probability and sessionGate
          so users don't get fatigued by the cameo. The existing animated
          "Data refreshed" pulsing dot in the hero stays as-is. */}
      <IntelligenceBackground />
      <WalkingTractovaMark triggerProbability={0.25} sessionGate={true} />

      <main className="relative max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* V3: Brand-navy hero banner — adds institutional depth, replaces stark white-on-white */}
        <div
          className="mt-4 rounded-xl overflow-hidden mb-6 relative"
          style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
        >
          {/* Top teal accent rail */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
          <div className="px-6 py-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: '#2DD4BF' }}>Deal Tracker</p>
              <h1 className="text-2xl font-serif font-semibold tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>Library</h1>
              <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {projects.length > 0 ? (
                  <>
                    <span className="font-mono tabular-nums">{projects.length}</span> project{projects.length !== 1 ? 's' : ''}
                    <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                    <span className="font-mono tabular-nums">{projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0).toFixed(1)}</span> MW tracked
                    <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                    monitored for policy changes
                  </>
                ) : (
                  'Your saved deals — tracked, scored, and monitored for policy changes.'
                )}
              </p>
              {lastRefresh && (
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] mt-2"
                  style={{ color: lastRefresh.isStale ? '#FCD34D' : '#5EEAD4' }}
                  title={lastRefresh.isStale
                    ? `Underlying program data is ${lastRefresh.ageDays} days old — last weekly refresh missed at least one cycle. Score deltas and alerts may not reflect this week's policy changes.`
                    : `Underlying program data refreshed ${lastRefresh.ageDays === 0 ? 'today' : `${lastRefresh.ageDays} day${lastRefresh.ageDays === 1 ? '' : 's'} ago`}. Project scores are recomputed from this snapshot on every load.`}
                >
                  <span className="relative flex w-1.5 h-1.5 shrink-0" aria-hidden="true">
                    {!lastRefresh.isStale && (
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: '#14B8A6' }} />
                    )}
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{
                        background: lastRefresh.isStale ? '#F59E0B' : '#14B8A6',
                        boxShadow: lastRefresh.isStale ? '0 0 6px rgba(245,158,11,0.6)' : '0 0 6px rgba(20,184,166,0.65)',
                      }}
                    />
                  </span>
                  <span>Data refreshed {lastRefresh.date}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {projects.length > 0 && (
                <button
                  onClick={() => exportXLSX(projects, stateProgramMap, countyDataMap)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  title="Export to Excel — Projects sheet + Methodology & Sources + Glossary"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export Excel
                </button>
              )}
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-2 rounded-lg transition-colors"
                style={{ background: '#14B8A6' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#0F766E' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Lens Search
              </Link>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="mb-8">

          {/* Stat strip + pipeline overview */}
          {projects.length > 0 && (
            <>
              {/* V3 stat strip: navy chrome with teal accent rail; monospace numerics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Saved Projects', value: projects.length,   sub: 'across all states',     valColor: '#0F1A2E' },
                  { label: 'Total Capacity', value: `${projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0).toFixed(1)} MW`, sub: 'AC nameplate', valColor: '#0F1A2E' },
                  { label: 'Active Alerts',  value: projects.reduce((s, p) => s + getAlerts(p, stateProgramMap, countyDataMap).length, 0), sub: 'policy or market flags', valColor: '#0F1A2E' },
                ].map(({ label, value, sub, valColor }) => (
                  <div key={label} className="rounded-xl px-4 py-3 bg-white border border-gray-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #0F1A2E 0%, #14B8A6 100%)' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1">{label}</p>
                    <p className="text-xl font-bold font-mono tabular-nums mt-0.5" style={{ color: valColor }}>{value}</p>
                    <p className="text-[10px] mt-0.5 text-gray-400">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Pipeline distribution bar — V3: click to filter, weeks-in-stage stale flag.
                  Stage ramp uses V3 feasibility tokens (was hardcoded emerald cascade). */}
              {(() => {
                const STAGE_COLORS = ['#F0FDFA', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0F766E', '#0F1A2E']
                const now = Date.now()
                const stageCounts = PIPELINE_STAGES.map((s, i) => {
                  const matching = projects.filter(p => p.stage === s)
                  // V3: weeks-in-stage stale detection — flag stages where any project has been
                  // sitting >180 days based on saved_at (proxy for last status change)
                  const stale = matching.some(p => {
                    if (!p.savedAt) return false
                    const days = (now - new Date(p.savedAt).getTime()) / 86400000
                    return days >= 180
                  })
                  return {
                    stage: s,
                    count: matching.length,
                    mw: matching.reduce((sum, p) => sum + (parseFloat(p.mw) || 0), 0),
                    color: STAGE_COLORS[i],
                    stale,
                  }
                })
                const maxCount = Math.max(...stageCounts.map(s => s.count), 1)
                // 2026-05-05: Pipeline Distribution made collapsible — was
                // taking ~150px of vertical real estate above the project
                // grid even when the user wasn't actively filtering by stage.
                // Default collapsed; one click expands. Active filter
                // forces-expand so the user sees what they're filtering by.
                const totalProjects = stageCounts.reduce((s, c) => s + c.count, 0)
                const totalMwSum = stageCounts.reduce((s, c) => s + c.mw, 0)
                const showBars = pipelineExpanded || !!filterStage
                return (
                  <div className="mt-4 rounded-xl px-4 py-3 bg-white border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setPipelineExpanded(v => !v)}
                      className="w-full flex items-center justify-between text-left"
                      aria-expanded={showBars}
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-3 h-3 text-gray-400 transition-transform"
                          style={{ transform: showBars ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pipeline Distribution</p>
                        {!showBars && (
                          <span className="text-[10px] text-gray-400 font-mono tabular-nums">
                            · {totalProjects} project{totalProjects !== 1 ? 's' : ''} · {totalMwSum.toFixed(1)} MW across {stageCounts.filter(s => s.count > 0).length} stage{stageCounts.filter(s => s.count > 0).length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {filterStage && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setFilterStage('') }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setFilterStage('') } }}
                          className="text-[10px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                        >
                          Clear filter ✕
                        </span>
                      )}
                    </button>
                    {showBars && (
                    <>
                    <div className="mt-3 flex items-end gap-2 h-16">
                      {stageCounts.map(({ stage, count, mw, color, stale }) => {
                        const isActive = filterStage === stage
                        const isDimmed = filterStage && filterStage !== stage
                        return (
                          <button
                            type="button"
                            key={stage}
                            onClick={() => count > 0 && setFilterStage(isActive ? '' : stage)}
                            disabled={count === 0}
                            className="flex-1 flex flex-col items-center gap-1 group relative transition-opacity"
                            style={{ opacity: isDimmed ? 0.4 : 1, cursor: count > 0 ? 'pointer' : 'default' }}
                          >
                            <div
                              className="w-full rounded-t-md transition-all duration-300 relative"
                              style={{
                                height: count > 0 ? `${Math.max(6, (count / maxCount) * 56)}px` : '3px',
                                background: count > 0 ? color : '#E5E7EB',
                                outline: isActive ? '2px solid #0F766E' : 'none',
                                outlineOffset: isActive ? '2px' : '0',
                              }}
                            >
                              {stale && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                                  style={{ background: '#F59E0B', boxShadow: '0 0 0 1.5px #FFFFFF' }}
                                  title="A project has been in this stage 180+ days"
                                />
                              )}
                            </div>
                            {count > 0 && (
                              <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-10 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-medium bg-gray-900 text-white shadow-lg pointer-events-none font-mono">
                                {count} project{count > 1 ? 's' : ''} · {mw.toFixed(1)} MW
                                {stale ? ' · ⚠ stale' : ''}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {stageCounts.map(({ stage, count, mw, color }) => {
                        const isActive = filterStage === stage
                        // V3 fix: stage labels need to be readable regardless of bar color.
                        // The first two stages (Prospecting #F0FDFA, Site Control #99F6E4) are
                        // very-light teals that disappear against white. Use ink for labels;
                        // the colored count number below carries the visual identity.
                        return (
                          <div key={stage + 'l'} className="flex-1 text-center">
                            <p
                              className="text-[9px] leading-tight font-semibold"
                              style={{ color: isActive ? '#0F766E' : count > 0 ? '#0A1828' : '#9CA3AF' }}
                            >
                              {PIPELINE_SHORT[PIPELINE_STAGES.indexOf(stage)]}
                            </p>
                            {count > 0 && (
                              <>
                                {/* Count number takes the stage color -- but darken the very light shades
                                    so they're readable on white. Stages 0/1 use teal-700 fallback. */}
                                <p className="text-[10px] font-bold font-mono tabular-nums" style={{ color: ['#F0FDFA', '#99F6E4'].includes(color) ? '#0F766E' : color }}>{count}</p>
                                <p className="text-[8px] font-mono tabular-nums text-gray-400">{mw.toFixed(0)} MW</p>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    </>
                    )}
                  </div>
                )
              })()}

              {/* Filter + sort bar — uses FilterSelect (custom popup) for
                  visual parity with the Lens form's FieldSelect. Native
                  <select> elements were inconsistent with the rest of the
                  app's polish and impossible to style cross-browser. */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <FilterSelect
                  value={filterState}
                  onChange={setFilterState}
                  placeholder="All States"
                  ariaLabel="Filter by state"
                  options={[...new Set(projects.map(p => p.state))].sort()}
                />
                <FilterSelect
                  value={filterTech}
                  onChange={setFilterTech}
                  placeholder="All Tech"
                  ariaLabel="Filter by technology"
                  options={[...new Set(projects.map(p => p.technology).filter(Boolean))].sort()}
                  optionTooltips={TECH_FILTER_TOOLTIPS}
                />
                <FilterSelect
                  value={filterStage}
                  onChange={setFilterStage}
                  placeholder="All Stages"
                  ariaLabel="Filter by stage"
                  options={PIPELINE_STAGES}
                />

                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-gray-400">Sort:</span>
                  {[
                    { key: 'saved', label: 'Recent' },
                    { key: 'score', label: 'Score' },
                    { key: 'mw',    label: 'MW' },
                    { key: 'alerts', label: 'Alerts' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSortBy(s.key)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-sm transition-colors"
                      style={sortBy === s.key
                        ? { background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.30)' }
                        : { background: 'transparent', color: '#6B7280', border: '1px solid transparent' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* View toggle — Projects vs Scenarios. The Scenarios view exposes
            saved scenarios that don't yet have a project attached (orphan
            scenarios from Lens exploration), grouped by state + county +
            tech. Always visible so users can find scenarios even before
            they've saved any projects. */}
        {(projects.length > 0 || orphanScenarios.length > 0 || Object.keys(scenariosMap).length > 0) && (
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: 'rgba(15,26,46,0.04)' }}>
            <button
              type="button"
              onClick={() => setViewMode('projects')}
              className="cursor-pointer text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all"
              style={viewMode === 'projects'
                ? { background: 'white', color: '#0F1A2E', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                : { background: 'transparent', color: '#6B7280' }}
            >
              Projects {projects.length > 0 && <span className="font-mono opacity-60">· {projects.length}</span>}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('scenarios')}
              className="cursor-pointer text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all"
              style={viewMode === 'scenarios'
                ? { background: 'white', color: '#0F1A2E', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                : { background: 'transparent', color: '#6B7280' }}
            >
              Scenarios {(() => {
                const total = orphanScenarios.length + Object.values(scenariosMap).reduce((n, arr) => n + arr.length, 0)
                return total > 0 ? <span className="font-mono opacity-60">· {total}</span> : null
              })()}
            </button>
          </div>
        )}

        {/* Scenarios view — grouped by Lens context. */}
        {viewMode === 'scenarios' && !loading && (
          <ScenariosView
            scenariosMap={scenariosMap}
            orphanScenarios={orphanScenarios}
            projects={projects}
            onScenarioDelete={async (snap) => {
              const { error } = await supabase.from('scenario_snapshots').delete().eq('id', snap.id)
              if (error) return
              if (snap.project_id) {
                setScenariosMap(prev => ({
                  ...prev,
                  [snap.project_id]: (prev[snap.project_id] || []).filter(s => s.id !== snap.id),
                }))
              } else {
                setOrphanScenarios(prev => prev.filter(s => s.id !== snap.id))
              }
            }}
          />
        )}

        {/* Loading skeleton */}
        {viewMode === 'projects' && (loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl px-5 py-4 animate-pulse flex items-center gap-4 bg-white border border-gray-200">
                <div className="w-11 h-11 rounded-lg shrink-0 bg-gray-100" />
                <div className="flex-1">
                  <div className="h-3.5 rounded-sm w-1/3 mb-2 bg-gray-100" />
                  <div className="h-2.5 rounded-sm w-1/2 bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            Failed to load projects: {error}
          </div>
        ) : (projects.length > 0 && !previewEmpty) ? (
          <>
            {/* "What Changed" banner */}
            {(() => {
              const updatedCount = projects.filter(p => {
                const current = stateProgramMap[p.state]
                return current?.lastUpdated && p.savedAt && new Date(current.lastUpdated) > new Date(p.savedAt)
              }).length
              const alertCount = projects.reduce((n, p) => n + getAlerts(p, stateProgramMap, countyDataMap).length, 0)
              if (updatedCount === 0 && alertCount === 0) return null
              return (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 mb-4"
                  style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.20)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F766E' }} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
                    Recent Updates
                  </p>
                  <span className="text-gray-300">·</span>
                  <p className="text-xs font-medium text-ink">
                    {updatedCount > 0 && <span>{updatedCount} project{updatedCount > 1 ? 's have' : ' has'} updated market data</span>}
                    {updatedCount > 0 && alertCount > 0 && <span className="text-gray-400"> · </span>}
                    {alertCount > 0 && <span>{alertCount} alert{alertCount > 1 ? 's' : ''} across your portfolio</span>}
                  </p>
                </div>
              )
            })()}

            {/* Portfolio Summary — shows when 3+ projects */}
            {projects.length >= 3 && (
              <WeeklySummaryCard projects={projects} stateProgramMap={stateProgramMap} />
            )}
            <SectionDivider />

            {/* Inline "Select all" affordance — discreet text-button visible
                BEFORE any selection is active so the affordance is
                discoverable. Without this, users have to click one card's
                checkbox first to learn the bulk toolbar exists. */}
            {selectedIds.size === 0 && displayProjects.length > 1 && (
              <div className="mb-2 flex items-center gap-3 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-medium uppercase tracking-[0.16em] hover:underline transition-colors"
                  style={{ color: '#0F766E' }}
                >
                  Select all {displayProjects.length} →
                </button>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">for bulk export, compare, or delete</span>
              </div>
            )}

            {/* Bulk-operations toolbar — appears as a sticky bar at the top
                of the grid when ≥1 project is selected via the per-card
                checkbox. Provides: bulk delete, bulk export to Excel, bulk
                add to Compare tray. Reuses existing single-project utilities
                (handleRequestRemove pattern, exportXLSX, useCompare.add). */}
            {selectedIds.size > 0 && (
              <div
                className="sticky top-14 z-20 mb-3 rounded-lg flex items-center justify-between gap-3 px-4 py-2.5"
                style={{ background: '#0F1A2E', border: '1px solid rgba(20,184,166,0.30)', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-sm"
                    style={{ background: 'rgba(20,184,166,0.20)', color: '#5EEAD4' }}
                  >
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={allSelected ? clearSelection : handleSelectAll}
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: '#5EEAD4' }}
                  >
                    {allSelected ? 'Deselect all' : `Select all (${displayProjects.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkAddToCompare}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors"
                    style={{ background: 'rgba(20,184,166,0.18)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.40)' }}
                  >
                    Add to Compare
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkExportXLSX}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.18)' }}
                  >
                    Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkConfirm(true)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors"
                    style={{ background: 'rgba(220,38,38,0.18)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.45)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {displayProjects.length > 0 ? (
              <div className="grid gap-3">
                {displayProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onRequestRemove={handleRequestRemove}
                    onStageChange={handleStageChange}
                    stateProgramMap={stateProgramMap}
                    countyDataMap={countyDataMap}
                    stateDelta={stateDeltaMap?.get?.(p.state) || null}
                    shareCount={shareCountMap[p.id] || 0}
                    onShareSuccess={() => setShareCountMap(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                    selectionActive={selectedIds.size > 0}
                    scenarios={scenariosMap[p.id] || []}
                    onScenarioDelete={(snapId) => setScenariosMap(prev => ({
                      ...prev,
                      [p.id]: (prev[p.id] || []).filter(s => s.id !== snapId),
                    }))}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm font-medium text-gray-500">No projects match current filters.</p>
                <button
                  onClick={() => { setFilterState(''); setFilterTech(''); setFilterStage('') }}
                  className="mt-2 text-xs font-medium transition-colors"
                  style={{ color: '#0F766E' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#0A1828' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#0F766E' }}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyStateOnboarding stateProgramMap={stateProgramMap} lastRefresh={lastRefresh} />
        ))}
      </main>

      {/* V3: Radix Dialog -- portal-rendered, focus-trapped, ESC-to-close,
          a11y-correct (Title + Description). Replaces the hand-rolled modal. */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => { if (!open) setConfirmRemove(null) }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <DialogTitle>Remove project?</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to remove <span className="font-semibold text-ink">{confirmRemove?.name}</span>? This cannot be undone.
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={() => setConfirmRemove(null)}
              className="text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Keep it
            </button>
            <button
              onClick={handleConfirmRemove}
              className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#DC2626' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
            >
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk-delete confirm modal — same Dialog primitive as single-project
          remove, but lists count + warns about irreversibility. Distinct from
          confirmRemove so a single-card delete and a bulk delete can never
          collide on the same modal state. */}
      <Dialog open={bulkConfirm} onOpenChange={(open) => { if (!open) setBulkConfirm(false) }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <DialogTitle>Remove {selectedIds.size} project{selectedIds.size === 1 ? '' : 's'}?</DialogTitle>
          </div>
          <DialogDescription>
            This will permanently delete <span className="font-semibold text-ink">{selectedIds.size}</span> project{selectedIds.size === 1 ? '' : 's'} from your Library. Saved scenarios, share links, and alert history for these projects will also be removed. This cannot be undone.
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={() => setBulkConfirm(false)}
              className="text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Keep them
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#DC2626' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
            >
              Remove {selectedIds.size}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
