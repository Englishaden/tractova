import { useState, useMemo } from 'react'
import CountUp from '../ui/CountUp'
import WeeklySummaryCard from './WeeklySummaryCard'
import { getAlerts } from '../../lib/alertHelpers'
import { PIPELINE_STAGES, PIPELINE_SHORT } from './PipelineProgress'

// ── Portfolio Intelligence — the consolidated "what's my book doing" drawer ──
// Pass 5 (Wave 1) folds five formerly-stacked blocks — the KPI stat strip, the
// Pipeline Distribution bar, the "Recent Updates" what-changed banner, the
// "due this week" follow-up roll-up, and the WeeklySummaryCard — into ONE
// collapsible surface. Collapsed by default: a single summary line carries the
// glanceable numbers (projects · MW · alerts · due); expanding reveals the full
// breakdown. This kills the signal overlap (counts/MW/alerts were repeated
// across three of the old blocks) and reclaims the vertical real estate above
// the project list that the user actually came for.
//
// State lives in localStorage so the user's open/closed preference survives a
// reload — mirrors the layout/pageSize persistence in useLibraryLayout.

const OPEN_KEY = 'tractova_library_intel_open'
function loadOpen() {
  try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false }
}

const STAGE_COLORS = ['#F0FDFA', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0F766E', '#0F1A2E']

export default function PortfolioIntelligence({
  projects,
  stateProgramMap,
  countyDataMap,
  stateDeltaMap,
  filterStage,
  setFilterStage,
}) {
  const [open, setOpenState] = useState(loadOpen)
  const setOpen = (v) => {
    setOpenState(v)
    try { localStorage.setItem(OPEN_KEY, v ? '1' : '0') } catch { /* SSR / quota — silent */ }
  }

  // ── Glanceable aggregates (always computed; cheap over the in-memory list) ──
  const totalMw = useMemo(
    () => projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0),
    [projects],
  )
  const alertCount = useMemo(
    () => projects.reduce((n, p) => n + getAlerts(p, stateProgramMap, countyDataMap).length, 0),
    [projects, stateProgramMap, countyDataMap],
  )

  // Follow-ups due within 7 days (incl. overdue). Null until migration 074 +
  // Wave 2 editing land — list is simply empty before then (graceful).
  const due = useMemo(() => {
    const now = Date.now()
    return projects
      .filter(p => p.followUpAt)
      .map(p => ({ p, ms: new Date(p.followUpAt).getTime() }))
      .filter(({ ms }) => (ms - now) / 86400000 <= 7)
      .sort((a, b) => a.ms - b.ms)
  }, [projects])
  const hasOverdue = due.some(({ ms }) => ms < Date.now())

  // "Recent Updates" roll-up — same source data as the per-card chips.
  const { updatedCount, stateMoveCount } = useMemo(() => {
    let updated = 0
    const moved = new Set()
    for (const p of projects) {
      const cur = stateProgramMap[p.state]
      if (cur?.lastUpdated && p.savedAt && new Date(cur.lastUpdated) > new Date(p.savedAt)) updated++
      const d = stateDeltaMap?.get?.(p.state)
      if (d && d.delta !== 0) moved.add(p.state)
    }
    return { updatedCount: updated, stateMoveCount: moved.size }
  }, [projects, stateProgramMap, stateDeltaMap])

  // ── Pipeline distribution (bars, click-to-filter, 180-day stale flag) ──
  const stageCounts = useMemo(() => {
    const now = Date.now()
    return PIPELINE_STAGES.map((s, i) => {
      const matching = projects.filter(p => p.stage === s)
      const stale = matching.some(p => p.savedAt && (now - new Date(p.savedAt).getTime()) / 86400000 >= 180)
      return {
        stage: s,
        count: matching.length,
        mw: matching.reduce((sum, p) => sum + (parseFloat(p.mw) || 0), 0),
        color: STAGE_COLORS[i],
        stale,
      }
    })
  }, [projects])
  const maxCount = Math.max(...stageCounts.map(s => s.count), 1)

  if (projects.length === 0) return null

  return (
    <div className="mb-4 rounded-xl bg-white border border-gray-200 overflow-hidden">
      {/* ── Summary header — always visible, carries the glanceable numbers ── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold shrink-0" style={{ color: '#0F766E' }}>
            ◈ Portfolio Intelligence
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs font-medium text-ink font-mono tabular-nums">
            <CountUp value={projects.length} /> project{projects.length !== 1 ? 's' : ''}
            <span className="mx-1.5 text-gray-300">·</span>
            <CountUp value={totalMw} decimals={1} /> MW
            <span className="mx-1.5 text-gray-300">·</span>
            <span style={{ color: alertCount > 0 ? '#B45309' : undefined }}>{alertCount} alert{alertCount !== 1 ? 's' : ''}</span>
            {due.length > 0 && (
              <>
                <span className="mx-1.5 text-gray-300">·</span>
                <span style={{ color: hasOverdue ? '#DC2626' : '#0F766E' }}>{due.length} due</span>
              </>
            )}
          </span>
        </div>
        <span className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold text-gray-400">
          {open ? 'Hide' : 'Details'}
          <svg
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* ── Expanded breakdown ── */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 flex flex-col gap-3">
          {/* KPI tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Saved Projects', value: projects.length, decimals: 0, suffix: '', sub: 'across all states' },
              { label: 'Total Capacity', value: totalMw, decimals: 1, suffix: ' MW', sub: 'AC nameplate' },
              { label: 'Active Alerts', value: alertCount, decimals: 0, suffix: '', sub: 'policy or market flags' },
            ].map(({ label, value, decimals, suffix, sub }) => (
              <div key={label} className="rounded-xl px-4 py-3 bg-white border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #0F1A2E 0%, #14B8A6 100%)' }} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1">{label}</p>
                <p className="text-xl font-bold font-mono tabular-nums mt-0.5" style={{ color: '#0F1A2E' }}><CountUp value={value} decimals={decimals} suffix={suffix} /></p>
                <p className="text-[10px] mt-0.5 text-gray-400">{sub}</p>
              </div>
            ))}
          </div>

          {/* Recent Updates roll-up */}
          {(updatedCount > 0 || stateMoveCount > 0 || alertCount > 0) && (
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 flex-wrap"
              style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.20)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F766E' }} />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>Recent Updates</p>
              <span className="text-gray-300">·</span>
              <p className="text-xs font-medium text-ink">
                {updatedCount > 0 && <span>{updatedCount} project{updatedCount > 1 ? 's have' : ' has'} updated market data</span>}
                {updatedCount > 0 && stateMoveCount > 0 && <span className="text-gray-400"> · </span>}
                {stateMoveCount > 0 && <span>{stateMoveCount} state{stateMoveCount > 1 ? 's' : ''} moved week-over-week</span>}
                {(updatedCount > 0 || stateMoveCount > 0) && alertCount > 0 && <span className="text-gray-400"> · </span>}
                {alertCount > 0 && <span>{alertCount} alert{alertCount > 1 ? 's' : ''} across your portfolio</span>}
              </p>
            </div>
          )}

          {/* Pipeline distribution — click a bar to filter by stage */}
          <div className="rounded-xl px-4 py-3 bg-white border border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Pipeline Distribution</p>
            <div className="flex items-end gap-2 h-16">
              {stageCounts.map(({ stage, count, mw, color, stale }) => {
                const isActive = filterStage === stage
                const isDimmed = filterStage && filterStage !== stage
                return (
                  <button
                    type="button"
                    key={stage}
                    onClick={() => count > 0 && setFilterStage(isActive ? '' : stage)}
                    disabled={count === 0}
                    className="flex-1 flex flex-col items-center gap-1 group relative transition-opacity"
                    style={{ opacity: isDimmed ? 0.4 : 1, cursor: count > 0 ? 'pointer' : 'default' }}
                  >
                    <div
                      className="w-full rounded-t-md transition-all duration-300 relative"
                      style={{
                        height: count > 0 ? `${Math.max(6, (count / maxCount) * 56)}px` : '3px',
                        background: count > 0 ? color : '#E5E7EB',
                        outline: isActive ? '2px solid #0F766E' : 'none',
                        outlineOffset: isActive ? '2px' : '0',
                      }}
                    >
                      {stale && (
                        <span
                          className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                          style={{ background: '#F59E0B', boxShadow: '0 0 0 1.5px #FFFFFF' }}
                          title="A project has been in this stage 180+ days"
                        />
                      )}
                    </div>
                    {count > 0 && (
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-10 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-medium bg-gray-900 text-white shadow-lg pointer-events-none font-mono">
                        {count} project{count > 1 ? 's' : ''} · {mw.toFixed(1)} MW{stale ? ' · ⚠ stale' : ''}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 mt-2">
              {stageCounts.map(({ stage, count, mw, color }) => {
                const isActive = filterStage === stage
                return (
                  <div key={stage + 'l'} className="flex-1 text-center">
                    <p className="text-[9px] leading-tight font-semibold" style={{ color: isActive ? '#0F766E' : count > 0 ? '#0A1828' : '#9CA3AF' }}>
                      {PIPELINE_SHORT[PIPELINE_STAGES.indexOf(stage)]}
                    </p>
                    {count > 0 && (
                      <>
                        <p className="text-[10px] font-bold font-mono tabular-nums" style={{ color: ['#F0FDFA', '#99F6E4'].includes(color) ? '#0F766E' : color }}>{count}</p>
                        <p className="text-[8px] font-mono tabular-nums text-gray-400">{mw.toFixed(0)} MW</p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Due this week — empty until follow-up dates exist (migration 074 + Wave 2) */}
          {due.length > 0 && (
            <div className="rounded-xl px-4 py-3 bg-white border border-gray-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Due This Week</p>
              <div className="flex flex-col gap-1.5">
                {due.map(({ p, ms }) => {
                  const days = Math.round((ms - Date.now()) / 86400000)
                  const overdue = ms < Date.now()
                  const rel = overdue
                    ? `${Math.abs(days)}d overdue`
                    : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-ink truncate min-w-0">{p.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {p.followUpNote && <span className="text-gray-400 truncate max-w-[160px] hidden sm:inline">{p.followUpNote}</span>}
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm" style={overdue ? { background: 'rgba(220,38,38,0.10)', color: '#DC2626' } : { background: 'rgba(15,118,110,0.10)', color: '#0F766E' }}>{rel}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full portfolio analytics — only meaningful at 3+ projects */}
          {projects.length >= 3 && (
            <WeeklySummaryCard projects={projects} stateProgramMap={stateProgramMap} />
          )}
        </div>
      )}
    </div>
  )
}
