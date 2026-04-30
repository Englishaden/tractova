import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import { getStateProgramMap, getCountyData } from '../lib/programData'
import { computeSubScores, computeDisplayScore } from '../lib/scoreEngine'
import { computeRevenueProjection, hasRevenueData } from '../lib/revenueEngine'
import { useCompare, libraryProjectToCompareItem } from '../context/CompareContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/Tooltip'
import { LoadingDot } from '../components/ui'
import TractovaLoader from '../components/ui/TractovaLoader'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { logProjectEvent, fetchProjectEvents } from '../lib/projectEvents'
import { TECH_COLORS } from '../lib/v3Tokens'
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

// ── Alert detection ──────────────────────────────────────────────────────────
const STATUS_RANK = { active: 3, limited: 2, pending: 1, none: 0 }

function getAlerts(project, stateProgramMap) {
  const current = stateProgramMap[project.state]
  if (!current) return []

  const alerts = []
  const savedRank   = STATUS_RANK[project.csStatus]   ?? 2
  const currentRank = STATUS_RANK[current.csStatus]   ?? 2

  if (currentRank < savedRank) {
    if (current.csStatus === 'limited') {
      alerts.push({ level: 'warning', pillar: 'Offtake', label: 'Capacity Limited', detail: `${current.name} program moved to limited capacity` })
    } else if (current.csStatus === 'none' || current.csStatus === 'pending') {
      alerts.push({ level: 'urgent', pillar: 'Offtake', label: 'Program Closed', detail: `${current.name} CS program is no longer active` })
    }
  }

  // BUGFIX: previously this compared current.feasibilityScore (bare state value)
  // to project.feasibilityScore (bare state value at save time). But the Library
  // card itself displays a tech-aware recomputed score via computeSubScores +
  // computeDisplayScore. Those numbers can differ by 20+ points for non-CS
  // technologies, causing alerts that don't match what the user sees on the
  // card (Gila County AZ: bare dropped 41→4, but card showed tech-aware ~35).
  // Now we recompute current using the same path the card uses, so the alert
  // delta matches the displayed liveScore.
  const currentSubs = computeSubScores(current, null, project.stage, project.technology)
  const currentLiveScore = computeDisplayScore(currentSubs.offtake, currentSubs.ix, currentSubs.site)
  if (project.feasibilityScore != null && currentLiveScore < project.feasibilityScore - 10) {
    alerts.push({ level: 'warning', pillar: 'Market', label: 'Score Drop', detail: `Feasibility index fell from ${project.feasibilityScore} → ${currentLiveScore} (recomputed for ${project.technology || 'CS'} at ${project.stage || 'current stage'})` })
  }

  const IX_RANK = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }
  if (project.ixDifficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ixDifficulty] ?? 0)) {
    alerts.push({ level: 'warning', pillar: 'IX', label: 'Queue Harder', detail: `${current.name} IX difficulty increased to ${current.ixDifficulty.replace('_', ' ')}` })
  }

  if (current.updatedAt) {
    const updatedAt = new Date(current.updatedAt)
    const savedAt   = new Date(project.savedAt)
    const ageDays   = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (updatedAt > savedAt && ageDays < 90) {
      const fmt = updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      alerts.push({ level: 'info', pillar: null, label: 'Data Refreshed', detail: `${current.name} data updated ${fmt}` })
    }
  }

  return alerts
}

// ── Alert chip ───────────────────────────────────────────────────────────────
// V3: deeper text colors for legibility (was red-700 / amber-700 / blue-600 -- fine
// on the chip itself, but parent counters used too-light shades on too-light bgs).
const ALERT_STYLES = {
  urgent:  { chip: 'bg-red-50 border-red-300 text-red-800',         dot: 'bg-red-600'   },
  warning: { chip: 'bg-amber-50 border-amber-300 text-amber-800',   dot: 'bg-amber-500' },
  info:    { chip: 'bg-teal-50 border-teal-300 text-teal-800',      dot: 'bg-teal-500'  },
}

