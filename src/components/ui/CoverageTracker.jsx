// CoverageTracker — JSX port of the Tremor "Tracker" pattern (Skills/Tremor/
// Tracker.md), re-themed to our dark teal tokens. A dense row of one block per
// item, colored by status — an uptime-tracker-style "coverage at a glance"
// strip. Used by the CS Coverage KPI reveal to show program-status breadth
// across all seeded states (NOT a capacity ranking — that lives elsewhere).
//
// No new deps: native title tooltips + a count legend instead of the skill's
// suggested @radix-ui/react-hover-card (50 radix tooltips would be overkill).
//
// Usage:
//   <CoverageTracker rows={[{ name: 'NY', csStatus: 'active' }, ...]} />

// Program-status maturity ramp: active (open) → limited → pending → none.
const STATUS = {
  active:  { color: '#14B8A6',                label: 'Active' },
  limited: { color: '#5EEAD4',                label: 'Limited' },
  pending: { color: '#FBBF24',                label: 'Pending' },
  none:    { color: 'rgba(148,164,182,0.20)', label: 'No program' },
}
const ORDER = { active: 0, limited: 1, pending: 2, none: 3 }

export default function CoverageTracker({ rows = [] }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>
        No coverage data.
      </p>
    )
  }

  // Sort by maturity so the teal "active" cluster reads as the coverage front,
  // ties broken by remaining capacity (bigger first).
  const sorted = [...rows].sort(
    (a, b) =>
      (ORDER[a.csStatus] ?? 3) - (ORDER[b.csStatus] ?? 3) ||
      (b.capacityMW || 0) - (a.capacityMW || 0)
  )

  const counts = { active: 0, limited: 0, pending: 0, none: 0 }
  for (const r of rows) counts[r.csStatus in counts ? r.csStatus : 'none'] += 1

  // Only states that actually HAVE a program get an individual block — at ~50
  // states the old one-block-per-state strip rendered illegible 2px slivers.
  // The (usually large) "no program" set collapses into one labeled cap.
  const withProgram = sorted.filter((r) => (r.csStatus || 'none') !== 'none')

  const legend = ['active', 'limited', 'pending', 'none']

  return (
    <div>
      {/* Tracker strip — a legible block per program-state + a "no program" cap */}
      <div className="flex w-full gap-px h-6 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {withProgram.map((r) => {
          const s = STATUS[r.csStatus] || STATUS.none
          return (
            <div
              key={r.id ?? r.name}
              className="flex-1 min-w-[5px] transition-opacity hover:opacity-70"
              style={{ background: s.color }}
              title={`${r.name} · ${s.label}`}
            />
          )
        })}
        {counts.none > 0 && (
          <div
            className="shrink-0 flex items-center justify-center px-1.5"
            style={{ background: STATUS.none.color, minWidth: 32 }}
            title={`${counts.none} states · ${STATUS.none.label}`}
          >
            <span className="font-mono text-[8px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-muted)' }}>
              +{counts.none}
            </span>
          </div>
        )}
      </div>
      {/* Count legend — 2×2 */}
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
        {legend.map((key) => (
          <li key={key} className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS[key].color }} />
              <span className="text-[10px] truncate" style={{ color: 'var(--text-label)' }}>{STATUS[key].label}</span>
            </div>
            <span className="font-mono text-[10px] tabular-nums font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
              {counts[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
