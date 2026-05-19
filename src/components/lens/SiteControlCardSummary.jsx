// Site Control summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'

const PILLAR_ACCENT = '#2563EB'

export default function SiteControlCardSummary({ siteControl, geospatial, county, stateName, score, coverage, onOpen }) {
  const title = county ? `${county} County` : (stateName || 'Site')

  // Caption prefers live geospatial coverage (NWI wetlands + SSURGO
  // farmland, all 3,142 counties) over curated booleans. When neither
  // is available, surface the empty-state honestly.
  const wet = geospatial?.wetlandCoveragePct
  const farm = geospatial?.primeFarmlandPct
  let caption = null
  if (wet != null || farm != null) {
    const parts = []
    if (wet != null) parts.push(`Wetlands ${wet.toFixed(1)}%`)
    if (farm != null) parts.push(`Prime farmland ${farm.toFixed(1)}%`)
    caption = parts.join(' · ')
  } else if (siteControl?.availableLand != null) {
    caption = siteControl.availableLand
      ? 'Curated: developable land identified'
      : 'Curated: limited developable land'
  } else {
    caption = 'No site signal yet for this county'
  }

  // Status chip: tone derives from wetland coverage if present (>=25% =
  // permit risk), or curated availableLand if not.
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
      pillarLabel="03 / Site Control"
      pillarAccent={PILLAR_ACCENT}
      title={title}
      score={score}
      coverage={coverage}
      caption={caption}
      statusChip={statusChip}
      onOpen={onOpen}
    />
  )
}
