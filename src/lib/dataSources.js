// ── Tractova data-source citation map — SINGLE SOURCE OF TRUTH ───────────────
// Consumed by BOTH the public /methodology page (src/pages/Methodology.jsx) AND
// the XLSX export's "Methodology & Sources" sheet (src/lib/exportHelpers.js).
// Promoted out of exportHelpers in the 2026-06 data audit (Wave 2) so the two
// surfaces can never drift — update sources HERE only.
//
// Two-layer honesty (the platform tenet — see [[feedback_data_honesty]]): each
// row separates what the SOURCE publishes (observed) from what Tractova
// SYNTHESIZES on top (the 0-100 signal, the editorial weights, the thresholds).
// `provides` = the observed layer; `synthesis` = the Tractova editorial layer,
// named explicitly so a developer/investor can trace every number to its origin.
//
// Tiers: A primary+live · B primary+static · C Tractova-editorial · D placeholder.
// Labels corrected in the audit: Energy Community is DOE NETL (not "EPA"); the
// wetlands layer is USFWS NWI (not "EPA"); C&I retail is EIA Form 861 while the
// Net Billing retail anchors are cross-referenced to EIA EPM (a different EIA
// product); OBBBA federal timing is keyed to primary IRS/Treasury guidance with
// Wood Mackenzie used only as a labeled analyst summary.

