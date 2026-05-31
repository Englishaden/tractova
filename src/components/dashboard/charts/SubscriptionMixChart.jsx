import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getCsSubscriptionMixByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP } from './ChartCard'

// Markets & Policy — Subscription Channel Mix.
// A donut of the AGGREGATE channel split (who markets operating CS capacity —
// Utility-run / Third-party / Combination / Unspecified) across all states with
// operating CS, mimicking the IX donut on the Analytics tab. A part-to-whole
// composition reads far better as a radial donut than the old full-width 100%
// stacked bars (which buried small states and felt heavy). Expand reveals the
// per-state dominant-channel breakdown so the state detail isn't lost.
//
// `Unspecified` = projects the source left unlabeled — shown, not dropped.
// Data: getCsSubscriptionMixByState() → cs_projects.subscription_marketer.

const CHANNELS = [
  { key: 'utility',     label: 'Utility-run',  color: '#14B8A6' },
  { key: 'thirdParty',  label: 'Third-party',  color: '#5EEAD4' },
  { key: 'combination', label: 'Combination',  color: '#FBBF24' },
  { key: 'unknown',     label: 'Unspecified',  color: '#64748B' },
]
const COLOR_OF = Object.fromEntries(CHANNELS.map((c) => [c.key, c.color]))
const LABEL_OF = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]))

export default function SubscriptionMixChart({ expandable = false, isExpanded = false, onToggleExpand }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCsSubscriptionMixByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [])

  const { donutData, total, perState } = useMemo(() => {
    const states = (rows || []).filter((r) => r.total > 0)
    const agg = { utility: 0, thirdParty: 0, combination: 0, unknown: 0 }
    for (const r of states) {
      agg.utility += r.utility; agg.thirdParty += r.thirdParty
      agg.combination += r.combination; agg.unknown += r.unknown
    }
    const tot = agg.utility + agg.thirdParty + agg.combination + agg.unknown
    const donutData = CHANNELS.map((c) => ({ name: c.label, value: agg[c.key], color: c.color, key: c.key }))
      .filter((d) => d.value > 0)
    const perState = [...states].sort((a, b) => b.total - a.total).slice(0, 8).map((r) => {
      const dom = [['utility', r.utility], ['thirdParty', r.thirdParty], ['combination', r.combination], ['unknown', r.unknown]]
        .sort((a, b) => b[1] - a[1])[0]
      return { id: r.stateId, total: r.total, domKey: dom[0], domPct: r.total ? Math.round((dom[1] / r.total) * 100) : 0 }
    })
    return { donutData, total: tot, perState }
  }, [rows])

  const loading = rows === null
  const empty = !loading && total === 0

  return (
    <ChartCard
      title="Subscription Channel Mix"
      sub="Who markets operating CS capacity — share of total MW"
      footer="Source: LBNL/NREL Sharing the Sun (Jan 2026). 'Unspecified' = source left unlabeled — shown, not dropped."
      className="h-full"
      expandable={expandable}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {loading ? (
        <div style={{ height: 210 }} className="flex items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>Loading deployments…</p>
        </div>
      ) : empty ? (
        <div style={{ height: 210 }} className="flex items-center justify-center">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No operating CS projects found in the dataset.</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {/* Donut + centered total */}
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius="58%" outerRadius="86%" paddingAngle={2}
                  isAnimationActive={false}
                >
                  {donutData.map((d) => (
                    <Cell key={d.key} fill={d.color} stroke="var(--cards-bg, #131C2C)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={false}
                  formatter={(value, name) => [`${Math.round(value).toLocaleString()} MW · ${total > 0 ? Math.round((value / total) * 100) : 0}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-[16px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>
                {Math.round(total).toLocaleString()}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] mt-0.5" style={{ color: 'var(--text-muted)' }}>MW total</span>
            </div>
          </div>

          {/* Breakdown legend (channel · MW · %) */}
          <ul className="min-w-[200px] max-w-[300px] space-y-1.5">
            {donutData.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-label)' }}>{d.name}</span>
                </div>
                <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>
                  {Math.round(d.value).toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>MW · {total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Expand → per-state dominant channel */}
          {isExpanded && (
            <div className="w-full mt-1 pt-2 border-t" style={{ borderColor: 'var(--cards-border)' }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--text-muted)' }}>Top states · dominant channel</p>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                {perState.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_OF[s.domKey] }} />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{s.id}</span>
                    </div>
                    <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }} title={LABEL_OF[s.domKey]}>
                      {s.domPct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  )
}
