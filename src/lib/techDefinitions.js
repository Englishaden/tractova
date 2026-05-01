// Canonical technology-type definitions.
//
// Single source of truth for what each technology label means across the
// product. Consumed by:
//   - src/pages/Glossary.jsx — renders one glossary card per entry
//   - src/pages/Library.jsx — hover tooltip on project-card tech metadata
//                              and on the FilterSelect "All Tech" option list
//   - src/pages/Search.jsx — hover tooltip on the Lens Technology FieldSelect
//
// Definitions reflect industry-standard meanings as of 2026, written for
// developers/investors who already know solar/storage basics but may not
// recognize a specific term (e.g. "Hybrid" can mean different things in
// different contexts; we pin it to "co-located solar + BESS" here).
//
// Structure mirrors the IX · Live tooltip shape in Search.jsx so the
// Tooltip rendering can reuse the same visual treatment:
//   - title:  bold one-line headline (top of tooltip)
//   - short:  one-sentence summary (used in dropdowns + glossary one-liner)
//   - long:   2-3 sentence explanation (glossary body)
//   - inputs: data layers Tractova uses to score this tech (footnote)

export const TECH_DEFINITIONS = {
  'Community Solar': {
    title: 'Community Solar',
    short: 'Subscription-based shared-solar program serving multiple retail customers from one facility.',
    long: 'A community solar facility (typically 1-5 MW) sells subscriptions to local residents and businesses; the utility credits each subscriber\'s monthly bill for their share of the facility\'s output. Enabled by state-level community solar legislation — eligibility, capacity caps, and LMI carve-out requirements vary by state. Tractova scores Community Solar feasibility using state CS program status (active / limited / pending / none), program capacity remaining, and LMI subscriber requirements.',
    inputs: 'state_programs · revenue_stacks · cron-driven program capacity tracking',
  },
  'C&I Solar': {
    title: 'C&I Solar (Commercial & Industrial)',
    short: 'Behind-the-meter or wheeling-PPA solar serving a single commercial/industrial off-taker.',
    long: 'A 1-50 MW solar system selling power directly to a corporate, industrial, or institutional buyer via a long-tenor PPA (typically 10-25 years). Economics depend on the off-taker\'s retail electricity rate (the higher the rate, the better the C&I PPA spread). Tractova\'s C&I score is calibrated against state-average commercial retail rates from EIA Form 861 — currently curated for 12 states, with the rest treated as "limited coverage."',
    inputs: 'EIA Form 861 retail rates · state CI tariff structures · ITC/PTC overlays',
  },
  'BESS': {
    title: 'BESS (Battery Energy Storage System)',
    short: 'Standalone storage selling capacity into wholesale markets and providing grid services.',
    long: 'A 1-100+ MW battery system that earns revenue from a stacked combination of: ISO/RTO capacity-market clearing prices, energy arbitrage (charge cheap, discharge expensive), frequency regulation, and other ancillary services. Land footprint is small (1-2 acres/MW vs solar\'s 5-7), so wetland and farmland constraints matter less. Tractova\'s BESS score weights ISO capacity-market structure heavily — currently calibrated for 10 states, mostly inside ISO-NE, PJM, NYISO, MISO, and SPP.',
    inputs: 'ISO/RTO capacity-market clearing prices · frequency-regulation revenue · IX queue intelligence',
  },
  'Hybrid': {
    title: 'Hybrid (Solar + Storage)',
    short: 'Co-located solar + battery facility, sharing interconnection and an ITC stack.',
    long: 'A solar facility paired with batteries on the same site, sharing one point of interconnection and (typically) one PPA. Storage shifts midday solar output into evening peak periods, firms capacity for the off-taker, and stacks the standalone storage ITC on top of the solar ITC for compounded tax-equity returns. IX studies are more complex (combined resource modeling), so Tractova applies a -5 IX score modifier vs solar-alone. Offtake economics blend the curated CS or C&I score with the BESS score.',
    inputs: 'state CS programs · ISO capacity-market clearing prices · IRA §48 storage ITC adders · IX queue (combined-resource studies)',
  },
}

// Convenience: shape for FilterSelect.optionTooltips — { [techName]: short }
export const TECH_FILTER_TOOLTIPS = Object.fromEntries(
  Object.entries(TECH_DEFINITIONS).map(([k, v]) => [k, v.short])
)
