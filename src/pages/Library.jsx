import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import { getStateProgramMap } from '../lib/programData'
import { useCompare, libraryProjectToCompareItem } from '../context/CompareContext'
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

  if (project.feasibilityScore != null && current.feasibilityScore < project.feasibilityScore - 10) {
    alerts.push({ level: 'warning', pillar: 'Market', label: 'Score Drop', detail: `Feasibility score fell from ${project.feasibilityScore} → ${current.feasibilityScore}` })
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
const ALERT_STYLES = {
  urgent:  { chip: 'bg-red-50 border-red-200 text-red-700',       dot: 'bg-red-500'   },
  warning: { chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400' },
  info:    { chip: 'bg-blue-50 border-blue-200 text-blue-600',    dot: 'bg-blue-400'  },
}

function AlertChip({ alert }) {
  const s = ALERT_STYLES[alert.level] || ALERT_STYLES.info
  return (
    <div className={`group relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-default ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {alert.pillar && <span className="opacity-60">{alert.pillar}</span>}
      {alert.label}
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-52 bg-gray-900 text-white text-[10px] rounded px-2 py-1.5 leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
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
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round"
        />
        {arcD && (
          <path d={arcD} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="rgba(255,255,255,0.90)">{score}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.30)">out of 100</text>
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
                  style={(!done && !current) ? { background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' } :
                         current             ? { background: 'rgba(15,110,86,0.15)' } : {}}
                />
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 ${done ? 'bg-primary' : ''}`}
                  style={!done ? { background: 'rgba(255,255,255,0.10)' } : {}}
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
              style={!current ? { color: 'rgba(255,255,255,0.20)' } : {}}
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
function exportCSV(projects) {
  const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
  const headers = ['Name', 'State', 'County', 'MW AC', 'Technology', 'Stage', 'CS Status', 'CS Program', 'Feasibility Score', 'Serving Utility', 'Saved Date']
  const rows = projects.map(p => [
    p.name,
    p.stateName || p.state,
    p.county,
    p.mw,
    p.technology || '',
    p.stage || '',
    CS_LABEL[p.csStatus] || p.csStatus || '',
    p.csProgram || '',
    p.feasibilityScore ?? '',
    p.servingUtility || '',
    p.savedAt ? new Date(p.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '',
  ])
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
          className="absolute z-50 top-full mt-1 left-0 rounded-lg overflow-hidden min-w-[210px]"
          style={{ background: '#0D1A2E', border: '1px solid rgba(15,110,86,0.30)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}
        >
          {PIPELINE_STAGES.map((s) => (
            <li key={s}>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                style={s === stage
                  ? { fontWeight: 600, background: 'rgba(15,110,86,0.20)', color: '#34D399' }
                  : { color: 'rgba(255,255,255,0.65)' }}
                onMouseEnter={(e) => { if (s !== stage) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={(e) => { if (s !== stage) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s === stage ? '#0F6E56' : 'transparent' }}
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

  return (
    <button
      onClick={handleClick}
      disabled={atLimit}
      title={inCompare ? 'Remove from compare' : atLimit ? `Compare tray full (max ${MAX_ITEMS})` : 'Add to compare'}
      className={`p-1 transition-colors ${
        inCompare
          ? 'text-primary'
          : atLimit
            ? 'text-gray-200 cursor-not-allowed'
            : 'text-gray-300 hover:text-primary'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </button>
  )
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onRequestRemove, stateProgramMap }) {
  const [expanded,   setExpanded]   = useState(false)
  const [notes,      setNotes]      = useState(project.notes || '')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [stage,      setStage]      = useState(project.stage || '')
  const [exporting,  setExporting]  = useState(false)
  const idleTimerRef = useRef(null)

  const handleExportPDF = async (e) => {
    e.stopPropagation()
    setExporting(true)
    try {
      const { exportProjectPDF } = await import('../components/ProjectPDFExport')
      await exportProjectPDF({ ...project, notes, stage }, current)
    } finally {
      setExporting(false)
    }
  }

  const current   = stateProgramMap[project.state]
  const alerts    = getAlerts(project, stateProgramMap)
  const hasUrgent = alerts.some(a => a.level === 'urgent')

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

  const liveScore = current?.feasibilityScore ?? null

  const accentColor = hasUrgent          ? '#EF4444' :
                      liveScore == null   ? 'rgba(255,255,255,0.15)' :
                      liveScore >= 70     ? '#0F6E56' :
                      liveScore >= 50     ? '#D97706' :
                                            '#EF4444'

  const scoreBg = liveScore == null ? 'rgba(255,255,255,0.08)' :
                  liveScore >= 70   ? 'rgba(15,110,86,0.30)'   :
                  liveScore >= 50   ? 'rgba(217,119,6,0.28)'   :
                                      'rgba(220,38,38,0.28)'
  const scoreText = liveScore == null ? 'rgba(255,255,255,0.60)' :
                    liveScore >= 70   ? '#34D399'  :
                    liveScore >= 50   ? '#FCD34D'  :
                                        '#F87171'

  return (
    <div
      className="rounded-xl border transition-all duration-200 overflow-hidden"
      style={{
        background: '#0D1624',
        borderColor: hasUrgent ? 'rgba(220,38,38,0.35)' : expanded ? 'rgba(15,110,86,0.45)' : 'rgba(15,110,86,0.28)',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: expanded
          ? `0 4px 24px rgba(0,0,0,0.40), 0 0 0 1px rgba(15,110,86,0.12)`
          : '0 2px 12px rgba(0,0,0,0.25)',
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
          <span className="text-[8px] font-medium opacity-60 mt-0.5">score</span>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold leading-snug" style={{ color: '#FFFFFF' }}>{project.name}</h2>
            <StagePicker stage={stage} projectId={project.id} onChange={setStage} />
            {alerts.length > 0 && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 border"
                style={hasUrgent
                  ? { background: 'rgba(220,38,38,0.15)', color: '#F87171', borderColor: 'rgba(220,38,38,0.30)' }
                  : { background: 'rgba(217,119,6,0.15)',  color: '#FCD34D', borderColor: 'rgba(217,119,6,0.30)' }}
              >
                {alerts.length} alert{alerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.68)' }}>
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
            className="hover:text-red-400 transition-colors p-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
          <svg
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'rgba(255,255,255,0.35)' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Expanded panel ──────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-5 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.10)', background: '#0F1A2E' }}>

          {/* Alert strip */}
          {alerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
              {alerts.map((a, i) => <AlertChip key={i} alert={a} />)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Left: Market Intelligence ──────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.90)' }}>Market Intelligence</p>

              {current ? (
                <>
                  {/* Score gauge */}
                  <div className="flex items-center gap-5">
                    <ScoreGauge score={liveScore} />
                    <div className="flex flex-col gap-2">
                      {/* CS status */}
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}>Program Status</p>
                        <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${CS_STATUS_STYLES[current.csStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {CS_STATUS_LABEL[current.csStatus] ?? current.csStatus}
                        </span>
                      </div>
                      {/* IX difficulty */}
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}>IX Difficulty</p>
                        <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${IX_STYLES[current.ixDifficulty] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {IX_LABEL[current.ixDifficulty] ?? current.ixDifficulty}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Program details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>CS Program</p>
                      <p className="font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>{current.csProgram ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>LMI Required</p>
                      <p className="font-medium">
                        {current.lmiRequired
                          ? <span style={{ color: '#34D399' }}>{current.lmiPercent}% minimum</span>
                          : <span style={{ color: 'rgba(255,255,255,0.60)' }}>Not required</span>}
                      </p>
                    </div>
                    {current.capacityMW && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Program Capacity</p>
                        <p className="font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>{current.capacityMW} MW</p>
                      </div>
                    )}
                    {current.lastUpdated && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Data As Of</p>
                        <p style={{ color: 'rgba(255,255,255,0.40)' }}>{current.lastUpdated}</p>
                      </div>
                    )}
                  </div>

                  {/* IX notes */}
                  {current.ixNotes && (
                    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(186,117,23,0.08)', border: '1px solid rgba(186,117,23,0.18)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(186,117,23,0.70)' }}>IX Notes</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{current.ixNotes}</p>
                    </div>
                  )}

                  {/* Program notes */}
                  {current.programNotes && (
                    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(15,110,86,0.10)', border: '1px solid rgba(15,110,86,0.20)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(52,211,153,0.60)' }}>Program Context</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{current.programNotes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.60)' }}>No market data available for this state.</p>
              )}
            </div>

            {/* ── Right: Your Deal ───────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.90)' }}>Your Deal</p>

              {/* Pipeline progress */}
              <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.60)' }}>Development Stage</p>
                  <StagePicker stage={stage} projectId={project.id} onChange={setStage} />
                </div>
                <PipelineProgress stage={stage} />
              </div>

              {/* Deal details */}
              <div className="rounded-lg px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)' }}>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Technology</p>
                  <p className="font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>{project.technology || '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Capacity</p>
                  <p className="font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>{project.mw} MW AC</p>
                </div>
                {project.servingUtility && (
                  <div className="col-span-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Serving Utility</p>
                    <p className="font-medium" style={{ color: 'rgba(255,255,255,0.90)' }}>{project.servingUtility}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>Saved</p>
                  <p style={{ color: 'rgba(255,255,255,0.50)' }}>{new Date(project.savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.60)' }}>Deal Notes</p>
                  {saveStatus === 'saving' && (
                    <span className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.60)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: 'rgba(255,255,255,0.60)' }} />
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
                        className="text-[10px] px-2 py-0.5 rounded transition-colors"
                        style={{ border: '1px solid rgba(15,110,86,0.30)', color: 'rgba(255,255,255,0.50)', background: 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(15,110,86,0.60)'; e.currentTarget.style.color = '#34D399' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(15,110,86,0.30)'; e.currentTarget.style.color = 'rgba(255,255,255,0.50)' }}
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
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(15,110,86,0.30)',
                    color: 'rgba(255,255,255,0.90)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Action footer ── */}
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <Link
              to={`/search?state=${project.state}`}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'rgba(52,211,153,0.75)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#34D399'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(52,211,153,0.75)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Re-Analyze in Lens →
            </Link>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
            >
              {exporting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-primary animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <polyline points="9 15 12 18 15 15"/>
                  </svg>
                  Export Summary PDF
                </>
              )}
            </button>
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
  if (!isPro)     return <UpgradePrompt feature="My Projects" />
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
      if (sortBy === 'score') return (stateProgramMap[b.state]?.feasibilityScore ?? 0) - (stateProgramMap[a.state]?.feasibilityScore ?? 0)
      if (sortBy === 'mw')    return (parseFloat(b.mw) || 0) - (parseFloat(a.mw) || 0)
      if (sortBy === 'alerts') return getAlerts(b, stateProgramMap).length - getAlerts(a, stateProgramMap).length
      return new Date(b.savedAt) - new Date(a.savedAt)
    })
  }, [projects, filterState, filterTech, filterStage, sortBy, stateProgramMap])

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
            <h1 className="text-xl font-bold text-gray-900">My Projects</h1>
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
    <div className="min-h-screen" style={{ background: '#0C1220' }}>
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'rgba(52,211,153,0.80)' }}>Deal Tracker</p>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#FFFFFF' }}>My Projects</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Your saved deals — tracked, scored, and monitored for policy changes.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {projects.length > 0 && (
                <button
                  onClick={() => exportCSV(projects)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.72)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                  title="Export all projects to CSV"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export CSV
                </button>
              )}
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-700 px-3.5 py-2 rounded-lg transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Lens Search
              </Link>
            </div>
          </div>

          <SectionDivider />

          {/* Stat strip + pipeline overview */}
          {projects.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Saved Projects', value: projects.length,   sub: 'across all states',     topColor: '#0F6E56', valColor: '#34D399' },
                  { label: 'Total Capacity', value: `${projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0).toFixed(1)} MW`, sub: 'AC nameplate', topColor: '#BA7517', valColor: '#FCD34D' },
                  { label: 'Active Alerts',  value: projects.reduce((s, p) => s + getAlerts(p, stateProgramMap).length, 0), sub: 'policy or market flags', topColor: 'rgba(255,255,255,0.15)', valColor: 'rgba(255,255,255,0.80)' },
                ].map(({ label, value, sub, topColor, valColor }) => (
                  <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#0D1624', border: '1px solid rgba(15,110,86,0.18)', borderTop: `3px solid ${topColor}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.58)' }}>{label}</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: valColor }}>{value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Pipeline distribution bar */}
              {(() => {
                const stageCounts = PIPELINE_STAGES.map(s => ({ stage: s, count: projects.filter(p => p.stage === s).length }))
                const maxCount = Math.max(...stageCounts.map(s => s.count), 1)
                return (
                  <div className="mt-4 rounded-xl px-4 py-3" style={{ background: '#0D1624', border: '1px solid rgba(15,110,86,0.15)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Pipeline Distribution</p>
                    <div className="flex items-end gap-1.5 h-10">
                      {stageCounts.map(({ stage, count }) => (
                        <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-sm transition-all duration-300"
                            style={{
                              height: count > 0 ? `${Math.max(4, (count / maxCount) * 32)}px` : '2px',
                              background: count > 0 ? '#0F6E56' : 'rgba(255,255,255,0.08)',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      {stageCounts.map(({ stage, count }) => (
                        <div key={stage + 'l'} className="flex-1 text-center">
                          <p className="text-[8px] leading-tight truncate" style={{ color: count > 0 ? 'rgba(52,211,153,0.80)' : 'rgba(255,255,255,0.20)' }}>
                            {PIPELINE_SHORT[PIPELINE_STAGES.indexOf(stage)]}
                          </p>
                          {count > 0 && (
                            <p className="text-[9px] font-bold tabular-nums" style={{ color: '#34D399' }}>{count}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Filter + sort bar */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <select
                  value={filterState}
                  onChange={e => setFilterState(e.target.value)}
                  className="text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: filterState ? '#34D399' : 'rgba(255,255,255,0.55)' }}
                >
                  <option value="">All States</option>
                  {[...new Set(projects.map(p => p.state))].sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={filterTech}
                  onChange={e => setFilterTech(e.target.value)}
                  className="text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: filterTech ? '#34D399' : 'rgba(255,255,255,0.55)' }}
                >
                  <option value="">All Tech</option>
                  {[...new Set(projects.map(p => p.technology).filter(Boolean))].sort().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className="text-[11px] font-medium rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer transition-colors focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: filterStage ? '#34D399' : 'rgba(255,255,255,0.55)' }}
                >
                  <option value="">All Stages</option>
                  {PIPELINE_STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Sort:</span>
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
                        ? { background: 'rgba(15,110,86,0.25)', color: '#34D399', border: '1px solid rgba(15,110,86,0.40)' }
                        : { background: 'transparent', color: 'rgba(255,255,255,0.40)', border: '1px solid transparent' }}
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
              <div key={i} className="rounded-xl px-5 py-4 animate-pulse flex items-center gap-4" style={{ background: '#0D1624', border: '1px solid rgba(15,110,86,0.15)' }}>
                <div className="w-11 h-11 rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex-1">
                  <div className="h-3.5 rounded w-1/3 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-2.5 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
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
            <SectionDivider />
            {displayProjects.length > 0 ? (
              <div className="grid gap-3">
                {displayProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onRequestRemove={handleRequestRemove} stateProgramMap={stateProgramMap} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>No projects match current filters.</p>
                <button
                  onClick={() => { setFilterState(''); setFilterTech(''); setFilterStage('') }}
                  className="mt-2 text-xs font-medium transition-colors"
                  style={{ color: '#34D399' }}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(15,110,86,0.12)', border: '1px solid rgba(15,110,86,0.20)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>No saved projects yet</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Run a search in Tractova Lens, then click <span style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 500 }}>Save as Project</span> to add it here.
            </p>
            <Link
              to="/search"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
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
