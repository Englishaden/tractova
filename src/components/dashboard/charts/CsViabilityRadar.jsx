import { useMemo, useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import ChartCard, { CHART_TOOLTIP } from './ChartCard'

// CsViabilityRadar — Markets section. Side-by-side state comparison across four
// CS-viability dimensions (the "CS Viability Comparison" concept). Pick up to 3
// states; each draws a polygon.
//
// DATA HONESTY: there are no real per-state pillar sub-scores at this layer
// (Lens computes those per-county). So the four axes are NORMALIZED 0–100 from
// real curated state-program fields via explicit ordinal maps below — labeled
// as comparative signals in the footer, never presented as published values.

const AXES = ['Program', 'Interconnect', 'Capacity', 'Runway']
const SERIES_COLORS = ['#14B8A6', '#FBBF24', '#60A5FA']

const PROGRAM_SCORE = { active: 90, limited: 55, pending: 30, none: 8 }
const IX_SCORE = { easy: 88, moderate: 62, hard: 35, very_hard: 14 }
function capacityScore(mw = 0) {
  if (mw > 1000) return 100
  if (mw > 500) return 78
  if (mw > 100) return 55
  if (mw > 0) return 30
  return 8
}
function runwayScore(runway) {
  if (!runway || !Number.isFinite(runway.months)) return 0
  return Math.min(100, Math.round((runway.months / 24) * 100))
}

function axisValues(p) {
  return {
    Program:      PROGRAM_SCORE[p.csStatus] ?? 8,
    Interconnect: IX_SCORE[p.ixDifficulty] ?? 50,
    Capacity:     capacityScore(p.capacityMW),
    Runway:       runwayScore(p.runway),
  }
}

export default function CsViabilityRadar({ programs = [], expandable = false, isExpanded = false, onToggleExpand }) {
  // Selectable pool = states with a program, by score desc.
  const pool = useMemo(
    () => programs.filter((p) => p.csStatus && p.csStatus !== 'none').sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0)),
    [programs],
  )

  const [selected, setSelected] = useState(() => pool.slice(0, 3).map((p) => p.id))
  // keep selection valid as pool loads
  const validSelected = selected.filter((id) => pool.some((p) => p.id === id))
  const active = validSelected.length ? validSelected : pool.slice(0, 3).map((p) => p.id)

  const toggle = (id) => {
    setSelected((prev) => {
      const cur = prev.filter((x) => pool.some((p) => p.id === x))
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= 3) return [...cur.slice(1), id] // drop oldest
      return [...cur, id]
    })
  }

  const byId = useMemo(() => Object.fromEntries(pool.map((p) => [p.id, p])), [pool])

  const data = useMemo(() => {
    const vals = active.map((id) => ({ id, v: axisValues(byId[id]) })).filter((x) => byId[x.id])
    return AXES.map((axis) => {
      const row = { axis }
      for (const { id, v } of vals) row[id] = v[axis]
      return row
    })
  }, [active, byId])

  if (pool.length === 0) {
    return (
      <ChartCard title="CS Viability Comparison" sub="Loading state programs…" className="h-full">
        <div className="h-[260px]" />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="CS Viability Comparison"
      sub={`Compare up to 3 states across 4 dimensions · ${active.length} selected`}
      footer="Axes normalized 0–100 from curated state-program fields (program status · IX difficulty · capacity tier · runway) — comparative signals, not Lens per-county sub-scores. Runway = 0 where enrollment rate isn't seeded."
      className="h-full"
      expandable={expandable}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {/* State picker */}
      <div className="flex flex-wrap gap-1 mb-2 max-h-16 overflow-y-auto thin-scrollbar">
        {pool.map((p) => {
          const idx = active.indexOf(p.id)
          const on = idx >= 0
          const color = on ? SERIES_COLORS[idx] : null
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-all outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--link,#5EEAD4)]"
              style={{
                background: on ? `${color}22` : 'transparent',
                border: `1px solid ${on ? color : 'var(--cards-border)'}`,
                color: on ? color : 'var(--text-label)',
              }}
            >
              {on && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
              <span className="font-mono text-[10px] font-bold">{p.id}</span>
            </button>
          )
        })}
      </div>

      <div style={{ width: '100%', height: 248 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 18 }} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-label, #98A4B6)', fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {active.map((id, i) => (
              <Radar
                key={id}
                name={byId[id]?.name || id}
                dataKey={id}
                stroke={SERIES_COLORS[i]}
                fill={SERIES_COLORS[i]}
                fillOpacity={0.16}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            <Tooltip {...CHART_TOOLTIP} cursor={false} />
            <Legend iconType="plainline" iconSize={10} wrapperStyle={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
