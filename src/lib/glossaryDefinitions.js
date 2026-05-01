// Canonical glossary definitions.
//
// Single source of truth for what each domain term means across the product.
// Consumed by:
//   - src/components/ui/GlossaryLabel.jsx — wraps any term in a Radix tooltip
//   - src/pages/Glossary.jsx — auto-generates one card per entry
//
// Pattern mirrors src/lib/techDefinitions.js: same shape so the existing
// Tooltip rendering can be reused. Each entry:
//   - title:  full name + acronym expansion (top of tooltip)
//   - short:  one-sentence summary (used for compact contexts)
//   - long:   2-3 sentence explanation (Glossary card body)
//   - inputs: data layers Tractova uses to compute or surface this signal
//
// When in doubt about adding a term: only add it if a small-shop analyst
// might hover-and-be-grateful. Don't include obvious words ("score",
// "project") or industry terms most CS developers already know cold.
export const GLOSSARY_DEFINITIONS = {
  'Site Control': {
    title: 'Site Control',
    short: 'County-level land suitability for ground-mount solar — wetlands, prime farmland, land use, parcel availability.',
    long: 'The pillar that answers "can a project actually get permitted and built here?" Tractova combines USFWS National Wetlands Inventory polygons with USDA SSURGO prime-farmland classification at the county level, plus curated land-use notes for high-volume CS counties. A low Site Control sub-score predicts permitting friction (wetland delineation, farmland conversion review, zoning variance).',
    inputs: 'USFWS NWI · USDA SSURGO · curated county_intelligence',
  },
  'IX': {
    title: 'Interconnection (IX)',
    short: 'Utility queue position, ease score, and typical study timeline for the project\'s point of connection.',
    long: 'The pillar that answers "can this project get on the grid in a reasonable timeframe?" Combines ISO/RTO queue data (live for 8 top CS markets) with curated state-level ixDifficulty baselines for the other 42 states. Live-blend overlay applies a quantitative adjustment from queue MW + average study months; clamped to ±10 so live signals never dominate structural ISO context.',
    inputs: 'ISO/RTO queue scrapers (live) · stateProgram.ixDifficulty (curated baseline)',
  },
  'Offtake': {
    title: 'Offtake',
    short: 'Revenue mechanism — community-solar program credits, C&I PPA, or BESS capacity-market revenue depending on tech.',
    long: 'The pillar that answers "how does this project actually make money?" For Community Solar: state CS program (capacity remaining, LMI carveout requirements, contract tenor). For C&I: retail electricity rates from EIA Form 861 (curated for 12 high-rate states). For BESS: ISO capacity-market clearing prices (curated for 10 active markets). For Hybrid: blended.',
    inputs: 'state_programs · revenue_stacks · EIA Form 861 · ISO capacity markets',
  },
  'Feasibility Index': {
    title: 'Feasibility Index',
    short: 'Composite 0-100 score blending Offtake (40%), Interconnection (35%), and Site Control (25%) sub-scores.',
    long: 'Tractova\'s headline composite for "how attractive is this project?" Computed live from the three pillar sub-scores using a weighted blend that emphasizes revenue (offtake) most, IX second, and site third. Adjusted by stage modifiers (a Construction-stage project gets +25 site-control credit reflecting de-risked permitting). 80+ = strong; 60-79 = viable; 40-59 = challenging; <40 = adverse.',
    inputs: 'computeSubScores(offtake, ix, site) → 0.40·offtake + 0.35·ix + 0.25·site',
  },
  'LMI Carveout': {
    title: 'LMI Carveout (Low-to-Moderate Income)',
    short: 'Required percentage of Community Solar subscribers who must be LMI households.',
    long: 'Most state Community Solar programs require a minimum % of subscribers (typically 20-40%) to qualify as LMI per HUD income limits. Higher LMI requirements mean more subscriber-acquisition complexity and a typical 5-15% revenue haircut. States with no LMI requirement (some Midwest markets) see materially easier project economics.',
    inputs: 'state_programs.lmi_required · state_programs.lmi_percent',
  },
  'Prime Farmland': {
    title: 'Prime Farmland',
    short: 'USDA classification flagging land most suitable for crop production — triggers Farmland Conversion Impact review.',
    long: 'A USDA SSURGO classification (`farmlndcl` field) marking soil with the highest agricultural productivity. Solar projects on prime farmland trigger NRCS Farmland Conversion Impact Rating review (FPPA) and frequently face local-zoning headwinds. Tractova surfaces per-county prime-farmland percentage; >25% triggers an availableLand=true flag in the site sub-score.',
    inputs: 'USDA SSURGO mapunit.farmlndcl per-county aggregate (Soil Data Access)',
  },
  'Wetland Warning': {
    title: 'Wetland Warning',
    short: 'County-level wetland coverage threshold flag — predicts CWA Section 404 permitting friction.',
    long: 'Triggered when USFWS NWI wetland coverage exceeds 15% of county AREALAND (categorized as "significant" or "severe"). Projects on wetland-flagged counties typically need wetland delineations, USACE Section 404 permits, and may face mitigation requirements. The flag is directional, not site-specific — a high wetland percentage means you should plan for delineation work, not that every parcel is wet.',
    inputs: 'USFWS National Wetlands Inventory · TIGER county geometry',
  },
  'Capacity Factor': {
    title: 'Capacity Factor',
    short: 'Effective annual production divided by nameplate × 8760 — typically 18-26% for fixed-tilt solar in the US.',
    long: 'The fraction of the year a system effectively runs at full nameplate. Tractova uses NREL PVWatts state-level baselines (refreshed quarterly); a 5 MW system in IL with a 19% capacity factor produces ~8,300 MWh/year (5 × 8760 × 0.19). Used in revenue projections and the Scenario Studio capacity-factor slider.',
    inputs: 'NREL PVWatts API v8 · state-level fixed-tilt baseline',
  },
  'REC': {
    title: 'REC (Renewable Energy Certificate)',
    short: 'Tradeable certificate representing the environmental attributes of 1 MWh of renewable generation.',
    long: 'In most state CS programs, the developer earns one REC per MWh produced, sold either to the utility (e.g. Illinois Shines via the Adjustable Block Program) or onto a state-specific market (e.g. NJ SRECs). REC price is often the largest single revenue component for CS projects in REC-market states. Tractova surfaces state REC prices from curated DSIRE data + program-specific filings.',
    inputs: 'DSIRE · state regulatory program filings (Illinois Shines, NJ SREC, MA SMART, MD CS)',
  },
  'ITC': {
    title: 'ITC (Investment Tax Credit)',
    short: 'IRA Section 48 federal tax credit equal to 30% of qualifying project costs, plus stackable bonus adders.',
    long: 'Base 30% ITC for renewable projects meeting prevailing wage + apprenticeship requirements. Stackable adders: Energy Community siting (+10%), Low-Income Community §48(e) (+10-20%), domestic content (+10%). Most CS projects under 5 MW qualify for the full adder stack, pushing effective ITC to 50%+. Tractova computes per-county adder eligibility from DOE NETL EDX (Energy Communities), HUD QCT/DDA, and CDFI NMTC LIC data.',
    inputs: 'DOE NETL EDX · HUD User · Census ACS (CDFI methodology)',
  },
  'Energy Community': {
    title: 'Energy Community',
    short: 'IRA-designated census tract or MSA qualifying for +10% ITC bonus — coal closures or fossil-fuel-employment areas.',
    long: 'Per IRA §45/§48, projects sited in qualifying tracts get an additional 10% ITC bonus. Two paths: (1) Coal Closure Communities — tracts with mine or generator closures since 1999/2009. (2) Statistical Areas — MSAs with high fossil-fuel-employment + above-average unemployment. Tractova flags county-level eligibility from DOE NETL EDX (the Treasury-designated source). Roughly 40% of US counties qualify under at least one path.',
    inputs: 'DOE NETL EDX ArcGIS FeatureServer (2024 designations)',
  },
  'Program Runway': {
    title: 'Program Runway',
    short: 'Estimated months until a state CS program\'s remaining capacity is fully enrolled.',
    long: 'Computed from current enrollment rate (MW/month) divided by remaining program capacity. <6 months = "urgent" — submit before the block closes. 7-12 months = "watch." Programs with multi-year runways are priced gently. Tractova tracks runway per state and surfaces it on Lens, Library, and Dashboard.',
    inputs: 'state_programs.capacity_mw · state_programs_snapshots (weekly enrollment deltas)',
  },
  'IX · Live': {
    title: 'IX · Live',
    short: 'This state has current ISO/RTO queue data feeding the IX sub-score — not a curated baseline.',
    long: 'When this badge appears, the Interconnection sub-score blends quantitative signals from the live ISO queue (avg study months, total MW pending) on top of the curated ixDifficulty baseline. Adjustment is clamped to ±10 so the live signal can move the score meaningfully without overwhelming structural ISO context. Currently live for 8 states: CO, IL, MA, MD, ME, MN, NJ, NY.',
    inputs: 'ix_queue_data table · ISO/RTO weekly scrapers · clamp(±10)',
  },
  'Site · Live': {
    title: 'Site · Live',
    short: 'This county has live geospatial data (NWI wetlands + SSURGO farmland) driving the Site Control sub-score.',
    long: 'When this badge appears, the Site Control sub-score is derived from authoritative federal sources for this specific county, not from a curated qualitative cell. Inputs are wetland coverage % (USFWS NWI) and prime farmland % (USDA SSURGO). Thresholds: wetlandWarning ≥ 15%, availableLand ≥ 25%. Replaces the legacy curated booleans for the 32 states that were never seeded — all 3,142 counties get live signals once the NWI seed completes.',
    inputs: 'USFWS NWI · USDA SSURGO · county_geospatial_data',
  },
}

// Convenience: shape for a `<GlossaryLabel>` short-tooltip use case.
export const GLOSSARY_SHORT_DEFS = Object.fromEntries(
  Object.entries(GLOSSARY_DEFINITIONS).map(([k, v]) => [k, v.short])
)
