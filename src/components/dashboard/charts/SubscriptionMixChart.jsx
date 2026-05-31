import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, LabelList } from 'recharts'
import { getCsSubscriptionMixByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP, CHART_AXIS } from './ChartCard'

// Total-MW label drawn just past each 100% bar's right edge (preserves the
// absolute magnitude the normalized share view drops). `value` = row.total.
function renderTotalLabel(props) {
  const { x, y, width, height, value } = props
  if (value == null) return null
  return (
    <text
      x={x + width + 6} y={y + height / 2} dy={3.5} textAnchor="start"
      fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize={9}
      fill="var(--text-muted, #6C7A91)"
    >
      {Number(value).toLocaleString()} MW
    </text>
  )
}

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

export default function SubscriptionMixChart({ expandable = false, isExpanded = false, onToggleExpand }) {
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
      .slice(0, isExpanded ? 15 : 8)
      .map((r) => {
        const t = r.total || 1
        return {
          name:        r.stateId,
          // normalized to % share so a 4,000 MW state and a 5 MW state read
          // their channel split equally — no slivers-vs-giant-bar.
          utility:     (r.utility / t) * 100,
          thirdParty:  (r.thirdParty / t) * 100,
          combination: (r.combination / t) * 100,
          unknown:     (r.unknown / t) * 100,
          total:       r.total,
          _raw: { utility: r.utility, thirdParty: r.thirdParty, combination: r.combination, unknown: r.unknown },
        }
      })
  }, [rows, isExpanded])

  const loading = rows === null
  const empty = !loading && data.length === 0

  return (
    <ChartCard
      title="Subscription Channel Mix"
      sub={`${isExpanded ? 'Top 15' : 'Top 8'} states by operating CS capacity · channel share of each state's MW`}
      footer="Source: cs_projects.subscription_marketer (LBNL/NREL Sharing the Sun, Jan 2026). 'Unspecified' = projects the source left unlabeled — shown, not dropped. Sharing the Sun does not publish a residential/commercial subscriber breakdown."
      className="h-full"
      expandable={expandable}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
        <div style={{ height: Math.max(300, data.length * 24), width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={CHART_AXIS.tick}
                axisLine={CHART_AXIS.axisLine}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                interval={0}
                tick={CHART_AXIS.tick}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                {...CHART_TOOLTIP}
                cursor={false}
                formatter={(value, name, entry) => {
                  const key = entry?.dataKey
                  const rawMW = entry?.payload?._raw?.[key] ?? 0
                  return [`${Math.round(value)}% · ${Number(rawMW).toLocaleString()} MW`, name]
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ paddingTop: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-label)' }}
              />
              {CHANNELS.map((c, i) => {
                const last = i === CHANNELS.length - 1
                return (
                  <Bar
                    key={c.key}
                    dataKey={c.key}
                    name={c.label}
                    stackId="mix"
                    fill={c.color}
                    radius={last ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  >
                    {last && <LabelList dataKey="total" content={renderTotalLabel} />}
                  </Bar>
                )
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