function AlertChip({ alert }) {
  const s = ALERT_STYLES[alert.level] || ALERT_STYLES.info
  // V3: Radix Tooltip portal -- prevents clipping inside flex/grid containers
  // (the chip lives inside the alert strip which has overflow contexts).
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-default ${s.chip}`} style={{ lineHeight: 1 }}>
          <span
            className={s.dot}
            style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '9999px', flexShrink: 0 }}
          />
          {alert.pillar && <span className="opacity-60">{alert.pillar}</span>}
          {alert.label}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {alert.detail}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Score arc gauge ───────────────────────────────────────────────────────────
function ScoreGauge({ score }) {
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
const IX_STYLES = {
  easy:      'bg-teal-50 text-teal-800 border-teal-200',
  moderate:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  hard:      'bg-orange-50 text-orange-700 border-orange-200',
  very_hard: 'bg-red-50 text-red-700 border-red-200',
}
const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }

// ── CS status display ────────────────────────────────────────────────────────
const CS_STATUS_STYLES = {
  active:  'bg-teal-50 text-teal-800 border-teal-200',
  limited: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  none:    'bg-red-50 text-red-700 border-red-200',
}
const CS_STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }

// ── Pipeline progress ────────────────────────────────────────────────────────
function PipelineProgress({ stage }) {
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
// Single source of truth for both CSV + XLSX export. Adds a column once and
// both files inherit the change automatically.
const EXPORT_HEADERS = [
  'Name', 'State', 'County', 'MW AC', 'Technology', 'Stage',
  'CS Status', 'CS Program', 'Program Capacity Remaining (MW)', 'LMI Required (%)',
  'Program Runway (months)', 'Feasibility Index',
  'IX Difficulty', 'IX Notes (truncated)', 'Serving Utility',
  'Est. Annual Revenue ($/MW/yr)', 'Risk Flags', 'Saved Date',
]

function buildExportRows(projects, stateProgramMap) {
  const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
  const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }
  return projects.map(p => {
    const sp = stateProgramMap[p.state] || {}
    let revPerMWperYear = ''
    try {
      const mwNum = parseFloat(p.mw) || 0
      if (mwNum > 0 && p.technology === 'Community Solar' && hasRevenueData(p.state)) {
        const proj = computeRevenueProjection(p.state, mwNum)
        if (proj?.year1Revenue) revPerMWperYear = Math.round(proj.year1Revenue / mwNum)
      }
    } catch {}
    const alerts = getAlerts(p, stateProgramMap).map(a => a.label || a.message || '').filter(Boolean).join('; ')
    const ixNotes = (sp.ixNotes || '').replace(/\s+/g, ' ').slice(0, 200)
    return [
      p.name,
      p.stateName || p.state,
      p.county,
      p.mw ? Number(p.mw) : '',
      p.technology || '',
      p.stage || '',
      CS_LABEL[p.csStatus] || p.csStatus || '',
      p.csProgram || '',
      sp.capacityMW ?? '',
      sp.lmiRequired ? sp.lmiPercent : '',
      sp.runway?.months ?? '',
      p.feasibilityScore ?? '',
      IX_LABEL[sp.ixDifficulty] || sp.ixDifficulty || '',
      ixNotes,
      p.servingUtility || '',
      revPerMWperYear,
      alerts,
      p.savedAt ? new Date(p.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '',
    ]
  })
}

// ── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(projects, stateProgramMap = {}) {
  const rows = buildExportRows(projects, stateProgramMap)
  const csv = [EXPORT_HEADERS, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `tractova-projects-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── XLSX export ──────────────────────────────────────────────────────────────
// Lazy-loads the xlsx library on first click so the dependency doesn't bloat
// the main bundle. Output is a properly-formatted .xlsx with column widths,
// number formatting on numeric columns, and a frozen header row -- ready to
// drop into a developer's internal model spreadsheet.
async function exportXLSX(projects, stateProgramMap = {}) {
  const rows = buildExportRows(projects, stateProgramMap)
  const XLSX = await import('xlsx')

  // Build worksheet from arrays (header + rows).
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows])

  // Column widths in chars -- tuned to typical content lengths.
  ws['!cols'] = [
    { wch: 28 }, // Name
    { wch: 12 }, // State
    { wch: 16 }, // County
    { wch: 8 },  // MW AC
    { wch: 16 }, // Technology
    { wch: 18 }, // Stage
    { wch: 10 }, // CS Status
    { wch: 22 }, // CS Program
    { wch: 14 }, // Program Capacity
    { wch: 10 }, // LMI %
    { wch: 12 }, // Runway
    { wch: 10 }, // Feas Idx
    { wch: 12 }, // IX Diff
    { wch: 50 }, // IX Notes
    { wch: 22 }, // Serving Utility
    { wch: 14 }, // Revenue
    { wch: 36 }, // Alerts
    { wch: 12 }, // Saved
  ]

  // Freeze header row.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Apply number format on revenue column (P) -- USD whole dollars.
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws[`P${r}`]
    if (cell && typeof cell.v === 'number') cell.z = '"$"#,##0'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Projects')
  XLSX.writeFile(wb, `tractova-projects-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Inline stage picker ───────────────────────────────────────────────────────
function StagePicker({ stage, projectId, onChange }) {
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
        title="Edit stage"
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
function CompareChip({ project, stateProgram = null }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = libraryProjectToCompareItem(project, stateProgram)
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
function ShareDealMemoButton({ project, stateProgram, countyData, stage, liveScore, shareCount = 0, onShareSuccess }) {
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
function UtilityOutreachButton({ project, stateProgram, countyData, stage }) {
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

// ── Audit timeline -- reverse-chrono event log per project ────────────────
// Surfaces the project_events table as a timeline. Lazy-loads on first
// open of the Audit tab so most users never spend the supabase round-trip.
const EVENT_KIND_META = {
  created:         { color: '#0F766E', label: 'Created' },
  stage_change:    { color: '#2563EB', label: 'Stage' },
  score_change:    { color: '#D97706', label: 'Score' },
  alert_triggered: { color: '#DC2626', label: 'Alert' },
  note_updated:    { color: '#5A6B7A', label: 'Note' },
  shared:          { color: '#7C3AED', label: 'Shared' },
}

function ProjectAuditTimeline({ projectId, refreshKey = 0 }) {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(true)
  // token → view_count map for `shared` events. Owners see how many times each
  // shared link has actually been opened, turning the audit log into a soft
  // engagement signal ("the IC opened it 4 times" beats "you sent the link").
  const [shareViews, setShareViews] = useState({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchProjectEvents(projectId).then(async (rows) => {
      if (cancelled) return
      setEvents(rows)
      setLoading(false)

      const tokens = (rows || [])
        .filter(e => e.kind === 'shared' && e.meta?.token)
        .map(e => e.meta.token)
      if (tokens.length === 0) { setShareViews({}); return }

      const { data, error } = await supabase
        .from('share_tokens')
        .select('token, view_count')
        .in('token', tokens)
      if (cancelled) return
      if (error) { console.warn('[audit] share view counts fetch failed:', error.message); return }
      const map = {}
      for (const row of data || []) map[row.token] = row.view_count
      setShareViews(map)
    })
    return () => { cancelled = true }
  }, [projectId, refreshKey])

  if (loading) {
    return <LoadingDot message="Loading audit trail" />
  }

  if (!events || events.length === 0) {
    return (
      <p className="text-xs text-ink-muted italic">
        No events logged yet. Stage changes and notes update this timeline. Older projects (created before audit logging shipped) will only show new events from now on.
      </p>
    )
  }

  return (
    <ol className="relative ml-3 border-l border-gray-200">
      {events.map((e) => {
        const meta = EVENT_KIND_META[e.kind] || { color: '#5A6B7A', label: e.kind }
        const dt = new Date(e.created_at)
        const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const viewCount = e.kind === 'shared' && e.meta?.token ? shareViews[e.meta.token] : undefined
        return (
          <li key={e.id} className="ml-4 pb-4 last:pb-0">
            <span
              className="absolute left-[-5px] w-[9px] h-[9px] rounded-full"
              style={{ background: meta.color, boxShadow: '0 0 0 3px #F9FAFB' }}
            />
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                {dateStr} · {timeStr}
              </span>
              {typeof viewCount === 'number' && (
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.18em] tabular-nums px-1.5 py-px rounded-xs border"
                  style={{ color: '#7C3AED', borderColor: 'rgba(124, 58, 237, 0.25)', background: 'rgba(124, 58, 237, 0.06)' }}
                  title={viewCount === 0 ? 'Link not yet opened' : `Recipient opened the link ${viewCount} time${viewCount === 1 ? '' : 's'}`}
                >
                  {viewCount} {viewCount === 1 ? 'view' : 'views'}
                </span>
              )}
            </div>
            <p className="text-[12px] text-ink mt-0.5 leading-relaxed">{e.detail}</p>
          </li>
        )
      })}
    </ol>
  )
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
function MiniArcGauge({ score, color, fallbackColor = '#9CA3AF' }) {
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

function ProjectCard({ project, onRequestRemove, onStageChange, stateProgramMap, countyDataMap = {}, shareCount = 0, onShareSuccess }) {
  const [expanded,   setExpanded]   = useState(false)
  const [notes,      setNotes]      = useState(project.notes || '')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [stage,      setStage]      = useState(project.stage || '')
  const [localCountyData, setLocalCountyData] = useState(null)
  // Bump on share success so the Audit timeline re-fetches and surfaces the
  // newly-logged 'shared' event without requiring a full Library refresh.
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const idleTimerRef = useRef(null)

  const handleShareSuccess = () => {
    if (typeof onShareSuccess === 'function') onShareSuccess()
    setAuditRefreshKey(k => k + 1)
  }

  // Prefer the centralized countyDataMap; fall back to local fetch only if
  // the map hasn't yet populated for this (state, county) pair.
  const mappedCountyData = countyDataMap[`${project.state}::${project.county}`] || null
  const countyData = mappedCountyData || localCountyData

  useEffect(() => {
    if (mappedCountyData) return
    if (project.state && project.county)
      getCountyData(project.state, project.county).then(setLocalCountyData).catch(() => {})
  }, [project.state, project.county, mappedCountyData])

  const current   = stateProgramMap[project.state]

  // V3: consolidated single PDF export. Was previously two buttons
  // ("Export Summary PDF" + "Generate Deal Memo") that produced near-identical
  // outputs -- the only difference was the AI section. User flagged the
  // redundancy. Now there's one path: it tries the AI memo, falls back
  // gracefully if the AI call fails or times out.
  const [memoExporting, setMemoExporting] = useState(false)
  const handleExportDealMemo = async (e) => {
    e.stopPropagation()
    setMemoExporting(true)
    try {
      // Recompute the LIVE score the same way the card displays it.
      // Without this, the PDF would print current.feasibilityScore (bare
      // state value) which can differ from what the user sees on the card
      // by 20+ points for non-CS technologies. Fixes the Cumberland ME
      // mismatch the user reported.
      let liveScore = null
      if (current) {
        const subs = computeSubScores(current, countyData, stage, project.technology)
        liveScore = computeDisplayScore(subs.offtake, subs.ix, subs.site)
      }
      const stateOverride = current ? { ...current, feasibilityScore: liveScore } : current

      // Try to fetch the AI memo (Sonnet); fall back to data-only PDF if it fails.
      let memo = null
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (token) {
          const res = await fetch('/api/lens-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: 'deal-memo',
              project: { ...project, stage, technology: project.technology },
              stateProgram: current,
              countyData,
            }),
          })
          if (res.ok) {
            const json = await res.json()
            memo = json.memo || null
          }
        }
      } catch (err) {
        // Best-effort: AI memo failure shouldn't block the PDF
        console.warn('[Deal Memo] AI fetch failed; exporting data-only PDF:', err.message)
      }

      const { exportProjectPDF } = await import('../components/ProjectPDFExport')
      await exportProjectPDF({ ...project, notes, stage }, stateOverride, memo)
    } finally {
      setMemoExporting(false)
    }
  }
  const alerts    = getAlerts(project, stateProgramMap)
  const hasUrgent = alerts.some(a => a.level === 'urgent')

  // Blue dot: state data updated since project was saved
  const hasDataUpdate = (() => {
    if (!current?.lastUpdated || !project.savedAt) return false
    return new Date(current.lastUpdated) > new Date(project.savedAt)
  })()

  // Debounced notes save
  useEffect(() => {
    if (notes === project.notes) return
    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      await supabase.from('projects').update({ notes }).eq('id', project.id)
      setSaveStatus('saved')
      idleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }, 900)
    return () => {
      clearTimeout(timer)
      clearTimeout(idleTimerRef.current)
    }
  }, [notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const { offtake, ix, site } = current
    ? computeSubScores(current, countyData, stage, project.technology)
    : { offtake: 0, ix: 0, site: 0 }
  const liveScore = current ? computeDisplayScore(offtake, ix, site) : null

  // V3.1 color audit: consolidated all score-color triples (accent / bg /
  // text) to the canonical Tailwind v4 palette. Previously the bg used
  // rgba(15,118,110,...) which decodes to legacy #0F766E -- visually
  // similar to the modern teal-700 #0F766E used elsewhere in the same
  // card, but technically a different green. Same drift on red: accent
  // was red-500 #EF4444 while text/bg were red-600 #DC2626. Now all on
  // teal-700 / amber / red-600.
  const accentColor = hasUrgent          ? '#DC2626' :
                      liveScore == null   ? '#D1D5DB' :
                      liveScore >= 70     ? '#0F766E' :
                      liveScore >= 50     ? '#D97706' :
                                            '#DC2626'

  const scoreBg = liveScore == null ? '#F3F4F6' :
                  liveScore >= 70   ? 'rgba(15,118,110,0.12)' :
                  liveScore >= 50   ? 'rgba(217,119,6,0.12)'  :
                                      'rgba(220,38,38,0.12)'
  const scoreText = liveScore == null ? '#6B7280' :
                    liveScore >= 70   ? '#0F766E'  :
                    liveScore >= 50   ? '#B45309'  :
                                        '#DC2626'

  // V3.1: tonal background for the collapsed bar -- a very faint score-tinted
  // gradient that fades from a hint of accent color on the left to white on the
  // right. Adds visual life without competing with the score gauge or text.
  const gradientStop = liveScore == null ? 'rgba(148,163,184,0.04)' :
                       liveScore >= 70   ? 'rgba(15,118,110,0.06)'  :
                       liveScore >= 50   ? 'rgba(217,119,6,0.05)'   :
                                           'rgba(220,38,38,0.05)'
  const collapsedBg = `linear-gradient(90deg, ${gradientStop} 0%, transparent 55%)`

  return (
    <div
      // V3: overflow-hidden ONLY when expanded -- so the inner alert strip + bg fill
      // clip cleanly to the rounded corners. When collapsed, no clipping so the
      // StagePicker dropdown can escape the card boundary.
      className={`rounded-xl border transition-all duration-200 relative ${expanded ? 'overflow-hidden' : ''}`}
      style={{
        background: '#FFFFFF',
        borderColor: hasUrgent ? 'rgba(220,38,38,0.35)' : expanded ? 'rgba(20,184,166,0.40)' : '#E5E7EB',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: expanded
          ? '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(20,184,166,0.10)'
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* V3.1: top hairline accent rail in the card's score color -- mirrors the
          editorial rail used on the Lens panels. Hidden when expanded so the
          inner border on the expanded panel takes precedence visually. */}
      {!expanded && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}55 30%, ${accentColor}55 70%, transparent 100%)` }}
        />
      )}

      {/* ── Collapsed header (always visible) ──────────────────────────────── */}
      <div
        className="px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 rounded-t-xl"
        onClick={() => setExpanded(e => !e)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev) } }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${project.name || `${project.county} County · ${project.mw} MW`} · feasibility index ${liveScore ?? 'unknown'} of 100. Press Enter to ${expanded ? 'collapse' : 'expand'} project details.`}
        style={{ background: expanded ? 'transparent' : collapsedBg }}
      >
        {/* Animated mini arc gauge — replaces the static rounded square.
            Arc and number both spring-animate on mount and on score change. */}
        <MiniArcGauge score={liveScore} color={accentColor} />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif text-base font-semibold leading-snug text-ink" style={{ letterSpacing: '-0.015em' }}>{project.name}</h2>
            <StagePicker stage={stage} projectId={project.id} onChange={(s) => { setStage(s); onStageChange?.(project.id, s) }} />
            {hasDataUpdate && !expanded && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 border flex items-center gap-1"
                style={{ background: 'rgba(37,99,235,0.12)', color: '#60A5FA', borderColor: 'rgba(37,99,235,0.25)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                Updated
              </span>
            )}
            {alerts.length > 0 && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 border inline-flex items-center"
                style={hasUrgent
                  ? { background: '#FEE2E2', color: '#991B1B', borderColor: '#FCA5A5', lineHeight: 1 }
                  : { background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D', lineHeight: 1 }}
              >
                <span
                  // Inline-block + explicit margin keeps the dot reliably centered
                  // with the cap-height of the 10px label across browsers; flex
                  // gap + small dot can sit a half-pixel low otherwise.
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '9999px',
                    marginRight: '5px',
                    background: hasUrgent ? '#DC2626' : '#D97706',
                    flexShrink: 0,
                  }}
                />
                {alerts.length} alert{alerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate text-gray-500">
            {project.county} County, {project.stateName || project.state}
            {' · '}{project.mw} MW AC
            {project.technology ? ` · ${project.technology}` : ''}
            {project.savedAt ? ` · Saved ${new Date(project.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}` : ''}
          </p>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <CompareChip project={project} stateProgram={current} />
          <button
            onClick={(e) => { e.stopPropagation(); onRequestRemove(project.id, project.name) }}
            title="Remove project"
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
          <svg
            className={`transition-transform duration-200 text-gray-400 ${expanded ? 'rotate-180' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Expanded panel ──────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-5 py-5" style={{ borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>

          {/* Alert strip */}
          {alerts.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 mb-5 pb-4 px-3 py-2.5 rounded-lg"
              style={{
                borderBottom: '1px solid #E5E7EB',
                background: alerts.some(a => a.level === 'warning' || a.level === 'urgent') ? 'rgba(217,119,6,0.06)' : '#FFFFFF',
              }}
            >
              {alerts.map((a, i) => <AlertChip key={i} alert={a} />)}
            </div>
          )}

          {/* V3: Tabbed expanded panel — replaces single giant 2-col scroll.
              Overview = top-line score + breakdown.
              Diligence = deep state context (IX notes, program notes, capacity).
              Notes = the user's own deal log. */}
          <Tabs defaultValue="overview">
            <TabsList className="mb-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="diligence">Diligence</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Overview — score + sub-scores + status badges ─── */}
            <TabsContent value="overview">
              {current ? (
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
                  {/* Score gauge + status pills */}
                  <div className="flex items-center gap-5">
                    <ScoreGauge score={liveScore} />
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1 text-ink-muted">Program Status</p>
                        <span className={`text-xs px-2 py-0.5 rounded-sm border font-semibold ${CS_STATUS_STYLES[current.csStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {CS_STATUS_LABEL[current.csStatus] ?? current.csStatus}
                        </span>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1 text-ink-muted">IX Difficulty</p>
                        <span className={`text-xs px-2 py-0.5 rounded-sm border font-semibold ${IX_STYLES[current.ixDifficulty] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {IX_LABEL[current.ixDifficulty] ?? current.ixDifficulty}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-score breakdown */}
                  <div className="flex flex-col gap-2 rounded-lg px-3 py-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1 text-ink-muted">Index Breakdown</p>
                    {[
                      { label: 'Offtake', value: offtake, weight: '40%', color: '#0F766E' },
                      { label: 'IX Risk', value: ix,      weight: '35%', color: '#D97706' },
                      { label: 'Site',    value: site,    weight: '25%', color: '#2563EB' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-right font-medium text-ink-muted">{s.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${s.value}%`, background: s.color, opacity: 0.85 }} />
                        </div>
                        <span className="text-[10px] w-7 font-mono font-semibold" style={{ color: s.color }}>{s.value}</span>
                        <span className="text-[9px] font-mono text-gray-400">{s.weight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">No market data available for this state.</p>
              )}
            </TabsContent>

            {/* ── Tab 2: Diligence — deep state context ────────────────── */}
            <TabsContent value="diligence">
              {current ? (
                <div className="flex flex-col gap-4">
                  {/* Program details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs rounded-lg px-3 py-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-0.5 text-ink-muted">CS Program</p>
                      <p className="font-medium text-ink">{current.csProgram ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-0.5 text-ink-muted">LMI Required</p>
                      <p className="font-medium">
                        {current.lmiRequired
                          ? <span className="text-teal-700">{current.lmiPercent}% minimum</span>
                          : <span className="text-gray-400">Not required</span>}
                      </p>
                    </div>
                    {current.capacityMW && (
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-0.5 text-ink-muted">Program Capacity</p>
                        <p className="font-medium text-ink">{current.capacityMW} MW</p>
                      </div>
                    )}
                    {current.lastUpdated && (
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-0.5 text-ink-muted">Data As Of</p>
                        <p className="text-gray-400">{current.lastUpdated}</p>
                      </div>
                    )}
                  </div>

                  {current.ixNotes && (
                    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.20)' }}>
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1" style={{ color: '#B45309' }}>IX Notes</p>
                      <p className="text-[12px] leading-relaxed text-ink">{current.ixNotes}</p>
                    </div>
                  )}

                  {current.programNotes && (
                    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.20)' }}>
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1" style={{ color: '#0F766E' }}>Program Context</p>
                      <p className="text-[12px] leading-relaxed text-ink">{current.programNotes}</p>
                    </div>
                  )}

                  {!current.ixNotes && !current.programNotes && (
                    <p className="text-xs text-ink-muted italic">No additional diligence notes for this state. Run a fresh Lens analysis for AI commentary.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">No market data available for this state.</p>
              )}
            </TabsContent>

            {/* ── Tab 3: Notes — user's own deal log ───────────────────── */}
            <TabsContent value="notes">
              <YourDealSection project={project} stage={stage} setStage={setStage} notes={notes} setNotes={setNotes} saveStatus={saveStatus} />
            </TabsContent>

            {/* ── Tab 4: Audit — append-only event timeline (V3 §4.3) ── */}
            <TabsContent value="audit">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                  Status thread · {project.name}
                </p>
                <p className="text-[11px] text-ink-muted leading-relaxed -mt-1">
                  Append-only log of stage changes, score shifts, and material updates. Useful as a paper trail for capital partners and IC review.
                </p>
                <div className="rounded-lg px-4 py-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <ProjectAuditTimeline projectId={project.id} refreshKey={auditRefreshKey} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* ── Action footer ── */}
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #E5E7EB' }}>
            <Link
              to={`/search?state=${project.state}&county=${encodeURIComponent(project.county || '')}&mw=${project.mw || ''}&stage=${encodeURIComponent(project.stage || '')}&technology=${encodeURIComponent(project.technology || '')}`}
              className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Re-Analyze in Lens →
            </Link>
            <div className="flex items-center gap-2">
              {/* V3 §4.7: shareable read-only memo URL. Generates a token-protected
                  link the user can send to investors / capital partners. The
                  recipient lands on /memo/:token and sees a frozen snapshot
                  without needing to sign in. */}
              <ShareDealMemoButton
                project={project}
                stateProgram={current}
                countyData={countyData}
                stage={stage}
                liveScore={liveScore}
                shareCount={shareCount}
                onShareSuccess={handleShareSuccess}
              />
              {/* V3 §Wave 2: Utility Outreach Kit -- consultant-grade pre-app
                  packet (email + study intel + checklists). Pro-gated via
                  the existing isPro check on /api/lens-insight. */}
              <UtilityOutreachButton
                project={project}
                stateProgram={current}
                countyData={countyData}
                stage={stage}
              />
              {/* V3: Single PDF export — IC-grade Deal Memo. */}
              <button
                onClick={handleExportDealMemo}
                disabled={memoExporting}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                style={{ background: '#0F1A2E' }}
                title="Generate IC-grade Deal Memo PDF with AI analysis"
              >
                {memoExporting ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Synthesizing memo…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <polyline points="9 15 12 18 15 15"/>
                    </svg>
                    Export PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Your Deal Section ────────────────────────────────────────────────────────
// V3: Lives inside the "Notes" tab. Tab activation IS the open state, so
// the previous collapsible toggle is redundant and was removed.
function YourDealSection({ project, stage, setStage, notes, setNotes, saveStatus }) {
  // "Last analyzed X days ago"
  const daysAgo = project.savedAt
    ? Math.max(0, Math.round((Date.now() - new Date(project.savedAt).getTime()) / 86400000))
    : null

  return (
    <div className="flex flex-col gap-3">
      {/* Header strip — saved-on caption + always-visible meta + stage picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-medium text-ink">{project.mw} MW AC</span>
          {project.technology && <><span className="text-gray-300">·</span><span className="text-ink-muted">{project.technology}</span></>}
          <span className="text-gray-300">·</span>
          <StagePicker stage={stage} projectId={project.id} onChange={setStage} />
        </div>
        {daysAgo != null && (
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-muted">
            {daysAgo === 0 ? 'Saved today' : daysAgo === 1 ? 'Saved yesterday' : `Saved ${daysAgo}d ago`}
          </span>
        )}
      </div>

      {/* Always-expanded content — replaces the legacy collapsible */}
      <div className="flex flex-col gap-4 mt-1">
          {/* Pipeline progress */}
          <div className="rounded-lg px-4 py-3 bg-white border border-gray-200">
            <p className="text-[9px] font-bold uppercase tracking-wider mb-3 text-gray-500">Pipeline Progress</p>
            <PipelineProgress stage={stage} />
          </div>

          {/* Deal details */}
          <div className="rounded-lg px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs bg-white border border-gray-200">
            {project.servingUtility && (
              <div className="sm:col-span-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-gray-500">Serving Utility</p>
                <p className="font-medium text-gray-900">{project.servingUtility}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-gray-500">Saved</p>
              <p className="text-gray-400">{project.savedAt ? new Date(project.savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Deal Notes</p>
              {saveStatus === 'saving' && (
                <span className="text-[9px] flex items-center gap-1 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-gray-400" />
                  Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[9px] flex items-center gap-1" style={{ color: '#34D399' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Saved
                </span>
              )}
            </div>
            {!notes && (
              <div className="flex flex-wrap gap-1.5">
                {['Landowner', 'Queue position', 'Key dates', 'ISA deposit', 'Site notes'].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotes(`${hint}: `) }}
                    className="text-[10px] px-2 py-0.5 rounded-sm transition-colors border border-gray-200 text-gray-500 bg-white hover:border-teal-700 hover:text-teal-700"
                  >
                    + {hint}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Landowner · Queue position · Key dates · ISA deposit · Site findings"
              rows={4}
              className="w-full text-xs resize-none focus:outline-hidden leading-relaxed rounded-lg px-3 py-2.5 transition-colors"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D1D5DB',
                color: '#111827',
              }}
            />
          </div>
      </div>
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
    return { ...p, score: computeDisplayScore(...Object.values(subs)) }
  }), [projects, stateProgramMap])

  // Portfolio health score (weighted avg)
  const healthScore = useMemo(() => {
    if (!scored.length) return 0
    const totalMW = scored.reduce((s, p) => s + (parseFloat(p.mw) || 1), 0)
    const weighted = scored.reduce((s, p) => s + ((parseFloat(p.mw) || 1) * p.score), 0)
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
  const geoBreakdown = useMemo(() => {
    const map = {}
    scored.forEach(p => {
      const st = p.state_name || p.state || 'Unknown'
      if (!map[st]) map[st] = { count: 0, mw: 0, avgScore: 0, scores: [] }
      map[st].count++
      map[st].mw += parseFloat(p.mw) || 0
      map[st].scores.push(p.score)
    })
    Object.values(map).forEach(v => { v.avgScore = Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) })
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
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [countyDataMap,   setCountyDataMap]   = useState({}) // key `${state}::${county}` -> countyData
  const [sortBy,          setSortBy]          = useState('saved')    // saved|score|mw|alerts
  const [filterState,     setFilterState]     = useState('')
  const [filterTech,      setFilterTech]      = useState('')
  const [filterStage,     setFilterStage]     = useState('')
  const [shareCountMap,   setShareCountMap]   = useState({})         // project_id -> int (active, non-expired tokens)

  // Load live state program map for alert detection
  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
  }, [])

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
          const liveScore = computeDisplayScore(subs.offtake, subs.ix, subs.site)
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
          const alerts = getAlerts(p, stateProgramMap)
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
    return computeDisplayScore(subs.offtake, subs.ix, subs.site)
  }

  const displayProjects = useMemo(() => {
    let filtered = projects
    if (filterState) filtered = filtered.filter(p => p.state === filterState)
    if (filterTech)  filtered = filtered.filter(p => p.technology === filterTech)
    if (filterStage) filtered = filtered.filter(p => p.stage === filterStage)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score')  return liveScoreFor(b) - liveScoreFor(a)
      if (sortBy === 'mw')     return (parseFloat(b.mw) || 0) - (parseFloat(a.mw) || 0)
      if (sortBy === 'alerts') return getAlerts(b, stateProgramMap).length - getAlerts(a, stateProgramMap).length
      return new Date(b.savedAt) - new Date(a.savedAt)
    })
  }, [projects, filterState, filterTech, filterStage, sortBy, stateProgramMap, countyDataMap])

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
      const newScore = computeDisplayScore(subs.offtake, subs.ix, subs.site)
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
    <div className="min-h-screen bg-paper">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

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
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {projects.length > 0 && (
                <>
                  <button
                    onClick={() => exportCSV(projects, stateProgramMap)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                    style={{
                      color: 'rgba(255,255,255,0.85)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    title="Export all projects to CSV (universal format)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    CSV
                  </button>
                  <button
                    onClick={() => exportXLSX(projects, stateProgramMap)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                    style={{
                      color: 'rgba(255,255,255,0.85)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    title="Export to Excel with column widths + number formatting"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    XLSX
                  </button>
                </>
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
                  { label: 'Active Alerts',  value: projects.reduce((s, p) => s + getAlerts(p, stateProgramMap).length, 0), sub: 'policy or market flags', valColor: '#0F1A2E' },
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
                return (
                  <div className="mt-4 rounded-xl px-4 py-4 bg-white border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pipeline Distribution</p>
                      {filterStage && (
                        <button
                          onClick={() => setFilterStage('')}
                          className="text-[10px] font-semibold text-teal-700 hover:text-teal-800"
                        >
                          Clear filter ✕
                        </button>
                      )}
                    </div>
                    <div className="flex items-end gap-2 h-16">
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
                  </div>
                )
              })()}

              {/* Filter + sort bar */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <select
                  value={filterState}
                  onChange={e => setFilterState(e.target.value)}
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-hidden bg-white border border-gray-200 ${filterState ? 'text-teal-700' : 'text-gray-500'}`}
                >
                  <option value="">All States</option>
                  {[...new Set(projects.map(p => p.state))].sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={filterTech}
                  onChange={e => setFilterTech(e.target.value)}
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-hidden bg-white border border-gray-200 ${filterTech ? 'text-teal-700' : 'text-gray-500'}`}
                >
                  <option value="">All Tech</option>
                  {[...new Set(projects.map(p => p.technology).filter(Boolean))].sort().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-hidden bg-white border border-gray-200 ${filterStage ? 'text-teal-700' : 'text-gray-500'}`}
                >
                  <option value="">All Stages</option>
                  {PIPELINE_STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

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

        {/* Loading skeleton */}
        {loading ? (
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
              const alertCount = projects.reduce((n, p) => n + getAlerts(p, stateProgramMap).length, 0)
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
            {displayProjects.length > 0 ? (
              <div className="grid gap-3">
                {displayProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onRequestRemove={handleRequestRemove} onStageChange={handleStageChange} stateProgramMap={stateProgramMap} countyDataMap={countyDataMap} shareCount={shareCountMap[p.id] || 0} onShareSuccess={() => setShareCountMap(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))} />
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
          <div
            className="rounded-2xl mt-2 mx-auto max-w-2xl px-8 py-10"
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

              {/* Three value props */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 w-full max-w-lg">
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
                  to="/dashboard"
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
                >
                  Or browse Markets on the Move →
                </Link>
              </div>
            </div>
          </div>
        )}
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
    </div>
  )
}
