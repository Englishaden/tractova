import { useState, useRef, useEffect } from 'react'
import { TECH_DEFINITIONS } from '../lib/techDefinitions'
import { GLOSSARY_DEFINITIONS } from '../lib/glossaryDefinitions'
import IntelligenceBackground from '../components/IntelligenceBackground'
import WalkingTractovaMark from '../components/WalkingTractovaMark'

// Convert term name to a URL-safe anchor slug
function toSlug(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Technology-type entries are derived from the canonical TECH_DEFINITIONS
// catalog so the same source of truth feeds Library tooltips, Search dropdown
// tooltips, and Glossary cards. Pillar 'all' because tech type is cross-cutting
// (touches site, IX, and offtake scoring at once).
const TECH_TYPE_TERMS = Object.entries(TECH_DEFINITIONS).map(([_name, def]) => ({
  term: def.title,
  pillar: 'all',
  definition: def.long,
  related: ['Lens Analysis', 'Feasibility Index', 'Sensitivity Analysis'],
}))

// Glossary-tooltip entries (for terms newly surfaced by Phase 1 of the
// launch roadmap). Maps each entry's pillar so the Glossary card uses
// the matching badge color. We list ONLY new terms not already in the
// hardcoded array below — for terms like Site Control / IX / Offtake
// that have richer hardcoded entries, those stay authoritative.
const GLOSSARY_PILLAR_MAP = {
  'Prime Farmland':     'site',
  'Wetland Warning':    'site',
  'Capacity Factor':    'offtake',
  'Energy Community':   'offtake',
  'IX · Live':          'ix',
  'Site · Live':        'site',
  // Phase 2 — Scenario Studio terminology
  'Scenario Studio':    'offtake',
  'Achievable Baseline':'offtake',
  'Year 1 Revenue':     'offtake',
  'Simple Payback':     'offtake',
  'Capex':              'offtake',
  'IX Cost':            'ix',
  'Program Allocation': 'offtake',
  'REC Price':          'offtake',
}
const GLOSSARY_NEW_TERMS = Object.entries(GLOSSARY_DEFINITIONS)
  .filter(([key]) => key in GLOSSARY_PILLAR_MAP)
  .map(([key, def]) => ({
    term: def.title,
    pillar: GLOSSARY_PILLAR_MAP[key],
    definition: def.long,
    related: ['Feasibility Index'],
  }))

const terms = [
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

// V3: pillar badges aligned to V3 palette — teal for offtake, amber for IX
// (semantic caution per V3 §7.4), blue for site, slate-navy for stage, gray for all.
const PILLAR_BADGE = {
  offtake: 'bg-teal-50 text-teal-800 border-teal-200',
  ix:      'bg-amber-50 text-amber-800 border-amber-200',
  site:    'bg-blue-50 text-blue-700 border-blue-200',
  stage:   'bg-slate-100 text-slate-700 border-slate-200',
  all:     'bg-gray-100 text-gray-600 border-gray-200',
}

const PILLAR_LABEL = {
  offtake: 'Offtake',
  ix:      'Interconnection',
  site:    'Site Control',
  stage:   'Dev Stage',
  all:     'All Pillars',
}

// Highlight the matching substring in a suggestion label
function MatchHighlight({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span className="font-bold" style={{ color: '#0F766E' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

const PILLAR_FILTERS = [
  { key: 'offtake', label: 'Offtake' },
  { key: 'ix',      label: 'Interconnection' },
  { key: 'site',    label: 'Site Control' },
  { key: 'stage',   label: 'Dev Stages' },
]

// V3: active pillar filter button styles — teal/amber/blue/navy aligned with V3 palette
const PILLAR_ACTIVE = {
  offtake: 'bg-teal-600 text-white border-teal-700',
  ix:      'bg-amber-600 text-white border-amber-700',
  site:    'bg-blue-600 text-white border-blue-700',
  stage:   'bg-brand text-white border-brand',
}

export default function Glossary() {
  const [query, setQuery]           = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [pillar, setPillar]         = useState(null)   // null = all
  const [highlighted, setHighlighted] = useState(null) // term name briefly flashing

  const searchRef = useRef(null)
  const cardRefs  = useRef({})  // { [termName]: DOM element }

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Deep-link: scroll to hashed term on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const match = terms.find(t => toSlug(t.term) === hash)
    if (!match) return
    setTimeout(() => {
      const el = cardRefs.current[match.term]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlighted(match.term)
        setTimeout(() => setHighlighted(null), 1400)
      }
    }, 200)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Typeahead: match term names only
  const suggestions = query.trim()
    ? terms.filter((t) => t.term.toLowerCase().includes(query.toLowerCase()))
    : []

  // Main list: apply pillar filter + text search (name or definition)
  const filtered = terms.filter((t) => {
    const matchesPillar = !pillar || t.pillar === pillar || t.pillar === 'all'
    const q = query.trim().toLowerCase()
    const matchesQuery = !q ||
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q)
    return matchesPillar && matchesQuery
  })

  const scrollToTerm = (termName) => {
    setQuery('')
    setShowDropdown(false)
    setPillar(null)
    window.location.hash = toSlug(termName)
    setTimeout(() => {
      const el = cardRefs.current[termName]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlighted(termName)
        setTimeout(() => setHighlighted(null), 1400)
      }
    }, 50)
  }

  const handleSuggestionClick = (termName) => scrollToTerm(termName)

  // Tracks the most recently copied term + outcome so the term button can
  // flash a "Copied" / "Copy failed" indicator. Previously the silent
  // .catch(() => {}) left users uncertain whether the click did anything.
  const [copyState, setCopyState] = useState({ term: null, status: null })
  const copyAnchorLink = async (termName) => {
    const url = `${window.location.origin}${window.location.pathname}#${toSlug(termName)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyState({ term: termName, status: 'ok' })
    } catch {
      setCopyState({ term: termName, status: 'error' })
    }
    setTimeout(() => setCopyState({ term: null, status: null }), 1500)
  }

  const handleQueryChange = (e) => {
    setQuery(e.target.value)
    setShowDropdown(true)
  }

  const clearQuery = () => {
    setQuery('')
    setShowDropdown(false)
  }

  return (
    <div className="min-h-screen bg-paper relative">
      {/* Ambient intelligence layer + occasional Tractova mark cameo —
          mirrors the Profile page treatment so the platform feels alive
          end-to-end. WalkingTractovaMark uses sessionGate so it fires at
          most once per session (Glossary is a reference surface users
          may revisit; recurring cameos would annoy). */}
      <IntelligenceBackground />
      <WalkingTractovaMark triggerProbability={0.30} sessionGate={true} />

      <main className="relative max-w-dashboard mx-auto px-6 pt-20 pb-16">
        {/* V3 hero — brand navy with teal accent rail; replaces legacy emerald-on-amber */}
        <div className="mt-6 mb-8">
          <div className="relative rounded-xl px-8 py-7 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
            {/* Top teal accent rail */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />
            {/* Subtle grid texture (kept) */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px)' }} />
            {/* Teal accent glow (was amber) */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl"
              style={{ background: 'rgba(20,184,166,0.20)' }} />

            <div className="relative flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  {/* Pulsing dot mirrors the Library "data refreshed" treatment —
                      visual signal that this is a live, growing surface. */}
                  <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
                      style={{ background: '#14B8A6' }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.65)' }}
                    />
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: '#5EEAD4' }}>Reference</span>
                  <span className="w-px h-3" style={{ background: 'rgba(20,184,166,0.40)' }} />
                  <span className="font-mono text-[10px] tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.55)' }}>{terms.length} TERMS</span>
                </div>
                <h1 className="font-serif text-3xl font-semibold text-white tracking-tight"
                  style={{ letterSpacing: '-0.02em' }}>Industry Glossary</h1>
                <p className="text-sm mt-2 leading-relaxed max-w-xl"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Definitions for every key term used across Tractova — from program structures and dev stages to interconnection mechanics. Built for practitioners, not generalists.
                </p>
              </div>
              {/* Decorative monospace tag — V3 teal */}
              <div className="hidden sm:block shrink-0 text-right">
                <div className="font-mono text-[10px] leading-5 select-none"
                  style={{ color: 'rgba(94,234,212,0.40)' }}>
                  <div>offtake · ix · site</div>
                  <div>stage · program</div>
                  <div style={{ color: 'rgba(20,184,166,0.55)' }}>v{new Date().getFullYear()}.1</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search input + typeahead dropdown */}
        <div ref={searchRef} className="relative max-w-sm mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (query.trim()) setShowDropdown(true) }}
            placeholder="Search terms..."
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
          />
          {query && (
            <button
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}

          {/* Typeahead dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((t) => (
                <li key={t.term} className="border-b border-gray-50 last:border-0">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(t.term) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-teal-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <MatchHighlight text={t.term} query={query} />
                    <span className={`text-xs px-1.5 py-0.5 rounded-sm border font-medium shrink-0 ${PILLAR_BADGE[t.pillar]}`}>
                      {PILLAR_LABEL[t.pillar]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pillar filter buttons */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-400 font-medium mr-1">Pillar:</span>
          <button
            onClick={() => setPillar(null)}
            className={`text-xs px-2.5 py-0.5 rounded border font-medium transition-colors ${
              pillar === null
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'
            }`}
          >
            All
          </button>
          {PILLAR_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPillar(pillar === key ? null : key)}
              className={`text-xs px-2.5 py-0.5 rounded border font-medium transition-colors ${
                pillar === key
                  ? PILLAR_ACTIVE[key]
                  : PILLAR_BADGE[key] + ' hover:opacity-80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Term list */}
        {filtered.length > 0 ? (
          <div className="grid gap-4">
            {filtered.map((t) => (
              <div
                key={t.term}
                id={toSlug(t.term)}
                ref={(el) => { cardRefs.current[t.term] = el }}
                className={`bg-white border rounded-lg px-6 py-5 transition-all duration-700 ${
                  highlighted === t.term
                    ? 'border-teal-500 ring-2 ring-teal-500/25 bg-teal-50/40'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={() => copyAnchorLink(t.term)}
                        title="Copy link to this term"
                        className="group flex items-center gap-1.5 font-serif text-lg font-semibold text-ink hover:text-teal-700 transition-colors"
                        style={{ letterSpacing: '-0.015em' }}
                      >
                        {t.term}
                        <svg
                          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0"
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                      </button>
                      <span className={`text-xs px-1.5 py-0.5 rounded-sm border font-medium ${PILLAR_BADGE[t.pillar]}`}>
                        {PILLAR_LABEL[t.pillar]}
                      </span>
                      {copyState.term === t.term && (
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold transition-opacity"
                          style={{ color: copyState.status === 'ok' ? '#0F766E' : '#B45309' }}
                        >
                          {copyState.status === 'ok' ? 'Copied' : 'Copy failed'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{t.definition}</p>

                    {/* Related terms */}
                    {t.related?.length > 0 && (
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-100">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.20em] text-ink-muted">See also</span>
                        {t.related.map((r) => (
                          <button
                            key={r}
                            onClick={() => scrollToTerm(r)}
                            className="text-xs hover:underline transition-colors"
                            style={{ color: '#0F766E' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#0A1828' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#0F766E' }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">
            No terms match &ldquo;{query}&rdquo;
            {pillar && <span> in <span className="font-medium">{PILLAR_LABEL[pillar]}</span></span>}
          </div>
        )}
      </main>
    </div>
  )
}
