import { useEffect, useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { getStatePrograms, getDashboardMetricsHistory } from '../../lib/programData'
import MetricsBar from '../MetricsBar'
import CsProgramStatusBar from './charts/CsProgramStatusBar'
import CsCapacityLeaderboard from './charts/CsCapacityLeaderboard'
import LmiDivergingLollipop from './charts/LmiDivergingLollipop'
import FeasibilityScoreDeltas from './charts/FeasibilityScoreDeltas'
import PolicyPulseStacked from './charts/PolicyPulseStacked'
import IxDifficultyDonut from './charts/IxDifficultyDonut'
import OperatingCsProjectsDot from './charts/OperatingCsProjectsDot'

// AnalyticsTab — the dense, single-screen analytics surface for the Dashboard.
//   • Zone A — the live KPI MetricsBar (moved here from HomeTab; expand/collapse
//     cards with CountUp + sparkline + per-card reveals, unchanged)
//   • Zone B — collapsible state filter (condenses to reclaim vertical space)
//   • Zone C — a 12-col bento of charts that are COMPACT by default (fit ~one
//     screen) and EXPAND on click — the expanded tile spans full width and the
//     siblings reflow around it (motion layout), like the Home command center.
// All wrapped in a faint .dash-map-grid backdrop for the control-room feel.
//
// Each chart cites its UPSTREAM authority (DSIRE / Census ACS / LBNL / ISO-RTO
// / RSS), not the table name. The state filter drives the filter-aware charts.

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
      {['lg:col-span-12', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-6', 'lg:col-span-6', 'lg:col-span-12'].map((span, i) => (
        <div
          key={i}
          className={`relative overflow-hidden rounded-md dash-shimmer ${span}`}
          style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: i === 0 ? '110px' : '300px' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal) 50%, transparent 100%)' }} />
        </div>
      ))}
    </div>
  )
}

// Slower, clearly-visible settle (Aden 2026-05-30 "slow it down so the
// transition is viewable"). A gentle spring reads as smooth, not snappy.
const SPRING = { type: 'spring', stiffness: 130, damping: 24, mass: 1 }

export default function AnalyticsTab() {
  const [programs, setPrograms] = useState([])
  const [history, setHistory] = useState(null)
  const [filterStates, setFilterStates] = useState([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [ready, setReady] = useState(false)
  const reduced = useReducedMotion()

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

  const filterableStates = useMemo(() => {
    return programs
      .filter((s) => s.csStatus && s.csStatus !== 'none')
      .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
  }, [programs])

  const toggleState = (id) => {
    setFilterStates((cur) => cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id])
  }
  const clearAll = () => setFilterStates([])

  // layout="position" (not full layout): animate only the TRANSLATE of
  // reflowing tiles — never a width/height SCALE transform. The scale
  // transform was what briefly distorted the chart SVG text on expand/
  // collapse (Aden 2026-05-30). Size now snaps; positions glide. Reduced
  // motion disables it entirely.
  const LAYOUT = reduced ? false : 'position'

  const isOpen = (key) => expanded.has(key)
  const toggleExpand = (key) => {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  // Expanded tiles grow to 8/12 (NOT full 12) so the clicked chart stays in
  // place and its neighbours MELD AROUND it — one sibling tucks into the
  // remaining 4 cols, the rest reflow below. Full-width pushed the clicked
  // tile onto its own row, which read as "the chart you opened moved away"
  // (Aden 2026-05-30). col-span-8 keeps it anchored.
  const span = (key, base) => (isOpen(key) ? 'lg:col-span-8' : base)

  return (
    <div className="relative">
      {/* Faint control-room grid backdrop */}
      <div className="dash-map-grid" style={{ opacity: 0.4 }} aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* ── Zone A — live KPI metrics (moved from Home) ────────────── */}
        <MetricsBar />

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

        {/* ── Zone C — expandable bento grid ─────────────────────────── */}
        {!ready ? (
          <ChartsSkeleton />
        ) : (
          <motion.div layout={LAYOUT} transition={SPRING} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
            <motion.div layout={LAYOUT} transition={SPRING} className="lg:col-span-12">
              <CsProgramStatusBar programs={programs} filterStates={filterStates} />
            </motion.div>

            <motion.div layout={LAYOUT} transition={SPRING} className={span('capacity', 'lg:col-span-4')}>
              <CsCapacityLeaderboard programs={programs} filterStates={filterStates} isExpanded={isOpen('capacity')} onToggleExpand={() => toggleExpand('capacity')} />
            </motion.div>
            <motion.div layout={LAYOUT} transition={SPRING} className={span('ix', 'lg:col-span-4')}>
              <IxDifficultyDonut programs={programs} filterStates={filterStates} isExpanded={isOpen('ix')} onToggleExpand={() => toggleExpand('ix')} />
            </motion.div>
            <motion.div layout={LAYOUT} transition={SPRING} className={span('projects', 'lg:col-span-4')}>
              <OperatingCsProjectsDot filterStates={filterStates} isExpanded={isOpen('projects')} onToggleExpand={() => toggleExpand('projects')} />
            </motion.div>

            <motion.div layout={LAYOUT} transition={SPRING} className={span('lmi', 'lg:col-span-6')}>
              <LmiDivergingLollipop filterStates={filterStates} isExpanded={isOpen('lmi')} onToggleExpand={() => toggleExpand('lmi')} />
            </motion.div>
            <motion.div layout={LAYOUT} transition={SPRING} className={span('trends', 'lg:col-span-6')}>
              <FeasibilityScoreDeltas filterStates={filterStates} weeks={8} label="TRENDS" expandable isExpanded={isOpen('trends')} onToggleExpand={() => toggleExpand('trends')} />
            </motion.div>

            <motion.div layout={LAYOUT} transition={SPRING} className="lg:col-span-12">
              <PolicyPulseStacked series={history?.policyPulseByPillar || []} isExpanded={isOpen('policy')} onToggleExpand={() => toggleExpand('policy')} />
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
