import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { getCsSubscriptionMixByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// Markets & Policy — Subscription Channel Mix.
// Stacked horizontal bar: top 15 states by operating CS capacity (MW),
// stacked by who markets/subscribes the projects — Utility-run /
// Third-party / Combination. The honest read of the BUILD_LOG's
// "Subscriber Mix" section: LBNL/NREL Sharing the Sun does NOT publish a
// residential/commercial/municipal subscriber split, so we surface the
// dimension the source actually carries (subscription_marketer).
//
// `unknown` is its own visible segment — projects where the source left
// the marketer blank are shown, not silently dropped (data-honesty).
//
// Data: getCsSubscriptionMixByState() → cs_projects.subscription_marketer.

const CHANNELS = [
  { key: 'utility',     label: 'Utility-run',  color: '#14B8A6' },
  { key: 'thirdParty',  label: 'Third-party',  color: '#60A5FA' },
  { key: 'combination', label: 'Combination',  color: '#A78BFA' },
  { key: 'unknown',     label: 'Unspecified',  color: '#3F4E68' },
]

export default function SubscriptionMixChart() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCsSubscriptionMixByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    if (!rows) return []
    return rows
      .filter((r) => r.total > 0)
      .slice(0, 15)
      .map((r) => ({
        name:        r.stateId,
        utility:     r.utility,
        thirdParty:  r.thirdParty,
        combination: r.combination,
        unknown:     r.unknown,
        total:       r.total,
      }))
  }, [rows])

  const loading = rows === null
  const empty = !loading && data.length === 0

  return (
    <ChartCard
      label="Markets 01"
      title="Subscription Channel Mix"
      sub="Top 15 states by operating CS capacity, split by who markets the projects."
      footer="Source: cs_projects.subscription_marketer (LBNL/NREL Sharing the Sun, Jan 2026). 'Unspecified' = projects the source left unlabeled — shown, not dropped. Sharing the Sun does not publish a residential/commercial subscriber breakdown."
    >
      {loading ? (
        <div style={{ height: 340 }} className="flex items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>Loading deployments…</p>
        </div>
      ) : empty ? (
        <div style={{ height: 340 }} className="flex items-center justify-center">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No operating CS projects found in the dataset.</p>
        </div>
      ) : (
        <div style={{ height: Math.max(300, data.length * 22), width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
              <XAxis
                type="number"
                tick={CHART_AXIS.tick}
                axisLine={CHART_AXIS.axisLine}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
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
                formatter={(value, name) => {
                  const ch = CHANNELS.find((c) => c.label === name)
                  return [`${Number(value).toLocaleString()} MW`, ch?.label || name]
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ paddingTop: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }}
              />
              {CHANNELS.map((c, i) => (
                <Bar
                  key={c.key}
                  dataKey={c.key}
                  name={c.label}
                  stackId="mix"
                  fill={c.color}
                  radius={i === CHANNELS.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
