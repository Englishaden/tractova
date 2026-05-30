import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, CHART_GRID_STROKE } from './ChartCard'

// Chart 2: CS Capacity Leaderboard.
// Top 15 states by remaining authorized capacity (MW). Horizontal bar with
// state abbrev on the Y axis, MW on X. Color-coded by csStatus so the
// reader can see "this state has lots of MW but it's pending" vs "active
// and large."
//
// Data: state_programs.capacityMw (existing).

export default function CsCapacityLeaderboard({ programs = [], filterStates = [] }) {
  const data = useMemo(() => {
    const filterSet = new Set(filterStates)
    return programs
      .filter((s) => (filterSet.size === 0 || filterSet.has(s.id)) && (s.capacityMW || 0) > 0)
      .sort((a, b) => (b.capacityMW || 0) - (a.capacityMW || 0))
      .slice(0, 15)
      .map((s) => ({ name: s.id, fullName: s.name, capacity: s.capacityMW, status: s.csStatus, csProgram: s.csProgram }))
  }, [programs, filterStates])

  return (
    <ChartCard
      label="CAPACITY"
      title="CS Capacity Leaderboard"
      sub="Top 15 states by remaining authorized capacity (MW)."
      footer="Source: DSIRE (NCSU/DOE) program registry verifies program identity; MW authorizations admin-curated from state PUC / program filings — program authorizations, not operating deployments."
      className="h-full"
    >
      <div style={{ height: 288, overflowY: 'auto', width: '100%' }} className="thin-scrollbar">
       <div style={{ height: Math.max(248, data.length * 18), width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
            <XAxis
              type="number"
              tick={CHART_AXIS.tick}
              axisLine={CHART_AXIS.axisLine}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
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
            <Bar dataKey="capacity" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => {
                const color = d.status === 'active'  ? '#14B8A6'
                            : d.status === 'limited' ? '#5EEAD4'
                            : d.status === 'pending' ? '#FBBF24'
                            : '#3F4E68'
                return <Cell key={i} fill={color} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
       </div>
      </div>
    </ChartCard>
  )
}
