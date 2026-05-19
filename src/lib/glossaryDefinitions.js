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
    short: 'Composite 0-100 score blending Offtake (36%), Interconnection (31.5%), Site Control (22.5%), and Policy Climate (10%) sub-scores.',
    long: 'Tractova\'s headline composite for "how attractive is this project?" Computed live from four pillar sub-scores using a weighted blend that emphasizes revenue (offtake) most, IX second, site third, and active policy climate fourth (PIE-001). Adjusted by stage modifiers (a Construction-stage project gets +25 site-control credit reflecting de-risked permitting). 80+ = strong; 60-79 = viable; 40-59 = challenging; <40 = adverse.',
    inputs: 'computeSubScores(offtake, ix, site, policyClimate) → 0.36·offtake + 0.315·ix + 0.225·site + 0.10·policyClimate',
  },
  'Active Policy': {
    title: 'Active Policy Events',
    short: 'Enacted state-level policies (bills, PUC orders, tariff changes) that materially shift project economics or applicability.',
    long: 'When a state enacts a bill — Maine LD 1777 imposing per-kWAC fees, Minnesota PUC cutting CS bill credits, Virginia SB 254 expanding shared solar capacity — that policy event is captured as a row in policy_impact_events. Tractova classifies it by pillar (Offtake / IX / Site / Cross-cutting), MW band, applicability (new applications vs existing queue vs operating projects), and confidence. High-confidence rows feed Scenario Studio + the feasibility composite; medium/low rows surface qualitatively without adjusting numbers.',
    inputs: 'policy_impact_events table (admin-curated via /admin → Policy Impact tab; AI-assisted classification from URL paste)',
  },
  'Policy Climate': {
    title: 'Policy Climate (sub-score)',
    short: 'Fourth dimension of the Feasibility Index — aggregates active high-confidence policy events for the state into a ±50 shift from neutral.',
    long: 'For each state, Tractova sums the signed IRR-bps impact across active high-confidence policy_impact_events and maps it to a 0-100 sub-score (50 = neutral). A 500-bps headwind drops the score 10 points; a 1000-bps tailwind lifts it 20. The sub-score takes 10% weight in the composite. States with no high-confidence policies in scope land at exactly neutral so the policy slot only moves the composite when there\'s real signal to move it.',
    inputs: 'sum(irr_impact_bps) across applicable high-confidence rows · 50 bps per score point · ±50 clamp',
  },
  'Modeled in financials': {
    title: 'Modeled in financials',
    short: 'High-confidence policy events that have moved this project\'s Scenario Studio base IRR and the state feasibility composite.',
    long: 'Tractova\'s honest-data discipline: only high-confidence policy_impact_events rows are allowed to shift the numbers shown on the screen. The "Modeled in financials" badge marks rows that have actually adjusted Studio capex / opex / revenue and the policy_climate sub-score. Medium and low-confidence rows surface qualitatively (with full methodology + source) but never alter IRR or feasibility — they exist for situational awareness only.',
    inputs: 'impact_confidence = "high" · all four impact fields populated · derivation against revenue_rates baseline',
  },
  'Qualitative — not modeled': {
    title: 'Qualitative — not modeled',
    short: 'Medium or low-confidence policy events that appear here for awareness but have NOT shifted any displayed numbers.',
    long: 'When a source article describes a policy in prose but doesn\'t state the specific $/kW, %, or bps figures verbatim, the classifier marks it medium or low confidence. These rows are surfaced everywhere the high-confidence rows are — but with this badge to make clear that the IRR and feasibility numbers do NOT include any adjustment from them. To upgrade a row to "Modeled in financials", paste a source that quotes the numbers verbatim and re-scan.',
    inputs: 'impact_confidence in (medium, low) · raw_provisions sparsely populated',
  },
  'Operating Projects': {
    title: 'Operating CS Projects (ground truth)',
    short: 'Real-world operating community-solar projects in the state, sourced from NREL\'s Sharing the Sun database.',
    long: 'NREL publishes an annual dataset of every known operating community-solar project in the US — state, capacity, COD, owner/developer, utility, LMI status. Tractova seeds this into cs_projects to give the developer ground-truth on "what actually got built here." Count, total MW, vintage range, top developers, utility-type mix, and LMI penetration all come from this dataset. Refreshed annually as NREL re-issues the report.',
    inputs: 'cs_projects table (seeded from NREL Sharing the Sun Excel)',
  },
  'Comparable Deals': {
    title: 'Comparable Deals',
    short: 'Point-estimate examples of similar projects — same state, same technology, MW within ±50% to 2× of yours.',
    long: 'Two data sources merged: operating projects from cs_projects (NREL ground truth) and curated deal rows from comparable_deals (admin-curated from news articles + SEC filings + press releases). Each row shows MW AC, COD or expected COD, stage, and disclosed economics if any. Filtered to the developer\'s size band so the comps actually inform their underwriting.',
    inputs: 'cs_projects + comparable_deals · filtered by state, technology, mwRange [mw×0.5, mw×2]',
  },
  'Market Benchmarks': {
    title: 'Market Benchmarks',
    short: 'Statistical aggregates from operating projects — observed kWh/kW specific yield, deal-flow medians, etc.',
    long: 'Where Operating Projects shows raw per-project rows and Comparable Deals shows individual examples, Market Benchmarks shows the summary statistics. Today: specific-yield (kWh/kW/yr) observed from operating projects — used to validate the modeled production assumption Scenario Studio runs against. Future: median $/W installed, median IRR, deal-flow rates from comparable_deals once enough articles are seeded.',
    inputs: 'cs_specific_yield table (currently) · future: comparable_deals statistical rollups',
  },
  'Regulatory Watch': {
    title: 'Regulatory Watch (§ 06)',
    short: 'Chronological feed of state regulatory activity — pending bills, recent enacted events, and active PUC proceedings.',
    long: 'Where § 04 (Policy Climate) aggregates policy_impact_events into a pillar sub-score, § 06 takes the same table and slices it by TIME. The developer reads "what\'s pending right now, what just changed in the last 90 days, what\'s been on the books longer." Same source of truth, different cut — § 04 answers "how does policy stack up against this pillar?" while § 06 answers "what regulatory developments do I need to watch this week?" Events surface from policy article URLs (AI-classified), curated admin entries, and pasted PDF text from PUC press releases and state legislative bulletins.',
    inputs: 'policy_impact_events table (chronological by effective_date) · grouped into Pending → Recent → Earlier buckets',
  },
  'Active Proceedings': {
    title: 'Active Proceedings (PUC dockets)',
    short: 'Open state Public Utility Commission proceedings — comment-period dockets, pending decisions, recent filings.',
    long: 'State PUCs run the rule-making that turns policy into operational reality (IX standards, capacity allocation, tariff schedules, interconnection cost-sharing). Active Proceedings surfaces the dockets currently in flight: comment-open windows where developer input still matters, pending decisions about to land, and recent filings worth tracking. Curation-gated — only renders when at least one puc_dockets row has been seeded for the state, since per-state PUC interfaces are archaic and manual transcription is high-friction. For most states the policy_impact_events feed above carries the regulatory signal; this subsection only appears when admin has curated dockets specifically.',
    inputs: 'puc_dockets table (admin-curated via /admin → PUC Dockets tab)',
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
    long: 'In most state CS programs, the developer earns one REC per MWh produced, sold either to the utility (e.g. Illinois Shines via the Adjustable Block Program) or onto a state-specific market (e.g. NJ SRECs). REC price is often the largest single revenue component for CS projects in REC-market states. Tractova surfaces state REC prices from Tractova-curated state regulatory program filings.',
    inputs: 'State regulatory program filings (Illinois Shines, NJ SREC, MA SMART, MD CS)',
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
  'Scenario Studio': {
    title: 'Scenario Studio',
    short: 'Interactive sensitivity layer over an "achievable baseline" — drag sliders to see Year 1 revenue + payback shift in real time.',
    long: 'Tractova\'s deal-structuring tool. Each Lens result has a Scenario Studio tab that pre-computes an achievable baseline (industry-standard capex, IX cost, capacity factor, REC price for the state). Drag any of six sliders to model alternative scenarios — larger system, cheaper capex, looser allocation. Outputs Year 1 revenue + simple payback so you can quickly explore the deal envelope. NOT an investment-grade pro-forma; engage a financial advisor for IC modeling.',
    inputs: 'scenarioEngine · revenueEngine per-tech formulas · industry baselines',
  },
  'Achievable Baseline': {
    title: 'Achievable Baseline',
    short: 'Industry-standard reference point Tractova uses as the starting position for Scenario Studio sliders.',
    long: 'Combines per-state revenue rates (bill credit, REC price, capacity factor) from the live scoring engine with industry baselines for inputs not in the rates table — IX cost ($0.10/W typical) and program allocation (100%). The baseline isn\'t a forecast; it\'s a defensible starting point so you can immediately see how shifting any single input moves Year 1 revenue and payback.',
    inputs: 'revenue_rates table · curated industry-survey baselines',
  },
  'Year 1 Revenue': {
    title: 'Year 1 Revenue',
    short: 'Annualized gross revenue for the first year of operation — bill credits + RECs + ITC (annualized over 6 years).',
    long: 'Sum of all revenue streams in the project\'s first operational year. For Community Solar: bill credit revenue (kWh × bill credit ¢/kWh × allocation) + REC revenue (MWh × $/REC) + 1/6 of the ITC value. For C&I: PPA revenue + 1/6 ITC. For BESS: capacity payment + demand-charge revenue + arbitrage revenue. ITC is amortized over 6 years to match how tax-equity partners typically monetize it.',
    inputs: 'revenueEngine compute*Projection() per tech',
  },
  'Simple Payback': {
    title: 'Simple Payback',
    short: 'Total development cost (capex + IX cost) divided by Year 1 revenue — years to recoup capital.',
    long: 'A first-pass capital efficiency metric, not a financed-IRR view. Total dev cost = system capex (mw × $/W × 1M) + IX cost (mw × $/W × 1M). Lower is better; CS payback typically lands in the 5-9 year range, BESS in 4-7. Doesn\'t account for tax-equity stacking, debt structure, or escalators — see the disclaimer and engage an advisor for IC-grade modeling.',
    inputs: 'totalDevCost / year1Revenue · directional only',
  },
  'Capex': {
    title: 'Capex (Capital Expenditure)',
    short: 'Installed cost per watt of DC system capacity — covers panels, inverters, racking, BOS, and EPC labor.',
    long: 'Excludes interconnection costs (modeled separately). 2026 industry baseline: $1.50-$1.80/W for utility-scale CS, $2.00-$2.40/W for C&I rooftop, $350-$420/kWh for BESS. Lower-cost markets (Southwest, large project sizes) trend toward the bottom of the range. Sourced from Wood Mac H2 2025 + per-state revenue_rates seed.',
    inputs: 'revenue_rates.installed_cost_per_watt · Wood Mackenzie H2 2025',
  },
  'IX Cost': {
    title: 'IX Cost (Interconnection Cost)',
    short: 'Cost of grid upgrades + utility study fees needed to bring the project online — separate from system capex.',
    long: 'Covers utility-required network upgrades, point-of-interconnection equipment, and study fees (Feasibility, System Impact, Facilities). Baseline assumption: $0.10/W for typical CS sized 2-5 MW behind a substation with capacity. Can balloon to $0.30+/W in capacity-constrained ISO regions (PJM, NYISO) or where deep system upgrades are triggered. Use the Lens IX score + ix_queue_data to gauge whether your IX cost slider should sit above or below baseline.',
    inputs: 'industry survey baseline · ix_queue_data signals',
  },
  'Program Allocation': {
    title: 'Program Allocation',
    short: 'Fraction of the system\'s production that\'s actually compensated under the state CS program — capped at program rules.',
    long: 'Most state CS programs cap project size or require a minimum/maximum per-subscriber allocation. 100% allocation = the entire system\'s output earns the program tariff. Lower allocation (e.g. 70%) models the reality that some production is uncompensated overflow when the program block fills. Slider lets you stress-test scenarios where allocation is constrained by block oversubscription.',
    inputs: 'state CS program rules · Lens program runway data',
  },
  'REC Price': {
    title: 'REC Price',
    short: 'Per-MWh price for the project\'s renewable-attribute certificates — varies wildly by state and program tranche.',
    long: 'Spans from near-$0 (no REC market) to $85+/MWh (NJ SREC-II, MA SMART). For states with ABP/REC programs (IL, MD), the contracted price is typically locked at award; this slider models alternative outcomes (next-block pricing, REC market shifts). For states with no REC market, leave at baseline (0). Major revenue lever in REC-market states.',
    inputs: 'revenue_rates.rec_per_mwh · state regulatory filings (Tractova-curated)',
  },
  'IRR': {
    title: 'IRR (Internal Rate of Return)',
    short: 'Annualized return rate that makes the project\'s lifetime cashflows discount to zero — the headline IC metric.',
    long: 'Computed by Newton-Raphson root-finding on the project\'s 25-year cashflow stream (15-year for BESS). Year 0 = -(capex + IX cost). Years 1-25 = revenue (with 0.5%/yr degradation) - opex (baseline $20/kW/yr × 2.5%/yr inflation) + ITC annualized over 6 years. Solar CS projects typically land 8-15% IRR depending on REC market + tax-equity structure. Doesn\'t model debt leverage or tax-equity flips — engage an advisor for structured-finance IRR.',
    inputs: 'project cashflow stream · 25-yr life · 8% discount baseline · $20/kW/yr opex',
  },
  'LCOE': {
    title: 'LCOE (Levelized Cost of Energy)',
    short: 'Discounted lifetime cost divided by discounted lifetime production — what each MWh actually costs to produce.',
    long: 'A "what does it cost us to make a MWh?" metric that lets you compare projects at different scales or in different markets. Sum of (capex + present-value of opex) divided by sum of present-value of MWh production over project life, all discounted at 8%. Utility-scale solar typically lands $30-60/MWh in 2025. Lower is better. Not meaningful for BESS (storage cycles vs production), so the BESS view shows IRR + NPV instead.',
    inputs: 'discounted lifecycle cost / discounted lifetime MWh @ 8%',
  },
  'NPV': {
    title: 'NPV (Net Present Value @ 8%)',
    short: 'Sum of all cashflows over project life, discounted to today at the standard 8% rate. Positive = value creation.',
    long: 'The dollar value the project creates above the cost of capital. Computed as sum over 25 years of (Y1 revenue × degradation - opex + ITC) ÷ (1.08)^year, minus initial dev cost. Positive NPV means the project beats an alternative 8% return; negative means it doesn\'t. Adjust the discount rate assumption mentally if your hurdle rate differs (a 12% hurdle means the project needs to clear a higher bar).',
    inputs: 'cashflow stream · 8% discount rate baseline',
  },
  'Lifetime Rev': {
    title: 'Lifetime Revenue',
    short: 'Sum of nominal (un-discounted) revenue across all years of the project life — useful for sanity-checking deal size.',
    long: 'Total revenue the project will gross over its 25-year life (15-year for BESS), including ITC value. NOT discounted, so a $100K/yr project = $2.5M lifetime — but those late-year dollars are worth far less than today\'s. Use NPV for the actual value-creation metric; lifetime revenue is mostly a "deal scale" reference.',
    inputs: 'sum of yearly revenue with degradation applied',
  },
  'Equity IRR': {
    title: 'Equity IRR (with leverage)',
    short: 'IRR computed on equity cashflows after debt service — the return the equity investor actually sees.',
    long: 'Assumes 70/30 debt:equity capital structure at 6.5% all-in rate over 18-year amortization (typical IPP project finance). Year 0 = -equity (= 30% of dev cost). Years 1-N = revenue - opex - debt service. Equity IRR is typically 200-500 bps higher than project IRR for solar deals. Doesn\'t model tax-equity flips or sponsor-equity tranching — for those structures the actual return profile is materially different.',
    inputs: '70/30 debt:equity · 6.5% rate · 18-yr amortization',
  },
  'DSCR': {
    title: 'DSCR (Debt Service Coverage Ratio)',
    short: 'Year 1 NOI divided by annual debt service — the lender\'s primary "is this loan safe" metric.',
    long: 'Sized at NOI = Year 1 revenue (excluding ITC, since it\'s tax flow not cash) minus opex. Annual debt service is the level annuity payment on 70% of dev cost at 6.5% over 18 years. ≥1.30x is a typical lender minimum; 1.20-1.29x raises eyebrows but may close with sponsor support; <1.20x usually requires restructuring (more equity, longer tenor, or rate concession).',
    inputs: 'Year 1 NOI / annual debt service · 70/30 leverage · 6.5% rate',
  },
  'Opex': {
    title: 'Opex (Operating Expenses)',
    short: 'Annual operating cost — O&M, insurance, site lease, monitoring, asset management.',
    long: 'Industry baseline of $20/kW/yr for utility-scale solar (Wood Mac H2 2025: $15-25/kW range). Includes preventive maintenance, inverter service, vegetation management, insurance, and asset-management fees. Escalates 2.5%/yr. Lower for large remote arrays with simple racking; higher for distributed systems with complex grid interfaces or premium service contracts. Material to LCOE + IRR.',
    inputs: 'Wood Mac H2 2025 utility-scale O&M survey · industry baseline',
  },
  'Discount Rate': {
    title: 'Discount Rate',
    short: 'The annual rate used to value future cashflows in today\'s dollars — typically your hurdle rate or cost of capital.',
    long: 'NPV uses this to discount future cashflows: a $100 payment in year 5 at 8% discount = $68 today. Higher discount rate = future revenue worth less today = lower NPV. 8% is the project-finance industry baseline. IC reviewers may use 10-12%; utility-equity 6-7%; family-office capital 12-15%. Tractova\'s baseline is 8% so you can compare projects on apples-to-apples terms; nudge to your own hurdle rate for a personalized read.',
    inputs: 'baseline 8% (project finance standard) · user-adjustable',
  },
  'Contract Tenor': {
    title: 'Contract Tenor',
    short: 'Project life used for revenue + IRR computation — how many years of cashflow we model.',
    long: 'Solar CS: 25 years standard (REC contract or PPA term). C&I PPA: 15-25 years typical. BESS: 15 years (battery degradation cap). Longer tenor = more lifetime revenue + (usually) higher IRR. Adjust if your specific offtake contract is shorter (e.g. 10-yr municipal CS) or longer (e.g. 30-yr utility PPA).',
    inputs: 'baseline 25yr solar / 15yr BESS · adjusts cashflow stream length',
  },
  'Section 404': {
    title: 'Section 404 (Clean Water Act)',
    short: 'Federal permit required when a project fills or disturbs any wetland — administered by US Army Corps of Engineers.',
    long: 'Section 404 of the Clean Water Act governs discharge of dredged or fill material into "waters of the United States," which includes most wetlands. Three permit flavors: Nationwide Permits (NWP) for small fills under ~0.5 acres (30-60 day review), Regional General Permits for routine project categories, Individual Permits for larger or complex fills (typically 6-12 months with public comment + environmental review). State wetland rules usually stack on top — NY DEC, MA WPA, NJ Freshwater Wetlands Act often the longer pole. Tractova\'s Lens timeline surfaces a Section 404 flag when county wetland coverage ≥25% as a proxy for "site selection likely to encounter wetland-adjacent parcels"; the actual permit trigger is parcel-level fill activity, not county coverage. Confirm via a parcel-level NWI delineation before treating the flag as deterministic.',
    inputs: 'USFWS NWI county polygons (≥25% coverage proxy) · USACE permit framework',
  },
  'COD': {
    title: 'COD (Commercial Operation Date)',
    short: 'The date a project starts generating revenue — final commissioning + utility energization complete.',
    long: 'Commercial Operation Date is the milestone when a project transitions from construction to producing revenue. It requires: utility witness tests passed, interconnection energization completed, REC certification (if applicable), final permits closed out. Lenders + tax-equity investors size facilities to a target COD; missing it triggers contract penalties and delays REC accrual. Tractova\'s timeline phase bar models four phases ending at COD: IX Study → Permitting → Construction → Energization (~3-mo final buffer).',
    inputs: 'phase-stack model · ixQueueSummary.avgStudyMonths · permit / construct / energization defaults',
  },
  'PPA': {
    title: 'PPA (Power Purchase Agreement)',
    short: 'Long-term contract under which a power buyer agrees to purchase project output at a fixed or escalating $/MWh rate.',
    long: 'The PPA is the offtake instrument for C&I and utility-scale solar. Typical terms: 15-25 years, fixed $/MWh price with 0-2% annual escalator, take-or-pay structure. Counterparty creditworthiness drives financeability — investment-grade corporate or municipal anchors most projects, retail/utility BLAs are second tier. Distinct from CS bill-credit programs, where the customer is the program administrator rather than an end-user. Tractova\'s C&I revenue model uses EIA Form 861 retail rates as a baseline PPA-spread proxy.',
    inputs: 'EIA Form 861 commercial retail rates (curated 12 states) · revenue_rates.ppa_rate_cents_kwh',
  },
  'Bill Credit': {
    title: 'Bill Credit (Net Metering / NEM)',
    short: 'Per-kWh value of community-solar generation credited to subscriber utility bills.',
    long: 'In CS markets, subscribers don\'t buy power directly — they buy bill-credit allocations off a shared facility. The state PUC sets the bill-credit rate (typically 80-100% of retail electric rate) and the program administrator allocates credits monthly. Subscribers see lower bills; the project earns the bill-credit value × allocated kWh as revenue. Bill-credit rates vary 5-25 ¢/kWh across states. The 2023 CA NEM 3.0 reform cut residential bill credits 57% — a precedent for downside risk Tractova flags via the policy_climate sub-score.',
    inputs: 'state PUC tariff filings · revenue_rates.bill_credit_cents_kwh (per-state curated)',
  },
  'Offtaker': {
    title: 'Offtaker',
    short: 'The counterparty that contractually purchases project output — corporate buyer, utility, CS subscribers, or capacity market.',
    long: 'Distinct from the Offtake pillar (which scores how good the market structure is): the offtaker is the specific entity that signs the PPA, bill-credit allocation agreement, or capacity-market clearing position. For CS: state program administrator + downstream subscribers. For C&I: an investment-grade corporate buyer, university, or municipality. For BESS: the ISO capacity market + ancillary services. Offtaker credit quality is one of the top three diligence items for project finance.',
    inputs: 'project-specific · sourced from comparable_deals + project metadata',
  },
  'CCA': {
    title: 'CCA (Community Choice Aggregation)',
    short: 'Municipal energy procurement programs that aggregate local demand to negotiate independently from the incumbent utility.',
    long: 'CCAs operate in CA, MA, NY, IL, NJ, OH, RI, NH, VA. A municipality (or coalition) forms a CCA to procure power on behalf of its residents — often serving as an anchor offtaker for community-solar projects with multi-year subscription guarantees. CCAs stabilize subscriber pipelines in a way single-residential subscription doesn\'t, lifting offtake confidence. Tractova\'s subscription-target lever surfaces "anchor offtaker / CCA partnership" at the 90-100% subscription tier for this reason.',
    inputs: 'state CCA enabling legislation · curated per-state CCA list (admin)',
  },
  'IX Queue': {
    title: 'IX Queue (Interconnection Queue)',
    short: 'The utility\'s ordered list of pending projects awaiting interconnection study + grid impact analysis.',
    long: 'Every project needing grid interconnection joins a queue at its host utility. The queue is studied in clusters or sequentially depending on the utility / ISO. Live queue data from 8 top CS markets (NY, NJ, IL, MA, MD, CO, ME, MN as of 2026-04-30) flows into Tractova\'s IX sub-score; the other 42 states use a curated ixDifficulty baseline. Study windows range from 4-6 months (small distribution) to 36+ months (PJM cluster). Queue position is the single biggest timeline risk for CS development.',
    inputs: 'ix_queue_data (live · 8 states) · state_programs.ixDifficulty (curated baseline · 50 states)',
  },
  'Study Window': {
    title: 'Study Window (IX Study)',
    short: 'Time the utility / ISO spends evaluating grid impacts before issuing an interconnection agreement.',
    long: 'The utility runs three studies in sequence: Feasibility (rough screen — weeks), System Impact (cluster modeling — months), and Facilities (detailed engineering for required upgrades — months). Total window: 4 months on a fast distribution path, 24-36+ months on a saturated transmission cluster. Tractova surfaces the live weighted-average study window from ix_queue_data; the Dev Feasibility "IX Assumption" lever scales it (queue=100%, acquire=50%, distribution fast-track=25%) to model alternate routing.',
    inputs: 'ix_queue_data.avgStudyMonths · curated fallback ~18mo when live data not wired',
  },
  'NWI': {
    title: 'NWI (National Wetlands Inventory)',
    short: 'USFWS dataset mapping wetland polygons across the US — Tractova\'s authoritative wetland-coverage source.',
    long: 'The US Fish and Wildlife Service maintains the National Wetlands Inventory, a GIS dataset of wetland boundaries derived from aerial imagery + ground truthing. Tractova ingests county-aggregated wetland coverage % from NWI as the primary site-control input. Polygons are accurate at the county scale but should be verified parcel-by-parcel via on-site delineation before committing capex — NWI polygons can be 1-5 years stale depending on coverage region.',
    inputs: 'USFWS NWI polygons → county aggregation → county_geospatial_data.wetland_coverage_pct',
  },
  'SSURGO': {
    title: 'SSURGO (Soil Survey Geographic Database)',
    short: 'USDA dataset classifying soil types — Tractova reads prime-farmland coverage from it for site permitting risk.',
    long: 'USDA NRCS publishes SSURGO with detailed soil-classification polygons. Prime farmland classification triggers state ag-protection review in NJ, NY, CA, IL, MI — adding 3-9 months to permitting and sometimes blocking conversion entirely. Tractova ingests county-level prime farmland coverage % as a Site Control input. Counties ≥40% prime farmland get a "verify ag-land protections + dual-use eligibility" diligence flag in the Dev Feasibility verdict rationale.',
    inputs: 'USDA NRCS SSURGO polygons → county aggregation → county_geospatial_data.prime_farmland_pct',
  },
  'ISO/RTO': {
    title: 'ISO / RTO (Independent System Operator / Regional Transmission Organization)',
    short: 'Independent grid operators that manage transmission, run wholesale markets, and administer interconnection queues regionally.',
    long: 'The US power grid is operated by seven major ISO/RTOs covering ~70% of demand: NYISO (NY), PJM (mid-Atlantic + Ohio Valley + IL), ISO-NE (New England), CAISO (CA), MISO (Midwest + south), SPP (south-central), ERCOT (TX, separate non-FERC grid). Outside these, vertically-integrated utilities (TVA, PNW, Southeast) manage their own interconnection. Each ISO has its own queue, study process, and timeline — driving structural differences in IX difficulty by region.',
    inputs: 'ISO public queue dashboards · ix_queue_data per-utility roll-up',
  },
  'Confidence Tier': {
    title: 'Confidence Tier (Tier A / Tier B)',
    short: 'How much observed install data backs a state\'s capex baseline — Tier A = n≥40 observed installs, Tier B = thinner sample.',
    long: 'Tractova\'s solar cost baselines come from the LBNL Tracking the Sun observed-install dataset. States with ≥40 observed installs in the vintage window get Tier A confidence (p10-p90 spread surfaced inline). States with 3-39 installs get Tier B (median shown, no spread). States with <3 installs use a synthesized national-extrapolation baseline. Tier A is anchored in observed data; Tier B and the synthesis layer should be tuned against your own pipeline quotes before underwriting.',
    inputs: 'LBNL Tracking the Sun · cs_cost_index.install_count · vintage_window',
  },
  'Safe Harbor': {
    title: 'Safe Harbor (ITC / Tax Credit)',
    short: 'IRS provision that locks in a project\'s ITC rate by demonstrating "begun construction" before a rate cut takes effect.',
    long: 'Federal solar incentives can change year-to-year. Safe-harboring lets developers lock in the current ITC rate by purchasing 5% of project cost in equipment or starting physical construction. Once safe-harbored, the project has 4 years to reach COD without losing the protected rate. Critical for projects spanning policy transitions (IRA passage, ITC step-downs, FEOC rules). Tractova flags policy events as "safe harbor eligible" when their effective date allows pre-construction locking.',
    inputs: 'IRS Notice 2018-59 + IRA §13701 framework · policy_impact_events.safe_harbor_eligible',
  },
  'NTP': {
    title: 'NTP (Notice to Proceed)',
    short: 'Project stage when all financing, permits, and contracts are closed — construction begins.',
    long: 'Notice to Proceed is the contractual signal from the developer to the EPC contractor authorizing construction to start. It marks the transition from "development" to "execution" and triggers the construction-period interest clock. Requirements typically include: final IX agreement signed, all permits issued, tax equity committed, EPC contract executed, debt closed. Tractova\'s stage modifier adds +8 offtake / -5 IX / +25 site to projects at NTP — reflecting the de-risked nature of permits + the now-locked queue position.',
    inputs: 'Tractova stage modifier · project.stage = "NTP (Notice to Proceed)"',
  },
  'p50 / p90': {
    title: 'p50 / p90 (Statistical Percentiles)',
    short: 'p50 is the median; p90 is the value below which 90% of observations fall — used to communicate spread.',
    long: 'When Tractova surfaces a capex range like "$1.32/W (p25) – $1.78/W (p75)" from LBNL observed installs, those percentiles describe the spread of real-world install costs. p10 is the most-favorable 10% (lowest cost); p90 is the worst 10% (highest cost). Project finance often models p50 as "expected case" and p90 as "downside stress." A p25-p75 band is the interquartile range — half the observed projects cleared in this zone. Tractova surfaces the band on Tier A states so developers can size against typical spread, not just the median.',
    inputs: 'LBNL Tracking the Sun observed-install distribution · cs_cost_index.p10/p25/p50/p75/p90',
  },
}

// Convenience: shape for a `<GlossaryLabel>` short-tooltip use case.
export const GLOSSARY_SHORT_DEFS = Object.fromEntries(
  Object.entries(GLOSSARY_DEFINITIONS).map(([k, v]) => [k, v.short])
)
