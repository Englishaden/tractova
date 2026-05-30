import { useState, useEffect, useMemo, useCallback } from 'react'
import MetricsBar from '../MetricsBar'
import IntelligenceFeedCard from '../IntelligenceFeedCard'
import StateDetailPanel from '../StateDetailPanel'
import DashboardGlobe from '../DashboardGlobe'
import MarketFiltersRail from '../MarketFiltersRail'
// MarketBrief temporarily hidden — see Dashboard.jsx history.
// import MarketBrief from '../MarketBrief'
import { getStateProgramMap, getNewsFeed, getStateProgramDeltas } from '../../lib/programData'
import MountReveal from '../ui/MountReveal'

// HomeTab — the Dashboard's primary surface. Absorbs the Ship 1.8 hero
// (MarketFiltersRail | DashboardGlobe | IntelligenceFeedCard/StateDetailPanel)
// plus the KPI strip + Markets on the Move row beneath. Owns its own data
// fetching (state programs / news / deltas) because Analytics and
// Markets&Policy tabs have different data shapes — no shared parent state.
//
// Mobile layout: stacks single-col; the MarketFiltersRail collapses to a
// horizontal chip strip above the map (handled inside MarketFiltersRail).

// V3 §4.1 inline component — Markets on the Move ticker. Ship 2.2: now a
// seamless dash-marquee of EVERY recent mover (was a static top-5 strip
// with a "+N more" truncation). The track holds the chip list duplicated
// so the -50% loop has no visible seam; hovering reverses direction
// (Defillama trick) rather than pausing. CSS lives in index.css
// (.dash-marquee / .dash-marquee-container).
const formatAgo = (ts) => {
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7)   return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function MoverChip({ s, onStateClick, ariaHidden }) {
  const score = s.feasibilityScore ?? 0
  const deltaColor = s.delta > 0 ? '#34D399' : s.delta < 0 ? '#F87171' : 'var(--text-muted)'
  return (
    <button
      onClick={() => onStateClick(s.id)}
      aria-hidden={ariaHidden ? 'true' : undefined}
      tabIndex={ariaHidden ? -1 : 0}
      className="group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all shrink-0"
      style={{ background: 'transparent', border: '1px solid var(--cards-border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.06)'; e.currentTarget.style.borderColor = 'var(--hairline-teal)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--cards-border)' }}
    >
      <span className="text-sm font-semibold leading-none whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
      <span className="font-mono text-[11px] font-bold tabular-nums leading-none" style={{ color: score >= 60 ? '#34D399' : 'var(--text-label)' }}>{score}</span>
      {s.delta !== null && s.delta !== 0 ? (
        <span className="font-mono text-[10px] font-bold tabular-nums leading-none" style={{ color: deltaColor }}>
          {s.delta > 0 ? '↑' : '↓'}{Math.abs(s.delta)}
        </span>
      ) : (
        <span className="font-mono text-[9px] leading-none" style={{ color: 'var(--text-muted)' }}>{formatAgo(s.recencyTs)}</span>
      )}
    </button>
  )
}

