import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useLibraryLayout } from '../hooks/useLibraryLayout'
import { useBulkSelection } from '../hooks/useBulkSelection'
import UpgradePrompt from '../components/UpgradePrompt'
import MountReveal from '../components/ui/MountReveal'
import { getStateProgramMap, getCountyData, getStateProgramDeltas } from '../lib/programData'
import { useDataRefresh } from '../lib/useDataRefresh'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
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
import SavedComparisonsList from '../components/library/SavedComparisonsList.jsx'
import EmptyStateOnboarding from '../components/library/EmptyStateOnboarding.jsx'
import LibraryCommandBar from '../components/library/LibraryCommandBar.jsx'
import PortfolioIntelligence from '../components/library/PortfolioIntelligence.jsx'
import PipelineBoard from '../components/library/PipelineBoard.jsx'
import SavedViewsMenu from '../components/library/SavedViewsMenu.jsx'
import ProjectDrawer from '../components/library/ProjectDrawer.jsx'
import Pagination from '../components/library/Pagination.jsx'
import MobileLibrary from '../components/library/MobileLibrary.jsx'
import { useIsMobile } from '../hooks/useIsMobile'
// PIPELINE_STAGES/SHORT now consumed inside PortfolioIntelligence + LibraryCommandBar.

// LibraryMap + ProjectTable lazily split — default layout is 'cards', so
// Map's heavy payload (react-simple-maps + topojson-client + ~100 KB
// centroids JSON) and Table's per-row chrome (StagePicker, ShareButton,
// scenario chips) only load when the user actually picks the layout.
const LibraryMap   = lazy(() => import('../components/library/LibraryMap.jsx'))
const ProjectTable = lazy(() => import('../components/library/ProjectTable.jsx'))

// Library view-state (layout / filters / sort / pagination / map drawer /
// URL flags) is owned by the useLibraryLayout hook in src/hooks/.
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
    // Pass 5 cockpit columns (migrations 073/074). Null-safe: until those
    // migrations apply, the row lacks these keys and we fall through to the
    // empty/undefined defaults — chips don't render, filters/sorts no-op.
    tags:             Array.isArray(row.tags) ? row.tags : [],
    followUpAt:       row.follow_up_at ?? null,
    followUpNote:     row.follow_up_note ?? '',
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
  'Serving Utility',
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
  // toggle, map, table, bulk-actions, and the Comparisons tab.
  // Paywall still applies — MobileLibrary is rendered after the Pro gate.
  const isMobile = useIsMobile()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="Library" />
  if (isMobile)   return <MobileLibrary />
  return <LibraryContent />
}

