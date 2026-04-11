import metrics from '../data/metrics'

const cards = [
  {
    label: 'States w/ Active CS',
    value: metrics.statesWithActiveCS,
    sub: `${metrics.statesWithAnyCS} with any program`,
    color: 'text-primary',
  },
  {
    label: 'Utilities w/ IX Headroom',
    value: metrics.utilitiesWithIXHeadroom,
    sub: 'open queue capacity',
    color: 'text-primary',
  },
  {
    label: 'Policy Alerts This Week',
    value: metrics.policyAlertsThisWeek,
    sub: 'across all pillars',
    color: 'text-accent-500',
  },
  {
    label: 'Avg CS Capacity Left',
    value: metrics.avgCSCapacityRemaining,
    sub: 'across active programs',
    color: 'text-primary',
  },
  {
    label: 'MW in Active Pipeline',
    value: metrics.totalMWInPipeline.toLocaleString(),
    sub: 'across active/limited states',
    color: 'text-primary',
  },
]

export default function MetricsBar() {
  return (
    <div className="grid grid-cols-5 gap-4 mt-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-gray-200 rounded-lg px-5 py-4"
        >
          <div className={`text-2xl font-bold ${c.color} leading-none`}>{c.value}</div>
          <div className="text-xs font-semibold text-gray-700 mt-1.5">{c.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