function MarketsOnTheMove({ stateProgramMap, deltaMap, onStateClick }) {
  const { movers, hasDeltas } = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    if (!states.length) return { movers: [], hasDeltas: false }
    const now = Date.now()
    const recent = states
      .filter(s => s.csStatus && s.csStatus !== 'none')
      .map(s => {
        const v = s.lastVerified ? new Date(s.lastVerified).getTime() : 0
        const u = s.updatedAt   ? new Date(s.updatedAt).getTime()   : 0
        const d = deltaMap?.get?.(s.id) || null
        return { ...s, recencyTs: Math.max(v, u), delta: d?.delta ?? null }
      })
      .filter(s => s.recencyTs > 0 && (now - s.recencyTs) < 1000 * 60 * 60 * 24 * 30)

    const deltasPresent = recent.some(s => s.delta !== null && s.delta !== 0)
    const sorted = deltasPresent
      ? recent.slice().sort((a, b) => {
          if (a.delta !== null && b.delta === null) return -1
          if (a.delta === null && b.delta !== null) return 1
          if (a.delta !== null && b.delta !== null) return Math.abs(b.delta) - Math.abs(a.delta)
          return b.recencyTs - a.recencyTs
        })
      : recent.slice().sort((a, b) => b.recencyTs - a.recencyTs)
    return { movers: sorted, hasDeltas: deltasPresent }
  }, [stateProgramMap, deltaMap])

  if (movers.length === 0) return null

  return (
    <div className="rounded-md px-4 py-2.5" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-semibold" style={{ color: 'var(--link, #5EEAD4)' }}>
            Markets on the Move
          </p>
          <span className="font-mono text-[10px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            · {hasDeltas ? 'WoW score deltas' : 'past 30 days'}
          </span>
        </div>
        <span className="hidden sm:inline-block w-px h-4 shrink-0" style={{ background: 'var(--cards-border)' }} />
        {/* Seamless ticker — chips duplicated so the -50% marquee loop has
            no visible seam. Second copy is aria-hidden + untabbable. */}
        <div className="dash-marquee-container flex-1 min-w-0">
          <div className="dash-marquee">
            {movers.map((s) => (
              <MoverChip key={s.id} s={s} onStateClick={onStateClick} />
            ))}
            {movers.map((s) => (
              <MoverChip key={`dup-${s.id}`} s={s} onStateClick={onStateClick} ariaHidden />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomeTab({ effectivePreviewMode, onDataError }) {
  const [selectedStateId, setSelectedStateId] = useState(null)
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [news, setNews] = useState([])
  const [deltaMap, setDeltaMap] = useState(new Map())
  const [filters, setFilters] = useState({ states: [], utility: '', stage: null, mw: null })
  // Globe phase drives the panel background: aurora behind the idle GLOBE,
  // an infinite grid behind the focused MAP (Aden 2026-05-29 — aurora read
  // fine on the globe but felt wrong flat behind the map).
  const [globePhase, setGlobePhase] = useState('idle')

  const loadDashboardData = useCallback(async () => {
    let failed = []
    const [mapRes, newsRes, deltasRes] = await Promise.allSettled([
      getStateProgramMap(),
      getNewsFeed(),
      getStateProgramDeltas(),
    ])
    if (mapRes.status === 'fulfilled') setStateProgramMap(mapRes.value)
    else                                failed.push('market data')
    if (newsRes.status === 'fulfilled') setNews(newsRes.value)
    else                                failed.push('news')
    if (deltasRes.status === 'fulfilled') {
      const v = deltasRes.value
      setDeltaMap(v instanceof Map ? v : new Map())
    }
    if (failed.length > 0 && onDataError) {
      onDataError(`Couldn't load ${failed.join(' and ')}. Check your connection or retry.`)
    } else if (onDataError) {
      onDataError(null)
    }
  }, [onDataError])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])

  useEffect(() => {
    if (!selectedStateId) return
    const handle = (e) => { if (e.key === 'Escape') setSelectedStateId(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [selectedStateId])

  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null
  const newsSources = useMemo(() => Array.from(new Set(news.map((n) => n.source).filter(Boolean))), [news])

  const filteredNews = useMemo(() => {
    const stateSet = new Set(filters.states || [])
    const utilLC = (filters.utility || '').trim().toLowerCase()
    return news.filter((n) => {
      if (stateSet.size > 0) {
        const itemStates = Array.isArray(n.stateIds) ? n.stateIds : []
        if (!itemStates.some((s) => stateSet.has(s))) return false
      }
      if (utilLC && !(n.source || '').toLowerCase().includes(utilLC)) return false
      return true
    })
  }, [news, filters.states, filters.utility])

  const handleStateClick = (stateId) => setSelectedStateId((prev) => prev === stateId ? null : stateId)
  const handleClosePanel = () => setSelectedStateId(null)

  return (
    <div className="flex flex-col gap-2">
      {/* MarketBrief — temporarily hidden 2026-05-27. Re-enable by uncommenting the import + this block. */}
      {/* <MountReveal delay={0}><MarketBrief stateProgramMap={stateProgramMap} deltaMap={deltaMap} /></MountReveal> */}

      {/* 3-col hero — Filters | Globe/Map | Intelligence Feed (or StateDetailPanel) */}
      <MountReveal delay={0.04}>
        {/* Hero grid resizes when a state is selected: the FILTERS rail
            collapses (2fr→0) and the detail panel grows (4fr→6fr) — the globe
            track stays 6fr of an unchanged total, so the map does NOT shrink
            (Aden 2026-05-29: "without overly shrinking the map in the center").
            The collapse animates via grid-template-columns. */}
        <div
          className="dash-hero-grid gap-2"
          style={{ '--hero-cols': selectedState ? '0fr 6fr 6fr' : '2fr 6fr 4fr' }}
        >
          {/* Filters rail — full width on mobile, first track on lg+.
              min-w-0 + overflow-hidden let the track collapse fully to 0. */}
          <div className="min-w-0 overflow-hidden">
            <MarketFiltersRail
              stateProgramMap={stateProgramMap}
              newsSources={newsSources}
              filters={filters}
              onChange={setFilters}
            />
          </div>

          {/* Map area — full width on mobile, middle track on lg+ */}
          <div
            className="relative rounded-md overflow-hidden min-w-0"
            style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '470px', maxHeight: '600px' }}
          >
            <div className="lp-hero-grid" aria-hidden="true" />
            {/* Aurora — slow GPU-composited (transform-only) drifting blobs.
                Reads well behind the idle GLOBE; crossfades OUT once the view
                focuses into the flat MAP, where it felt wrong (Aden
                2026-05-29). */}
            <div
              className="dash-map-aurora"
              aria-hidden="true"
              style={{ opacity: globePhase === 'idle' ? 1 : 0, transition: 'opacity 700ms ease' }}
            >
              <span className="dash-map-aurora__blob dash-map-aurora__blob--1" />
              <span className="dash-map-aurora__blob dash-map-aurora__blob--2" />
              <span className="dash-map-aurora__blob dash-map-aurora__blob--3" />
            </div>
            {/* Infinite grid — a slow-drifting, edge-masked tech grid that
                gives the focused MAP a radar / command-surface feel without
                fighting the choropleth. Crossfades IN as the globe focuses
                (Aden 2026-05-29: grid background, not aurora, on the map). */}
            <div
              className="dash-map-grid"
              aria-hidden="true"
              style={{ opacity: globePhase === 'idle' ? 0 : 1, transition: 'opacity 700ms ease' }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.08) 0%, rgba(11,22,35,0.55) 78%)' }}
            />
            <div className="relative z-10 w-full h-full">
              <DashboardGlobe
                onStateClick={handleStateClick}
                selectedStateId={selectedStateId}
                stateProgramMap={stateProgramMap}
                deltaMap={deltaMap}
                onPhaseChange={setGlobePhase}
              />
            </div>
          </div>

          {/* Intelligence feed / state detail — full width on mobile, last track on lg+.
              min-w-0 + min-h-0 are both load-bearing. Without min-w-0 a wide
              child (expanded synthesis) grew this track and collapsed the globe
              to 0. Without min-h-0 the track's auto MIN HEIGHT = its content's
              min-content height, so expanding the Market Pulse synthesis grew
              the hero row and pushed the globe DOWN. With min-h-0 (+ minHeight
              0) the track stretches to the map-driven row height and scrolls
              its content internally instead — expand/collapse no longer moves
              the map (Aden 2026-05-30). maxHeight keeps it bounded on very tall
              viewports. */}
          <div className="flex flex-col min-w-0 min-h-0 overflow-hidden" style={{ minHeight: 0, maxHeight: '600px' }}>
            {selectedState ? (
              <StateDetailPanel
                state={selectedState}
                news={filteredNews}
                onClose={handleClosePanel}
                previewMode={effectivePreviewMode}
                delta={deltaMap?.get?.(selectedStateId)?.delta ?? null}
                lensFilters={{ stage: filters.stage, mw: filters.mw }}
              />
            ) : (
              <IntelligenceFeedCard news={filteredNews} />
            )}
          </div>
        </div>
      </MountReveal>

      {/* KPI strip */}
      <MountReveal delay={0.08}>
        <MetricsBar previewMode={effectivePreviewMode} />
      </MountReveal>

      {/* Markets on the Move */}
      <MountReveal delay={0.12}>
        <MarketsOnTheMove stateProgramMap={stateProgramMap} deltaMap={deltaMap} onStateClick={handleStateClick} />
      </MountReveal>
    </div>
  )
}