export const DATA_SOURCES = [
  // ── Composite ──────────────────────────────────────────────────────────────
  {
    pillar: 'Composite',
    component: 'Feasibility Index',
    source: 'Tractova scoreEngine',
    url: 'https://www.tractova.com/glossary#feasibility-index',
    tier: 'C',
    provides: 'A 0-100 composite blending the five signal pillars, rebalanced over whichever pillars have data for a given project (a missing pillar is excluded, never scored as zero). Per-pillar stage modifiers apply.',
    synthesis: 'Weights — Offtake 25% · Interconnection 25% · Incentives 20% · Site 20% · Policy & Timing 10% — are Tractova editorial. There is no primary-source anchor for "how much each pillar should count," so the Lens surfaces a weight-sensitivity RANGE (the score under five reasonable weight schemes) rather than implying false precision.',
  },

  // ── Offtake (25%) ────────────────────────────────────────────────────────────
  {
    pillar: 'Offtake',
    component: 'Community Solar programs (50 states + DC)',
    source: 'State PUC / program-administrator portals (Tractova-curated)',
    url: '',
    tier: 'C',
    provides: 'Program status, capacity remaining, LMI carve-out, and REC mechanism — read from each state\'s primary program documentation (Illinois Shines, NJ SREC/SuSI, MA SMART, MD CS, NY VDER, ME NEB, etc.).',
    synthesis: 'The {active/limited/pending/closed} status → base offtake score is a Tractova editorial mapping; magnitudes are curated, not published by any single source.',
  },
  {
    pillar: 'Offtake',
    component: 'C&I retail-rate anchor (48 states + DC)',
    source: 'EIA Form 861 — Commercial Retail Rates (+ EIA EPM Table 5.6.B)',
    url: 'https://www.eia.gov/electricity/sales_revenue_price/',
    tier: 'B',
    provides: 'Commercial-sector retail electricity rates — the anchor for C&I and net-metering offtake economics. The original 32 states off EIA Form 861 (2024); the 2026-06 extension off EIA EPM Table 5.6.B (Mar-2026, Form EIA-861M).',
    synthesis: 'The legacy 32 blend rate with a per-state market-depth adjustment (e.g. TX scores on volume despite a modest rate). The extension cohort uses a transparent rate-anchored formula — clamp(round(34 + 1.8·¢/kWh), 45, 72) — with no deep-market boost (thin / non-ISO markets). AK + HI stay on a directional baseline (islanded / atypical offtake). Sourced on disk in docs/eia-861/, with a CI review_due that forces re-sourcing.',
  },
  {
    pillar: 'Offtake',
    component: 'Net Billing export-credit ratio (12 states)',
    source: 'State PUC tariff filings + EIA EPM (retail cross-reference)',
    url: 'https://www.eia.gov/electricity/monthly/',
    tier: 'B+',
    provides: 'Per-state avoided-cost export-credit-to-retail RATIO, sourced from each utility/PUC tariff (e.g. CA NEM 3.0 ACC, AZ APS RCP, NC Duke NEEC). Retail anchors cross-referenced to EIA Electric Power Monthly commercial rates.',
    synthesis: 'The ratio is sourced/observed; the 0-100 offtake SIGNAL is Tractova\'s disclosed synthesis — anchor × (0.35 + 0.65·ratio), where 0.35 is the residual self-consumption floor. Time-of-use tariffs use the dominant-rate approximation. States without a citable ratio stay honestly gated.',
  },
  {
    pillar: 'Offtake',
    component: 'Standalone BESS (legacy, out-of-scope)',
    source: 'ISO/RTO capacity-market clearing prices',
    url: 'https://www.iso-ne.com/markets-operations/markets/forward-capacity-market',
    tier: 'C',
    provides: 'Capacity-market clearing prices + storage carve-outs (CAISO/ERCOT/PJM/NYISO/MISO/ISO-NE, 2024-25 cycle).',
    synthesis: 'Preserved only for legacy saved projects — merchant standalone storage is out of Tractova\'s distribution-scale DG scope. Editorial tiering.',
  },

  // ── Interconnection (25%) ────────────────────────────────────────────────────
  {
    pillar: 'Interconnection',
    component: 'NYISO distribution / CS pipeline (live)',
    source: 'NYSERDA + NYISO interconnection feeds',
    url: 'https://www.nyiso.com/interconnections',
    tier: 'A',
    provides: 'Live CS deployment-pipeline signals parsed on a weekly cron.',
    synthesis: 'Surfaced as live CONTEXT. A CS deployment pipeline is NOT ISO study-queue depth, so it is deliberately NOT blended into the IX score — the curated ixDifficulty baseline holds.',
  },
  {
    pillar: 'Interconnection',
    component: 'PJM queue (redistribution-restricted)',
    source: 'PJM Data Miner 2',
    url: 'https://dataminer2.pjm.com/',
    tier: 'B',
    provides: 'Interconnection-queue data under PJM\'s redistribution terms.',
    synthesis: 'May surface stale signals only, within PJM\'s redistribution restrictions.',
  },
  {
    pillar: 'Interconnection',
    component: 'Curated baseline (all 50 states)',
    source: 'ISO/RTO queue context (Tractova-curated)',
    url: 'https://www.tractova.com/glossary#ix',
    tier: 'C',
    provides: 'A per-state ixDifficulty enum (easy / moderate / hard / very_hard) encoding structural ISO context.',
    synthesis: 'The enum → 0-100 mapping {88/65/38/14} is Tractova editorial. Where a live distribution feed exists it adjusts the baseline by at most ±10, never overriding the structural read.',
  },

  // ── Incentives (20%) ──────────────────────────────────────────────────────────
  {
    pillar: 'Incentives',
    component: 'Energy Community ITC adder (+10%)',
    source: 'DOE NETL Energy Communities Data Layers',
    url: 'https://edx.netl.doe.gov/dataset/energy-communities-data-layers',
    tier: 'A-',
    provides: 'County-level eligibility for the §48E/§45Y Energy Community bonus (closed-coal / brownfield / fossil-fuel-employment tracts). Refreshed weekly against the 2024-vintage layer.',
    synthesis: 'Eligibility is observed federal data. Whether the +10% materializes is still site-specific (brownfield qualification is per-parcel) — Tractova scores the county-layer eligibility, not a guaranteed award.',
  },
  {
    pillar: 'Incentives',
    component: 'HUD QCT/DDA — informational context (not a §48(e) pathway)',
    source: 'HUD QCT/DDA dataset',
    url: 'https://www.huduser.gov/portal/datasets/qct.html',
    tier: 'A',
    provides: 'HUD Qualified Census Tract / Difficult Development Area designations (2026 vintage).',
    synthesis: 'Surfaced as context only. As of the 2026-06 audit it does NOT count toward the §48(e) Cat 1 Low-Income Community adder — §48(e) Cat 1 statutorily uses the NMTC LIC definition, not the LIHTC QCT designation, so QCT-eligibility alone no longer grants the +25. The LIC adder is NMTC-only (and capped to facilities ≤5 MW AC).',
  },
  {
    pillar: 'Incentives',
    component: '§48(e) Cat 1 Low-Income Community — NMTC pathway',
    source: 'DOE §48(e) Program Layers · CDFI CIMS NMTC LIC (ACS 2016-2020)',
    url: 'https://www.energy.gov/diversity/low-income-communities-bonus-credit-program',
    tier: 'A',
    provides: 'Census-tract Low-Income Community eligibility for the +10% §48(e) Cat 1 bonus, rolled up per county.',
    synthesis: 'The authoritative CDFI CIMS NMTC LIC determination (ACS 2016-2020 — the legally-operative §48(e) Cat 1 vintage), published via the DOE program; it applies the greater-of-state/MSA-MFI rule + special provisions (replacing Tractova\'s earlier ACS state-MFI derivation). Tractova rolls the tract file up to a per-county count — eligibility is per-tract, so a project must sit in a qualifying tract; verify the parcel.',
  },

  // ── Site (20%) ────────────────────────────────────────────────────────────────
  {
    pillar: 'Site',
    component: 'Prime farmland coverage',
    source: 'USDA SSURGO via Soil Data Access',
    url: 'https://sdmdataaccess.sc.egov.usda.gov/',
    tier: 'B+',
    provides: 'County prime-farmland % — LIVE (2,405 of 3,143 counties, refreshed weekly; AK absent + some areas unmapped — those counties score on wetland + flood).',
    synthesis: 'HIGH farmland coverage is treated as a siting CONSTRAINT (FPPA conversion review, ag-preservation ordinances), not an opportunity; ≥25% flags the constraint. The favorable/unfavorable threshold is Tractova editorial.',
  },
  {
    pillar: 'Site',
    component: 'Wetland coverage',
    source: 'USFWS National Wetlands Inventory',
    url: 'https://www.fws.gov/program/national-wetlands-inventory',
    tier: 'B-',
    provides: 'County wetland-richness index from NWI polygons (overlapping classifications can exceed 100%). ≥15% triggers a wetland warning + Section 404 flag.',
    synthesis: 'COMPLETE — all 3,143 counties (a throttle-safe weekly cron freshens batches; the original ~700-county local seed has fully caught up). The richness index sums overlapping NWI classifications so it can exceed 100% — wetland_category is the cleaner categorical signal driving the score. The 15% threshold is Tractova editorial; always confirm with a parcel-level delineation.',
  },
  {
    pillar: 'Site',
    component: 'Flood risk (third site constraint)',
    source: 'FEMA National Risk Index (NRI) — county layer',
    url: 'https://www.fema.gov/flood-maps/products-tools/national-risk-index',
    tier: 'B',
    provides: 'County flood risk RATING + 0-100 score — the worse of NRI inland (riverine) and coastal flooding. County-keyed (no parcel geometry).',
    synthesis: 'Tractova takes the worse of the two NRI flood ratings; a county rated Relatively High or Very High applies a flat site-score penalty (flood is a real constraint on buildable acreage / insurability / permitting, but mitigable — so a lighter hit than the wetland 404 gate). The two warning tiers + the penalty size are disclosed editorial. County-level screening — a specific parcel may sit in or out of a floodplain regardless.',
  },

  // ── Policy & Timing (10%) — added in the 2026-06 audit (was omitted) ─────────
  {
    pillar: 'Policy & Timing',
    component: 'Federal tax-credit timing (§48E/§45Y · FEOC · safe harbor)',
    source: 'IRS / U.S. Treasury OBBBA guidance (primary); Wood Mackenzie (analyst summary)',
    url: 'https://www.irs.gov/credits-deductions/businesses/clean-electricity-investment-credit',
    tier: 'B',
    provides: 'A rules engine over published federal law — the OBBBA §48E/§45Y cliffs, FEOC compliance, and start-of-construction safe-harbor dates — keyed to a project\'s target COD and stage.',
    synthesis: 'Statutory dates are primary (IRS/Treasury). Where a provision is cited via Wood Mackenzie it is a labeled analyst summary, not a primary source. Output is a risk TIER, never a synthesized dollar figure.',
  },
  {
    pillar: 'Policy & Timing',
    component: 'State policy headwind events',
    source: 'policy_impact_events (Tractova admin-curated)',
    url: '',
    tier: 'C',
    provides: 'Enacted/proposed state bills with a human-set severity × probability, gated by applicability (stage / MW band / technology).',
    synthesis: 'Severity and probability are admin-confirmed (AI may draft, but never publishes the score-driving fields). Only high-confidence, published events move the score AND appear in the AI brief. "No policy data for a state" is flagged as no-coverage, not scored as a clean 100.',
  },

  // ── Cross-pillar lineage ──────────────────────────────────────────────────────
  {
    pillar: 'Cross-pillar',
    component: 'Capacity factor / specific yield',
    source: 'NREL PVWatts v8 + LBNL Tracking the Sun + NREL CS Market & Modeling',
    url: 'https://pvwatts.nrel.gov/',
    tier: 'B',
    provides: 'State-level fixed-tilt capacity-factor baseline (PVWatts), cross-referenced against LBNL Tracking the Sun installed-system data and NREL\'s community-solar modeling.',
    synthesis: 'cs_specific_yield is DERIVED by Tractova from these baselines (not an observed per-project measurement) — treated as a synthesis layer, never presented as metered output.',
  },
  {
    pillar: 'Cross-pillar',
    component: 'Demographics — LMI / AMI',
    source: 'U.S. Census ACS 5-Year Estimates',
    url: 'https://www.census.gov/programs-surveys/acs',
    tier: 'B',
    provides: 'County LMI %, AMI bands — the basis for CS subscriber-eligibility math.',
    synthesis: 'Observed Census data; the subscriber-eligibility interpretation is Tractova\'s.',
  },
]

