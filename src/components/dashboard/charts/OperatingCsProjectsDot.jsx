import { useEffect, useState, useMemo } from 'react'
import { ComposedChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getCsProjectsAggByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, TILE_H } from './ChartCard'

// Operating CS Projects per State — sorted dot plot (Cleveland-style).
//
// A dot plot keeps small states legible where right-skewed bars vanish, and
// interval={0} forces all labels.
//
// Compact by default (top 7, no scroll) — click the header to expand to the
// full top-20 and let the bento grid reflow around it.
//
// Data: cs_projects via getCsProjectsAggByState() — LBNL "Sharing the Sun".

const RANK_COLORS = ['#0F766E', '#14B8A6', '#2DD4BF', '#5EEAD4']
function rankColor(i) {
  return i === 0 ? RANK_COLORS[0] : i < 5 ? RANK_COLORS[1] : i < 10 ? RANK_COLORS[2] : RANK_COLORS[3]
}

function DotGlyph(props) {
  const { x, y, width, height, payload } = props
  const cy = y + height / 2
  const endX = x + width
  const color = payload?.color || '#14B8A6'
  return (
    <g>
      <line x1={x} y1={cy} x2={endX} y2={cy} stroke={color} strokeWidth={1.5} strokeOpacity={0.22} />
      <circle cx={endX} cy={cy} r={4} fill={color} stroke="#131C2C" strokeWidth={1.5} />
    </g>
  )
}

export default function OperatingCsProjectsDot({ filterStates = [], isExpanded = false, onToggleExpand }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCsProjectsAggByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch((e) => { if (!cancelled) console.warn('[OperatingCsProjectsDot] fetch failed:', e?.message) })
    return () => { cancelled = true }
  }, [])

  const { data, total } = useMemo(() => {
    if (!rows) return { data: [], total: 0 }
    const filterSet = new Set(filterStates)
    const all = rows
      .filter((r) => (filterSet.size === 0 || filterSet.has(r.stateId)) && r.count > 0)
      .slice(0, 20)
    const shown = isExpanded ? all : all.slice(0, 7)
    const d = shown.map((r, i) => ({ name: r.stateId, count: r.count, totalMw: r.totalMw, median: r.median, color: rankColor(i) }))
    return { data: d, total: all.length }
  }, [rows, filterStates, isExpanded])

  const chartH = isExpanded ? Math.max(TILE_H.expanded, data.length * 22) : TILE_H.feature

  return (
    <ChartCard
      label="DEPLOYMENT"
      title="Operating CS Projects per State"
      sub={isExpanded ? `Top ${total} states by operating project count.` : `Top 7 of ${total} states by operating project count.`}
      footer="Source: Lawrence Berkeley National Lab (LBNL) “Sharing the Sun” project database, Q4 2024 release — deployment ground truth, distinct from program authorization."
      className="h-full"
      expandable
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div style={{ height: chartH, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 24, left: 4, bottom: 4 }}>
            <XAxis
              type="number"
              domain={[0, 'dataMax']}
              tick={CHART_AXIS.tick}
              axisLine={CHART_AXIS.axisLine}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
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
            <Tooltip
              {...CHART_TOOLTIP}
              cursor={false}
              formatter={(_v, _n, props) => {
                const p = props?.payload || {}
                return [`${p.count} projects · ${Math.round(p.totalMw ?? 0).toLocaleString()} MW total · median ${Math.round(p.median ?? 0)} MW`, '']
              }}
            />
            <Bar dataKey="count" shape={<DotGlyph />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
