import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS, CHART_GRID_STROKE } from './ChartCard'

// Chart 5: Policy & Market Pulse Stacked.
// Stacked area chart — 8-week trailing news-feed volume broken out by
// pillar (offtake / IX / site / policy). Reuses the
// policyPulseByPillar series added to getDashboardMetricsHistory.
//
// Reads "what does the conversation look like this quarter?" — is it
// dominated by offtake (program updates) or IX (queue dynamics) or
// site (geospatial / land) or pure policy (legislation)?

const PILLAR_CFG = [
  { key: 'offtake', label: 'Offtake',         color: '#14B8A6' },
  { key: 'ix',      label: 'Interconnection', color: '#FBBF24' },
  { key: 'site',    label: 'Site',            color: '#60A5FA' },
  { key: 'policy',  label: 'Policy',          color: '#A78BFA' },
]

export default function PolicyPulseStacked({ series = [], isExpanded = false, onToggleExpand }) {
  const hasData = Array.isArray(series) && series.length >= 2
  const chartH = isExpanded ? 360 : 220

  return (
    <ChartCard
      label="SIGNALS"
      title="Policy & Market Pulse"
      sub={hasData
        ? `8-week trailing news-feed volume by pillar.`
        : 'Weekly news history accruing — chart unlocks at ≥2 weeks of pillar-tagged signals.'}
      footer="Source: PV Magazine, Utility Dive, Solar Power World & Solar Industry RSS, AI-classified (relevance ≥ 60) and grouped by ISO week."
      className="h-full"
      expandable
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {hasData ? (
        <div style={{ height: chartH, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <defs>
                {PILLAR_CFG.map((p) => (
                  <linearGradient key={p.key} id={`pulse-${p.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={p.color} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={p.color} stopOpacity={0.08} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="week"
                tick={CHART_AXIS.tick}
                axisLine={CHART_AXIS.axisLine}
                tickLine={false}
                tickFormatter={(v) => v.replace(/^\d{4}-W/, 'W')}
              />
              <YAxis
                tick={CHART_AXIS.tick}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip {...CHART_TOOLTIP} cursor={{ stroke: 'rgba(94,234,212,0.30)', strokeWidth: 1 }} />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ paddingTop: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }}
              />
              {PILLAR_CFG.map((p) => (
                <Area
                  key={p.key}
                  type="monotone"
                  dataKey={p.key}
                  name={p.label}
                  stackId="pulse"
                  stroke={p.color}
                  strokeWidth={1.5}
                  fill={`url(#pulse-${p.key})`}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: chartH }} className="flex items-center justify-center">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Weekly history accruing — needs ≥2 weeks of data.</p>
        </div>
      )}
    </ChartCard>
  )
}
