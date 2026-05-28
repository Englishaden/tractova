import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from 'recharts'
import { supabase } from '../../../lib/supabase'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// Chart 3: LMI Penetration by State.
// Top 20 states by lmi_pct (% of households in Low-to-Moderate Income
// bracket, ≤80% AMI). ACS 2022 5-year estimates from `lmi_data`.
//
// Honest framing in the footer: 18 states are seeded with state-specific
// values; the rest fall back to the national median (~38%). The chart
// only shows SEEDED states to avoid implying we have 50-state coverage.
//
// Data: lmi_data (per-state).

export default function LmiPenetrationBar({ filterStates = [] }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('lmi_data')
      .select('state, lmi_pct, lmi_households, total_households, median_household_income')
      .order('lmi_pct', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error) return
        setRows(data || [])
      })
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    if (!rows) return []
    const filterSet = new Set(filterStates)
    return rows
      .filter((r) => (filterSet.size === 0 || filterSet.has(r.state)) && r.lmi_pct != null)
      .slice(0, 20)
      .map((r) => ({
        name:  r.state,
        pct:   Math.round(Number(r.lmi_pct) * 10) / 10,
        households: r.lmi_households,
      }))
  }, [rows, filterStates])

  return (
    <ChartCard
      label="Chart 03"
      title="LMI Penetration by State"
      sub="Top 20 states by Low-to-Moderate Income household share (≤80% AMI)."
      footer="Source: lmi_data (ACS 2022 5-year estimates). Only ~18 states have state-specific seeded values; non-seeded states omitted rather than back-filled with the national median."
    >
      <div style={{ height: Math.max(280, data.length * 18), width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
            <XAxis
              type="number"
              domain={[0, 'dataMax + 5']}
              tick={CHART_AXIS.tick}
              axisLine={CHART_AXIS.axisLine}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={CHART_AXIS.tick}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <ReferenceLine x={38} stroke="rgba(251,191,36,0.4)" strokeDasharray="4 4" label={{ value: 'Natl ~38%', position: 'top', fill: '#FBBF24', fontSize: 9, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }} />
            <Tooltip
              {...CHART_TOOLTIP}
              cursor={{ fill: 'rgba(94,234,212,0.06)' }}
              formatter={(value, _n, props) => {
                const hh = props?.payload?.households
                return [`${value}%${hh ? ` · ${(hh/1000).toFixed(0)}k LMI households` : ''}`, '']
              }}
            />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => {
                const color = d.pct >= 45 ? '#0F766E' : d.pct >= 38 ? '#14B8A6' : d.pct >= 30 ? '#5EEAD4' : '#99F6E4'
                return <Cell key={i} fill={color} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
