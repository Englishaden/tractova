import { useState, useEffect, useMemo, useCallback } from 'react'
import MetricsBar from '../components/MetricsBar'
import IntelligenceFeedCard from '../components/IntelligenceFeedCard'
import StateDetailPanel from '../components/StateDetailPanel'
import WelcomeCard from '../components/WelcomeCard'
import ApiErrorBanner from '../components/ApiErrorBanner'
import DashboardGlobe from '../components/DashboardGlobe'
import MarketFiltersRail from '../components/MarketFiltersRail'
// MarketBrief temporarily hidden 2026-05-27 per Aden — likely returns
// once the dashboard chrome is locked. Import kept commented for the
// inevitable re-enable, not deleted.
// import MarketBrief from '../components/MarketBrief'
import { useAuth } from '../context/AuthContext'
import { getStateProgramMap, getNewsFeed, getStateProgramDeltas } from '../lib/programData'
import { useDataRefresh } from '../lib/useDataRefresh'
import MountReveal from '../components/ui/MountReveal'

// Dashboard revamp v2 — Intelligence Terminal (plan: warm-foraging-charm.md).
//
// Layout (lg+):
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Header + freshness pill                                      │
//   │ MarketBrief                                                  │
//   ├──────────┬──────────────────────────────────┬────────────────┤
//   │  Market  │  DashboardGlobe / USMap          │  Intelligence  │
//   │  Filters │  (click globe → zoom to map)     │  Feed          │
//   │  Rail    │                                  │  (NewsFeed)    │
//   ├──────────┴──────────────────────────────────┴────────────────┤
//   │ MetricsBar (5 KPI cards + sparklines)                        │
//   │ MarketsOnTheMove (inline; extracted+marqueed in Ship 2)      │
//   └──────────────────────────────────────────────────────────────┘
//
// Mobile: single-col stack. Filter rail collapses to a horizontal scroll
// chip strip above the map.
//
// Dark surface via the `dashboard-dark` scope class on <main>. CSS vars
// (--app-bg, --cards-bg, --cards-border, --text-primary, etc.) live in
// src/index.css and are scoped to this surface only — other pages stay
// on the Tractova cream brand surface.

// V3 §4.1: top-of-dashboard strip surfacing recently-active states.
// Inline here in Ship 1; Ship 2 extracts to MarketsOnTheMoveMarquee.jsx
// and adds the `.dash-marquee` infinite-scroll behavior.
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
        return { ...s, recencyTs: Math.max(v, u), delta: d?.delta ?? null, prevScore: d?.prevScore ?? null }
      })
      .filter(s => s.recencyTs > 0 && (now - s.recencyTs) < 1000 * 60 * 60 * 24 * 30)

    const deltasPresent = recent.some(s => s.delta !== null && s.delta !== 0)
    const sorted = deltasPresent
      ? recent.slice().sort((a, b) => {
          if (a.delta !== null && b.delta === null) return -1
          if (a.delta === null && b.delta !== null) return 1
          if (a.delta !== null && b.delta !== null) {
            return Math.abs(b.delta) - Math.abs(a.delta)
          }
          return b.recencyTs - a.recencyTs
        })
      : recent.slice().sort((a, b) => b.recencyTs - a.recencyTs)

    const top = sorted.slice(0, 5)
    return {
      displayed:    top,
      overflowCount: Math.max(0, sorted.length - top.length),
      hasDeltas:    deltasPresent,
    }
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
                <span className="font-mono text-[11px] font-bold tabular-nums leading-none" style={{ color: score >= 60 ? '#34D399' : 'var(--text-label)' }}>
                  {score}
                </span>
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

