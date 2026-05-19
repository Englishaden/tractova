// Shared coverage chip — used by both §03 Dev Feasibility pillar cards
// AND §04 summary cards so the same lineage signal reads as one vocab
// across the result panel. Was duplicated as styled vs plain text in
// two places; unifying here.
//
// Coverage tier strings ('live' / 'researched' / 'curated' / 'fallback')
// come from scoreEngine.js. We surface them as eyebrow-mono chips with
// the same Radix Tooltip body the user already sees on the Dev
// Feasibility pillar cards.

import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip'

export const COVERAGE_TOOLTIPS = {
  live: {
    label: 'Live data',
    title: 'Live data',
    body: 'Score is driven by real-time data — IX queue scrapes (8 CS states), county geospatial (NWI wetlands + SSURGO farmland, all 3,142 counties), or live news/PUC ingest. Refreshed on cron; data-age stamps surface staleness when scrapers lag.',
  },
  researched: {
    label: 'Researched',
    title: 'Researched · curated',
    body: 'Score uses Tractova-curated baseline values — county_intelligence boolean (~18 states seeded), CS program status from state_programs (all 50 states). Stable but not live; updated when manual research lands.',
  },
  curated: {
    label: 'Curated baseline',
    title: 'Curated baseline',
    body: 'Score uses the state-level curated baseline (e.g. ixDifficulty tier from state_programs). All 50 states have a curated value; the live-blend overlay applies only where ix_queue_data is wired.',
  },
  fallback: {
    label: 'Fallback estimate',
    title: 'Fallback estimate',
    body: 'Curated data not yet seeded for this state/county — score uses a neutral placeholder (50–60 depending on pillar). Treat as low-confidence; verify directly before using to make a decision.',
  },
  none: null,
}

const COVERAGE_PALETTE = {
  live:       { bg: 'rgba(20,184,166,0.10)', fg: '#0F766E' },
  researched: { bg: 'rgba(15,26,46,0.06)',   fg: '#475569' },
  curated:    { bg: 'rgba(15,26,46,0.06)',   fg: '#475569' },
  fallback:   { bg: 'rgba(217,119,6,0.10)',  fg: '#92400E' },
}

// `variant='boxed'` renders with a top border separator (the §03 pillar
// card treatment — sits below the per-card body). `variant='inline'`
// drops the separator (the §04 summary card treatment — sits in the
// status chip row). Both render the same colored chip + tooltip body.
export default function CoverageChip({ coverage, variant = 'boxed' }) {
  if (!coverage || coverage === 'none') return null
  const palette = COVERAGE_PALETTE[coverage] || COVERAGE_PALETTE.curated
  const tip = COVERAGE_TOOLTIPS[coverage]
  const chip = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="eyebrow-mono px-1.5 py-0.5 rounded-sm cursor-help"
          style={{ background: palette.bg, color: palette.fg }}
        >
          {tip?.label || coverage}
        </span>
      </TooltipTrigger>
      {tip && (
        <TooltipContent side="top">
          <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>{tip.title}</p>
          <p className="leading-relaxed">{tip.body}</p>
        </TooltipContent>
      )}
    </Tooltip>
  )
  if (variant === 'inline') return chip
  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {chip}
    </div>
  )
}
