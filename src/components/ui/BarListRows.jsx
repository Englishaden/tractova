import AnimatedList from './AnimatedList'

// BarListRows — JSX port of the Tremor "Bar List" pattern (Skills/Tremor/
// Bar List/*), re-themed to our dark teal tokens. Each row is a label sitting
// on a proportional value bar (width ∝ value / max), with the formatted value
// right-aligned. Replaces the plain rank+name+value list in the KPI-card
// reveals so the top-N comparison reads at a glance.
//
// Picked Bar List iteration 1/5 (the clean label-on-bar + value layout) over
// the heavier 2/3/4 variants (search Dialog + "show more" modal) — the reveal
// is already a compact disclosure, so the modal machinery would be overkill.
//
// Usage:
//   <BarListRows
//     rows={[{ name: 'NY', value: 1320 }, ...]}
//     valueFormatter={(v) => `${v.toLocaleString()} MW`}
//     sub="Top 4 by remaining capacity"
//   />

export default function BarListRows({
  rows = [],
  valueFormatter = (v) => v,
  // Bar fill — a teal gradient (bright leading edge → faded tail) so the bar
  // reads as an obvious proportional bar against the dark card, not a hairline.
  color = 'linear-gradient(90deg, rgba(20,184,166,0.42), rgba(20,184,166,0.10))',
  sub,
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          No states match
        </span>
      </div>
    )
  }

  const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1)

  return (
    <div>
      <AnimatedList className="space-y-1" delay={0.05}>
        {rows.map((r) => {
          const pct = Math.max(2, ((Number(r.value) || 0) / max) * 100)
          return (
            <div key={r.id ?? r.name} className="relative overflow-hidden rounded-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {/* proportional bar — bright teal left edge marks every row even
                  when the value (and thus the bar) is tiny */}
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${pct}%`, background: color, borderLeft: '2px solid #2DD4BF' }}
                aria-hidden="true"
              />
              {/* label + value sit on top of the bar */}
              <div className="relative flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {r.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums font-bold shrink-0" style={{ color: 'var(--link, #5EEAD4)' }}>
                  {valueFormatter(r)}
                </span>
              </div>
            </div>
          )
        })}
      </AnimatedList>
      {sub && (
        <p className="mt-1.5 pt-1 border-t text-[9px] font-mono uppercase tracking-[0.16em]" style={{ borderColor: 'var(--cards-border)', color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
