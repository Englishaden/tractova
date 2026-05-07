import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCountyData } from '../lib/programData'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import TechLabel from './ui/TechLabel'
import { getAlerts } from '../lib/alertHelpers'
import { formatLargeUSD } from '../lib/formatters'
import AlertChip from './AlertChip.jsx'
import ProjectAuditTimeline from './ProjectAuditTimeline.jsx'
import YourDealSection from './YourDealSection.jsx'
import {
  StagePicker,
  CompareChip,
  ShareDealMemoButton,
  UtilityOutreachButton,
  MiniArcGauge,
  ScoreGauge,
  CS_STATUS_STYLES,
  CS_STATUS_LABEL,
  IX_STYLES,
  IX_LABEL,
} from '../pages/Library.jsx'

export default function ProjectCard({ project, onRequestRemove, onStageChange, stateProgramMap, countyDataMap = {}, stateDelta = null, shareCount = 0, onShareSuccess, selected = false, onToggleSelect, selectionActive = false, scenarios = [], onScenarioDelete }) {
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
    if (project.state && project.county) {
      // Local fallback fetch when the centralized countyDataMap hasn't
      // populated yet for this card. On failure the score recomputes with
      // null countyData (falls through to the curated/baseline tier) — a
      // degraded but non-broken state. Log for devtools visibility.
      getCountyData(project.state, project.county).then(setLocalCountyData).catch(err => {
        console.warn('[ProjectCard] getCountyData failed:', project.state, project.county, err)
      })
    }
  }, [project.state, project.county, mappedCountyData])

  const current   = stateProgramMap[project.state]

  // V3: consolidated single PDF export. Was previously two buttons
  // ("Export Summary PDF" + "Generate Deal Memo") that produced near-identical
  // outputs -- the only difference was the AI section. User flagged the
  // redundancy. Now there's one path: it tries the AI memo, falls back
  // gracefully if the AI call fails or times out.
  const [memoExporting, setMemoExporting] = useState(false)
  // Scenario selection — when set, the next PDF export embeds this scenario
  // as a "Selected Scenario" section. null = data-only / no scenario embed.
  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  // Confirm-delete modal for the in-card scenario picker. Holds the snap
  // pending confirmation, or null when no modal is open.
  const [scenarioConfirmDelete, setScenarioConfirmDelete] = useState(null)
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
        liveScore = safeScore(subs.offtake, subs.ix, subs.site)
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

      const selectedScenario = selectedScenarioId
        ? scenarios.find(s => s.id === selectedScenarioId) || null
        : null
      const { exportProjectPDF } = await import('./ProjectPDFExport')
      await exportProjectPDF({ ...project, notes, stage }, stateOverride, memo, selectedScenario)
    } finally {
      setMemoExporting(false)
    }
  }
  const alerts    = getAlerts(project, stateProgramMap, countyDataMap)
  const hasUrgent = alerts.some(a => a.level === 'urgent')
  // 2026-05-05 (A.6): split alerts by kind so the pill can render
  // distinct colors. data_update is good news (green); concern is
  // amber/red. When both exist, render two chips side-by-side.
  const concernAlerts    = alerts.filter(a => a.kind === 'concern' || (!a.kind && a.level !== 'info'))
  const updateAlerts     = alerts.filter(a => a.kind === 'data_update' || (!a.kind && a.level === 'info'))

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
  const liveScore = current ? safeScore(offtake, ix, site) : null

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
      className={`group/card rounded-xl border transition-all duration-200 relative ${expanded ? 'overflow-hidden' : ''}`}
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
            {/* 2026-05-05 (A.6): split into TWO chips when alerts of
                different kinds exist on the same project. Concerns chip
                shows amber/red; data_update chip shows emerald. Ordered
                so concerns lead (urgency-first reading). */}
            {concernAlerts.length > 0 && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 border inline-flex items-center"
                style={hasUrgent
                  ? { background: '#FEE2E2', color: '#991B1B', borderColor: '#FCA5A5', lineHeight: 1 }
                  : { background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D', lineHeight: 1 }}
              >
                <span
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
                {concernAlerts.length} alert{concernAlerts.length > 1 ? 's' : ''}
              </span>
            )}
            {updateAlerts.length > 0 && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 border inline-flex items-center"
                style={{ background: '#D1FAE5', color: '#065F46', borderColor: '#6EE7B7', lineHeight: 1 }}
                title="Data update — fresher state-program data is now available"
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '9999px',
                    marginRight: '5px',
                    background: '#10B981',
                    flexShrink: 0,
                  }}
                />
                {updateAlerts.length} update{updateAlerts.length > 1 ? 's' : ''}
              </span>
            )}
            {/* V3 Wave 1.4: WoW delta chip — surfaces when this project's state
                moved week-over-week in the snapshot history. Honestly labeled
                "State" because the source is state_programs_snapshots, not
                a per-project history. Silent when delta is null/zero. */}
            {stateDelta && stateDelta.delta !== 0 && !expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-0.5 border inline-flex items-center gap-1 cursor-help"
                    style={stateDelta.delta > 0
                      ? { background: 'rgba(15,118,110,0.10)', color: '#0F766E', borderColor: 'rgba(15,118,110,0.25)', lineHeight: 1 }
                      : { background: 'rgba(217,119,6,0.10)',  color: '#B45309', borderColor: 'rgba(217,119,6,0.25)',  lineHeight: 1 }}
                    tabIndex={0}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {stateDelta.delta > 0
                        ? <polyline points="6 15 12 9 18 15" />
                        : <polyline points="6 9 12 15 18 9" />}
                    </svg>
                    <span className="font-mono tabular-nums">State {stateDelta.delta > 0 ? '+' : ''}{stateDelta.delta} pt</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-xs text-[10px]">
                  <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>State-level snapshot delta</p>
                  <p className="leading-relaxed">
                    {project.stateName || project.state} program feasibility moved from {Math.round(stateDelta.prevScore)} → {Math.round(stateDelta.curScore)} between {new Date(stateDelta.previousAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and {new Date(stateDelta.latestAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                  </p>
                  <p className="mt-1.5 text-gray-400 leading-relaxed">
                    Project score blends state + county + tech + stage, so individual movement may differ from the state delta.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Scenarios badge — promoted from the buried below-footer toggle
                to the header so users see immediately that this project has
                saved scenarios attached. Click expands the card AND opens
                the picker for one-tap access. */}
            {scenarios.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(true)
                  setScenariosOpen(true)
                }}
                className="cursor-pointer text-[10px] font-semibold rounded-full px-2 py-0.5 border inline-flex items-center gap-1 transition-all hover:brightness-95"
                style={{ background: 'rgba(20,184,166,0.12)', color: '#0F766E', borderColor: 'rgba(20,184,166,0.40)', lineHeight: 1 }}
                aria-label={`${scenarios.length} saved scenario${scenarios.length === 1 ? '' : 's'} — open picker`}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 14l4-4 4 4 5-5" />
                </svg>
                <span className="font-mono tabular-nums">Scenarios · {scenarios.length}</span>
              </button>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate text-gray-500">
            {project.county} County, {project.stateName || project.state}
            {' · '}{project.mw} MW AC
            {project.technology && (
              <> · <TechLabel tech={project.technology} className="text-gray-500 hover:text-teal-700" /></>
            )}
            {project.savedAt ? ` · Saved ${new Date(project.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}` : ''}
          </p>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Bulk-select checkbox — visible when ANY project is selected
              (selectionActive=true) OR on hover of this card. Clicking
              toggles inclusion in the bulk-ops set. Stops event propagation
              so it doesn't trigger card expand. */}
          {onToggleSelect && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
              aria-label={selected ? 'Deselect project' : 'Select project for bulk action'}
              aria-pressed={selected}
              className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                selected
                  ? 'border-teal-500'
                  : selectionActive
                    ? 'border-gray-300 hover:border-teal-400'
                    : 'border-transparent group-hover/card:border-gray-300 hover:border-teal-400'
              }`}
              style={selected ? { background: '#14B8A6' } : { background: 'white' }}
            >
              {selected && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          )}
          <CompareChip project={project} stateProgram={current} countyData={countyData} />
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
              role="region"
              aria-label={`${alerts.length} alert${alerts.length === 1 ? '' : 's'} for this project`}
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

          {/* ── Saved Scenarios picker ── */}
          {/* Backed by scenario_snapshots (migration 041) — list filtered to
              this project_id by the parent's batched query. Opened via the
              "Scenarios · N" badge in the card header (since 2026-05-01 the
              chevron toggle here was retired in favor of the header badge,
              which is impossible to miss). Selecting a scenario marks it for
              the next PDF export + Share Deal Memo. */}
          {scenarios.length > 0 && scenariosOpen && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold" style={{ color: '#0F766E' }}>
                    ◆ Saved Scenarios · {scenarios.length}
                  </span>
                  {selectedScenarioId && (
                    <span className="text-[9px] font-mono uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(245,158,11,0.15)', color: '#92400E' }}>
                      1 in next PDF
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setScenariosOpen(false)}
                  className="cursor-pointer text-[10px] font-medium text-gray-500 hover:text-ink"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scenarios.map((snap) => {
                    const isSel = snap.id === selectedScenarioId
                    const out = snap.outputs || {}
                    return (
                      <div
                        key={snap.id}
                        className="rounded-md px-3 py-2 transition-colors"
                        style={{
                          background: isSel ? 'rgba(20,184,166,0.08)' : '#FAFAF7',
                          border: isSel ? '1px solid rgba(20,184,166,0.40)' : '1px solid #E5E7EB',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-ink truncate">{snap.name}</p>
                            <div className="text-[10px] text-gray-500 tabular-nums mt-0.5">
                              ${formatLargeUSD(out.year1Revenue)}/yr · {out.paybackYears != null ? `${out.paybackYears}yr payback` : '—'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setScenarioConfirmDelete(snap)}
                            className="cursor-pointer text-[10px] text-gray-400 hover:text-red-600 transition-colors px-1"
                            aria-label={`Delete scenario ${snap.name}`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedScenarioId(isSel ? null : snap.id)}
                            className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
                            style={{
                              background: isSel ? '#0F766E' : 'rgba(20,184,166,0.12)',
                              color: isSel ? 'white' : '#0F766E',
                              border: '1px solid rgba(20,184,166,0.30)',
                            }}
                          >
                            {isSel ? '✓ In next PDF' : 'Include in PDF'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

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
                selectedScenario={selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) || null : null}
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

      {/* Delete-scenario confirm modal — guards the in-card picker's ✕
          button so misclicks don't permanently nuke a scenario. Mirrors
          the confirm pattern in the project remove flow. */}
      <Dialog open={!!scenarioConfirmDelete} onOpenChange={(open) => { if (!open) setScenarioConfirmDelete(null) }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
            <DialogTitle>Delete scenario "{scenarioConfirmDelete?.name}"?</DialogTitle>
          </div>
          <DialogDescription>
            This permanently removes the saved scenario, including its inputs and computed metrics. This can't be undone.
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => setScenarioConfirmDelete(null)}
              className="cursor-pointer text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={async () => {
                const snap = scenarioConfirmDelete
                if (!snap) return
                const { error } = await supabase.from('scenario_snapshots').delete().eq('id', snap.id)
                if (!error && onScenarioDelete) onScenarioDelete(snap.id)
                if (selectedScenarioId === snap.id) setSelectedScenarioId(null)
                setScenarioConfirmDelete(null)
              }}
              className="cursor-pointer text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#DC2626' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
            >
              Delete scenario
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
