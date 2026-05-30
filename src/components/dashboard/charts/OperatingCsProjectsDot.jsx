import { useEffect, useState, useMemo } from 'react'
import { ComposedChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getCsProjectsAggByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, ChartToggle } from './ChartCard'

// Operating CS Projects per State — sorted dot plot (Cleveland-style).
//
// Aden 2026-05-30 rework: the prior horizontal bars were heavily right-skewed
// (MA/IL/CO/FL dominated; everyone else was an invisible sliver) and the axis
// skipped every other state label. A dot plot keeps small states legible where
// bars vanish, and interval={0} forces all labels. A linear/log toggle lets
// power users resolve the orders-of-magnitude spread honestly (log ticks are
// explicitly labeled at 1/10/100/…).
//
// Data: cs_projects via getCsProjectsAggByState() — LBNL "Sharing the Sun".

const RANK_COLORS = ['#0F766E', '#14B8A6', '#2DD4BF', '#5EEAD4']
function rankColor(i) {
  return i === 0 ? RANK_COLORS[0] : i < 5 ? RANK_COLORS[1] : i < 10 ? RANK_COLORS[2] : RANK_COLORS[3]
}

// Dot glyph: a faint leader line (aids row tracking) + a colored dot at the value.
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

export default function OperatingCsProjectsDot({ filterStates = [] }) {
  const [rows, setRows] = useState(null)
  const [scale, setScale] = useState('linear')

  useEffect(() => {
    let cancelled = false
    getCsProjectsAggByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch((e) => { if (!cancelled) console.warn('[OperatingCsProjectsDot] fetch failed:', e?.message) })
    return () => { cancelled = true }
  }, [])

  const { data, max } = useMemo(() => {
    if (!rows) return { data: [], max: 10 }
    const filterSet = new Set(filterStates)
    const d = rows
      .filter((r) => (filterSet.size === 0 || filterSet.has(r.stateId)) && r.count > 0)
      .slice(0, 20)
      .map((r, i) => ({ name: r.stateId, count: r.count, totalMw: r.totalMw, median: r.median, color: rankColor(i) }))
    const mx = d.reduce((m, x) => Math.max(m, x.count), 0)
    return { data: d, max: mx }
  }, [rows, filterStates])

  const isLog = scale === 'log'
  const logTicks = [1, 10, 100, 1000].filter((t) => t <= max)
  const innerH = Math.max(248, data.length * 18)

  return (
    <ChartCard
      label="DEPLOYMENT"
      title="Operating CS Projects per State"
      sub="Real operating community-solar projects in the field — top 20 states by count."
      footer="Source: Lawrence Berkeley National Lab (LBNL) “Sharing the Sun” project database, Q4 2024 release — deployment ground truth, distinct from program authorization."
      className="h-full"
      headerRight={
        <ChartToggle
          ariaLabel="Project-count axis scale"
          value={scale}
          onChange={setScale}
          options={[{ value: 'linear', label: 'Lin' }, { value: 'log', label: 'Log' }]}
        />
      }
    >
      <div style={{ height: 288, overflowY: 'auto', width: '100%' }} className="thin-scrollbar">
        <div style={{ height: innerH, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 24, left: 4, bottom: 4 }}>
              <XAxis
                type="number"
                scale={isLog ? 'log' : 'linear'}
                domain={isLog ? [1, max] : [0, 'dataMax']}
                ticks={isLog ? logTicks : undefined}
                allowDataOverflow={isLog}
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
                cursor={{ fill: 'rgba(94,234,212,0.06)' }}
                formatter={(_v, _n, props) => {
                  const p = props?.payload || {}
                  return [`${p.count} projects · ${p.totalMw ?? 0} MW total · median ${p.median ?? 0} MW`, '']
                }}
              />
              <Bar dataKey="count" shape={<DotGlyph />} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}
