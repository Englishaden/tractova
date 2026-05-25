// Site Control summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'

const PILLAR_ACCENT = '#2563EB'

export default function SiteControlCardSummary({ geospatial, county, stateName, score, coverage, onOpen }) {
  const title = county ? `${county} County` : (stateName || 'Site')

  // Status chip: tone derives from live wetland coverage when present
  // (>=25% = permit risk). Detailed geospatial breakdown lives in the modal.
  const wet = geospatial?.wetlandCoveragePct
  let statusChip = null
  if (wet != null) {
    const constrained = wet >= 25
    statusChip = (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-sm"
        style={
          constrained
            ? { background: 'rgba(217,119,6,0.12)', color: '#92400E', border: '1px solid rgba(217,119,6,0.35)' }
            : { background: 'rgba(20,184,166,0.12)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.35)' }
        }
      >
        {constrained ? 'Permit risk' : 'Wetland-clear'}
      </span>
    )
  }

  return (
    <SummaryShell
      pillarLabel="04 / Site Control"
      pillarAccent={PILLAR_ACCENT}
      title={title}
      score={score}
      coverage={coverage}
      statusChip={statusChip}
      onOpen={onOpen}
    />
  )
}
