import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { scoreProjectFromMaps } from '../lib/scoreEngine'
import { getAlerts } from '../lib/alertHelpers'
import { axesFromTechnology, normalizeStructure } from '../lib/lensFormConstants'

// A saved project's monetization structure — the real column post-migration 069,
// falling back to deriving it from the legacy technology label. normalizeStructure
// folds the pre-2026-05-24 'C&I behind-the-meter' label into canonical 'C&I Solar'
// so legacy rows don't split the filter into two C&I buckets.
const structureOf = (p) => normalizeStructure(p.structure || axesFromTechnology(p.technology).structure)

const LAYOUT_STORAGE_KEY = 'tractova_library_view'
const PAGE_SIZE_KEY      = 'tractova_library_page_size'
const VALID_PAGE_SIZES   = [10, 25, 50, 100]

function loadLayout() {
  // Board-first (Pass 6): default to the kanban board when the user has no
  // stored preference; honour their stored choice (cards/table/map/board) otherwise.
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_STORAGE_KEY) : null
    if (v === 'cards' || v === 'table' || v === 'map' || v === 'board') return v
    return 'board'
  } catch { return 'board' }
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
export function useLibraryLayout(projects, stateProgramMap, countyDataMap, incentivesMap = {}, policyEventsMap = {}) {
  // URL flags — sampled once at hook init; the page reloads if the
  // user changes them, so we don't bother subscribing.
  const previewEmpty = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'empty'
  const showAllOverride = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('all') === '1'

  const [sortBy,           setSortBy]           = useState('saved')    // saved|score|mw|alerts|followup
  const [search,           setSearch]           = useState('')         // desktop free-text (name/county/state/tech/tags)
  const [filterState,      setFilterState]      = useState('')
  const [filterStructure,  setFilterStructure]  = useState('')
  const [filterStage,      setFilterStage]      = useState('')
  const [filterTags,       setFilterTags]       = useState([])         // AND-match against project.tags
  const [pipelineExpanded, setPipelineExpanded] = useState(false)
  // Pass 6 sub-tabs: 'pipeline' (deal board/list) | 'intelligence' (analytics) |
  // 'comparisons'. Synced to the ?view= URL param (deep-link + back/forward).
  const [viewMode,         setViewModeState]    = useState('pipeline')
  const [layout,           setLayoutState]      = useState(loadLayout) // 'board' | 'cards' | 'table' | 'map'
  const [drawerProject,    setDrawerProject]    = useState(null)       // map-pin → slide-in
  const [pageSize,         setPageSizeState]    = useState(loadPageSize)
  const [page,             setPage]             = useState(1)

  const setLayout = useCallback((next) => { setLayoutState(next); saveLayout(next) }, [])
  const setPageSize = useCallback((n) => {
    setPageSizeState(n)
    savePageSize(n)
    setPage(1)  // reset so the user always sees the top of the new window
  }, [])

  // Sub-tab ↔ URL sync (mirrors the Dashboard ?tab= pattern). Read ?view= on
  // mount; setViewMode writes it back so deep-links + browser back/forward work.
  // Legacy ?tab=comparisons still lands on Comparisons.
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_VIEWS = ['pipeline', 'intelligence', 'comparisons']
  useEffect(() => {
    const v = searchParams.get('view')
    if (VALID_VIEWS.includes(v)) setViewModeState(v)
    else if (searchParams.get('tab') === 'comparisons') setViewModeState('comparisons')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const setViewMode = useCallback((v) => {
    setViewModeState(v)
    const next = new URLSearchParams(window.location.search)
    if (v === 'pipeline') next.delete('view')   // default view = clean URL
    else next.set('view', v)
    next.delete('tab')                           // retire the legacy param
    setSearchParams(next, { replace: false })
  }, [setSearchParams])

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

  // V3 fix: sort-by-score uses the SAME canonical helper as the card display
  // (scoreProjectFromMaps — all 5 pillars off the same lookup maps), so a card
  // showing "84" never sorts below a card showing "76". Previously this passed
  // null for countyData AND omitted incentives/policy, so the sort order could
  // disagree with the visible scores once the parity maps populated.
  const liveScoreFor = useCallback((p) => {
    const { score } = scoreProjectFromMaps(p, { stateProgramMap, countyDataMap, incentivesMap, policyEventsMap })
    return score == null ? -1 : score
  }, [stateProgramMap, countyDataMap, incentivesMap, policyEventsMap])

  const displayProjects = useMemo(() => {
    let filtered = projects
    if (filterState) filtered = filtered.filter(p => p.state === filterState)
    if (filterStructure) filtered = filtered.filter(p => structureOf(p) === filterStructure)
    if (filterStage) filtered = filtered.filter(p => p.stage === filterStage)
    // Tag filter — AND semantics (project must carry every selected tag), so
    // narrowing by multiple tags drills in rather than widening the set.
    if (filterTags.length) filtered = filtered.filter(p => filterTags.every(t => (p.tags || []).includes(t)))
    // Free-text search — same client-side approach as MobileLibrary, over the
    // already-fetched rows. Matches name / county / state(+name) / technology /
    // tags so one box finds a deal however the user remembers it.
    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(p => {
        const hay = [p.name, p.county, p.state, p.stateName, p.technology, ...(p.tags || [])]
          .filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score')  return liveScoreFor(b) - liveScoreFor(a)
      if (sortBy === 'mw')     return (parseFloat(b.mw) || 0) - (parseFloat(a.mw) || 0)
      if (sortBy === 'alerts') return getAlerts(b, stateProgramMap, countyDataMap, incentivesMap, policyEventsMap).length - getAlerts(a, stateProgramMap, countyDataMap, incentivesMap, policyEventsMap).length
      // followup — soonest open next-action first; projects with no follow-up
      // sink to the bottom (Infinity), then break ties by most-recently saved.
      if (sortBy === 'followup') {
        const fa = a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity
        const fb = b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity
        if (fa !== fb) return fa - fb
        return new Date(b.savedAt) - new Date(a.savedAt)
      }
      return new Date(b.savedAt) - new Date(a.savedAt)
    })
  }, [projects, filterState, filterStructure, filterStage, filterTags, search, sortBy, stateProgramMap, countyDataMap, incentivesMap, policyEventsMap, liveScoreFor])

  // Reset to page 1 when the filtered list changes shape — otherwise a
  // user on page 3 of 100 who applies a filter that yields 8 results
  // ends up looking at an empty page 3.
  useEffect(() => {
    setPage(1)
  }, [filterState, filterStructure, filterStage, filterTags, search, sortBy])

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

  // Unique tags across the portfolio — powers the command-bar tag filter and
  // the saved-views restore. Sorted for stable menu order.
  const allTags = useMemo(() => {
    const set = new Set()
    for (const p of projects) for (const t of (p.tags || [])) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [projects])

  const activeFilterCount =
    (filterState ? 1 : 0) + (filterStructure ? 1 : 0) + (filterStage ? 1 : 0) +
    filterTags.length + (search.trim() ? 1 : 0)

  return {
    // Filters
    sortBy, setSortBy,
    search, setSearch,
    filterState, setFilterState,
    filterStructure, setFilterStructure,
    filterStage, setFilterStage,
    filterTags, setFilterTags,
    allTags,
    activeFilterCount,
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
