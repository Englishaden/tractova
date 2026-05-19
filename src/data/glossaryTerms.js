// Glossary terms data module. Phase 2 perf-pass.
//
// This was the static body of src/pages/Glossary.jsx. Moved out so the
// Glossary page can stay lazy-loaded: when CommandPalette (eager-mounted
// in App.jsx) imports GLOSSARY_TERMS + toSlug from the page module
// directly, Vite/Rollup merges Glossary's entire chunk into the main
// bundle (and the dev build warns INEFFECTIVE_DYNAMIC_IMPORT). Splitting
// the data out preserves the lazy boundary — main bundle shrinks ~25 KB
// gzip, Glossary chunk stays lazy.
//
// Source of truth for: the Glossary page (renders these cards), the
// Cmd-K palette (`:gloss <TERM>` verb indexes them), tooltip
// generators (link `Glossary` term names from in-app surfaces).
//
// To add a term, edit this file. Don't add term data anywhere else.

import { TECH_DEFINITIONS } from '../lib/techDefinitions'
import { GLOSSARY_DEFINITIONS } from '../lib/glossaryDefinitions'

// Convert term name → URL-safe anchor slug. Glossary page reads
// window.location.hash on mount and scrolls + briefly highlights the
// matching term card; CommandPalette builds `/glossary#<slug>` paths.
// Keep this in lockstep with that hash handler.
export function toSlug(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Technology-type entries derived from TECH_DEFINITIONS so the same
// catalog feeds Glossary cards, Library hover tooltips, and Search
// dropdown tooltips. Pillar 'all' because tech type is cross-cutting.
const TECH_TYPE_TERMS = Object.entries(TECH_DEFINITIONS).map(([_name, def]) => ({
  term: def.title,
  pillar: 'all',
  definition: def.long,
  related: ['Lens Analysis', 'Feasibility Index', 'Sensitivity Analysis'],
}))

// Phase-1 launch terms surfaced via tooltip-only entries in
// GLOSSARY_DEFINITIONS — promoted into the GLOSSARY_TERMS catalog by
// mapping each definition to its canonical pillar. Only new terms not
// already present below.
const GLOSSARY_PILLAR_MAP = {
  // Site pillar
  'Prime Farmland':     'site',
  'Wetland Warning':    'site',
  'Section 404':        'site',
  'NWI':                'site',
  'SSURGO':             'site',
  // Offtake pillar
  'Capacity Factor':    'offtake',
  'Energy Community':   'offtake',
  'Scenario Studio':    'offtake',
  'Achievable Baseline':'offtake',
  'Year 1 Revenue':     'offtake',
  'Simple Payback':     'offtake',
  'Capex':              'offtake',
  'Program Allocation': 'offtake',
  'REC Price':          'offtake',
  'PPA':                'offtake',
  'Bill Credit':        'offtake',
  'Offtaker':           'offtake',
  'CCA':                'offtake',
  // Interconnection pillar
  'IX · Live':          'ix',
  'IX Cost':            'ix',
  'IX Queue':           'ix',
  'Study Window':       'ix',
  'ISO/RTO':            'ix',
  // Cross-cutting (project lifecycle / finance / regulatory)
  'Site · Live':        'site',
  'COD':                'all',
  'NTP':                'all',
  'Safe Harbor':        'all',
  'Confidence Tier':    'all',
  'p50 / p90':          'all',
}
const GLOSSARY_NEW_TERMS = Object.entries(GLOSSARY_DEFINITIONS)
  .filter(([key]) => key in GLOSSARY_PILLAR_MAP)
  .map(([key, def]) => ({
    term: def.title,
    pillar: GLOSSARY_PILLAR_MAP[key],
    definition: def.long,
    related: ['Feasibility Index'],
  }))

export const GLOSSARY_TERMS = [
  // ── Development stages ──────────────────────────────────────────────────────
  {
    term: 'Prospecting',
    pillar: 'stage',
    definition:
      'The earliest stage of project development. A developer is identifying potential sites based on available land, favorable grid conditions, and state program activity — but has not yet engaged landowners or utilities. Prospecting decisions are driven by desktop research, GIS analysis, and market intelligence. Tractova is purpose-built to support this stage.',
    related: ['Site Control', 'Feasibility Index', 'IX Queue (Interconnection Queue)'],
  },
  {
    term: 'Site Control',
    pillar: 'stage',
    definition:
      'The developer has secured a legal right to develop a specific parcel — typically through an option agreement or lease with the landowner. Site control is a prerequisite for filing an interconnection application and most project financing. Standard option agreements run 3–5 years with renewal rights tied to project milestones.',
    related: ['Pre-Development', 'ISA (Interconnection Study Agreement)', 'Offtake'],
  },
  {
    term: 'Pre-Development',
    pillar: 'stage',
    definition:
      'Site control is secured and the developer is completing foundational studies and permits before construction begins. Activities include environmental surveys, Phase I/II assessments, permitting applications, and interconnection study execution (ISA filing). Pre-development spend typically ranges from $50K–$500K before a project reaches NTP.',
    related: ['Site Control', 'ISA (Interconnection Study Agreement)', 'Development'],
  },
  {
    term: 'Development',
    pillar: 'stage',
    definition:
      'The project has cleared pre-development milestones and is actively advancing toward construction. Key activities include finalizing the Interconnection Agreement (IA), securing offtake contracts, completing land use permits, and arranging project financing. Many projects fail to close financing and never exit this stage.',
    related: ['Pre-Development', 'NTP (Notice to Proceed)', 'Offtake', 'ITC (Investment Tax Credit)'],
  },
  {
    term: 'NTP (Notice to Proceed)',
    pillar: 'stage',
    definition:
      'A contractual milestone issued by the project owner or lender authorizing the EPC contractor to begin construction. NTP signals that financing is closed, permits are in hand, interconnection is approved, and offtake is contracted. It is the official start of the construction timeline and a key trigger for lender disbursements.',
    related: ['Development', 'Construction', 'ITC (Investment Tax Credit)'],
  },
  {
    term: 'Construction',
    pillar: 'stage',
    definition:
      'The EPC contractor is actively building the project. For community solar, construction typically takes 3–9 months depending on project size and grid connection complexity. Key milestones include equipment procurement, civil work, racking installation, electrical balance-of-system completion, and utility commissioning inspection.',
    related: ['NTP (Notice to Proceed)', 'Operational'],
  },
  {
    term: 'Operational',
    pillar: 'stage',
    definition:
      'The project has received Permission to Operate (PTO) from the utility and is generating electricity. For community solar, operational status triggers subscriber billing and revenue recognition. Ongoing responsibilities include O&M, subscriber management, performance reporting, and REC delivery under the offtake contract.',
    related: ['Construction', 'REC (Renewable Energy Certificate)', 'Offtake'],
  },

  // ── Program status terms ─────────────────────────────────────────────────────
  {
    term: 'Active Program',
    pillar: 'offtake',
    definition:
      'A state has a currently open, funded community solar program accepting new project applications or subscriber enrollments. Active programs have defined capacity, compensation structures, and regulatory approval. Contrast with Limited (nearly full) or Pending (rules not yet finalized).',
    related: ['Limited Capacity', 'LMI (Low-to-Moderate Income)', 'Offtake'],
  },
  {
    term: 'Limited Capacity',
    pillar: 'offtake',
    definition:
      'The program exists and is operational, but available capacity is nearly exhausted. New tranches or block openings can re-open the queue — track program-administrator filings and PUC dockets to catch the reopening before competitors. A Limited state flips back to Active when additional MW is authorized.',
    related: ['Active Program', 'Offtake', 'Feasibility Index'],
  },
  {
    term: 'LMI (Low-to-Moderate Income)',
    pillar: 'offtake',
    definition:
      'Federal income designation, typically defined as households earning ≤80% of Area Median Income (AMI). Many community solar programs mandate a minimum percentage of LMI-qualified subscribers — commonly 20–51%. Meeting LMI requirements can also unlock additional ITC adders under the Inflation Reduction Act (IRA Section 48E).',
    related: ['ITC (Investment Tax Credit)', 'Active Program', 'Offtake'],
  },
  {
    term: 'IX Queue (Interconnection Queue)',
    pillar: 'ix',
    definition:
      'The backlog of generation projects awaiting utility or ISO/RTO approval to connect to the electric grid. Queue position, study timelines, Network Upgrade costs, and ISA withdrawal rates determine whether a project is technically and economically viable. Queue saturation is one of the top project killers for small developers.',
    related: ['ISA (Interconnection Study Agreement)', 'Feasibility Index', 'Pre-Development'],
  },
  {
    term: 'ISA (Interconnection Study Agreement)',
    pillar: 'ix',
    definition:
      'A contract between a developer and the utility or ISO/RTO that triggers the formal interconnection feasibility or system impact study. Executing an ISA is a major project milestone — it commits capital (typically $10K–$100K+ in study deposits), locks in a queue position, and initiates the timeline toward a final Interconnection Agreement (IA).',
    related: ['IX Queue (Interconnection Queue)', 'Pre-Development', 'Development'],
  },
  {
    term: 'VDER (Value of Distributed Energy Resources)',
    pillar: 'offtake',
    definition:
      'New York\'s compensation framework for distributed generation and community solar, replacing net metering for most projects. VDER calculates credit rates based on time of delivery, location on the grid, installed capacity, and system attributes rather than a flat avoided cost rate. Also called the "Value Stack." Rates vary by utility territory and are set annually by NYSERDA.',
    related: ['NEM (Net Energy Metering)', 'Offtake', 'REC (Renewable Energy Certificate)'],
  },
  {
    term: 'NEM (Net Energy Metering)',
    pillar: 'offtake',
    definition:
      'A billing mechanism that credits solar system owners for electricity exported to the grid, typically at or near the retail rate. NEM policies vary significantly by state and utility and are being modified in several markets — most notably NEM 3.0 in California, which reduced export credits by ~75%. Virtual NEM (VNEM) is the mechanism used for community solar subscriber billing in many states.',
    related: ['VDER (Value of Distributed Energy Resources)', 'ANEM (Adjustable Net Energy Metering)', 'Offtake'],
  },
  {
    term: 'Offtake',
    pillar: 'offtake',
    definition:
      'The arrangement by which electricity generated by a project is sold or assigned to end users. In community solar, offtake means subscriber enrollment — the process of signing up households or businesses to receive bill credits from the project\'s output. Offtake risk (inability to find subscribers) is a key early-stage concern for community solar developers.',
    related: ['Active Program', 'REC (Renewable Energy Certificate)', 'NEM (Net Energy Metering)', 'LMI (Low-to-Moderate Income)'],
  },
  {
    term: 'REC (Renewable Energy Certificate)',
    pillar: 'offtake',
    definition:
      'A market instrument representing the environmental attributes of 1 MWh of renewable electricity generation. RECs can be sold separately from the physical electricity ("unbundled") or bundled with power purchase agreements. State RPS (Renewable Portfolio Standard) requirements drive REC demand. Community solar projects may generate SRECs (Solar RECs) or TRECs depending on state program structure.',
    related: ['SREC (Solar Renewable Energy Certificate)', 'ITC (Investment Tax Credit)', 'Offtake'],
  },
  {
    term: 'ITC (Investment Tax Credit)',
    pillar: 'offtake',
    definition:
      'A federal tax credit for renewable energy projects equal to a percentage of qualifying project costs, governed by IRA Section 48/48E. The base ITC rate is 30% for projects meeting prevailing wage and apprenticeship requirements. Adders are available for Energy Community siting (+10%), Low-Income Community Projects (+10–20%), and domestic content (+10%). Most community solar projects under 5MW AC qualify for the full adder stack.',
    related: ['LMI (Low-to-Moderate Income)', 'REC (Renewable Energy Certificate)', 'Feasibility Index'],
  },
  {
    term: 'Feasibility Index',
    pillar: 'all',
    definition:
      'A proprietary Tractova composite index (0–100) reflecting the combined attractiveness of a state for community solar development. Inputs include CS program status, remaining capacity, IX difficulty, LMI requirements, and IRA adder eligibility. Higher scores indicate states where a small developer is most likely to close a viable project. This scoring is Tractova\'s primary differentiated data layer.',
    related: ['IX Queue (Interconnection Queue)', 'Active Program', 'ITC (Investment Tax Credit)'],
  },

  // ── Data confidence tiers (the trust spine) ─────────────────────────────────
  {
    term: 'Tier A · Observed',
    pillar: 'all',
    definition:
      'A data point anchored on an observed, primary-source dataset (e.g., LBNL Tracking the Sun observed installed-PV-cost percentiles, NREL PVWatts modeled capacity factors, EIA Form 860 grid filings, USFWS NWI wetlands, USDA SSURGO soils, state PUC program-administrator portals). Tier A entries surface a sample size, vintage stamp, and source URL on every Lens render. Sub-tiers reflect confidence within Tier A: Strong (n ≥ 40), Modest (n = 10–39), Thin (n = 3–9). At Thin tier, p10/p90 percentiles are suppressed to avoid false precision — the median is shown alone with a caveat.',
    related: ['Tier B · Regional Analog', 'Tier C · Editorial', 'Feasibility Index'],
  },
  {
    term: 'Tier B · Regional Analog',
    pillar: 'all',
    definition:
      'A data point anchored on a regional/programmatic analog with a Tractova-applied multiplier rather than an observed primary source. Used when no qualifying observed sample exists for that state in the relevant dataset. Example: Illinois CS $/W is published as 1.10 × $2.45/W national 2026 anchor based on PJM-mature-CS regional analog reasoning, not a per-state LBNL TTS observation. Two sub-classifications surface inline: Thin (sample exists but below the n ≥ 3 floor — FL/MD/NH/CT) and Structural (incentive design produces no observable paper trail regardless of program maturity — the SREC-strike states IL/PA/OR/DE/WA). Tier B values are defensible editorial synthesis but not "ground truth"; treat them as directional and cross-reference your own market intel before committing capital.',
    related: ['Tier A · Observed', 'Tier C · Editorial', 'CS $/W'],
  },
  {
    term: 'Tier C · Editorial',
    pillar: 'all',
    definition:
      'A data point that is product-design methodology, not a number we sourced or synthesized from external data. Examples: composite weights (0.40 / 0.35 / 0.25 across offtake / IX / site), stage modifiers, IX difficulty bracket cutoffs, LMI penalty magnitudes. These are Tractova\'s editorial product-design choices about how to score things, not claims about the world. Surfaced transparently in Lens (the weight-sensitivity tooltip shows the score range across alternative weighting schemes) and tracked in scripts/data-trust-audit.mjs as "review priority" items. Tier C entries are the highest-leverage refinement targets — A/B-testing or developer-survey work could move them to Tier A over time.',
    related: ['Tier A · Observed', 'Tier B · Regional Analog', 'Feasibility Index'],
  },

  // ── Platform terms (Tractova-specific concepts) ─────────────────────────────
  {
    term: 'Lens Analysis',
    pillar: 'all',
    definition:
      'Tractova\'s core intelligence tool. Enter a state, county, MW size, development stage, and technology to generate a full feasibility assessment with AI-powered market intelligence. Lens combines the Feasibility Index with three pillar cards (Site Control, Interconnection, Offtake), sensitivity scenarios, and a Claude-generated analyst brief tailored to the project\'s specifics.',
    related: ['Feasibility Index', 'Market Intelligence', 'Sensitivity Analysis'],
  },
  {
    term: 'Market Intelligence',
    pillar: 'all',
    definition:
      'The AI-generated analysis section in Lens results — a Claude-powered brief covering immediate action, stage-specific guidance, primary risk, top opportunity, and competitive context. Market Intelligence is the differentiated layer that turns raw program and queue data into directive, project-specific commentary. Rebuilt for each Lens run, never cached across projects.',
    related: ['Lens Analysis', 'Feasibility Index', 'Sensitivity Analysis'],
  },
  {
    term: 'Sensitivity Analysis',
    pillar: 'all',
    definition:
      'Interactive scenario testing in Lens results. Toggle market conditions (IX difficulty, CS status, LMI requirement) to see how the Feasibility Index changes, with quantified dollar and timeline impacts plus an AI rationale explaining the mechanism behind the score change. Available scenarios are tech-aware: Community Solar exposes program/LMI scenarios, BESS exposes capacity-market scenarios, etc.',
    related: ['Lens Analysis', 'Market Intelligence', 'Feasibility Index'],
  },
  {
    term: 'Best Case / Worst Case Scenario',
    pillar: 'all',
    definition:
      'Pre-set P10 and P90 envelopes in the Scenario Studio. Best case applies favorable multipliers anchored to public industry data (capex −15% NREL ATB 2024 P10, IX cost −30% greenfield, capacity factor +5%, REC price +15%, allocation +10% capped at 110% of baseline). Worst case applies adverse multipliers (capex +20% NREL ATB P90, IX cost +150% network-upgrade shock, capacity factor −8%, REC price −15%, allocation −25% floored at 50%). The presets stay inside defensible-sensitivity territory — outlier scenarios (e.g. IX cost 5–10× baseline from a major distribution-feeder reinforcement) exist beyond the worst-case envelope and aren\'t modeled here. Hover the chip in Scenario Studio to see the full multiplier table.',
    related: ['Scenario Studio', 'Sensitivity Analysis', 'Lens Analysis'],
  },
  {
    term: 'Add to Compare',
    pillar: 'all',
    definition:
      'Save a Lens result or Library project to the comparison tray. Compare up to 4 projects side-by-side across Feasibility Index, IX difficulty, program status, MW, and revenue economics. The Compare tray includes an auto-generated "Best for" tradeoff summary and an "Open in Lens" shortcut per column to dive back into any project with all parameters pre-filled.',
    related: ['Lens Analysis', 'Library'],
  },
  {
    term: 'Portfolio Intelligence',
    pillar: 'all',
    definition:
      'The AI-powered portfolio summary in the Library, available when 3 or more projects are saved. Combines a Portfolio Health gauge (MW-weighted average score), a Risk Concentration widget (% of MW exposed to single state / single program / single technology), MW-by-technology breakdown, and a Claude-generated portfolio insight covering diversification, market timing, and the most impactful next action.',
    related: ['Library', 'Feasibility Index', 'Lens Analysis'],
  },
  {
    term: 'Program Runway',
    pillar: 'offtake',
    definition:
      'The estimated months until a community solar program\'s remaining capacity is fully enrolled, computed from current enrollment rate (MW/month). Programs with runway under 6 months are flagged as "urgent" — submit your application before the block closes. Programs with 7–12 months are "watch" status. Tractova tracks runway per state and surfaces it on Lens, Library, and the Dashboard state panel.',
    related: ['Active Program', 'Limited Capacity', 'Lens Analysis'],
  },
  {
    term: 'Deal Memo',
    pillar: 'all',
    definition:
      'An IC-grade analyst memo generated from a saved project. Tractova\'s Deal Memo combines structured project data with four AI-written sections: site control assessment, interconnection outlook, revenue positioning, and a directive recommendation for the next 30 days. Designed as a sales artifact developers can send to financiers, capital partners, or their own investment committee — branded, dated, and exportable to PDF.',
    related: ['Library', 'Lens Analysis', 'Market Intelligence'],
  },
  {
    term: 'Comparable Project',
    pillar: 'all',
    definition:
      'An anonymized prior project matched to the current project by state, utility, MW size range, and development stage. Tractova surfaces comparable projects in Lens results to ground the analysis in real-world outcomes — typical revenue actuals, study timelines, LMI fill rates, and time-from-NTP-to-COD. Sourced from public ISO interconnection filings and EIA Form 860 commercial-operation data.',
    related: ['Lens Analysis', 'Feasibility Index'],
  },
  {
    term: 'Subscriber Acquisition',
    pillar: 'offtake',
    definition:
      'The operational process of signing up household and small-business subscribers for a community solar project. For projects with LMI requirements, subscriber acquisition is typically the binding execution constraint — sourcing qualifying low-to-moderate income subscribers takes 6–9 months through aggregator contracting and CBO partnerships. The economics often include a 10–15% revenue haircut to attract compliant subscribers.',
    related: ['LMI (Low-to-Moderate Income)', 'Active Program', 'Offtake'],
  },

  // ── Additional industry terms ────────────────────────────────────────────────
  {
    term: 'SREC (Solar Renewable Energy Certificate)',
    pillar: 'offtake',
    definition:
      'A state-specific Solar REC representing the environmental attributes of 1 MWh of solar generation. SRECs trade on state-specific markets and prices vary widely — from under $10/MWh in oversupplied markets to $300+/MWh in constrained markets like Massachusetts. States with active SREC markets include MA, NJ, MD, DC, OH, and PA. SREC revenue is often a key component of the revenue stack and can make or break project economics in these states.',
    related: ['REC (Renewable Energy Certificate)', 'Illinois Shines', 'Offtake'],
  },
  {
    term: 'Illinois Shines',
    pillar: 'offtake',
    definition:
      'Illinois\' community solar and distributed generation incentive program, formally structured as the Adjustable Block Program (ABP). Administered by the Illinois Power Agency (IPA), Illinois Shines provides Renewable Energy Credits (RECs) at a fixed price per MWh under a 15-year contract. Projects up to 2,000 kW AC qualify. The program is funded through the Climate and Equitable Jobs Act (CEJA) and is widely regarded as one of the most developer-friendly CS programs in the country. Capacity is released in tranches and waitlists can form quickly.',
    related: ['ABP (Adjustable Block Program)', 'CSEGS (Community Solar Electric Generating System)', 'REC (Renewable Energy Certificate)'],
  },
  {
    term: 'CSEGS (Community Solar Electric Generating System)',
    pillar: 'offtake',
    definition:
      'The formal regulatory term used in Illinois for a community solar project. A CSEGS is a distributed generation facility of up to 2,000 kW AC whose output is subscribed by multiple customers in the same utility territory. CSEGS projects are eligible for Illinois Shines REC contracts under the ABP. The term is defined under the Illinois Public Utilities Act and used in all IPA program filings.',
    related: ['Illinois Shines', 'ABP (Adjustable Block Program)', 'Offtake'],
  },
  {
    term: 'ANEM (Adjustable Net Energy Metering)',
    pillar: 'offtake',
    definition:
      'A community solar billing mechanism used in select states that adjusts subscriber credit rates based on time-of-use or other market factors, rather than applying a flat volumetric credit. ANEM structures attempt to align subscriber bill credits with the actual market value of solar generation, similar in intent to New York\'s VDER Value Stack. Specific ANEM rules vary by state and utility territory.',
    related: ['NEM (Net Energy Metering)', 'VDER (Value of Distributed Energy Resources)', 'Offtake'],
  },
  {
    term: 'ABP (Adjustable Block Program)',
    pillar: 'offtake',
    definition:
      'The formal programmatic structure underlying Illinois Shines, administered by the Illinois Power Agency. The ABP sets fixed REC prices ("blocks") by project category — small distributed generation, large distributed generation, and community solar — and adjusts pricing across tranches based on demand. When a block fills, the IPA sets new pricing for the next tranche. The ABP is widely considered a model for well-structured state community solar incentive programs and is frequently cited by other states designing their own programs.',
    related: ['Illinois Shines', 'CSEGS (Community Solar Electric Generating System)', 'REC (Renewable Energy Certificate)'],
  },

  // ── Technology types ────────────────────────────────────────────────────────
  // Derived from src/lib/techDefinitions.js so Glossary cards, Library
  // hover tooltips, and Search dropdown tooltips all share one source.
  ...TECH_TYPE_TERMS,
  ...GLOSSARY_NEW_TERMS,
]
