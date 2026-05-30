import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, TILE_H } from './ChartCard'

// CS Capacity Leaderboard.
// States by remaining authorized capacity (MW). Horizontal bar, state abbrev
// on the Y axis, MW on X. Color-coded by csStatus so the reader can see "this
// state has lots of MW but it's pending" vs "active and large." A status
// legend sits below the chart.
//
// Compact by default (top 7, no scroll) — click expand to see the full board
// and let the bento grid reflow around it.
//
// Data: state_programs.capacityMW.

const STATUS_CFG = [
  { key: 'active',  label: 'Active',     color: '#14B8A6' },
  { key: 'limited', label: 'Limited',    color: '#5EEAD4' },
  { key: 'pending', label: 'Pending',    color: '#FBBF24' },
  { key: 'none',    label: 'No program', color: '#3F4E68' },
]
function statusColor(s) {
  return s === 'active' ? '#14B8A6' : s === 'limited' ? '#5EEAD4' : s === 'pending' ? '#FBBF24' : '#3F4E68'
}

export default function CsCapacityLeaderboard({ programs = [], filterStates = [], isExpanded = false, onToggleExpand }) {
  const { data, legend, totalShown } = useMemo(() => {
    const filterSet = new Set(filterStates)
    const all = programs
      .filter((s) => (filterSet.size === 0 || filterSet.has(s.id)) && (s.capacityMW || 0) > 0)
      .sort((a, b) => (b.capacityMW || 0) - (a.capacityMW || 0))
    const shown = isExpanded ? all : all.slice(0, 7)
    const counts = { active: 0, limited: 0, pending: 0, none: 0 }
    for (const s of shown) counts[s.csStatus in counts ? s.csStatus : 'none'] += 1
    return {
      data: shown.map((s) => ({ name: s.id, fullName: s.name, capacity: s.capacityMW, status: s.csStatus })),
      legend: STATUS_CFG.map((c) => ({ ...c, count: counts[c.key] })).filter((c) => c.count > 0),
      totalShown: all.length,
    }
  }, [programs, filterStates, isExpanded])

  const chartH = isExpanded ? Math.max(TILE_H.expanded, data.length * 22) : TILE_H.feature

  return (
    <ChartCard
      label="CAPACITY"
      title="CS Capacity Leaderboard"
      sub={isExpanded ? `All ${totalShown} states by remaining authorized capacity (MW).` : `Top 7 of ${totalShown} states by remaining authorized capacity (MW).`}
      footer="Source: DSIRE (NCSU/DOE) program registry verifies program identity; MW authorizations admin-curated from state PUC / program filings — program authorizations, not operating deployments."
      className="h-full"
      expandable
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div style={{ height: chartH, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
            <XAxis
              type="number"
              tick={CHART_AXIS.tick}
              axisLine={CHART_AXIS.axisLine}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            />
            <YAxis
              type="category"
              dataKey="name"
              interval={0}
              tick={CHART_AXIS.tick}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              {...CHART_TOOLTIP}
              cursor={{ fill: 'rgba(94,234,212,0.06)' }}
              formatter={(value, _name, props) => {
                const status = props?.payload?.status || ''
                const fullName = props?.payload?.fullName || ''
                return [`${value.toLocaleString()} MW · ${status}`, fullName]
              }}
            />
            <Bar dataKey="capacity" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={statusColor(d.status)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 px-1">
        {legend.map((c) => (
          <div key={c.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-label)' }}>
              {c.label} · {c.count}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
