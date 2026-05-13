import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import FilterSelect from '../components/ui/FilterSelect'
import { TECH_FILTER_TOOLTIPS } from '../lib/techDefinitions'
import { getStateProgramMap, getCountyData, getStateProgramDeltas } from '../lib/programData'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { convertOrphanGroupToProject } from '../lib/orphanConversion'
import { useCompare, libraryProjectToCompareItem } from '../context/CompareContext'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/Dialog'
import { logProjectEvent } from '../lib/projectEvents'
// Decorative-only — lazy so they don't block the Library hero's LCP.
// IntelligenceBackground is an animated SVG/CSS layer; WalkingTractovaMark
// is a probabilistic easter egg (triggerProbability=0.25). Both render
// behind / over the page chrome and contribute nothing to first paint.
const IntelligenceBackground = lazy(() => import('../components/IntelligenceBackground'))
const WalkingTractovaMark   = lazy(() => import('../components/WalkingTractovaMark'))
import { getAlerts } from '../lib/alertHelpers'
import { buildExportRows, buildMethodologySheet, buildGlossarySheet } from '../lib/exportHelpers'
import ProjectCard from '../components/ProjectCard.jsx'
import ScenariosView from '../components/ScenariosView.jsx'
import SavedComparisonsList from '../components/library/SavedComparisonsList.jsx'
import WeeklySummaryCard from '../components/library/WeeklySummaryCard.jsx'
import EmptyStateOnboarding from '../components/library/EmptyStateOnboarding.jsx'
import LibraryToolbar from '../components/library/LibraryToolbar.jsx'
import ProjectDrawer from '../components/library/ProjectDrawer.jsx'
import Pagination from '../components/library/Pagination.jsx'
import MobileLibrary from '../components/library/MobileLibrary.jsx'
import { useIsMobile } from '../hooks/useIsMobile'

// LibraryMap + ProjectTable lazily split — default layout is 'cards', so
// Map's heavy payload (react-simple-maps + topojson-client + ~100 KB
// centroids JSON) and Table's per-row chrome (StagePicker, ShareButton,
// scenario chips) only load when the user actually picks the layout.
const LibraryMap   = lazy(() => import('../components/library/LibraryMap.jsx'))
const ProjectTable = lazy(() => import('../components/library/ProjectTable.jsx'))
import { PIPELINE_STAGES, PIPELINE_SHORT } from '../components/library/PipelineProgress.jsx'

// Phase 2A · TRACTOVA-UX-001 — Library layout (cards | table | map) is
// persisted per user across sessions in localStorage. Map is gated until
// Phase 2B ships; only 'cards' and 'table' are valid runtime values.
const LAYOUT_STORAGE_KEY = 'tractova_library_view'
function loadLayout() {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_STORAGE_KEY) : null
    if (v === 'table' || v === 'map') return v
    return 'cards'
  } catch { return 'cards' }
}
function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_STORAGE_KEY, layout) } catch { /* quota / SSR — silent */ }
}

// Page-size persistence for client-side pagination. Valid sizes: 25, 50,
// 100. Hidden ?all=1 URL flag bypasses pagination entirely (power-user
// escape hatch).
const PAGE_SIZE_KEY = 'tractova_library_page_size'
const VALID_PAGE_SIZES = [10, 25, 50, 100]
function loadPageSize() {
  try {
    const v = typeof window !== 'undefined' ? parseInt(localStorage.getItem(PAGE_SIZE_KEY), 10) : NaN
    return VALID_PAGE_SIZES.includes(v) ? v : 25
  } catch { return 25 }
}
function savePageSize(n) {
  try { localStorage.setItem(PAGE_SIZE_KEY, String(n)) } catch { /* silent */ }
}
// ProjectPDFExport is lazy-loaded on first click — keeps initial bundle lean

