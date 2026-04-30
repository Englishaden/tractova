import { useState, useEffect, useMemo, useCallback } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import SectionDivider from '../components/SectionDivider'
import WelcomeCard from '../components/WelcomeCard'
import ApiErrorBanner from '../components/ApiErrorBanner'
import { useAuth } from '../context/AuthContext'
import { getStateProgramMap, getNewsFeed, getStateProgramDeltas } from '../lib/programData'

// V3 §4.1: top-of-dashboard strip surfacing recently-active states.
// Pragmatic v1 -- ranks by max(lastVerified, updatedAt). When weekly
// `dashboard_metrics` history accumulates, swap to true score-delta deltas
// (this hook just needs to start consuming a deltas-aware payload).
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

    // V3 Wave 1.4: when score-deltas exist, sort by |delta| desc -- "Markets
    // on the Move" then literally means score-movers. Falls back to recency
    // sort when no deltas (typical for the first ~2 weeks after migration
    // 038 lands until weekly snapshot history accrues).
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

    const top = sorted.slice(0, 3)
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
  const formatFullDate = (ts) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="rounded-xl px-5 py-3.5 mb-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          {/* Live-pulse indicator -- previously a static teal dot. Now
              breathes via CSS ping/pulse layered atop a solid core, signaling
              the panel reflects current data and isn't just a snapshot. */}
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-semibold" style={{ color: '#0F766E' }}>
            Markets on the Move
          </p>
          <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">
            · {hasDeltas ? 'WoW score deltas' : 'past 30 days'}
          </span>
        </div>
        <span className="hidden sm:inline-block w-px h-4" style={{ background: '#E2E8F0' }} />
        <div className="flex items-center gap-2 flex-wrap">
          {displayed.map((s) => {
            const score = s.feasibilityScore ?? 0
            const tooltip = s.delta !== null
              ? `${s.name}: ${s.delta > 0 ? '+' : ''}${s.delta} pt${Math.abs(s.delta) === 1 ? '' : 's'} WoW · ${formatFullDate(s.recencyTs)}${s.csProgram ? ` · ${s.csProgram}` : ''}`
              : `${s.name}: data verified ${formatFullDate(s.recencyTs)}${s.csProgram ? ` · ${s.csProgram}` : ''}`
            const deltaColor = s.delta > 0 ? '#0F766E' : s.delta < 0 ? '#DC2626' : '#5A6B7A'
            return (
              <button
                key={s.id}
                onClick={() => onStateClick(s.id)}
                title={tooltip}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#F9FAFB', border: '1px solid #E2E8F0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,118,110,0.06)'; e.currentTarget.style.borderColor = 'rgba(15,118,110,0.30)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E2E8F0' }}
              >
                <span className="font-serif text-sm font-semibold text-ink leading-none">{s.name}</span>
                <span className="font-mono text-[11px] font-bold tabular-nums leading-none" style={{ color: score >= 60 ? '#0F766E' : '#5A6B7A' }}>
                  {score}
                </span>
                {s.delta !== null && s.delta !== 0 ? (
                  <span className="font-mono text-[10px] font-bold tabular-nums leading-none flex items-center gap-0.5" style={{ color: deltaColor }}>
                    {s.delta > 0 ? '↑' : '↓'}{Math.abs(s.delta)}
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-ink-muted leading-none">{formatAgo(s.recencyTs)}</span>
                )}
              </button>
            )
          })}
          {/* Overflow indicator -- surfaces total mover count when there
              are more updated states than fit in the visible top-3. */}
          {overflowCount > 0 && (
            <span
              className="font-mono text-[10px] text-ink-muted px-2 py-1 leading-none"
              title={`${overflowCount} more state${overflowCount === 1 ? '' : 's'} updated in the past 30 days`}
            >
              +{overflowCount} more
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ previewMode = false }) {
  const [selectedStateId,  setSelectedStateId]  = useState(null)
  const [stateProgramMap,  setStateProgramMap]  = useState({})
  const [news,             setNews]             = useState([])
  const { user } = useAuth()
  // Effective preview mode: only ON if route is /preview AND visitor is
  // unauth. Authed users who navigate to /preview manually see the real
  // Dashboard (no banner, no gates) since marketing UX is irrelevant
  // to them.
  const effectivePreviewMode = previewMode && !user

  // Track which fetches failed so we can surface a single banner with retry.
  // Previously these used `.catch(console.error)` and the user was stuck
  // staring at a frozen MetricsBar / empty NewsFeed with no recovery path.
  const [dashboardError, setDashboardError] = useState(null)
  const [retrying, setRetrying] = useState(false)
  // V3 Wave 1.4: WoW score deltas for Markets on the Move. Empty Map until
  // state_programs_snapshots accumulates ≥2 weekly entries per state
  // (~2 weeks after migration 038 lands). Failure is non-fatal -- panel
  // gracefully falls back to recency-only sort.
  const [deltaMap, setDeltaMap] = useState(new Map())

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
    // Deltas are best-effort -- never surface in the error banner. Hardened:
    // the value MUST be a Map regardless of what the helper returned (a
    // non-Map value would crash the MarketsOnTheMove render via .get()).
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

  // ESC key closes the state detail panel
  useEffect(() => {
    if (!selectedStateId) return
    const handle = (e) => { if (e.key === 'Escape') setSelectedStateId(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [selectedStateId])

  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null

  const handleStateClick = (stateId) => {
    setSelectedStateId((prev) => (prev === stateId ? null : stateId))
  }

  const handleClosePanel = () => {
    setSelectedStateId(null)
  }

  return (
    <div className="min-h-screen bg-paper">
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
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* V3-extension — first-run welcome card. Renders ONCE per
            user (DB-backed dismissal) for authed users on Dashboard.
            Shown above page header to be the first thing a new user
            sees. Skipped on /preview unauth surface. */}
        {user && !effectivePreviewMode && <WelcomeCard />}

        {/* Page header */}
        <div className="mt-4 mb-1">
          <h1 className="text-2xl font-serif font-semibold text-ink" style={{ letterSpacing: '-0.02em' }}>Market Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Community solar program status, interconnection conditions, and policy alerts — updated weekly.
          </p>
        </div>

        {/* Surface failures from getStateProgramMap / getNewsFeed (previously
            silently caught) so users have a recovery path. */}
        <ApiErrorBanner
          message={dashboardError}
          onRetry={() => loadDashboardData(true)}
          onDismiss={() => setDashboardError(null)}
          retrying={retrying}
        />

        <SectionDivider />

        {/* Metrics bar */}
        <MetricsBar previewMode={effectivePreviewMode} />

        <SectionDivider />

        {/* V3 §4.1: Markets on the Move — surfaces WoW score deltas when
            state_programs_snapshots history exists, else recency-sorted. */}
        <MarketsOnTheMove stateProgramMap={stateProgramMap} deltaMap={deltaMap} onStateClick={handleStateClick} />

        {/* Main two-panel layout — stacks on mobile/tablet, side-by-side at lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Map — full-width on mobile, 60% on lg+ */}
          <div className="lg:col-span-3">
            <USMap
              onStateClick={handleStateClick}
              selectedStateId={selectedStateId}
              stateProgramMap={stateProgramMap}
            />
          </div>

          {/* Side panel — full-width on mobile, 40% on lg+ */}
          <div className="lg:col-span-2 flex flex-col" style={{ minHeight: '400px' }}>
            {selectedState ? (
              <StateDetailPanel
                state={selectedState}
                news={news}
                onClose={handleClosePanel}
                previewMode={effectivePreviewMode}
              />
            ) : (
              <NewsFeed news={news} previewMode={effectivePreviewMode} />
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
