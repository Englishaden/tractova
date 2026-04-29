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
// ProjectPDFExport is lazy-loaded on first click — keeps initial bundle lean

// ── Stage / tech badge styles ────────────────────────────────────────────────
const STAGE_BADGE = {
  'Prospecting':            'bg-gray-100 text-gray-600 border-gray-200',
  'Site Control':           'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-Development':        'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Development':            'bg-primary-50 text-primary-700 border-primary-200',
  'NTP (Notice to Proceed)':'bg-purple-50 text-purple-700 border-purple-200',
  'Construction':           'bg-accent-50 text-accent-700 border-accent-200',
  'Operational':            'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const TECH_BADGE = {
  'Community Solar': 'bg-primary-50 text-primary-700 border-primary-200',
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
  }
}

function Badge({ label, map }) {
  const cls = map[label] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{label}</span>
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
  // Hover tooltip widened from w-52 (208px) to w-64 (256px) so the new
  // longer score-drop detail string ("...recomputed for Hybrid at Pre-Dev")
  // doesn't truncate awkwardly.
  return (
    <div className={`group relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-default ${s.chip}`} style={{ lineHeight: 1 }}>
      <span
        className={s.dot}
        style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '9999px', flexShrink: 0 }}
      />
      {alert.pillar && <span className="opacity-60">{alert.pillar}</span>}
      {alert.label}
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-64 bg-gray-900 text-white text-[10px] rounded px-2 py-1.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
        {alert.detail}
      </span>
    </div>
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
  easy:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  hard:      'bg-orange-50 text-orange-700 border-orange-200',
  very_hard: 'bg-red-50 text-red-700 border-red-200',
}
const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }

// ── CS status display ────────────────────────────────────────────────────────
const CS_STATUS_STYLES = {
  active:  'bg-emerald-50 text-emerald-700 border-emerald-200',
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
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors ${
                    done    ? 'bg-primary border-primary' :
                    current ? 'border-primary ring-2 ring-primary/30' :
                              ''
                  }`}
                  style={(!done && !current) ? { background: '#F3F4F6', borderColor: '#D1D5DB' } :
                         current             ? { background: 'rgba(15,110,86,0.15)' } : {}}
                />
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 ${done ? 'bg-primary' : ''}`}
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
              className={`flex-1 last:flex-none text-center text-[8.5px] leading-tight font-medium truncate px-0.5 ${current ? 'text-primary font-bold' : ''}`}
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

// ── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(projects, stateProgramMap = {}) {
  const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
  const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }
  // V3: 18 columns (was 11). Adds IX detail, program runway, LMI %, revenue est, alert flags.
  const headers = [
    'Name', 'State', 'County', 'MW AC', 'Technology', 'Stage',
    'CS Status', 'CS Program', 'Program Capacity Remaining (MW)', 'LMI Required (%)',
    'Program Runway (months)', 'Feasibility Index',
    'IX Difficulty', 'IX Notes (truncated)', 'Serving Utility',
    'Est. Annual Revenue ($/MW/yr)', 'Risk Flags', 'Saved Date',
  ]
  const rows = projects.map(p => {
    const sp = stateProgramMap[p.state] || {}
    // Revenue estimate: per-MW per-year (current revenue engine returns total, divide by MW)
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
      p.mw,
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
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `tractova-projects-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
    await supabase.from('projects').update({ stage: newStage }).eq('id', projectId)
    onChange(newStage)
  }

  const stageCls = STAGE_BADGE[stage] || 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        title="Edit stage"
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium transition-opacity hover:opacity-80 ${stageCls}`}
      >
        {stage}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <ul
          // V3: z-[100] to definitively sit above adjacent project cards.
          // Parent card now drops overflow-hidden when collapsed so the
          // dropdown can extend below the card boundary.
          className="absolute z-[100] top-full mt-1 left-0 rounded-lg overflow-hidden min-w-[210px]"
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
                  className="w-2 h-2 rounded-full flex-shrink-0"
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
function CompareChip({ project }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = libraryProjectToCompareItem(project)
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
          ? 'text-primary'
          : atLimit
            ? 'text-gray-200 cursor-not-allowed'
            : 'text-gray-300 hover:text-primary'
      }`}
    >
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-gray-900 text-white text-[9px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-10">
        {tooltipText}
      </span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </button>
  )
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onRequestRemove, onStageChange, stateProgramMap }) {
  const [expanded,   setExpanded]   = useState(false)
  const [notes,      setNotes]      = useState(project.notes || '')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [stage,      setStage]      = useState(project.stage || '')
  const [countyData, setCountyData] = useState(null)
  const idleTimerRef = useRef(null)

  useEffect(() => {
    if (project.state && project.county)
      getCountyData(project.state, project.county).then(setCountyData).catch(() => {})
  }, [project.state, project.county])

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

  const accentColor = hasUrgent          ? '#EF4444' :
                      liveScore == null   ? '#D1D5DB' :
                      liveScore >= 70     ? '#0F6E56' :
                      liveScore >= 50     ? '#D97706' :
                                            '#EF4444'

  const scoreBg = liveScore == null ? '#F3F4F6' :
                  liveScore >= 70   ? 'rgba(15,110,86,0.12)'   :
                  liveScore >= 50   ? 'rgba(217,119,6,0.12)'   :
                                      'rgba(220,38,38,0.12)'
  const scoreText = liveScore == null ? '#6B7280' :
                    liveScore >= 70   ? '#0F6E56'  :
                    liveScore >= 50   ? '#B45309'  :
                                        '#DC2626'

  return (
    <div
      // V3: overflow-hidden ONLY when expanded -- so the inner alert strip + bg fill
      // clip cleanly to the rounded corners. When collapsed, no clipping so the
      // StagePicker dropdown can escape the card boundary.
      className={`rounded-xl border transition-all duration-200 ${expanded ? 'overflow-hidden' : ''}`}
      style={{
        background: '#FFFFFF',
        borderColor: hasUrgent ? 'rgba(220,38,38,0.35)' : expanded ? 'rgba(20,184,166,0.40)' : '#E5E7EB',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: expanded
          ? '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(20,184,166,0.10)'
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >

      {/* ── Collapsed header (always visible) ──────────────────────────────── */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Score bubble */}
        <div
          className="flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center font-bold"
          style={{ background: scoreBg, color: scoreText }}
        >
          <span className="text-base leading-none">{liveScore ?? '—'}</span>
          <span className="text-[8px] font-medium opacity-60 mt-0.5">index</span>
        </div>

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
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <CompareChip project={project} />
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
                        <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${CS_STATUS_STYLES[current.csStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {CS_STATUS_LABEL[current.csStatus] ?? current.csStatus}
                        </span>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.18em] mb-1 text-ink-muted">IX Difficulty</p>
                        <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${IX_STYLES[current.ixDifficulty] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs rounded-lg px-3 py-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
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
          </Tabs>

          {/* ── Action footer ── */}
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #E5E7EB' }}>
            <Link
              to={`/search?state=${project.state}&county=${encodeURIComponent(project.county || '')}&mw=${project.mw || ''}&stage=${encodeURIComponent(project.stage || '')}&technology=${encodeURIComponent(project.technology || '')}`}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-700 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Re-Analyze in Lens →
            </Link>
            {/* V3: Single PDF export — IC-grade Deal Memo. Tries AI first; falls back to data-only PDF if AI unavailable. */}
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
                  Export Deal Memo PDF
                </>
              )}
            </button>
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
          <div className="rounded-lg px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs bg-white border border-gray-200">
            {project.servingUtility && (
              <div className="col-span-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-gray-500">Serving Utility</p>
                <p className="font-medium text-gray-900">{project.servingUtility}</p>
              </div>
            )}
            <div className="col-span-2">
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
                    className="text-[10px] px-2 py-0.5 rounded transition-colors border border-gray-200 text-gray-500 bg-white hover:border-primary hover:text-primary"
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
              className="w-full text-xs resize-none focus:outline-none leading-relaxed rounded-lg px-3 py-2.5 transition-colors"
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
const TECH_COLORS = { 'Community Solar': '#0F6E56', 'C&I Solar': '#2563EB', 'BESS': '#7C3AED', 'Hybrid': '#059669' }

function WeeklySummaryCard({ projects, stateProgramMap }) {
  const [collapsed, setCollapsed] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)
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

  const healthColor = healthScore > 65 ? 'text-primary-700' : healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
  const healthBg = healthScore > 65 ? 'bg-primary-50' : healthScore >= 40 ? 'bg-amber-50' : 'bg-red-50'

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
        if (data.summary) setAiInsight(data)
      }
    } catch { /* silently fail */ }
    setAiLoading(false)
  }

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
    <div className="rounded-xl overflow-hidden mb-4 bg-white border border-gray-200 shadow-sm">
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
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={healthScore > 65 ? '#0F6E56' : healthScore >= 40 ? '#D97706' : '#DC2626'} strokeWidth="3" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" />
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
                      <span className="text-[10px] text-gray-500 w-20 flex-shrink-0">{label}</span>
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
                  <div className="relative w-20 h-20 flex-shrink-0">
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
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: TECH_COLORS[tech] || '#6B7280' }} />
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
                    <span className="text-[10px] font-bold text-gray-700 w-8 flex-shrink-0">{state}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${totalMW > 0 ? (data.mw / totalMW) * 100 : 0}%`, background: data.avgScore > 65 ? '#10B981' : data.avgScore >= 40 ? '#F59E0B' : '#EF4444' }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-gray-500 w-14 text-right flex-shrink-0">{data.mw.toFixed(1)} MW</span>
                    <span className="text-[9px] font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: data.avgScore > 65 ? '#059669' : data.avgScore >= 40 ? '#D97706' : '#DC2626' }}>{data.avgScore}</span>
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
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F6E56, #10B981)' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">AI Portfolio Insight</p>
                </div>
                <p className="text-xs leading-relaxed text-gray-700">{aiInsight.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiInsight.topRecommendation && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-primary-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-primary-100 flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-primary-600 mb-0.5">Top Recommendation</p>
                        <p className="text-[11px] leading-relaxed text-gray-700">{aiInsight.topRecommendation}</p>
                      </div>
                    </div>
                  )}
                  {aiInsight.riskAssessment && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-amber-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100 flex-shrink-0 mt-0.5">
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
                  className="text-[10px] font-medium text-primary-500 hover:text-primary-700 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            ) : aiLoading ? (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md animate-pulse" style={{ background: 'linear-gradient(135deg, #0F6E56, #10B981)' }} />
                  <div className="h-3 w-28 rounded bg-primary-200/50 animate-pulse" />
                </div>
                <div className="h-3 w-full rounded bg-primary-100/40 animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-primary-100/40 animate-pulse" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 rounded-lg bg-white/50 animate-pulse" />
                  <div className="h-16 rounded-lg bg-white/50 animate-pulse" />
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateInsight}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-4 text-xs font-semibold text-primary-700 hover:bg-primary-50/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F6E56, #10B981)' }}>
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
  const [projects,        setProjects]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [hasFetched,      setHasFetched]      = useState(false)
  const [error,           setError]           = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [sortBy,          setSortBy]          = useState('saved')    // saved|score|mw|alerts
  const [filterState,     setFilterState]     = useState('')
  const [filterTech,      setFilterTech]      = useState('')
  const [filterStage,     setFilterStage]     = useState('')

  // Load live state program map for alert detection
  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
  }, [])

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

  const displayProjects = useMemo(() => {
    let filtered = projects
    if (filterState) filtered = filtered.filter(p => p.state === filterState)
    if (filterTech)  filtered = filtered.filter(p => p.technology === filterTech)
    if (filterStage) filtered = filtered.filter(p => p.stage === filterStage)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') {
        const aS = computeSubScores(stateProgramMap[a.state], null, a.stage, a.technology)
        const bS = computeSubScores(stateProgramMap[b.state], null, b.stage, b.technology)
        return computeDisplayScore(bS.offtake, bS.ix, bS.site) - computeDisplayScore(aS.offtake, aS.ix, aS.site)
      }
      if (sortBy === 'mw')    return (parseFloat(b.mw) || 0) - (parseFloat(a.mw) || 0)
      if (sortBy === 'alerts') return getAlerts(b, stateProgramMap).length - getAlerts(a, stateProgramMap).length
      return new Date(b.savedAt) - new Date(a.savedAt)
    })
  }, [projects, filterState, filterTech, filterStage, sortBy, stateProgramMap])

  const handleStageChange = useCallback((id, newStage) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage } : p))
  }, [])

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
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Sign in to view your projects</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">Your saved projects are tied to your account and sync across devices.</p>
            <div className="flex items-center gap-3 mt-5">
              <Link to="/signin" className="text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">Sign In</Link>
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {projects.length > 0 && (
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
                  title="Export all projects to CSV"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export CSV
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
              <div className="grid grid-cols-3 gap-3">
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
                          className="text-[10px] font-semibold text-primary hover:text-primary-700"
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
                                outline: isActive ? '2px solid #0F6E56' : 'none',
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
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none bg-white border border-gray-200 ${filterState ? 'text-primary' : 'text-gray-500'}`}
                >
                  <option value="">All States</option>
                  {[...new Set(projects.map(p => p.state))].sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={filterTech}
                  onChange={e => setFilterTech(e.target.value)}
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none bg-white border border-gray-200 ${filterTech ? 'text-primary' : 'text-gray-500'}`}
                >
                  <option value="">All Tech</option>
                  {[...new Set(projects.map(p => p.technology).filter(Boolean))].sort().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none bg-white border border-gray-200 ${filterStage ? 'text-primary' : 'text-gray-500'}`}
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
                      className="text-[10px] font-semibold px-2 py-1 rounded transition-colors"
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
                <div className="w-11 h-11 rounded-lg flex-shrink-0 bg-gray-100" />
                <div className="flex-1">
                  <div className="h-3.5 rounded w-1/3 mb-2 bg-gray-100" />
                  <div className="h-2.5 rounded w-1/2 bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            Failed to load projects: {error}
          </div>
        ) : projects.length > 0 ? (
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
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0F766E' }} />
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
                  <ProjectCard key={p.id} project={p} onRequestRemove={handleRequestRemove} onStageChange={handleStageChange} stateProgramMap={stateProgramMap} />
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
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p className="font-serif text-lg font-semibold text-ink" style={{ letterSpacing: '-0.015em' }}>No saved projects yet</p>
            <p className="text-xs mt-1 max-w-xs text-gray-400">
              Run a search in Tractova Lens, then click <span className="text-gray-600 font-medium">Save as Project</span> to add it here.
            </p>
            <Link
              to="/search"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0F766E' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Open Tractova Lens
            </Link>
          </div>
        )}
      </main>

      {/* Remove confirmation modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmRemove(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900">Remove project?</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-gray-700">{confirmRemove.name}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmRemove(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors">
                No, keep it
              </button>
              <button onClick={handleConfirmRemove} className="flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
