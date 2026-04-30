import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'

// V3 Strategy A — coverage tier badge.
//
// Tractova has different data depth across states. Surfacing this honestly
// raises trust (users always know what they're getting) and creates a
// natural upsell path for Tier 2 / Tier 3 expansion.
//
// Tiers:
//   full  — county-level intel, IX queue, substations, revenue rates,
//           PUC dockets, all AI features at full fidelity. Teal pill.
//   mid   — state-level program data + ISO/RTO IX summaries + PUC
//           docket monitoring + state retail rates. Lens still works.
//           Amber pill.
//   light — DSIRE-derived state-program data only. Lens shows guidance
//           with reasonable hedges. Gray pill.

const TIER_CONFIG = {
  full: {
    label:      'Full Coverage',
    short:      'Full',
    bg:         'rgba(20, 184, 166, 0.10)',
    color:      '#0F766E',
    border:     'rgba(15, 118, 110, 0.32)',
    description:
      'County-level intelligence, per-utility IX queue data, substations, revenue rates, and active PUC docket monitoring. Pro analysis at full fidelity.',
  },
  mid: {
    label:      'Mid Coverage',
    short:      'Mid',
    bg:         'rgba(245, 158, 11, 0.10)',
    color:      '#B45309',
    border:     'rgba(245, 158, 11, 0.36)',
    description:
      'State-level program data plus ISO/RTO IX summaries and PUC docket monitoring. Lens runs at state-level depth — reasonable for prospecting and adjacency analysis.',
  },
  light: {
    label:      'Light Coverage',
    short:      'Light',
    bg:         'rgba(90, 107, 122, 0.08)',
    color:      '#5A6B7A',
    border:     'rgba(90, 107, 122, 0.22)',
    description:
      'DSIRE-derived state-program data only. Lens provides reasonable guidance but lacks county / IX queue / docket depth. Useful for sanity-checking adjacent markets.',
  },
}

// `size`: 'sm' (compact, default) or 'md' (header-strip variant)
// `mode`: 'pill' (default badge) or 'inline' (no border, just colored text — for use inside other meta strips)
export default function CoverageBadge({ tier, size = 'sm', mode = 'pill', className = '' }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.light

  if (mode === 'inline') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.18em] cursor-help ${className}`}
            style={{ color: cfg.color }}
          >
            ◆ {cfg.short} Coverage
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/55 mb-1">
            Tractova Data Coverage
          </p>
          <p className="text-[12px] leading-relaxed">{cfg.description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const padCls = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5'
  const fontCls = size === 'md' ? 'text-[10px]' : 'text-[9px]'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`font-mono ${fontCls} uppercase tracking-[0.18em] font-semibold rounded-sm border cursor-help ${padCls} ${className}`}
          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
        >
          {cfg.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/55 mb-1">
          Tractova Data Coverage
        </p>
        <p className="text-[12px] leading-relaxed">{cfg.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}
