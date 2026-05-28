import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// Chart 1: CS Program Status Heatmap.
// Horizontal stacked bar — single row showing how the 51 states distribute
// across the 4 program-status buckets. Compact "where does CS stand
// nationally?" read.
//
// Data source: state_programs (all 51 rows)
// Coverage: 100% — all states have a cs_status value.

const STATUS_COLORS = {
  active:  { fill: '#14B8A6', label: 'Active' },
  limited: { fill: '#5EEAD4', label: 'Limited' },
  pending: { fill: '#FBBF24', label: 'Pending' },
  none:    { fill: '#3F4E68', label: 'No program' },
}

export default function CsProgramStatusBar({ programs = [], filterStates = [] }) {
  const data = useMemo(() => {
    const filterSet = new Set(filterStates)
    const buckets = { active: 0, limited: 0, pending: 0, none: 0 }
    for (const s of programs) {
      if (filterSet.size > 0 && !filterSet.has(s.id)) continue
      const key = s.csStatus in buckets ? s.csStatus : 'none'
      buckets[key] += 1
    }
    // Reshape to single-row stacked bar
    return [{ name: 'States', ...buckets }]
  }, [programs, filterStates])

  const total = data[0] ? (data[0].active + data[0].limited + data[0].pending + data[0].none) : 0

  return (
    <ChartCard
      label="Chart 01"
      title="CS Program Status — National Distribution"
      sub={`${total} state${total === 1 ? '' : 's'} ${filterStates.length > 0 ? '(filtered)' : '(all)'} grouped by community-solar program maturity.`}
      footer="Source: state_programs. Active = enrollment open; Limited = capped capacity; Pending = legislation filed."
    >
      <div style={{ height: 80, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip {...CHART_TOOLTIP} cursor={{ fill: 'rgba(94,234,212,0.08)' }} />
            {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
              <Bar key={key} dataKey={key} stackId="status" fill={cfg.fill} name={cfg.label} radius={key === 'active' ? [4, 0, 0, 4] : key === 'none' ? [0, 4, 4, 0] : 0}>
                <LabelList
                  dataKey={key}
                  position="center"
                  fill="#0A1828"
                  fontSize={11}
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontWeight={700}
                  formatter={(v) => (v > 0 ? v : '')}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1">
        {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: cfg.fill }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-label)' }}>
              {cfg.label} · {data[0]?.[key] || 0}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
