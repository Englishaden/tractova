import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { supabase } from '../../../lib/supabase'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, CHART_GRID_STROKE } from './ChartCard'

// Chart 4: Feasibility Score Deltas (Top Movers).
// Multi-line chart — 8-week trailing feasibility scores for the top 6
// states by week-over-week movement (highest |delta|). Pulls from
// state_programs_snapshots directly so the chart is independent of the
// existing getStateProgramDeltas() helper (which only returns the
// most-recent pair).
//
// Falls back gracefully if the snapshot history is sparse (<2 weeks per
// state): the chart renders an honest "trend tracking accruing" placeholder.

const LINE_COLORS = ['#14B8A6', '#5EEAD4', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA']

// ISO week key — must match the bucketing in getDashboardMetricsHistory
function toIsoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export default function FeasibilityScoreDeltas({ filterStates = [], weeks = 8 }) {
  const [snaps, setSnaps] = useState(null)

  useEffect(() => {
    let cancelled = false
    const cutoff = new Date(Date.now() - (weeks + 1) * 7 * 86400 * 1000).toISOString()
    supabase
      .from('state_programs_snapshots')
      .select('state_id, feasibility_score, snapshot_at')
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error) return
        setSnaps(data || [])
      })
    return () => { cancelled = true }
  }, [weeks])

  const { chartData, topMovers, hasData } = useMemo(() => {
    if (!snaps || snaps.length === 0) return { chartData: [], topMovers: [], hasData: false }
    const filterSet = new Set(filterStates)

    // Map<stateId, Map<weekKey, lastScore>> — keep latest snapshot per state per week
    const stateWeekScores = new Map()
    for (const row of snaps) {
      if (filterSet.size > 0 && !filterSet.has(row.state_id)) continue
      const wk = toIsoWeek(new Date(row.snapshot_at))
      if (!stateWeekScores.has(row.state_id)) stateWeekScores.set(row.state_id, new Map())
      stateWeekScores.get(row.state_id).set(wk, Math.round(Number(row.feasibility_score) || 0))
    }

    // Score range = max - min per state. Top 6 by range.
    const ranges = []
    for (const [stateId, weekMap] of stateWeekScores.entries()) {
      const scores = Array.from(weekMap.values())
      if (scores.length < 2) continue
      const range = Math.max(...scores) - Math.min(...scores)
      ranges.push({ stateId, range, weekMap })
    }
    ranges.sort((a, b) => b.range - a.range)
    const topN = ranges.slice(0, 6)
    if (topN.length === 0) return { chartData: [], topMovers: [], hasData: false }

    // Union of all weeks across top movers, sorted
    const allWeeks = new Set()
    topN.forEach(({ weekMap }) => weekMap.forEach((_, wk) => allWeeks.add(wk)))
    const sortedWeeks = Array.from(allWeeks).sort()

    // Pivot to chart-friendly rows
    const chartRows = sortedWeeks.map((wk) => {
      const row = { week: wk }
      topN.forEach(({ stateId, weekMap }) => {
        row[stateId] = weekMap.get(wk) ?? null
      })
      return row
    })

    return {
      chartData: chartRows,
      topMovers: topN.map(({ stateId, range }) => ({ stateId, range })),
      hasData: true,
    }
  }, [snaps, filterStates])

  return (
    <ChartCard
      label="Chart 04"
      title="Feasibility Score Movement"
      sub={hasData
        ? `8-week trailing scores for the ${topMovers.length} states with the largest score-range movement.`
        : 'Weekly history accruing — top-movers chart unlocks once each state has ≥2 weekly snapshots.'}
      footer="Source: state_programs_snapshots. Computed from program status, capacity, IX difficulty, LMI requirements (see scoreEngine.js)."
    >
      {hasData ? (
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="week"
                tick={CHART_AXIS.tick}
                axisLine={CHART_AXIS.axisLine}
                tickLine={false}
                tickFormatter={(v) => v.replace(/^\d{4}-W/, 'W')}
              />
              <YAxis
                tick={CHART_AXIS.tick}
                axisLine={false}
                tickLine={false}
                width={32}
                domain={[0, 100]}
              />
              <Tooltip {...CHART_TOOLTIP} cursor={{ stroke: 'rgba(94,234,212,0.45)', strokeWidth: 1 }} />
              <Legend
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ paddingTop: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }}
              />
              {topMovers.map((m, i) => (
                <Line
                  key={m.stateId}
                  type="monotone"
                  dataKey={m.stateId}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={1.75}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: 260 }} className="flex items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Trend Accruing</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Snapshot history fills weekly. Check back after the next refresh cycle.</p>
          </div>
        </div>
      )}
    </ChartCard>
  )
}
