import { useState, useEffect, useMemo } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import SectionDivider from '../components/SectionDivider'
import { getStateProgramMap, getNewsFeed } from '../lib/programData'

// V3 §4.1: top-of-dashboard strip surfacing recently-active states.
// Pragmatic v1 -- ranks by max(lastVerified, updatedAt). When weekly
// `dashboard_metrics` history accumulates, swap to true score-delta deltas
// (this hook just needs to start consuming a deltas-aware payload).
function MarketsOnTheMove({ stateProgramMap, onStateClick }) {
  const movers = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    if (!states.length) return []
    const now = Date.now()
    return states
      .filter(s => s.csStatus && s.csStatus !== 'none')
      .map(s => {
        const v = s.lastVerified ? new Date(s.lastVerified).getTime() : 0
        const u = s.updatedAt   ? new Date(s.updatedAt).getTime()   : 0
        return { ...s, recencyTs: Math.max(v, u) }
      })
      .filter(s => s.recencyTs > 0 && (now - s.recencyTs) < 1000 * 60 * 60 * 24 * 30)
      .sort((a, b) => b.recencyTs - a.recencyTs)
      .slice(0, 3)
  }, [stateProgramMap])

  if (movers.length === 0) return null

  const formatAgo = (ts) => {
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'today'
    if (days === 1) return '1d ago'
    if (days < 7)   return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <div className="rounded-xl px-5 py-3.5 mb-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-semibold" style={{ color: '#0F766E' }}>
            Markets on the Move
          </p>
          <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">· past 30 days</span>
        </div>
        <span className="hidden sm:inline-block w-px h-4" style={{ background: '#E2E8F0' }} />
        <div className="flex items-center gap-2 flex-wrap">
          {movers.map((s) => {
            const score = s.feasibilityScore ?? 0
            return (
              <button
                key={s.id}
                onClick={() => onStateClick(s.id)}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#F9FAFB', border: '1px solid #E2E8F0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,118,110,0.06)'; e.currentTarget.style.borderColor = 'rgba(15,118,110,0.30)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E2E8F0' }}
              >
                <span className="font-serif text-sm font-semibold text-ink leading-none">{s.name}</span>
                <span className="font-mono text-[11px] font-bold tabular-nums leading-none" style={{ color: score >= 60 ? '#0F766E' : '#5A6B7A' }}>
                  {score}
                </span>
                <span className="font-mono text-[9px] text-ink-muted leading-none">{formatAgo(s.recencyTs)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ previewMode = false }) {
  const [selectedStateId,  setSelectedStateId]  = useState(null)
  const [stateProgramMap,  setStateProgramMap]  = useState({})
  const [news,             setNews]             = useState([])

  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
    getNewsFeed().then(setNews).catch(console.error)
  }, [])

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
      {previewMode && (
        <div
          className="sticky top-14 z-30 flex items-center justify-between px-6 py-2.5"
          style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)', borderBottom: '1px solid rgba(20,184,166,0.22)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#5EEAD4' }}>◆ Live Preview</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
              You're viewing live market intelligence. Sign up for Tractova Lens AI analysis and project tracking.
            </span>
          </div>
          <a
            href="/signup"
            className="flex-shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
          >
            Get full access →
          </a>
        </div>
      )}
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* Page header */}
        <div className="mt-4 mb-1">
          <h1 className="text-2xl font-serif font-semibold text-ink" style={{ letterSpacing: '-0.02em' }}>Market Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Community solar program status, interconnection conditions, and policy alerts — updated weekly.
          </p>
        </div>

        <SectionDivider />

        {/* Metrics bar */}
        <MetricsBar />

        <SectionDivider />

        {/* V3 §4.1: Markets on the Move — recently-updated states with score */}
        <MarketsOnTheMove stateProgramMap={stateProgramMap} onStateClick={handleStateClick} />

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
              />
            ) : (
              <NewsFeed news={news} />
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
