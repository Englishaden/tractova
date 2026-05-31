import SortableTable from '../ui/SortableTable'
import ChartCard from './charts/ChartCard'

// StateMarketTable — Markets section. The per-state CS market at a glance as a
// SORTABLE TABLE (replaces the old StateProgramGrid box-of-cards — moving away
// from repetitive box layouts). Every field is read straight off the normalized
// getStatePrograms row; row click opens the canonical StateDetailPanel.
//
// Scope: states that actually have a program (csStatus !== 'none').

const STATUS_META = {
  active:  { label: 'Active',  order: 3, chip: 'bg-[rgba(20,184,166,0.15)] text-[#5EEAD4] border-[rgba(20,184,166,0.35)]' },
  limited: { label: 'Limited', order: 2, chip: 'bg-[rgba(251,191,36,0.12)] text-[#FBBF24] border-[rgba(251,191,36,0.32)]' },
  pending: { label: 'Pending', order: 1, chip: 'bg-[rgba(251,146,60,0.10)] text-[#FB923C] border-[rgba(251,146,60,0.28)]' },
}

const RUNWAY_COLOR = { strong: '#5EEAD4', moderate: '#2DD4BF', watch: '#FBBF24', urgent: '#F87171' }

function scoreColor(score) {
  if (score >= 75) return '#0F766E'
  if (score >= 60) return '#14B8A6'
  if (score >= 45) return '#2DD4BF'
  if (score >= 25) return '#99F6E4'
  return '#CCFBF1'
}

const COMPACT_ROWS = 8

export default function StateMarketTable({ programs = [], onSelectState, expandable = false, isExpanded = false, onToggleExpand }) {
  const rows = programs.filter((p) => p.csStatus && p.csStatus !== 'none')

  const columns = [
    {
      key: 'name', header: 'State', sortable: true,
      value: (r) => r.name,
      cell: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: 'status', header: 'Status', sortable: true,
      value: (r) => STATUS_META[r.csStatus]?.order ?? 0,
      cell: (r) => {
        const m = STATUS_META[r.csStatus]
        if (!m) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] font-bold border ${m.chip}`}>{m.label}</span>
      },
    },
    {
      key: 'capacity', header: 'Capacity', align: 'right', sortable: true,
      value: (r) => r.capacityMW || 0,
      cell: (r) => <span className="font-mono tabular-nums">{(r.capacityMW || 0).toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>MW</span></span>,
    },
    {
      key: 'runway', header: 'Runway', align: 'right', sortable: true,
      value: (r) => r.runway?.months ?? -1,
      cell: (r) => {
        if (!r.runway) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span className="font-mono tabular-nums" style={{ color: RUNWAY_COLOR[r.runway.urgency] || 'var(--text-primary)' }}>{r.runway.months}mo</span>
      },
    },
    {
      key: 'score', header: 'Feasibility', align: 'right', sortable: true,
      value: (r) => r.feasibilityScore || 0,
      cell: (r) => {
        const c = scoreColor(r.feasibilityScore || 0)
        return (
          <span className="inline-flex items-center justify-center rounded font-mono text-[11px] tabular-nums font-bold px-1.5 py-0.5"
            style={{ background: `${c}22`, color: c, minWidth: 28 }}>
            {r.feasibilityScore ?? '—'}
          </span>
        )
      },
    },
  ]

  const sub = rows.length === 0
    ? 'No state programs loaded'
    : isExpanded || rows.length <= COMPACT_ROWS
      ? `${rows.length} states · click a row for detail`
      : `Top ${COMPACT_ROWS} of ${rows.length} · expand for all`

  return (
    <ChartCard
      title="State Programs"
      sub={sub}
      className="h-full"
      expandable={expandable}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {rows.length === 0 ? (
        <p className="text-[11px] py-6 text-center" style={{ color: 'var(--text-muted)' }}>No state programs loaded.</p>
      ) : (
        <SortableTable
          columns={columns}
          rows={rows}
          initialSort={{ key: 'score', dir: 'desc' }}
          getRowId={(r) => r.id}
          onRowClick={(r) => onSelectState?.(r.id)}
          maxRows={isExpanded ? undefined : COMPACT_ROWS}
        />
      )}
    </ChartCard>
  )
}
