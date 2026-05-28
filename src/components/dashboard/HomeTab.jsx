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

// V3 §4.1 inline component — Markets on the Move strip. Ship 2 will
// extract + marquee-ify per the plan; for Ship 2.1 it stays inline here.
function MarketsOnTheMove({ stateProgramMap, deltaMap, onStateClick }) {
  const { displayed, overflowCount, hasDeltas } = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    if (!states.length) return { displayed: [], overflowCount: 0, hasDeltas: false }
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
    const top = sorted.slice(0, 5)
    return { displayed: top, overflowCount: Math.max(0, sorted.length - top.length), hasDeltas: deltasPresent }
  }, [stateProgramMap, deltaMap])

  if (displayed.length === 0) return null

  const formatAgo = (ts) => {
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'today'
    if (days === 1) return '1d ago'
    if (days < 7)   return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <div className="rounded-md px-4 py-2.5" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
      <div className="flex items-center gap-3 flex-wrap">
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
        <span className="hidden sm:inline-block w-px h-4" style={{ background: 'var(--cards-border)' }} />
        <div className="flex items-center gap-2 flex-wrap">
          {displayed.map((s) => {
            const score = s.feasibilityScore ?? 0
            const deltaColor = s.delta > 0 ? '#34D399' : s.delta < 0 ? '#F87171' : 'var(--text-muted)'
            return (
              <button
                key={s.id}
                onClick={() => onStateClick(s.id)}
                className="group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all"
                style={{ background: 'transparent', border: '1px solid var(--cards-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.06)'; e.currentTarget.style.borderColor = 'var(--hairline-teal)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--cards-border)' }}
              >
                <span className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
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
          })}
          {overflowCount > 0 && (
            <span className="font-mono text-[10px] px-2 py-1 leading-none" style={{ color: 'var(--text-muted)' }}>
              +{overflowCount} more
            </span>
          )}
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
  const [filters, setFilters] = useState({ states: [], utility: '', stage: null, sizeBucket: null })

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
          {/* Filters rail — full width on mobile, 2/12 on lg+ */}
          <div className="lg:col-span-2 order-1">
            <MarketFiltersRail
              stateProgramMap={stateProgramMap}
              newsSources={newsSources}
              filters={filters}
              onChange={setFilters}
            />
          </div>

          {/* Map area — full width on mobile, 6/12 on lg+ */}
          <div
            className="lg:col-span-6 order-2 relative rounded-md overflow-hidden"
            style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '440px', maxHeight: '560px' }}
          >
            <div className="lp-hero-grid" aria-hidden="true" />
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.10) 0%, rgba(11,22,35,0.65) 75%)' }}
            />
            <div className="relative z-10 w-full h-full">
              <DashboardGlobe
                onStateClick={handleStateClick}
                selectedStateId={selectedStateId}
                stateProgramMap={stateProgramMap}
                deltaMap={deltaMap}
              />
            </div>
          </div>

          {/* Intelligence feed / state detail — full width on mobile, 4/12 on lg+ */}
          <div className="lg:col-span-4 order-3 flex flex-col" style={{ minHeight: '440px', maxHeight: '560px' }}>
            {selectedState ? (
              <StateDetailPanel
                state={selectedState}
                news={filteredNews}
                onClose={handleClosePanel}
                previewMode={effectivePreviewMode}
                delta={deltaMap?.get?.(selectedStateId)?.delta ?? null}
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
