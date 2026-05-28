import { useEffect, useState, useMemo } from 'react'
import { getStatePrograms, getDashboardMetricsHistory } from '../../lib/programData'
import CsProgramStatusBar from './charts/CsProgramStatusBar'
import CsCapacityLeaderboard from './charts/CsCapacityLeaderboard'
import LmiPenetrationBar from './charts/LmiPenetrationBar'
import FeasibilityScoreDeltas from './charts/FeasibilityScoreDeltas'
import PolicyPulseStacked from './charts/PolicyPulseStacked'
import IxDifficultyDonut from './charts/IxDifficultyDonut'
import OperatingCsProjectsBar from './charts/OperatingCsProjectsBar'

// AnalyticsTab — chart-heavy data-viz surface for the Dashboard's
// Analytics sub-page. 7 charts grounded in the audited data inventory
// (research agent, 2026-05-28). Each chart sits inside a ChartCard with
// dark-themed Recharts + a data-honesty footer note.
//
// State multi-select filter at the top is STICKY — drives the underlying
// data for the charts that respect a filter (Charts 1, 2, 3, 6, 7).
// Charts 4 + 5 are time-series and reflect the full national pulse
// regardless of selection.

export default function AnalyticsTab() {
  const [programs, setPrograms] = useState([])
  const [history, setHistory] = useState(null)
  const [filterStates, setFilterStates] = useState([])

  // Fetch both data sources in parallel on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getStatePrograms().catch(() => []),
      getDashboardMetricsHistory({ weeks: 8 }).catch(() => null),
    ]).then(([progs, hist]) => {
      if (cancelled) return
      setPrograms(progs || [])
      setHistory(hist)
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

  return (
    <div className="flex flex-col gap-3">
      {/* Header — sticky filter strip */}
      <div
        className="rounded-md p-3"
        style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
      >
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
            </span>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
              State Filter
            </h2>
            {filterStates.length > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full font-mono text-[9px] font-bold tabular-nums"
                style={{ background: 'var(--link-active-bg)', color: '#FFFFFF' }}
              >
                {filterStates.length}
              </span>
            )}
          </div>
          {filterStates.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[9px] uppercase tracking-[0.18em] underline decoration-dotted hover:no-underline transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-[11px] mb-2" style={{ color: 'var(--text-label)' }}>
          {filterStates.length === 0
            ? 'No filter — all charts show 50-state distributions. Click states below to scope all charts to a subset.'
            : `Scoping all charts to ${filterStates.length} selected state${filterStates.length === 1 ? '' : 's'}.`}
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

      {/* Charts grid — single-col on mobile, 2-col on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Row 1 — national distribution + capacity leaderboard */}
        <CsProgramStatusBar programs={programs} filterStates={filterStates} />
        <CsCapacityLeaderboard programs={programs} filterStates={filterStates} />

        {/* Row 2 — LMI + IX */}
        <LmiPenetrationBar filterStates={filterStates} />
        <IxDifficultyDonut programs={programs} filterStates={filterStates} />

        {/* Row 3 — Time-series (full-width on lg+ if we wanted; keeping 2-col) */}
        <FeasibilityScoreDeltas filterStates={filterStates} weeks={8} />
        <PolicyPulseStacked series={history?.policyPulseByPillar || []} />

        {/* Row 4 — Real-ops ground truth (full width) */}
        <div className="lg:col-span-2">
          <OperatingCsProjectsBar filterStates={filterStates} />
        </div>
      </div>
    </div>
  )
}
