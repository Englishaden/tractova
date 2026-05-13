import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { getAlerts } from '../lib/alertHelpers'

const LAYOUT_STORAGE_KEY = 'tractova_library_view'
const PAGE_SIZE_KEY      = 'tractova_library_page_size'
const VALID_PAGE_SIZES   = [10, 25, 50, 100]

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
function loadPageSize() {
  try {
    const v = typeof window !== 'undefined' ? parseInt(localStorage.getItem(PAGE_SIZE_KEY), 10) : NaN
    return VALID_PAGE_SIZES.includes(v) ? v : 25
  } catch { return 25 }
}
function savePageSize(n) {
  try { localStorage.setItem(PAGE_SIZE_KEY, String(n)) } catch { /* silent */ }
}

// Owns the Library page's view-state stack: filters, sort, top-level
// tab (Projects / Scenarios / Comparisons), layout (cards / table /
// map), pagination, the map's drawer, and the URL-flag escape hatches
// (?tab, ?all, ?preview). Computes displayProjects (filtered + sorted)
// and pagedProjects (windowed) so the page just renders.
//
// Extracted from src/pages/Library.jsx — that file was 1500+ LOC after
// Phase 2C; keeping view-state separate from data-state + bulk-state
// makes the page tractable. `projects`, `stateProgramMap`, and
// `countyDataMap` come from the page (data-state); this hook owns
// everything downstream.
export function useLibraryLayout(projects, stateProgramMap, countyDataMap) {
  // URL flags — sampled once at hook init; the page reloads if the
  // user changes them, so we don't bother subscribing.
  const previewEmpty = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'empty'
  const showAllOverride = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('all') === '1'

  const [sortBy,           setSortBy]           = useState('saved')    // saved|score|mw|alerts
  const [filterState,      setFilterState]      = useState('')
  const [filterTech,       setFilterTech]       = useState('')
  const [filterStage,      setFilterStage]      = useState('')
  const [pipelineExpanded, setPipelineExpanded] = useState(false)
  const [viewMode,         setViewMode]         = useState('projects') // 'projects' | 'scenarios' | 'comparisons'
  const [layout,           setLayoutState]      = useState(loadLayout) // 'cards' | 'table' | 'map'
  const [drawerProject,    setDrawerProject]    = useState(null)       // map-pin → slide-in
  const [pageSize,         setPageSizeState]    = useState(loadPageSize)
  const [page,             setPage]             = useState(1)

  const setLayout = useCallback((next) => { setLayoutState(next); saveLayout(next) }, [])
  const setPageSize = useCallback((n) => {
    setPageSizeState(n)
    savePageSize(n)
    setPage(1)  // reset so the user always sees the top of the new window
  }, [])

  // ?tab=scenarios | ?tab=comparisons URL handling so external links
  // (e.g. the "view in Library →" confirmation card in ScenarioStudio)
  // can land directly on a non-default tab. Only applies on mount.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'scenarios')   setViewMode('scenarios')
    if (tab === 'comparisons') setViewMode('comparisons')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2B — Esc clears the state filter when the user is in Map
  // view. Only fires when filterState is set, the drawer isn't open
  // (Radix Dialog's Esc handler takes precedence there), and the
  // layout is Map (so Esc doesn't surprise users reading Cards/Table).
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

  // V3 fix: sort-by-score uses the SAME inputs as the card display
  // (state map + countyData + stage + technology). Previously sort
  // passed null for countyData while cards passed real data, so a
  // card showing "84" could sort below a card showing "76".
  const liveScoreFor = useCallback((p) => {
    const sp = stateProgramMap[p.state]
    if (!sp) return -1
    const cd = countyDataMap[`${p.state}::${p.county}`] || null
    const subs = computeSubScores(sp, cd, p.stage, p.technology)
    return safeScore(subs.offtake, subs.ix, subs.site)
  }, [stateProgramMap, countyDataMap])

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
  }, [projects, filterState, filterTech, filterStage, sortBy, stateProgramMap, countyDataMap, liveScoreFor])

  // Reset to page 1 when the filtered list changes shape — otherwise a
  // user on page 3 of 100 who applies a filter that yields 8 results
  // ends up looking at an empty page 3.
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

  // Clamp page when displayProjects shrinks below the current window.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayProjects.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [displayProjects.length, pageSize, page])

  return {
    // Filters
    sortBy, setSortBy,
    filterState, setFilterState,
    filterTech, setFilterTech,
    filterStage, setFilterStage,
    pipelineExpanded, setPipelineExpanded,
    // Top-level tab
    viewMode, setViewMode,
    // Layout
    layout, setLayout,
    // Map drawer
    drawerProject, setDrawerProject,
    // Pagination
    pageSize, setPageSize,
    page, setPage,
    // URL flags
    showAllOverride,
    previewEmpty,
    // Derived
    displayProjects,
    pagedProjects,
    liveScoreFor,
  }
}