// ── Tech badge styles ────────────────────────────────────────────────────────
const TECH_BADGE = {
  'Community Solar': 'bg-teal-50 text-teal-800 border-teal-200',
  'C&I Solar':       'bg-blue-50 text-blue-700 border-blue-200',
  'BESS':            'bg-accent-50 text-accent-700 border-accent-200',
  'Hybrid':          'bg-purple-50 text-purple-700 border-purple-200',
}

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

// ── IX difficulty display ────────────────────────────────────────────────────
export const IX_STYLES = {
  easy:      'bg-teal-50 text-teal-800 border-teal-200',
  moderate:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  hard:      'bg-orange-50 text-orange-700 border-orange-200',
  very_hard: 'bg-red-50 text-red-700 border-red-200',
}
// IX_LABEL + CS_STATUS_LABEL re-exported from src/lib/statusMaps.js (the
// single source of truth for these maps). Re-export keeps existing
// imports from this module (e.g. ProjectCard.jsx) working unchanged.
export { IX_LABEL, CS_STATUS_LABEL } from '../lib/statusMaps.js'

// ── CS status display ────────────────────────────────────────────────────────
export const CS_STATUS_STYLES = {
  active:  'bg-teal-50 text-teal-800 border-teal-200',
  limited: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  none:    'bg-red-50 text-red-700 border-red-200',
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

// ── Paywall gate ─────────────────────────────────────────────────────────────
export default function Library() {
  const { isPro, loading: subLoading } = useSubscription()
  // Mobile gets a cards-only view that drops the desktop toolbar, view
  // toggle, map, table, bulk-actions, and Comparisons/Scenarios tabs.
  // Paywall still applies — MobileLibrary is rendered after the Pro gate.
  const isMobile = useIsMobile()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="Library" />
  if (isMobile)   return <MobileLibrary />
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
  const [savedComparisonsCount, setSavedComparisonsCount] = useState(0) // count for the Comparisons tab's "· N" badge
  const [viewMode,        setViewMode]        = useState('projects') // 'projects' | 'scenarios' | 'comparisons' — top-level toggle
  const [layout,          setLayoutState]     = useState(loadLayout)   // 'cards' | 'table' | 'map' — Phase 2A + 2B
  const handleLayoutChange = useCallback((next) => { setLayoutState(next); saveLayout(next) }, [])

  // Phase 2B — pin-click → ProjectDrawer. drawerProject is the project
  // object to render in the slide-in panel; null when closed. Click a
  // pin in LibraryMap to open; close via Esc / outside-click / X button.
  const [drawerProject, setDrawerProject] = useState(null)

  // Phase 2B — Esc clears the state filter when the user is in Map
  // view. Only fires when filterState is set, the drawer isn't open
  // (Radix Dialog's Esc handler takes precedence and stops propagation
  // there), and the user is in the Map layout (so Esc doesn't
  // unexpectedly clear filters when reading the Cards / Table list).
  useEffect(() => {
    if (!filterState || layout !== 'map' || drawerProject) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFilterState('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filterState, layout, drawerProject])

  // Client-side pagination state — windows the rendered project list.
  // Data fetch stays unbounded because the Pipeline Distribution +
  // stat strip + score-change audit all need the full set. Hidden
  // ?all=1 URL flag bypasses windowing for power users.
  const showAllOverride = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('all') === '1'
  const [pageSize, setPageSizeState] = useState(loadPageSize)
  const [page, setPage] = useState(1)
  const handlePageSizeChange = useCallback((n) => {
    setPageSizeState(n)
    savePageSize(n)
    setPage(1)  // reset to first page so the user always sees the top of the list
  }, [])

  // ?tab=scenarios URL handling so external links (e.g. the "view in Library →"
  // confirmation card in ScenarioStudio) can land directly on the Scenarios
  // tab. Only applies on mount; in-page toggle still drives state afterwards.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'scenarios')   setViewMode('scenarios')
    if (tab === 'comparisons') setViewMode('comparisons')
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

  // Freshness signal — unified with Dashboard / Footer / Admin on the
  // /api/data-health?action=last-refresh endpoint (max(cron_runs.finished_at)
  // where status='success'). Previously this was a local useMemo over
  // state_programs.last_verified|updated_at, which drifted from the other
  // surfaces whenever the weekly cron ran successfully but the source
  // identical content (no row changes → local signal stays stale even
  // though the platform refreshed). Single source of truth across surfaces.
  const [lastRefresh, setLastRefresh] = useState(null)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let cancelled = false
    fetch('/api/data-health?action=last-refresh')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (!data?.finishedAt) return
        const ageDays = Math.floor((Date.now() - new Date(data.finishedAt).getTime()) / 86400000)
        setLastRefresh({
          date:    new Date(data.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          ageDays,
          isStale: ageDays > 14,
        })
      })
      .catch(err => console.warn('[Library] last-refresh fetch failed:', err))
    return () => { cancelled = true }
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

  // Saved-comparisons count powers the Comparisons tab's "· N" badge.
  // One head-only count query (cheap). Refetched on a window event so
  // Save (CompareTray) / Delete (SavedComparisonsList) keep it accurate
  // without prop-drilling a setter through two components.
  useEffect(() => {
    if (!user) { setSavedComparisonsCount(0); return }
    let cancelled = false
    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('saved_comparisons')
          .select('*', { count: 'exact', head: true })
        if (cancelled) return
        if (!error && count != null) setSavedComparisonsCount(count)
      } catch { /* table missing or RLS denial — silent */ }
    }
    fetchCount()
    const onChange = () => fetchCount()
    window.addEventListener('tractova:saved-comparisons-changed', onChange)
    return () => { cancelled = true; window.removeEventListener('tractova:saved-comparisons-changed', onChange) }
  }, [user])

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

  // Reset to page 1 when the filtered list changes shape — otherwise a
  // user on page 3 of 100 who applies a filter that yields 8 results
  // ends up looking at an empty page 3. Triggers on filter/sort changes.
  useEffect(() => {
    setPage(1)
  }, [filterState, filterTech, filterStage, sortBy])

  // Windowed projects for rendering. Stat strip + Pipeline Distribution
  // still use the full `displayProjects` (and `projects`) so portfolio-
  // level intelligence is never windowed. ?all=1 bypasses the window.
  const pagedProjects = useMemo(() => {
    if (showAllOverride) return displayProjects
    const start = (page - 1) * pageSize
    return displayProjects.slice(start, start + pageSize)
  }, [displayProjects, page, pageSize, showAllOverride])

  // Clamp page when displayProjects shrinks below the current window
  // (e.g. user is on page 5, then a filter reduces total to 12 results —
  // page 5 would render nothing; jump to the last valid page instead).
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayProjects.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [displayProjects.length, pageSize, page])

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
      {/* Decorative layers — render after the hero paints, never
          block LCP. fallback={null} means the page mounts immediately
          and the dot field / mark fade in once their chunks arrive. */}
      <Suspense fallback={null}>
        <IntelligenceBackground />
        <WalkingTractovaMark triggerProbability={0.25} sessionGate={true} />
      </Suspense>

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

              {/* Filter + sort bar relocated to sit directly above the
                  LibraryToolbar (below WeeklySummaryCard + SectionDivider)
                  so the control strip is adjacent to the project list it
                  drives. Previously bifurcated by the portfolio-intelligence
                  block — user feedback 2026-05-11 Phase 2A polish. */}
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
            <button
              type="button"
              onClick={() => setViewMode('comparisons')}
              className="cursor-pointer text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all"
              style={viewMode === 'comparisons'
                ? { background: 'white', color: '#0F1A2E', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                : { background: 'transparent', color: '#6B7280' }}
            >
              Comparisons {savedComparisonsCount > 0 && <span className="font-mono opacity-60">· {savedComparisonsCount}</span>}
            </button>
          </div>
        )}

        {/* Saved comparisons — Phase 2C tab. Component owns its own fetch
            so Library doesn't pay a second Supabase round-trip on every
            load when most users land on Projects. */}
        {viewMode === 'comparisons' && !loading && (
          <SavedComparisonsList />
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
            onConvertOrphan={async (group) => {
              // Phase 2C — orphan → project. Supabase logic lives in
              // `lib/orphanConversion.js`; Library handles optimistic UI.
              if (!user || !group?.scenarios?.length) return
              const sp = stateProgramMap[group.state] || null
              const cd = countyDataMap[`${group.state}::${group.county}`] || null
              const inserted = await convertOrphanGroupToProject({ group, userId: user.id, stateProgram: sp, countyData: cd })
              if (!inserted) return
              const ids = group.scenarios.map(s => s.id)
              setProjects(prev => [normalize(inserted), ...prev])
              setScenariosMap(prev => ({
                ...prev,
                [inserted.id]: group.scenarios.map(s => ({ ...s, project_id: inserted.id })),
              }))
              setOrphanScenarios(prev => prev.filter(s => !ids.includes(s.id)))
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
            {/* "What Changed" banner — Phase 2A extended with state-move
                counts. The per-card chips that show this (hasDataUpdate
                badge, State ±X pt badge) now persist when cards expand;
                this banner is the portfolio-level roll-up of those same
                signals, visible in both Cards and Table layouts. */}
            {(() => {
              const updatedCount = projects.filter(p => {
                const current = stateProgramMap[p.state]
                return current?.lastUpdated && p.savedAt && new Date(current.lastUpdated) > new Date(p.savedAt)
              }).length
              const alertCount = projects.reduce((n, p) => n + getAlerts(p, stateProgramMap, countyDataMap).length, 0)
              // State moves week-over-week — counts distinct states with a
              // non-zero snapshot delta that we have projects in. Mirrors
              // the per-card "State ±X pt" chip's source data.
              const movedStates = new Set()
              for (const p of projects) {
                const d = stateDeltaMap?.get?.(p.state)
                if (d && d.delta !== 0) movedStates.add(p.state)
              }
              const stateMoveCount = movedStates.size
              if (updatedCount === 0 && alertCount === 0 && stateMoveCount === 0) return null
              return (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 mb-4 flex-wrap"
                  style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.20)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F766E' }} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
                    Recent Updates
                  </p>
                  <span className="text-gray-300">·</span>
                  <p className="text-xs font-medium text-ink">
                    {updatedCount > 0 && <span>{updatedCount} project{updatedCount > 1 ? 's have' : ' has'} updated market data</span>}
                    {updatedCount > 0 && stateMoveCount > 0 && <span className="text-gray-400"> · </span>}
                    {stateMoveCount > 0 && <span>{stateMoveCount} state{stateMoveCount > 1 ? 's' : ''} moved week-over-week</span>}
                    {(updatedCount > 0 || stateMoveCount > 0) && alertCount > 0 && <span className="text-gray-400"> · </span>}
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
              // Phase 4 — sticky offset depends on layout. The Table
              // view's column header sticks at top-14; if this bulk
              // toolbar ALSO stuck at top-14, they would collide on
              // top of each other. In Table mode the toolbar offsets
              // ~52px below the header so both remain readable.
              // Cards / Map layouts have no competing sticky element,
              // so top-14 stays correct.
              <div
                className={`sticky z-20 mb-3 rounded-lg flex items-center justify-between gap-3 px-4 py-2.5 ${layout === 'table' ? 'top-[7rem]' : 'top-14'}`}
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

            {/* Phase 2A · unified control strip — filter + sort + layout
                toggle sit together immediately above the project list so
                the user's eye doesn't have to jump back up to the top of
                the page to filter or re-sort. Previously the filter row
                was rendered above WeeklySummaryCard + SectionDivider,
                visually bifurcating it from the data it drives. */}
            {projects.length > 0 && (
              <div className="mt-2 mb-1 flex items-center gap-2 flex-wrap">
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
            )}

            {/* Phase 2A + 2B · view-mode toolbar — Cards | Table | Map. */}
            {displayProjects.length > 0 && (
              <LibraryToolbar layout={layout} onLayoutChange={handleLayoutChange} count={displayProjects.length} />
            )}

            {displayProjects.length > 0 ? (
              <>
              {layout === 'map' ? (
                /* Phase 2B — Map view. Lazy-loaded; Suspense fallback
                   renders a neutral panel skeleton so the layout
                   doesn't collapse on first switch. Single click on
                   state = toggle the filter (stays on map; misclick
                   safety). Double click on state = force-set the
                   filter AND switch to Table (explicit transition).
                   Pin click → drawer. */
                <Suspense fallback={<div className="rounded-xl border border-gray-200 bg-paper h-[480px] animate-pulse" aria-label="Map view loading" />}>
                  <LibraryMap
                    projects={displayProjects}
                    stateProgramMap={stateProgramMap}
                    countyDataMap={countyDataMap}
                    filterState={filterState}
                    onStateClick={(stateId, hasProjects) => {
                      if (!hasProjects) return
                      setFilterState(prev => prev === stateId ? '' : stateId)
                    }}
                    onStateDoubleClick={(stateId, hasProjects) => {
                      if (!hasProjects) return
                      setFilterState(stateId)
                      handleLayoutChange('table')
                    }}
                    onSwitchToTable={() => handleLayoutChange('table')}
                    onPinClick={(project) => setDrawerProject(project)}
                  />
                </Suspense>
              ) : layout === 'table' ? (
                <Suspense fallback={<div className="rounded-xl border border-gray-200 bg-paper h-[480px] animate-pulse" aria-label="Table view loading" />}>
                  <ProjectTable
                    projects={pagedProjects}
                    stateProgramMap={stateProgramMap}
                    countyDataMap={countyDataMap}
                    stateDeltaMap={stateDeltaMap}
                    scenariosMap={scenariosMap}
                    shareCountMap={shareCountMap}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onStageChange={handleStageChange}
                    onRequestRemove={handleRequestRemove}
                    onShareSuccess={(id) => setShareCountMap(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))}
                    onScenarioDelete={(projectId, snapId) => setScenariosMap(prev => ({
                      ...prev,
                      [projectId]: (prev[projectId] || []).filter(s => s.id !== snapId),
                    }))}
                  />
                </Suspense>
              ) : (
              <div className="grid gap-3">
                {pagedProjects.map((p) => (
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
                    selectionActive={displayProjects.length > 1}
                    scenarios={scenariosMap[p.id] || []}
                    onScenarioDelete={(snapId) => setScenariosMap(prev => ({
                      ...prev,
                      [p.id]: (prev[p.id] || []).filter(s => s.id !== snapId),
                    }))}
                  />
                ))}
              </div>
              )}
              {/* Pagination strip — always visible in Cards / Table when
                  the portfolio has at least one project. Skipped in Map
                  view (the map shows all projects as pins regardless of
                  page; pagination is a list-view affordance). */}
              {layout !== 'map' && !showAllOverride && displayProjects.length > 0 && (
                <Pagination
                  total={displayProjects.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
              </>
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

      {/* Phase 2B — ProjectDrawer slide-in. Triggered by clicking a pin
          in LibraryMap. Lives at the page root so the slide-in animation
          isn't clipped by any ancestor with overflow set. */}
      <ProjectDrawer
        project={drawerProject}
        open={!!drawerProject}
        onOpenChange={(open) => { if (!open) setDrawerProject(null) }}
        stateProgramMap={stateProgramMap}
        countyDataMap={countyDataMap}
        stateDeltaMap={stateDeltaMap}
        scenariosMap={scenariosMap}
        shareCountMap={shareCountMap}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onStageChange={handleStageChange}
        onRequestRemove={handleRequestRemove}
        onShareSuccess={(id) => setShareCountMap(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))}
        onScenarioDelete={(projectId, snapId) => setScenariosMap(prev => ({
          ...prev,
          [projectId]: (prev[projectId] || []).filter(s => s.id !== snapId),
        }))}
      />
    </div>
  )
}
