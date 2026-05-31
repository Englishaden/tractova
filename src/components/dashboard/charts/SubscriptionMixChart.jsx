import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getCsSubscriptionMixByState } from '../../../lib/programData'
import ChartCard, { CHART_TOOLTIP } from './ChartCard'

// Markets & Policy — Subscription Channel Mix.
// A donut of the channel split (who markets operating CS capacity — Utility-run
// / Third-party / Combination / Unspecified), mimicking the Analytics IX donut.
// Filterable: "All" shows the aggregate across every operating-CS state; click a
// state chip to scope the donut to that state and back — fully interactive.
// Expand reveals the per-state dominant-channel breakdown.
//
// `Unspecified` = projects the source left unlabeled — shown, not dropped.
// Data: getCsSubscriptionMixByState() → cs_projects.subscription_marketer.

// Four clearly-distinct intelligence hues (teal · sky · amber · slate) so the
// legend + slices differentiate at a glance.
const CHANNELS = [
  { key: 'utility',     label: 'Utility-run',  color: '#14B8A6' },
  { key: 'thirdParty',  label: 'Third-party',  color: '#38BDF8' },
  { key: 'combination', label: 'Combination',  color: '#FBBF24' },
  { key: 'unknown',     label: 'Unspecified',  color: '#64748B' },
]
const COLOR_OF = Object.fromEntries(CHANNELS.map((c) => [c.key, c.color]))
const LABEL_OF = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]))

export default function SubscriptionMixChart({ expandable = false, isExpanded = false, onToggleExpand }) {
  const [rows, setRows] = useState(null)
  const [selectedState, setSelectedState] = useState(null) // null = aggregate

  useEffect(() => {
    let cancelled = false
    getCsSubscriptionMixByState()
      .then((data) => { if (!cancelled) setRows(data || []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [])

  const { states, byState, agg, aggTotal, perState } = useMemo(() => {
    const states = (rows || []).filter((r) => r.total > 0).sort((a, b) => b.total - a.total)
    const agg = { utility: 0, thirdParty: 0, combination: 0, unknown: 0 }
    for (const r of states) {
      agg.utility += r.utility; agg.thirdParty += r.thirdParty
      agg.combination += r.combination; agg.unknown += r.unknown
    }
    const aggTotal = agg.utility + agg.thirdParty + agg.combination + agg.unknown
    const byState = Object.fromEntries(states.map((r) => [r.stateId, r]))
    const perState = states.slice(0, 8).map((r) => {
      const dom = [['utility', r.utility], ['thirdParty', r.thirdParty], ['combination', r.combination], ['unknown', r.unknown]]
        .sort((a, b) => b[1] - a[1])[0]
      return { id: r.stateId, total: r.total, domKey: dom[0], domPct: r.total ? Math.round((dom[1] / r.total) * 100) : 0 }
    })
    return { states, byState, agg, aggTotal, perState }
  }, [rows])

  // keep selection valid as data loads
  const activeState = selectedState && byState[selectedState] ? selectedState : null
  const source = activeState ? byState[activeState] : agg
  const total = activeState ? (byState[activeState].total || 0) : aggTotal
  const donutData = CHANNELS.map((c) => ({ name: c.label, value: source[c.key] || 0, color: c.color, key: c.key })).filter((d) => d.value > 0)

  const loading = rows === null
  const empty = !loading && states.length === 0

  return (
    <ChartCard
      title="Subscription Channel Mix"
      sub={activeState
        ? `${activeState} — channel share of ${Math.round(total).toLocaleString()} MW operating CS`
        : 'All states — channel share of total operating-CS MW'}
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
        <>
          {/* State filter — Aggregate ("All") + one chip per operating-CS state */}
          <div className="flex flex-wrap gap-1 mb-2 max-h-14 overflow-y-auto thin-scrollbar">
            {[{ id: null, label: 'All' }, ...states.map((s) => ({ id: s.stateId, label: s.stateId }))].map((opt) => {
              const on = activeState === opt.id || (opt.id === null && !activeState)
              return (
                <button
                  key={opt.id ?? 'all'}
                  type="button"
                  onClick={() => setSelectedState(opt.id)}
                  className="inline-flex items-center rounded px-1.5 py-0.5 transition-all outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--link,#5EEAD4)]"
                  style={{
                    background: on ? 'rgba(20,184,166,0.18)' : 'transparent',
                    border: `1px solid ${on ? 'var(--link, #5EEAD4)' : 'var(--cards-border)'}`,
                    color: on ? 'var(--link, #5EEAD4)' : 'var(--text-label)',
                  }}
                >
                  <span className="font-mono text-[10px] font-bold">{opt.label}</span>
                </button>
              )
            })}
          </div>

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
                <span className="font-mono text-[8px] uppercase tracking-[0.18em] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {activeState || 'MW total'}
                </span>
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
          </div>

          {/* Expand → per-state dominant channel (click a state to scope the donut) */}
          {isExpanded && (
            <div className="w-full mt-2 pt-2 border-t" style={{ borderColor: 'var(--cards-border)' }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--text-muted)' }}>Top states · dominant channel</p>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                {perState.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedState(s.id)}
                      className="w-full flex items-center justify-between gap-2 rounded px-1 py-0.5 transition-colors hover:bg-white/[0.04] outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--link,#5EEAD4)]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_OF[s.domKey] }} />
                        <span className="text-[10px] font-medium" style={{ color: activeState === s.id ? 'var(--link, #5EEAD4)' : 'var(--text-primary)' }}>{s.id}</span>
                      </div>
                      <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }} title={LABEL_OF[s.domKey]}>{s.domPct}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ChartCard>
  )
}
