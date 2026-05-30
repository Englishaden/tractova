import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import ChartCard, { CHART_TOOLTIP, TILE_H } from './ChartCard'

// Chart 6: IX Difficulty Distribution.
// Donut chart — distribution of state_programs.ix_difficulty across
// the 4 tiers (easy / moderate / hard / very_hard). Reads "what fraction
// of the country faces high IX friction?" — a market-sizing view that
// complements the CS-coverage chart.
//
// Data: state_programs.ixDifficulty (all 51 rows).

const TIER_CFG = [
  { key: 'easy',      label: 'Easy',      color: '#14B8A6' },
  { key: 'moderate',  label: 'Moderate',  color: '#5EEAD4' },
  { key: 'hard',      label: 'Hard',      color: '#FBBF24' },
  { key: 'very_hard', label: 'Very Hard', color: '#F87171' },
]

export default function IxDifficultyDonut({ programs = [], filterStates = [], isExpanded = false, onToggleExpand }) {
  const data = useMemo(() => {
    const filterSet = new Set(filterStates)
    const counts = { easy: 0, moderate: 0, hard: 0, very_hard: 0 }
    for (const s of programs) {
      if (filterSet.size > 0 && !filterSet.has(s.id)) continue
      const t = s.ixDifficulty
      if (t in counts) counts[t] += 1
    }
    return TIER_CFG.map((c) => ({ name: c.label, value: counts[c.key], color: c.color, key: c.key }))
  }, [programs, filterStates])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      label="INTERCONNECTION"
      title="Interconnection Difficulty Distribution"
      sub={`${total} state${total === 1 ? '' : 's'} ${filterStates.length > 0 ? '(filtered)' : '(all)'} grouped by IX friction tier.`}
      footer="Source: IX-difficulty tier admin-curated from ISO/RTO public queue reports (MISO / PJM / NYISO / ISO-NE). State-level baseline; per-county precision lives in /search (Lens)."
      className="h-full"
      expandable
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div style={{ height: isExpanded ? TILE_H.expanded : TILE_H.feature, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="85%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="var(--cards-bg, #131C2C)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              {...CHART_TOOLTIP}
              formatter={(value) => [`${value} state${value === 1 ? '' : 's'} · ${total > 0 ? Math.round((value / total) * 100) : 0}%`, '']}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
