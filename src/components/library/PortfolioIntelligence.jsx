import { useState, useMemo } from 'react'
import CountUp from '../ui/CountUp'
import TealRail from '../ui/TealRail'
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

  if (projects.length === 0) return null

  return (
    <div className="relative mb-4 rounded-xl bg-white border border-gray-200 overflow-hidden">
      <TealRail />
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
            {/* Unique "what changed" signals folded in from the retired Recent
                Updates bar — only render when present, so the line stays clean. */}
            {updatedCount > 0 && (
              <>
                <span className="mx-1.5 text-gray-300">·</span>
                <span style={{ color: '#2563EB' }}>{updatedCount} updated</span>
              </>
            )}
            {stateMoveCount > 0 && (
              <>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="text-gray-500">{stateMoveCount} moved</span>
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
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex flex-col gap-3">
          {/* Pipeline funnel — ONE compact stacked bar (the dashboard's
              CsProgramStatusBar idiom, div-based so it doesn't pull Recharts
              into the Library bundle). Click a segment or legend chip to filter
              by stage; amber dot = a project 180+ days in that stage. Replaces
              the old vertical-bar block (taller + less professional). */}
          <div className="rounded-xl px-4 py-3.5 bg-white border border-gray-200">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pipeline Distribution</p>
              {filterStage && (
                <button type="button" onClick={() => setFilterStage('')} className="text-[10px] font-semibold text-teal-700 hover:text-teal-800">Clear ✕</button>
              )}
            </div>
            {(() => {
              const active = stageCounts.filter(s => s.count > 0)
              const total = active.reduce((s, c) => s + c.count, 0) || 1
              return (
                <>
                  <div className="flex w-full h-8 rounded-lg overflow-hidden" style={{ background: '#F1F5F9' }}>
                    {active.map(({ stage, count, mw, color, stale }) => {
                      const isActive = filterStage === stage
                      const isDimmed = filterStage && !isActive
                      const pct = (count / total) * 100
                      const light = ['#F0FDFA', '#99F6E4', '#5EEAD4'].includes(color)
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setFilterStage(isActive ? '' : stage)}
                          title={`${stage} · ${count} project${count > 1 ? 's' : ''} · ${mw.toFixed(1)} MW${stale ? ' · ⚠ 180+ days in stage' : ''}`}
                          className="relative h-full flex items-center justify-center transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background: color,
                            opacity: isDimmed ? 0.3 : 1,
                            boxShadow: isActive ? 'inset 0 0 0 2px #0F766E' : 'none',
                          }}
                        >
                          {pct > 7 && (
                            <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: light ? '#0A1828' : '#FFFFFF' }}>{count}</span>
                          )}
                          {stale && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B', boxShadow: '0 0 0 1.5px #FFFFFF' }} />}
                        </button>
                      )
                    })}
                  </div>
                  {/* Stage legend — also click-to-filter */}
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2.5">
                    {active.map(({ stage, count, mw, color }) => {
                      const isActive = filterStage === stage
                      const swatch = ['#F0FDFA', '#99F6E4'].includes(color) ? '#5EEAD4' : color
                      return (
                        <button
                          key={stage + 'l'}
                          type="button"
                          onClick={() => setFilterStage(isActive ? '' : stage)}
                          title={`${mw.toFixed(1)} MW`}
                          className="flex items-center gap-1.5 transition-opacity"
                          style={{ opacity: filterStage && !isActive ? 0.4 : 1 }}
                        >
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: swatch }} />
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: isActive ? '#0F766E' : '#5A6B7A' }}>
                            {PIPELINE_SHORT[PIPELINE_STAGES.indexOf(stage)]} · {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
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