function LibraryContent() {
  const { user, loading: authLoading } = useAuth()
  // Data state — fetched from Supabase. View-state (layout, filters,
  // sort, pagination, map drawer, URL flags) lives in useLibraryLayout.
  const [projects,        setProjects]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [hasFetched,      setHasFetched]      = useState(false)
  const [error,           setError]           = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(null)
  const { add: addToCompare, items: compareItems, MAX_ITEMS: COMPARE_MAX } = useCompare()
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [stateDeltaMap,   setStateDeltaMap]   = useState(new Map()) // state_id -> { delta, prevScore, latestAt, ... }
  const [countyDataMap,   setCountyDataMap]   = useState({}) // key `${state}::${county}` -> countyData
  const [shareCountMap,   setShareCountMap]   = useState({})         // project_id -> int (active, non-expired tokens)
  const [savedComparisonsCount, setSavedComparisonsCount] = useState(0) // count for the Comparisons tab's "· N" badge

  // View-state stack — owns filters, sort, viewMode (Projects/Scenarios/
  // Comparisons), layout (cards/table/map), pageSize/page, drawerProject,
  // and the URL escape hatches (?preview=empty, ?all=1, ?tab=). Also
  // derives displayProjects (filtered + sorted) and pagedProjects
  // (windowed) so the page just renders.
  const {
    sortBy, setSortBy,
    search, setSearch,
    filterState, setFilterState,
    filterStructure, setFilterStructure,
    filterStage, setFilterStage,
    filterTags, setFilterTags,
    allTags, activeFilterCount,
    viewMode, setViewMode,
    layout, setLayout: handleLayoutChange,
    drawerProject, setDrawerProject,
    pageSize, setPageSize: handlePageSizeChange,
    page, setPage,
    showAllOverride,
    previewEmpty,
    displayProjects,
    pagedProjects,
  } = useLibraryLayout(projects, stateProgramMap, countyDataMap)

  // Bulk-operations state — selected project IDs (Set), toggle/clear/
  // selectAll actions, allSelected derived flag, and the bulk-delete
  // confirm modal pair. Cleared after any bulk op completes (delete /
  // export / add-to-compare). The bulk *handlers* live below this hook
  // — they need external context (supabase, exportXLSX, useCompare)
  // that doesn't belong in a generic selection hook.
  const {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    clearSelection,
    selectAll: handleSelectAll,
    allSelected,
    bulkConfirm,
    setBulkConfirm,
  } = useBulkSelection(displayProjects)

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

  // Freshness signal — unified with Dashboard / Footer / Admin via the shared
  // useDataRefresh hook (max(cron_runs.finished_at WHERE status='success')).
  // The hook re-fetches on the admin Refresh broadcast / window focus / poll,
  // so the caption tracks a refresh across the platform, not only on reload.
  const refreshAt = useDataRefresh()
  const lastRefresh = useMemo(() => {
    if (!refreshAt) return null
    const ageDays = Math.floor((Date.now() - new Date(refreshAt).getTime()) / 86400000)
    return {
      date:    new Date(refreshAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      ageDays,
      isStale: ageDays > 14,
    }
  }, [refreshAt])

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
          const liveScore = safeScore(subs)
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
      const newScore = safeScore(subs)
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

  // Pass 5 Wave 2 — bubble tag / follow-up edits from any card surface back
  // into the projects array so the command-bar tag filter, the 'Due' sort, and
  // the PortfolioIntelligence "due this week" roll-up update live (persistence
  // happens inside ProjectCard). Mirrors the handleStageChange pattern.
  const handleTagsChange = useCallback((id, tags) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, tags } : p))
  }, [])
  const handleFollowUpChange = useCallback((id, { followUpAt, followUpNote }) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, followUpAt, followUpNote } : p))
  }, [])

  const handleRequestRemove = (id, name) => setConfirmRemove({ id, name })

  const handleConfirmRemove = async () => {
    const { error } = await supabase.from('projects').delete().eq('id', confirmRemove.id)
    if (!error) setProjects((prev) => prev.filter((p) => p.id !== confirmRemove.id))
    setConfirmRemove(null)
  }

  // ── Bulk-operation handlers ────────────────────────────────────────────────
  // Selection state + toggle/clear/selectAll live in useBulkSelection.
  // The handlers below run on `selectedIds` from that hook.

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
        <MountReveal delay={0}>
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
              {/* Subline is brand-only — the projects/MW/alerts numbers live in
                  the Portfolio Intelligence drawer below (no triple-count). */}
              <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {projects.length > 0
                  ? 'Tracked, scored, and monitored for policy changes.'
                  : 'Your saved deals — tracked, scored, and monitored for policy changes.'}
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
        </MountReveal>

        {/* Portfolio intelligence — consolidated overview drawer (Pass 5 Wave 1).
            The former stat-strip + pipeline-distribution + recent-updates +
            weekly-summary blocks now live in this ONE collapsible surface
            (src/components/library/PortfolioIntelligence.jsx). It self-hides
            when there are no projects, so the guard is just for loading /
            ?preview=empty. */}
        {viewMode === 'projects' && !loading && !previewEmpty && (
          <PortfolioIntelligence
            projects={projects}
            stateProgramMap={stateProgramMap}
            countyDataMap={countyDataMap}
            stateDeltaMap={stateDeltaMap}
            filterStage={filterStage}
            setFilterStage={setFilterStage}
          />
        )}

        {/* View toggle — Projects vs Comparisons. (Scenarios removed
            2026-06-04 — financial/scenario modeling is out of the product;
            feasibility $ stays behind the scenes in policy/card calcs.) */}
        {(projects.length > 0 || savedComparisonsCount > 0) && (
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
            {/* Command bar — the single control surface (search · filters ·
                tags · saved-views slot · sort · layout). Consolidated in Pass 5
                Wave 1; the former filter strip + view toggle lived here as two
                separate rows. The portfolio roll-up that used to sit here moved
                into the PortfolioIntelligence drawer above. */}
            <LibraryCommandBar
              projects={projects}
              search={search} setSearch={setSearch}
              filterState={filterState} setFilterState={setFilterState}
              filterStructure={filterStructure} setFilterStructure={setFilterStructure}
              filterStage={filterStage} setFilterStage={setFilterStage}
              filterTags={filterTags} setFilterTags={setFilterTags} allTags={allTags}
              sortBy={sortBy} setSortBy={setSortBy}
              layout={layout} onLayoutChange={handleLayoutChange} count={displayProjects.length}
              activeFilterCount={activeFilterCount}
              onClearAll={() => { setFilterState(''); setFilterStructure(''); setFilterStage(''); setFilterTags([]); setSearch('') }}
              selectAllSlot={
                selectedIds.size === 0 && displayProjects.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    title="Select all for bulk export, compare, or delete"
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
                    style={{ color: '#0F766E', background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.22)' }}
                  >
                    <span className="w-3 h-3 rounded-sm border flex items-center justify-center" style={{ borderColor: 'rgba(15,118,110,0.4)' }} aria-hidden="true" />
                    Select all {displayProjects.length}
                  </button>
                ) : null
              }
              savedViewsSlot={
                <SavedViewsMenu
                  currentView={{ filterState, filterStructure, filterStage, tags: filterTags, search, sortBy }}
                  canSave={activeFilterCount > 0}
                  onApply={(f) => {
                    setFilterState(f.filterState || '')
                    setFilterStructure(f.filterStructure || '')
                    setFilterStage(f.filterStage || '')
                    setFilterTags(Array.isArray(f.tags) ? f.tags : [])
                    setSearch(f.search || '')
                    setSortBy(f.sortBy || 'saved')
                  }}
                />
              }
            />

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
                    shareCountMap={shareCountMap}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onStageChange={handleStageChange}
                    onTagsChange={handleTagsChange}
                    onFollowUpChange={handleFollowUpChange}
                    onRequestRemove={handleRequestRemove}
                    onShareSuccess={(id) => setShareCountMap(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))}
                  />
                </Suspense>
              ) : layout === 'board' ? (
                /* Wave 3 — kanban deal board. Renders ALL filtered projects
                   (un-paginated, like Map); drag a card to advance its stage.
                   Card click opens the same ProjectDrawer the map pins use. */
                <PipelineBoard
                  projects={displayProjects}
                  stateProgramMap={stateProgramMap}
                  countyDataMap={countyDataMap}
                  onStageChange={handleStageChange}
                  onCardClick={(p) => setDrawerProject(p)}
                />
              ) : (
              <MountReveal delay={0.24}>
              <div className="grid gap-3">
                {pagedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onRequestRemove={handleRequestRemove}
                    onStageChange={handleStageChange}
                    onTagsChange={handleTagsChange}
                    onFollowUpChange={handleFollowUpChange}
                    stateProgramMap={stateProgramMap}
                    countyDataMap={countyDataMap}
                    stateDelta={stateDeltaMap?.get?.(p.state) || null}
                    shareCount={shareCountMap[p.id] || 0}
                    onShareSuccess={() => setShareCountMap(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                    selectionActive={displayProjects.length > 1}
                  />
                ))}
              </div>
              </MountReveal>
              )}
              {/* Pagination strip — Cards / Table only. Skipped in Map + Board
                  views, which render every filtered project at once (pins /
                  columns); pagination is a list-view affordance. */}
              {layout !== 'map' && layout !== 'board' && !showAllOverride && displayProjects.length > 0 && (
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
                  onClick={() => { setFilterState(''); setFilterStructure(''); setFilterStage('') }}
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
            This will permanently delete <span className="font-semibold text-ink">{selectedIds.size}</span> project{selectedIds.size === 1 ? '' : 's'} from your Library. Share links and alert history for these projects will also be removed. This cannot be undone.
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
        shareCountMap={shareCountMap}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onStageChange={handleStageChange}
        onTagsChange={handleTagsChange}
        onFollowUpChange={handleFollowUpChange}
        onRequestRemove={handleRequestRemove}
        onShareSuccess={(id) => setShareCountMap(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))}
      />
    </div>
  )
}
