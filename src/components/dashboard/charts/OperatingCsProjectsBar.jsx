import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { getCsProjectsAggByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// Chart 7: Operating Community Solar Projects per State.
// LBNL Sharing the Sun ground truth — the actual operating CS projects
// in the field, not state-level program authorizations. Top 20 states
// by project count. Sized by count; tooltip shows total MW AC + median.
//
// Reads "where does CS actually exist, on the ground?" Distinct from
// Chart 2 (capacity authorization) which can include states that have
// programs but few real deployments.
//
// Data: cs_projects via getCsProjectsAggByState() (cached).

export default function OperatingCsProjectsBar({ filterStates = [] }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCsProjectsAggByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch((e) => { if (!cancelled) console.warn('[OperatingCsProjectsBar] fetch failed:', e?.message) })
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    if (!rows) return []
    const filterSet = new Set(filterStates)
    return rows
      .filter((r) => filterSet.size === 0 || filterSet.has(r.stateId))
      .slice(0, 20)
      .map((r) => ({ name: r.stateId, count: r.count, totalMw: r.totalMw, median: r.median }))
  }, [rows, filterStates])

  return (
    <ChartCard
      label="Chart 07"
      title="Operating CS Projects per State"
      sub="Real operating community-solar projects in the field — LBNL Sharing the Sun, top 20 states by count."
      footer="Source: cs_projects (LBNL Sharing the Sun, Q4 2024 release). Reflects deployment ground truth — distinct from program authorization."
    >
      <div style={{ height: Math.max(280, data.length * 22), width: '100%' }}>
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
              tick={CHART_AXIS.tick}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              {...CHART_TOOLTIP}
              cursor={{ fill: 'rgba(94,234,212,0.06)' }}
              formatter={(value, _name, props) => {
                const p = props?.payload
                return [`${value} projects · ${p?.totalMw ?? 0} MW total · median ${p?.median ?? 0} MW`, '']
              }}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={i === 0 ? '#0F766E' : i < 5 ? '#14B8A6' : i < 10 ? '#2DD4BF' : '#5EEAD4'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
