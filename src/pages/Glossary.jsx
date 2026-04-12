import { useState, useRef, useEffect } from 'react'

const terms = [
  // ── Development stages ──────────────────────────────────────────────────────
  {
    term: 'Prospecting',
    pillar: 'stage',
    definition:
      'The earliest stage of project development. A developer is identifying potential sites based on available land, favorable grid conditions, and state program activity — but has not yet engaged landowners or utilities. Prospecting decisions are driven by desktop research, GIS analysis, and market intelligence. Tractova is purpose-built to support this stage.',
  },
  {
    term: 'Site Control',
    pillar: 'stage',
    definition:
      'The developer has secured a legal right to develop a specific parcel — typically through an option agreement or lease with the landowner. Site control is a prerequisite for filing an interconnection application and most project financing. Standard option agreements run 3–5 years with renewal rights tied to project milestones.',
  },
  {
    term: 'Pre-Development',
    pillar: 'stage',
    definition:
      'Site control is secured and the developer is completing foundational studies and permits before construction begins. Activities include environmental surveys, Phase I/II assessments, permitting applications, and interconnection study execution (ISA filing). Pre-development spend typically ranges from $50K–$500K before a project reaches NTP.',
  },
  {
    term: 'Development',
    pillar: 'stage',
    definition:
      'The project has cleared pre-development milestones and is actively advancing toward construction. Key activities include finalizing the Interconnection Agreement (IA), securing offtake contracts, completing land use permits, and arranging project financing. Many projects fail to close financing and never exit this stage.',
  },
  {
    term: 'NTP (Notice to Proceed)',
    pillar: 'stage',
    definition:
      'A contractual milestone issued by the project owner or lender authorizing the EPC contractor to begin construction. NTP signals that financing is closed, permits are in hand, interconnection is approved, and offtake is contracted. It is the official start of the construction timeline and a key trigger for lender disbursements.',
  },
  {
    term: 'Construction',
    pillar: 'stage',
    definition:
      'The EPC contractor is actively building the project. For community solar, construction typically takes 3–9 months depending on project size and grid connection complexity. Key milestones include equipment procurement, civil work, racking installation, electrical balance-of-system completion, and utility commissioning inspection.',
  },
  {
    term: 'Operational',
    pillar: 'stage',
    definition:
      'The project has received Permission to Operate (PTO) from the utility and is generating electricity. For community solar, operational status triggers subscriber billing and revenue recognition. Ongoing responsibilities include O&M, subscriber management, performance reporting, and REC delivery under the offtake contract.',
  },

  // ── Program status terms ─────────────────────────────────────────────────────
  {
    term: 'Active Program',
    pillar: 'offtake',
    definition:
      'A state has a currently open, funded community solar program accepting new project applications or subscriber enrollments. Active programs have defined capacity, compensation structures, and regulatory approval. Contrast with Limited (nearly full) or Pending (rules not yet finalized).',
  },
  {
    term: 'Limited Capacity',
    pillar: 'offtake',
    definition:
      'The program exists and is operational, but available capacity is nearly exhausted. Developers should monitor closely for new tranches or block openings. A Limited state may become Active again when the program administrator authorizes additional MW.',
  },
  {
    term: 'LMI (Low-to-Moderate Income)',
    pillar: 'offtake',
    definition:
      'Federal income designation, typically defined as households earning ≤80% of Area Median Income (AMI). Many community solar programs mandate a minimum percentage of LMI-qualified subscribers — commonly 20–51%. Meeting LMI requirements can also unlock additional ITC adders under the Inflation Reduction Act (IRA Section 48E).',
  },
  {
    term: 'IX Queue (Interconnection Queue)',
    pillar: 'ix',
    definition:
      'The backlog of generation projects awaiting utility or ISO/RTO approval to connect to the electric grid. Queue position, study timelines, Network Upgrade costs, and ISA withdrawal rates determine whether a project is technically and economically viable. Queue saturation is one of the top project killers for small developers.',
  },
  {
    term: 'ISA (Interconnection Study Agreement)',
    pillar: 'ix',
    definition:
      'A contract between a developer and the utility or ISO/RTO that triggers the formal interconnection feasibility or system impact study. Executing an ISA is a major project milestone — it commits capital (typically $10K–$100K+ in study deposits), locks in a queue position, and initiates the timeline toward a final Interconnection Agreement (IA).',
  },
  {
    term: 'VDER (Value of Distributed Energy Resources)',
    pillar: 'offtake',
    definition:
      'New York\'s compensation framework for distributed generation and community solar, replacing net metering for most projects. VDER calculates credit rates based on time of delivery, location on the grid, installed capacity, and system attributes rather than a flat avoided cost rate. Also called the "Value Stack." Rates vary by utility territory and are set annually by NYSERDA.',
  },
  {
    term: 'NEM (Net Energy Metering)',
    pillar: 'offtake',
    definition:
      'A billing mechanism that credits solar system owners for electricity exported to the grid, typically at or near the retail rate. NEM policies vary significantly by state and utility and are being modified in several markets — most notably NEM 3.0 in California, which reduced export credits by ~75%. Virtual NEM (VNEM) is the mechanism used for community solar subscriber billing in many states.',
  },
  {
    term: 'Offtake',
    pillar: 'offtake',
    definition:
      'The arrangement by which electricity generated by a project is sold or assigned to end users. In community solar, offtake means subscriber enrollment — the process of signing up households or businesses to receive bill credits from the project\'s output. Offtake risk (inability to find subscribers) is a key early-stage concern for community solar developers.',
  },
  {
    term: 'REC (Renewable Energy Certificate)',
    pillar: 'offtake',
    definition:
      'A market instrument representing the environmental attributes of 1 MWh of renewable electricity generation. RECs can be sold separately from the physical electricity ("unbundled") or bundled with power purchase agreements. State RPS (Renewable Portfolio Standard) requirements drive REC demand. Community solar projects may generate SRECs (Solar RECs) or TRECs depending on state program structure.',
  },
  {
    term: 'ITC (Investment Tax Credit)',
    pillar: 'offtake',
    definition:
      'A federal tax credit for renewable energy projects equal to a percentage of qualifying project costs, governed by IRA Section 48/48E. The base ITC rate is 30% for projects meeting prevailing wage and apprenticeship requirements. Adders are available for Energy Community siting (+10%), Low-Income Community Projects (+10–20%), and domestic content (+10%). Most community solar projects under 5MW AC qualify for the full adder stack.',
  },
  {
    term: 'Opportunity Score',
    pillar: 'all',
    definition:
      'A proprietary Tractova composite score (0–100) reflecting the combined attractiveness of a state for community solar development. Inputs include CS program status, remaining capacity, IX difficulty, LMI requirements, and IRA adder eligibility. Higher scores indicate states where a small developer is most likely to close a viable project. This scoring is Tractova\'s primary differentiated data layer.',
  },

  // ── Additional industry terms ────────────────────────────────────────────────
  {
    term: 'SREC (Solar Renewable Energy Certificate)',
    pillar: 'offtake',
    definition:
      'A state-specific Solar REC representing the environmental attributes of 1 MWh of solar generation. SRECs trade on state-specific markets and prices vary widely — from under $10/MWh in oversupplied markets to $300+/MWh in constrained markets like Massachusetts. States with active SREC markets include MA, NJ, MD, DC, OH, and PA. SREC revenue is often a key component of the revenue stack and can make or break project economics in these states.',
  },
  {
    term: 'Illinois Shines',
    pillar: 'offtake',
    definition:
      'Illinois\' community solar and distributed generation incentive program, formally structured as the Adjustable Block Program (ABP). Administered by the Illinois Power Agency (IPA), Illinois Shines provides Renewable Energy Credits (RECs) at a fixed price per MWh under a 15-year contract. Projects up to 2,000 kW AC qualify. The program is funded through the Climate and Equitable Jobs Act (CEJA) and is widely regarded as one of the most developer-friendly CS programs in the country. Capacity is released in tranches and waitlists can form quickly.',
  },
  {
    term: 'CSEGS (Community Solar Electric Generating System)',
    pillar: 'offtake',
    definition:
      'The formal regulatory term used in Illinois for a community solar project. A CSEGS is a distributed generation facility of up to 2,000 kW AC whose output is subscribed by multiple customers in the same utility territory. CSEGS projects are eligible for Illinois Shines REC contracts under the ABP. The term is defined under the Illinois Public Utilities Act and used in all IPA program filings.',
  },
  {
    term: 'ANEM (Adjustable Net Energy Metering)',
    pillar: 'offtake',
    definition:
      'A community solar billing mechanism used in select states that adjusts subscriber credit rates based on time-of-use or other market factors, rather than applying a flat volumetric credit. ANEM structures attempt to align subscriber bill credits with the actual market value of solar generation, similar in intent to New York\'s VDER Value Stack. Specific ANEM rules vary by state and utility territory.',
  },
  {
    term: 'ABP (Adjustable Block Program)',
    pillar: 'offtake',
    definition:
      'The formal programmatic structure underlying Illinois Shines, administered by the Illinois Power Agency. The ABP sets fixed REC prices ("blocks") by project category — small distributed generation, large distributed generation, and community solar — and adjusts pricing across tranches based on demand. When a block fills, the IPA sets new pricing for the next tranche. The ABP is widely considered a model for well-structured state community solar incentive programs and is frequently cited by other states designing their own programs.',
  },
]

