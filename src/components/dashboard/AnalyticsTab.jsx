import { useEffect, useState, useMemo } from 'react'
import { getStatePrograms, getDashboardMetricsHistory } from '../../lib/programData'
import AnalyticsKpiStrip from './charts/AnalyticsKpiStrip'
import CsProgramStatusBar from './charts/CsProgramStatusBar'
import CsCapacityLeaderboard from './charts/CsCapacityLeaderboard'
import LmiDivergingLollipop from './charts/LmiDivergingLollipop'
import FeasibilityScoreDeltas from './charts/FeasibilityScoreDeltas'
import PolicyPulseStacked from './charts/PolicyPulseStacked'
import IxDifficultyDonut from './charts/IxDifficultyDonut'
import OperatingCsProjectsDot from './charts/OperatingCsProjectsDot'

// AnalyticsTab — the dense, single-screen analytics surface for the Dashboard
// (v2.10 rework). A "top-10 SaaS terminal" layout:
//   • Zone A — KPI summary strip (overview always visible, filter-aware)
//   • Zone B — collapsible state filter (condenses to reclaim vertical space)
//   • Zone C — 12-col bento grid of charts on normalized, aligned heights
// All wrapped in a faint .dash-map-grid backdrop for the control-room feel.
//
// Charts grounded in the audited data inventory; each cites its UPSTREAM
// authority (DSIRE / Census ACS / LBNL / ISO-RTO / RSS), not the table name.
// State filter drives the filter-aware charts (status, capacity, LMI, IX,
// projects). Time-series (feasibility movement, policy pulse) show the
// national pulse regardless of selection.

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '92px' }} />
        ))}
      </div>
      <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '52px' }} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {['lg:col-span-12', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-6', 'lg:col-span-6', 'lg:col-span-12'].map((span, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-md dash-shimmer ${span}`}
            style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: i === 0 ? '120px' : '340px' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal) 50%, transparent 100%)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsTab() {
  const [programs, setPrograms] = useState([])
  const [history, setHistory] = useState(null)
  const [filterStates, setFilterStates] = useState([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getStatePrograms().catch(() => []),
      getDashboardMetricsHistory({ weeks: 8 }).catch(() => null),
    ]).then(([progs, hist]) => {
      if (cancelled) return
      setPrograms(progs || [])
      setHistory(hist)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  // Filter-chip list — sorted by feasibility score so the "important" states
  // are at the top of the chip grid.
  const filterableStates = useMemo(() => {
    return programs
      .filter((s) => s.csStatus && s.csStatus !== 'none')
      .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
  }, [programs])

  const toggleState = (id) => {
    setFilterStates((cur) => cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id])
  }
  const clearAll = () => setFilterStates([])

  if (!ready) return <AnalyticsSkeleton />

  return (
    <div className="relative">
      {/* Faint control-room grid backdrop */}
      <div className="dash-map-grid" style={{ opacity: 0.4 }} aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* ── Zone A — KPI summary strip ─────────────────────────────── */}
        <AnalyticsKpiStrip programs={programs} filterStates={filterStates} history={history} />

        {/* ── Zone B — collapsible state filter ──────────────────────── */}
        <div className="rounded-md" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
            aria-expanded={filtersOpen}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
              </span>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold shrink-0" style={{ color: 'var(--link, #5EEAD4)' }}>
                State Filter
              </h2>
              {filterStates.length > 0 ? (
                <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-label)' }}>
                  {filterStates.length} selected · {filterStates.slice(0, 8).join(' ')}{filterStates.length > 8 ? '…' : ''}
                </span>
              ) : (
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>all 50-state distributions</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {filterStates.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); clearAll() }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearAll() } }}
                  className="font-mono text-[9px] uppercase tracking-[0.18em] underline decoration-dotted cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear
                </span>
              )}
              <svg
                width="11" height="11" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="transition-transform duration-150"
                style={{ color: 'var(--text-muted)', transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>
          {filtersOpen && (
            <div className="px-3 pb-3 -mt-0.5">
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-label)' }}>
                {filterStates.length === 0
                  ? 'No filter — all charts show 50-state distributions. Click states to scope the filter-aware charts.'
                  : `Scoping the filter-aware charts to ${filterStates.length} selected state${filterStates.length === 1 ? '' : 's'}.`}
              </p>
              <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto thin-scrollbar">
                {filterableStates.length === 0 ? (
                  <span className="text-[10px] italic" style={{ color: 'var(--text-disabled)' }}>Loading states…</span>
                ) : filterableStates.map((s) => {
                  const active = filterStates.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleState(s.id)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-all"
                      style={{
                        background: active ? 'var(--link-active-bg)' : 'transparent',
                        border: `1px solid ${active ? 'var(--link-active-bg)' : 'var(--cards-border)'}`,
                        color: active ? '#FFFFFF' : 'var(--text-label)',
                      }}
                      data-active={active ? 'true' : 'false'}
                    >
                      <span className="font-mono text-[10px] font-bold tabular-nums leading-none">{s.id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Zone C — bento grid ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
          {/* Status ribbon — full width */}
          <div className="lg:col-span-12">
            <CsProgramStatusBar programs={programs} filterStates={filterStates} />
          </div>

          {/* Capacity · IX · Deployment — three feature tiles */}
          <div className="lg:col-span-4">
            <CsCapacityLeaderboard programs={programs} filterStates={filterStates} />
          </div>
          <div className="lg:col-span-4">
            <IxDifficultyDonut programs={programs} filterStates={filterStates} />
          </div>
          <div className="lg:col-span-4">
            <OperatingCsProjectsDot filterStates={filterStates} />
          </div>

          {/* Equity · Trends — two wide tiles */}
          <div className="lg:col-span-6">
            <LmiDivergingLollipop filterStates={filterStates} />
          </div>
          <div className="lg:col-span-6">
            <FeasibilityScoreDeltas filterStates={filterStates} weeks={8} label="TRENDS" />
          </div>

          {/* Signals hero — full width */}
          <div className="lg:col-span-12">
            <PolicyPulseStacked series={history?.policyPulseByPillar || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
