import { useEffect, useState, useMemo } from 'react'
import { ComposedChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { supabase } from '../../../lib/supabase'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, TILE_H } from './ChartCard'

// LMI Penetration — diverging lollipop vs. the national median.
//
// A *deviation* view: each state's distance from the ~38% national median (FT
// "deviation" pattern). The axis spans only the deviation range, so the tightly
// clustered ~30–45% values become legible — honest, because it's explicitly
// labeled Δ-vs-median, not a truncated absolute axis. interval={0} forces every
// state label. teal = above the median · amber = below.
//
// Compact by default (top 7 by share, no scroll) — click expand for all seeded
// states and let the bento grid reflow around it.
//
// Data: lmi_data (US Census ACS 2018–2022 5-year estimates).

const NATL_MEDIAN = 38 // % LMI households nationally (≤80% AMI), ACS-derived

function Lollipop(props) {
  const { x, y, width, height, payload } = props
  const delta = payload?.delta ?? 0
  const positive = delta >= 0
  const cy = y + height / 2
  const endX = positive ? x + width : x
  const zeroX = positive ? x : x + width
  const color = positive ? '#14B8A6' : '#FBBF24'
  return (
    <g>
      <line x1={zeroX} y1={cy} x2={endX} y2={cy} stroke={color} strokeWidth={2} strokeOpacity={0.5} />
      <circle cx={endX} cy={cy} r={4.5} fill={color} stroke="#131C2C" strokeWidth={1.5} />
    </g>
  )
}

export default function LmiDivergingLollipop({ filterStates = [], isExpanded = false, onToggleExpand }) {
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

  const { data, maxAbs, total } = useMemo(() => {
    if (!rows) return { data: [], maxAbs: 5, total: 0 }
    const filterSet = new Set(filterStates)
    const all = rows
      .filter((r) => (filterSet.size === 0 || filterSet.has(r.state)) && r.lmi_pct != null)
      .map((r) => {
        const pct = Math.round(Number(r.lmi_pct) * 10) / 10
        return { name: r.state, pct, delta: Math.round((pct - NATL_MEDIAN) * 10) / 10, households: r.lmi_households }
      })
      .sort((a, b) => b.pct - a.pct)
    const shown = isExpanded ? all : all.slice(0, 7)
    const m = shown.reduce((mx, x) => Math.max(mx, Math.abs(x.delta)), 0)
    return { data: shown, maxAbs: Math.ceil(m + 1), total: all.length }
  }, [rows, filterStates, isExpanded])

  const chartH = isExpanded ? Math.max(TILE_H.expanded, data.length * 20) : TILE_H.feature

  return (
    <ChartCard
      label="EQUITY"
      title="LMI Penetration by State"
      sub={`Deviation from the ~${NATL_MEDIAN}% national median · ${isExpanded ? `all ${total} seeded states` : `top 7 of ${total}`} by LMI share (≤80% AMI).`}
      footer="Source: US Census ACS 2018–2022 5-year estimates (api.census.gov). Seeded states only; non-seeded omitted rather than back-filled with the national median."
      className="h-full"
      expandable
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div style={{ height: chartH, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 22, right: 18, left: 4, bottom: 4 }}>
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
            <ReferenceLine x={0} stroke="rgba(251,191,36,0.45)" strokeDasharray="4 4" label={{ value: `Natl ~${NATL_MEDIAN}%`, position: 'insideTopLeft', fill: '#FBBF24', fontSize: 9, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }} />
            <Tooltip
              {...CHART_TOOLTIP}
              cursor={false}
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
    </ChartCard>
  )
}