const PILLAR_BADGE = {
  offtake: 'bg-primary-50 text-primary-700 border-primary-200',
  ix:      'bg-accent-50 text-accent-700 border-accent-200',
  site:    'bg-blue-50 text-blue-700 border-blue-200',
  stage:   'bg-purple-50 text-purple-700 border-purple-200',
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
      <span className="font-bold text-primary">{text.slice(idx, idx + query.length)}</span>
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

// Active pillar filter button style per pillar
const PILLAR_ACTIVE = {
  offtake: 'bg-primary-600 text-white border-primary-600',
  ix:      'bg-accent-500 text-white border-accent-500',
  site:    'bg-blue-600 text-white border-blue-600',
  stage:   'bg-purple-600 text-white border-purple-600',
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

  const handleSuggestionClick = (termName) => {
    setQuery('')
    setShowDropdown(false)
    setPillar(null) // ensure the target card is visible

    setTimeout(() => {
      const el = cardRefs.current[termName]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlighted(termName)
        setTimeout(() => setHighlighted(null), 1400)
      }
    }, 50)
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
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
        {/* Page header */}
        <div className="mt-6 mb-6 max-w-2xl">
          <h1 className="text-xl font-bold text-gray-900">Glossary</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Key terms used across the Tractova platform. Understanding these concepts is essential for interpreting market intelligence and making informed project decisions.
          </p>
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
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {query && (
            <button
              onClick={clearQuery}
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
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-primary-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <MatchHighlight text={t.term} query={query} />
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${PILLAR_BADGE[t.pillar]}`}>
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
                ref={(el) => { cardRefs.current[t.term] = el }}
                className={`bg-white border rounded-lg px-6 py-5 transition-all duration-700 ${
                  highlighted === t.term
                    ? 'border-primary ring-2 ring-primary/25 bg-primary-50/40'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-sm font-bold text-gray-900">{t.term}</h2>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PILLAR_BADGE[t.pillar]}`}>
                        {PILLAR_LABEL[t.pillar]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{t.definition}</p>
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