export default function Dashboard({ previewMode = false }) {
  const [selectedStateId, setSelectedStateId] = useState(null)
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [news, setNews] = useState([])
  const [deltaMap, setDeltaMap] = useState(new Map())
  const [dashboardError, setDashboardError] = useState(null)
  const [retrying, setRetrying] = useState(false)

  // Filter state — emitted by MarketFiltersRail; consumed by USMap (via the
  // filtered stateProgramMap below) and NewsFeed (via the filtered news
  // array). Ship 1 wires state + utility filters; stage + sizeBucket pass
  // through to /search via the rail's "Run a Lens" CTA.
  const [filters, setFilters] = useState({ states: [], utility: '', stage: null, sizeBucket: null })

  const { user } = useAuth()
  const effectivePreviewMode = previewMode && !user

  const loadDashboardData = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true)
    let failedSources = []
    const [mapRes, newsRes, deltasRes] = await Promise.allSettled([
      getStateProgramMap(),
      getNewsFeed(),
      getStateProgramDeltas(),
    ])
    if (mapRes.status === 'fulfilled') setStateProgramMap(mapRes.value)
    else                                failedSources.push('market data')
    if (newsRes.status === 'fulfilled') setNews(newsRes.value)
    else                                failedSources.push('news')
    if (deltasRes.status === 'fulfilled') {
      const v = deltasRes.value
      setDeltaMap(v instanceof Map ? v : new Map())
    }
    if (failedSources.length > 0) {
      setDashboardError(`Couldn't load ${failedSources.join(' and ')}. Check your connection or retry.`)
    } else {
      setDashboardError(null)
    }
    if (isRetry) setRetrying(false)
  }, [])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])

  // ESC closes the state detail panel
  useEffect(() => {
    if (!selectedStateId) return
    const handle = (e) => { if (e.key === 'Escape') setSelectedStateId(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [selectedStateId])

  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null

  // Freshness pill (preserved from Phase 1)
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

  // Unique news sources for the MarketFiltersRail utility datalist
  const newsSources = useMemo(() => {
    return Array.from(new Set(news.map((n) => n.source).filter(Boolean)))
  }, [news])

  // Filter wiring: apply state + utility filters to the data that flows
  // into USMap and NewsFeed. Other filters (stage, sizeBucket) pass through
  // to /search via the rail's "Run a Lens" CTA (no Dashboard effect — see
  // MarketFiltersRail.jsx comment for the data-honesty rationale).
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

  const handleStateClick = (stateId) => {
    setSelectedStateId((prev) => (prev === stateId ? null : stateId))
  }

  const handleClosePanel = () => {
    setSelectedStateId(null)
  }

  return (
    <div className="min-h-screen relative dashboard-dark">
      {effectivePreviewMode && (
        <div
          className="sticky top-14 z-30 flex items-center justify-between px-6 py-2.5"
          style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)', borderBottom: '1px solid rgba(20,184,166,0.22)' }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#5EEAD4' }}>◆ Live Preview</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
              You're seeing the same intelligence Pro users get. Create a free account to drill into states, save projects, and run Tractova Lens AI analysis.
            </span>
          </div>
          <a
            href="/signup"
            className="shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
          >
            Create free account →
          </a>
        </div>
      )}

      <main className="relative max-w-dashboard mx-auto px-6 pt-16 pb-6">
        {user && !effectivePreviewMode && <WelcomeCard />}

        {/* Page header */}
        <div className="mt-2 mb-2">
          <h1 className="text-xl font-serif font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Market Dashboard
          </h1>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Community solar program status, interconnection conditions, and policy alerts — refreshed weekly.
            </p>
            {lastRefresh && (
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ color: lastRefresh.isStale ? '#FBBF24' : '#5EEAD4' }}
                title={lastRefresh.isStale
                  ? `Data is ${lastRefresh.ageDays} days old — last refresh missed at least one weekly cycle.`
                  : `Last weekly refresh ${lastRefresh.ageDays === 0 ? 'today' : `${lastRefresh.ageDays} day${lastRefresh.ageDays === 1 ? '' : 's'} ago`}.`}
              >
                <span className="relative flex w-1.5 h-1.5 shrink-0" aria-hidden="true">
                  {!lastRefresh.isStale && (
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: '#14B8A6' }} />
                  )}
                  <span
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{
                      background: lastRefresh.isStale ? '#FBBF24' : '#14B8A6',
                      boxShadow: lastRefresh.isStale ? '0 0 6px rgba(251,191,36,0.5)' : '0 0 6px rgba(20,184,166,0.6)',
                    }}
                  />
                </span>
                <span>Refreshed {lastRefresh.date}</span>
              </span>
            )}
          </div>
        </div>

        <ApiErrorBanner
          message={dashboardError}
          onRetry={() => loadDashboardData(true)}
          onDismiss={() => setDashboardError(null)}
          retrying={retrying}
        />

        {/* MarketBrief temporarily hidden 2026-05-27 per Aden. The slot
            sat between the page header and the 3-col grid; left intentionally
            empty for now (intelligence-terminal vibe doesn't need an
            editorial preamble at every visit). Re-enable by uncommenting
            the import + the MountReveal/MarketBrief block. */}
        {/* <MountReveal delay={0}>
          <MarketBrief stateProgramMap={stateProgramMap} deltaMap={deltaMap} />
        </MountReveal> */}

        {/* 3-col hero — Filters | Globe/Map | Intelligence Feed.
            Heights tuned so the hero + KPI strip + Markets-on-the-Move
            all fit above the fold on a ~900px viewport (Aden 2026-05-27:
            "A dashboard shouldnt be 'scrollable' it should be a single
            interactive page that you can navigate."). */}
        <MountReveal delay={0.04}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 mb-2">
            {/* Filters rail — full width on mobile, 2/12 on lg+ */}
            <div className="lg:col-span-2 order-1">
              <MarketFiltersRail
                stateProgramMap={stateProgramMap}
                newsSources={newsSources}
                filters={filters}
                onChange={setFilters}
              />
            </div>

            {/* Map area — full width on mobile, 6/12 on lg+.
                Ambient background layers (.lp-hero-grid + radial wash)
                fill the negative space around the globe per Aden's note
                "use some of our background skill files too to fill in
                the empty space behind the map. very bland." */}
            <div className="lg:col-span-6 order-2 relative rounded-md overflow-hidden" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '440px', maxHeight: '560px' }}>
              {/* Slow-drifting teal grid — already-defined CSS utility
                  from src/index.css (used on the landing page hero).
                  Animates at 22s/cycle, respects prefers-reduced-motion. */}
              <div className="lp-hero-grid" aria-hidden="true" />
              {/* Radial wash — softens the corners, draws the eye to
                  the globe sitting at the visual center. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.10) 0%, rgba(11,22,35,0.65) 75%)',
                }}
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

            {/* Intelligence feed — full width on mobile, 4/12 on lg+.
                Condensed IntelligenceFeedCard (top-5 items, dotted-underline
                cells, hover-reveal "View all") replaces the verbose
                NewsFeed per Aden 2026-05-27. State drill-in still opens
                the full StateDetailPanel here. */}
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

        {/* KPI strip — full-width below the map hero */}
        <MountReveal delay={0.08}>
          <div className="mb-2">
            <MetricsBar previewMode={effectivePreviewMode} />
          </div>
        </MountReveal>

        {/* Markets on the Move — inline; Ship 2 extracts + marquees */}
        <MountReveal delay={0.12}>
          <MarketsOnTheMove
            stateProgramMap={stateProgramMap}
            deltaMap={deltaMap}
            onStateClick={handleStateClick}
          />
        </MountReveal>
      </main>
    </div>
  )
}
