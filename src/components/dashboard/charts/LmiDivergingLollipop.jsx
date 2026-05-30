import { useEffect, useState, useMemo } from 'react'
import { ComposedChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { supabase } from '../../../lib/supabase'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// LMI Penetration — diverging lollipop vs. the national median.
//
// Aden 2026-05-30 rework: the prior horizontal bars looked identical because
// every seeded state clusters in the ~30–45% band, and the Y-axis skipped
// every other state label. A *deviation* view fixes both: we plot each state's
// distance from the ~38% national median (FT "deviation" pattern). The axis
// spans only the deviation range, so small absolute gaps become legible visual
// gaps — honest, because the chart is explicitly labeled as Δ-vs-median, not a
// truncated absolute axis. interval={0} forces every state label.
//
// teal dot = above the national median · amber dot = below.
//
// Data: lmi_data (US Census ACS 2018–2022 5-year estimates).

const NATL_MEDIAN = 38 // % LMI households nationally (≤80% AMI), ACS-derived

// Custom lollipop glyph: a thin stem from the median (x=0) to the value, with a
// dot at the end. Receives Recharts bar geometry (x/width are the value extents).
function Lollipop(props) {
  const { x, y, width, height, payload } = props
  const delta = payload?.delta ?? 0
  const positive = delta >= 0
  const cy = y + height / 2
  const endX = positive ? x + width : x        // the value end of the bar
  const zeroX = positive ? x : x + width        // the median (baseline) end
  const color = positive ? '#14B8A6' : '#FBBF24'
  return (
    <g>
      <line x1={zeroX} y1={cy} x2={endX} y2={cy} stroke={color} strokeWidth={2} strokeOpacity={0.5} />
      <circle cx={endX} cy={cy} r={4.5} fill={color} stroke="#131C2C" strokeWidth={1.5} />
    </g>
  )
}

export default function LmiDivergingLollipop({ filterStates = [] }) {
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

  const { data, maxAbs } = useMemo(() => {
    if (!rows) return { data: [], maxAbs: 5 }
    const filterSet = new Set(filterStates)
    const d = rows
      .filter((r) => (filterSet.size === 0 || filterSet.has(r.state)) && r.lmi_pct != null)
      .map((r) => {
        const pct = Math.round(Number(r.lmi_pct) * 10) / 10
        return { name: r.state, pct, delta: Math.round((pct - NATL_MEDIAN) * 10) / 10, households: r.lmi_households }
      })
      .sort((a, b) => b.pct - a.pct)
    const m = d.reduce((mx, x) => Math.max(mx, Math.abs(x.delta)), 0)
    return { data: d, maxAbs: Math.ceil(m + 1) }
  }, [rows, filterStates])

  // Internal scroll keeps the tile a fixed bento height while every state
  // label stays visible (page stays "one screen"; overflow scrolls in-card).
  const innerH = Math.max(248, data.length * 17)

  return (
    <ChartCard
      label="EQUITY"
      title="LMI Penetration by State"
      sub={`Deviation from the ~${NATL_MEDIAN}% national median · Low-to-Moderate Income household share (≤80% AMI).`}
      footer="Source: US Census ACS 2018–2022 5-year estimates (api.census.gov). Seeded states only; non-seeded omitted rather than back-filled with the national median."
      className="h-full"
    >
      <div style={{ height: 288, overflowY: 'auto', width: '100%' }} className="thin-scrollbar">
        <div style={{ height: innerH, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 18, left: 4, bottom: 4 }}>
              <XAxis
                type="number"
                domain={[-maxAbs, maxAbs]}
                tick={CHART_AXIS.tick}
                axisLine={CHART_AXIS.axisLine}
                tickLine={false}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                interval={0}
                tick={CHART_AXIS.tick}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <ReferenceLine x={0} stroke="rgba(251,191,36,0.45)" strokeDasharray="4 4" label={{ value: `Natl ~${NATL_MEDIAN}%`, position: 'top', fill: '#FBBF24', fontSize: 9, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }} />
              <Tooltip
                {...CHART_TOOLTIP}
                cursor={{ fill: 'rgba(94,234,212,0.06)' }}
                formatter={(_v, _n, props) => {
                  const p = props?.payload || {}
                  const hh = p.households
                  const sign = p.delta > 0 ? '+' : ''
                  return [`${p.pct}% LMI · ${sign}${p.delta} pts vs median${hh ? ` · ${(hh / 1000).toFixed(0)}k households` : ''}`, '']
                }}
              />
              <Bar dataKey="delta" shape={<Lollipop />} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}