// The pillar order the /methodology page renders sections in.
export const PILLAR_ORDER = ['Composite', 'Offtake', 'Interconnection', 'Incentives', 'Site', 'Policy & Timing', 'Cross-pillar']

// Standing disclosure shown once on the page (and as the lead note on the sheet).
export const METHODOLOGY_DISCLOSURE =
  'Composite pillar weights are Tractova editorial — there is no primary source for "how much each pillar should count," so the Lens shows a weight-sensitivity range, not a single false-precision number. Every score separates the OBSERVED source layer from the Tractova SYNTHESIS layer; pillars without data for a project are rebalanced out, never scored as zero. All signals are screening-grade — verify interconnection, incentive eligibility, and site constraints with primary sources before committing capital.'

// Flatten to the XLSX "Methodology & Sources" sheet shape: [Pillar / Component,
// Source, URL, Notes]. Notes folds provides + synthesis so the sheet carries the
// same two-layer honesty as the page.
export function methodologySheetRows() {
  return DATA_SOURCES.map(s => [
    `${s.pillar} — ${s.component}`,
    s.source,
    s.url || '',
    s.synthesis ? `${s.provides}  ·  Tractova synthesis: ${s.synthesis}` : s.provides,
  ])
}

// Group rows by pillar in PILLAR_ORDER for the page.
export function dataSourcesByPillar() {
  return PILLAR_ORDER
    .map(pillar => ({ pillar, rows: DATA_SOURCES.filter(s => s.pillar === pillar) }))
    .filter(g => g.rows.length > 0)
}
