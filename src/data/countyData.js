// County-level intelligence data seeded for Iteration 2 — Tractova Lens
// Keyed by STATE_ID → county slug → pillar data
// Counties are normalized: lowercase, no "county" suffix, no spaces → hyphens
//
// Each entry has:
//   siteControl  — land availability, wetland flags, land use notes
//   interconnection — serving utility, queue status, ease score (1-10), avg study timeline
//
// Offtake data is pulled from statePrograms.js by state ID.
// Revenue stack summaries are in revenueStackByState below.

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Stack Summaries by State
// ─────────────────────────────────────────────────────────────────────────────
export const revenueStackByState = {
  IL: {
    summary: "Illinois Shines REC payments ($/kWh, 15-yr contract) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder where applicable. Capacity factor ~15–17%.",
    irecMarket: "Active — GATS-based",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10%",
    netMeteringStatus: "Virtual NEM via Illinois Shines program",
  },
  NY: {
    summary: "Value Stack (CDG bill credit — 6¢–11¢/kWh depending on zone) + IRA ITC 30% base + LMI adder + NY-Sun incentive for eligible projects. NYC/downstate rates strongest.",
    irecMarket: "Active — NYGATS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Low-Income Community +20%",
    netMeteringStatus: "CDG credit via Value Stack",
  },
  MA: {
    summary: "SMART Block 8 incentive (fixed ¢/kWh declining-block adder, 10-yr) + IRA ITC 30% + LMI adder + SREC II market for older projects. New blocks tightening.",
    irecMarket: "Active — NEPOOL-GIS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10%",
    netMeteringStatus: "SMART compensation + net metering",
  },
  MN: {
    summary: "Xcel Solar Garden compensation rate (fixed ¢/kWh, 25-yr, index-based) + IRA ITC 30%. No LMI adder required but voluntary LMI projects can access bonus REC pricing.",
    irecMarket: "Active — MRETS",
    itcBase: "30%",
    itcAdder: "Energy Community +10% in qualifying zones",
    netMeteringStatus: "Solar Garden credits via Xcel compensation tariff",
  },
  CO: {
    summary: "Xcel CS compensation rate (REC + capacity + energy, ¢/kWh, 20-yr) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder. 2MW cap lifted.",
    irecMarket: "Active — WREGIS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10%",
    netMeteringStatus: "CS bill credit via Xcel Colorado Solar Garden tariff",
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// County Intelligence Data
// ─────────────────────────────────────────────────────────────────────────────
const countyDataByState = {

  // ── ILLINOIS ──────────────────────────────────────────────────────────────
  IL: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Mix of prime agricultural and marginal land. Check USDA farmland class (Class I/II land will draw scrutiny). Large contiguous parcels available in rural counties.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Review county zoning for solar energy overlay. Most rural IL counties permit ground-mount solar by right or with a special use permit. Township sign-off sometimes needed.",
      },
      interconnection: {
        servingUtility: "Ameren Illinois",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Ameren territories generally accessible. Sub-5MW projects routed through expedited process. MISO Order 2023 reforms improving queue efficiency.",
      },
    },
    cook: {
      siteControl: {
        availableLand: false,
        landNotes: "Cook County is heavily urbanized — minimal agricultural parcels. Focus on brownfields, contaminated sites, or commercial rooftops. Some south suburban opportunity.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Chicago city zoning complex. Suburban Cook municipalities vary widely. Best opportunity: south and southwest suburban fringe.",
      },
      interconnection: {
        servingUtility: "ComEd (Exelon)",
        queueStatus: "Limited — high demand",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "ComEd northern Illinois territory sees heavy demand. Urban load pockets can create upgrade requirements. Sub-2MW projects may qualify for expedited review.",
      },
    },
    champaign: {
      siteControl: {
        availableLand: true,
        landNotes: "Prime agricultural county — high concentration of USDA Class I/II farmland. Expect local opposition and county scrutiny for large solar footprints on ag land. Landowner interest generally strong.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Champaign County has a solar energy overlay district. Most rural townships allow ground-mount solar with a special use permit. Setback requirements apply.",
      },
      interconnection: {
        servingUtility: "Ameren Illinois",
        queueStatus: "Open — moderate backlog",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–18 months",
        queueNotes: "Ameren Decatur load pocket can be congested for larger projects. Sub-5MW projects process faster. 138kV transmission access available near Champaign-Urbana.",
      },
    },
    mclean: {
      siteControl: {
        availableLand: true,
        landNotes: "Highly productive farmland county — USDA prime designation widespread. Low wetland risk on upland sites. Strong landowner interest in solar leases.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "McLean County zoning generally permissive for solar. Bloomington-Normal urban area has specific restrictions; rural unincorporated areas are more flexible.",
      },
      interconnection: {
        servingUtility: "Ameren Illinois",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–16 months",
        queueNotes: "McLean County sits in a good Ameren transmission corridor. Relatively low queue saturation. Medium-voltage distribution interconnection available at multiple substations.",
      },
    },
    will: {
      siteControl: {
        availableLand: true,
        landNotes: "South suburban Chicago fringe — mix of agricultural and industrial land. Good brownfield opportunities near Joliet. Prime ag land in southern portions.",
        wetlandWarning: true,
        wetlandNotes: "Kankakee River tributary wetlands present. Run EPA NWI check on any site below the Illinois & Michigan Canal corridor.",
        landUseNotes: "Will County has been proactive in solar zoning. Many townships have adopted solar energy ordinances. Check for industrial brownfield clean energy overlay zones.",
      },
      interconnection: {
        servingUtility: "ComEd (Exelon)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "15–20 months",
        queueNotes: "Southern ComEd territory has reasonable capacity. Joliet-area substations have seen renewable projects successfully interconnect. PJM/MISO seam can complicate larger projects.",
      },
    },
  },

  // ── NEW YORK ───────────────────────────────────────────────────────────────
  NY: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Land availability varies widely by region. Upstate NY generally more accessible than downstate. Agricultural land most common in western and central NY.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Check DEC NWI layer (Article 24 wetlands). All sites within 100ft of wetlands require DEC permit. Many upstate towns have adopted solar local laws.",
      },
      interconnection: {
        servingUtility: "NYSEG",
        queueStatus: "Open — moderate",
        queueStatusCode: "open",
        easeScore: 5,
        avgStudyTimeline: "20–28 months",
        queueNotes: "NYISO queue has improved post-2023 reforms. Upstate utilities (NYSEG, RG&E) more accessible than Con Ed downstate. Cluster study impacts vary by zone.",
      },
    },
    westchester: {
      siteControl: {
        availableLand: false,
        landNotes: "Densely developed suburban county — very limited land availability for utility-scale solar. Focus on commercial rooftops or C&I behind-the-meter.",
        wetlandWarning: true,
        wetlandNotes: "Numerous DEC Article 24 freshwater wetlands throughout county. Any site near streams requires thorough NWI analysis.",
        landUseNotes: "Strong local opposition to large ground-mount solar. Many Westchester municipalities have enacted solar moratoriums or strict setback requirements. BESS + rooftop better fit here.",
      },
      interconnection: {
        servingUtility: "Con Edison",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 2,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "Con Edison territory is among the most congested in the country. NYISO Zone J extremely backlogged. High network upgrade costs common. Not recommended for small developers.",
      },
    },
    albany: {
      siteControl: {
        availableLand: true,
        landNotes: "Mix of farmland and forest in Albany County. Moderate availability. APA-adjacent northern areas have restrictions. Agricultural land less productive than western NY.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Albany County comprehensive plan supportive of solar. Many towns have adopted solar local laws. Chapter 70 Article 10 large-scale review threshold is 25MW — stay under for smaller process.",
      },
      interconnection: {
        servingUtility: "National Grid / NYSEG",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 5,
        avgStudyTimeline: "22–28 months",
        queueNotes: "National Grid upstate territory has reasonable capacity. NYISO Zone E. Some congestion near Albany metro. Rural sites in southern Albany County generally cleaner to interconnect.",
      },
    },
    monroe: {
      siteControl: {
        availableLand: true,
        landNotes: "Rochester metro fringe has good agricultural land in suburban and rural areas. Lake Ontario proximity creates some wetland risk on low-lying sites.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Monroe County zoning is highly variable by town. Several Rochester-area towns have approved solar energy local laws. Wayne County line (eastern fringe) very permissive.",
      },
      interconnection: {
        servingUtility: "NYSEG / RG&E (Rochester Gas & Electric)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "RG&E/NYSEG Rochester territory has moderate headroom. NYISO Zone C. Several recent CS projects successfully interconnected in Monroe and adjacent counties.",
      },
    },
    ulster: {
      siteControl: {
        availableLand: true,
        landNotes: "Hudson Valley agricultural land available in western portions. Catskill foothills create topographic challenges for larger projects. Some ag land conversion opportunity.",
        wetlandWarning: true,
        wetlandNotes: "Rondout Creek and Wallkill River corridors have DEC wetlands. Check NWI before site selection in valley floors.",
        landUseNotes: "Ulster County has a progressive energy planning environment. Some towns have adopted community solar–friendly local laws. Catskill Park boundaries restrict development in northeastern portions.",
      },
      interconnection: {
        servingUtility: "Central Hudson Gas & Electric",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "24–32 months",
        queueNotes: "Central Hudson (NYISO Zone G) has seen recent congestion from Hudson Valley solar surge. Network upgrade costs rising. Study early and watch for cluster study groupings.",
      },
    },
  },

  // ── MASSACHUSETTS ─────────────────────────────────────────────────────────
  MA: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Wetland risk moderate to high statewide — use MassGIS NWI layer before site selection. Forest clearing politically sensitive in many communities.",
        wetlandWarning: true,
        wetlandNotes: "Massachusetts Wetlands Protection Act is strict — 50ft no-disturb, 100ft buffer. Chapter 61A land conversion process required for agricultural land under preferential tax status.",
        landUseNotes: "Most towns have local solar bylaws under Green Communities Act. Check town zoning for dimensional requirements (setbacks, screening). Many towns cap ground-mount at 3–5MW.",
      },
      interconnection: {
        servingUtility: "Eversource Energy / National Grid",
        queueStatus: "Limited — SMART Block 8 filling",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "ISO-NE interconnection. SMART program queue fills by blocks — project must be in queue before block caps. Eversource and National Grid distribution territories have moderate capacity.",
      },
    },
    worcester: {
      siteControl: {
        availableLand: true,
        landNotes: "Central MA has forested land and some agricultural areas. Wetland presence common — check MassGIS NWI before site selection. Capped landfills a strong brownfield opportunity.",
        wetlandWarning: true,
        wetlandNotes: "Chapter 131 Section 40 wetland protection applies. Many sites in Worcester County have vernal pools — NHESP mapping required.",
        landUseNotes: "Many Worcester County towns have solar bylaws. Chapter 61A conversion filing needed for farm parcels. Brownfields and disturbed land strongly preferred from a permitting standpoint.",
      },
      interconnection: {
        servingUtility: "Eversource Energy",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Eversource Central MA territory. SMART Block 8 interconnection slots filling. Distribution capacity varies by substation — check hosting capacity map before site commitment.",
      },
    },
    middlesex: {
      siteControl: {
        availableLand: false,
        landNotes: "High-density suburban county. Very limited large parcels. Most viable sites are commercial rooftops, parking canopies, or brownfields. Chapter 61/61A land conversion complex.",
        wetlandWarning: true,
        wetlandNotes: "Dense wetland network throughout county. Many streams and ponds with 100ft buffer requirements. NHESP rare species mapping important.",
        landUseNotes: "Strong environmental review in most Middlesex communities. Chapter 61A land conversion filings for ag parcels. Town center historic districts restrict visual impact.",
      },
      interconnection: {
        servingUtility: "Eversource Energy",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "24–30 months",
        queueNotes: "Near-Boston Eversource territory heavily loaded. High network upgrade costs common near urban core. Suburban fringe (western Middlesex) has better capacity.",
      },
    },
    hampshire: {
      siteControl: {
        availableLand: true,
        landNotes: "Pioneer Valley agricultural land available. Connecticut River floodplain wetlands require careful siting. Hillside and upland ag land best opportunities.",
        wetlandWarning: true,
        wetlandNotes: "Connecticut River corridor has priority resource areas. Mass Wildlife NHESP layer critical — several species of special concern in area.",
        landUseNotes: "Hampshire County towns vary in solar receptiveness. Northampton has progressive policies. Rural towns generally more flexible on setbacks. Chapter 61A conversion process standard.",
      },
      interconnection: {
        servingUtility: "Eversource Energy / National Grid",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "Western MA territory has better capacity than eastern MA. SMART Block opportunities remain open longer here. WMECO (National Grid) substations in some areas. Good for developers targeting rural MA.",
      },
    },
  },

  // ── MINNESOTA ─────────────────────────────────────────────────────────────
  MN: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Strong agricultural land availability in most counties. Low wetland risk on upland farm sites. Prairie pothole regions (west central MN) require wetland check.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Minnesota GreenStep Cities program supports solar. Check county ordinance for size limits and setback requirements. Most rural counties have permissive solar ordinances.",
      },
      interconnection: {
        servingUtility: "Xcel Energy (NSP)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–16 months",
        queueNotes: "Xcel Energy Minnesota has a well-defined Solar Garden process. MISO interconnection relatively transparent. Queue timelines have improved significantly since 2023.",
      },
    },
    hennepin: {
      siteControl: {
        availableLand: false,
        landNotes: "Minneapolis–St. Paul metro core — minimal agricultural parcels. Focus on commercial rooftops, parking canopies, or peri-urban fringe sites. Brookfield and Eden Prairie have some suburban opportunity.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Hennepin County suburban municipalities vary widely in solar ordinances. Several cities have proactive solar policies (Minneapolis, Eden Prairie). Urban sites favor distributed CS model.",
      },
      interconnection: {
        servingUtility: "Xcel Energy (NSP)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–14 months",
        queueNotes: "Metro Xcel territory has strong load and good capacity. Solar Garden applications process efficiently. Distribution-level interconnection widely available across the metro.",
      },
    },
    olmsted: {
      siteControl: {
        availableLand: true,
        landNotes: "Rochester area has productive farmland with strong solar resource. Good contiguous parcels available outside the urban core. Low wetland risk on upland sites.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Olmsted County zoning permissive for solar. Rochester GreenStep program actively supports renewables. IBM and Mayo Clinic presence drives strong commercial subscriber demand.",
      },
      interconnection: {
        servingUtility: "Xcel Energy (NSP)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "8–12 months",
        queueNotes: "Olmsted County has excellent Xcel interconnection conditions. Rochester load pocket absorbs Solar Garden output well. One of the stronger CS development counties in Minnesota.",
      },
    },
    stearns: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Minnesota agricultural land — large contiguous parcels widely available. Strong solar resource. Low wetland risk on upland farmland.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Stearns County recently updated solar ordinance (2024) — generally permissive for ground-mount CS. St. Cloud metro fringe has some restrictions, rural township areas flexible.",
      },
      interconnection: {
        servingUtility: "Xcel Energy (NSP)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "8–12 months",
        queueNotes: "Strong Xcel distribution capacity in Stearns County. Rural substations have headroom. Excellent interconnection conditions for sub-5MW CS projects.",
      },
    },
    dakota: {
      siteControl: {
        availableLand: true,
        landNotes: "Southern metro fringe. Mix of suburban and agricultural land. Apple Valley and Eagan urban areas limited; rural southern townships have good parcel availability.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Dakota County has an active solar program. Many suburban cities have solar-friendly zoning. Farmington and Northfield area rural townships very permissive.",
      },
      interconnection: {
        servingUtility: "Xcel Energy (NSP)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–14 months",
        queueNotes: "Southern metro Xcel territory with good capacity. Strong load near metro supports CS subscriber acquisition. Dakota Electric Association co-op serves some eastern portions.",
      },
    },
  },

  // ── COLORADO ──────────────────────────────────────────────────────────────
  CO: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Colorado generally has strong solar resource and available dryland and rangeland parcels. Eastern plains counties have large tracts.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Check for conservation easements (GOCO, Great Outdoors Colorado land trust designations) — very common on quality agricultural land. County zoning district matters significantly.",
      },
      interconnection: {
        servingUtility: "Xcel Energy Colorado",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–16 months",
        queueNotes: "Xcel Energy Colorado has a well-managed CS process. WACM (Western Area Colorado-Missouri) interconnection area. Rural co-ops in WACM territory have good headroom.",
      },
    },
    weld: {
      siteControl: {
        availableLand: true,
        landNotes: "High Plains agricultural county — large contiguous parcels readily available. Strong solar resource. Oil & gas co-location possible on existing mineral rights. Low wetland risk.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Weld County is among the most permissive in Colorado for energy development. Mineral rights co-existence common. Strong landowner interest in solar lease revenue.",
      },
      interconnection: {
        servingUtility: "Xcel Energy Colorado",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "10–14 months",
        queueNotes: "Excellent Xcel Colorado conditions in Weld County. Fort Lupton and Greeley load centers provide strong offtake. Multiple recent CS projects successfully commissioned here.",
      },
    },
    elpaso: {
      siteControl: {
        availableLand: true,
        landNotes: "Colorado Springs metro fringe. Mix of rangeland, dryland agriculture, and suburban residential. Strong solar resource. Some USAF base proximity restrictions — check restricted airspace.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "El Paso County: distinguish Colorado Springs incorporated (complex) vs. county unincorporated (more flexible). Monument and Falcon area rural townships are best opportunities.",
      },
      interconnection: {
        servingUtility: "Black Hills Energy / Colorado Springs Utilities",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Black Hills and CS Utilities territories have reasonable capacity but smaller systems than Xcel. CS Utilities (city-owned) has its own interconnection process — allow extra time for municipal coordination.",
      },
    },
    larimer: {
      siteControl: {
        availableLand: true,
        landNotes: "Fort Collins area. Mix of irrigated agricultural land and dryland parcels. Conservation easements common on higher-quality farmland — verify before leasing.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Larimer County has a strong conservation community. Check GOCO easements and Larimer County Land Stewardship designations. Rural eastern portions (Berthoud, Johnstown area) more flexible.",
      },
      interconnection: {
        servingUtility: "Xcel Energy Colorado",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–14 months",
        queueNotes: "Fort Collins metro Xcel territory. Good distribution capacity in rural eastern Larimer County. Loveland–Fort Collins corridor has seen successful CS interconnections.",
      },
    },
    adams: {
      siteControl: {
        availableLand: true,
        landNotes: "Northern Denver metro fringe. Mix of industrial, agricultural, and suburban land. Brighton and Fort Lupton areas have agricultural parcels. Brownfield opportunities near Commerce City.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Adams County has been receptive to solar in its eastern agricultural areas. Check for airport height restrictions near DIA. Brighton area rural townships are most accessible.",
      },
      interconnection: {
        servingUtility: "Xcel Energy Colorado",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "10–14 months",
        queueNotes: "Adams County sits in a strong Xcel transmission corridor. Brighton substation area has supported multiple CS and C&I solar projects. DIA-adjacent load provides strong CS subscriber base.",
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helper
// Normalizes county input → slug (lowercase, strip "county" suffix, trim)
// Falls back to state default if specific county not found
// ─────────────────────────────────────────────────────────────────────────────
// Counties with seeded data, keyed by state ID.
// label is the display name; slug is the key used in countyDataByState.
export const COUNTIES_BY_STATE = {
  IL: [
    { slug: 'champaign', label: 'Champaign' },
    { slug: 'cook',      label: 'Cook' },
    { slug: 'mclean',    label: 'McLean' },
    { slug: 'will',      label: 'Will' },
  ],
  NY: [
    { slug: 'albany',      label: 'Albany' },
    { slug: 'monroe',      label: 'Monroe' },
    { slug: 'ulster',      label: 'Ulster' },
    { slug: 'westchester', label: 'Westchester' },
  ],
  MA: [
    { slug: 'hampshire', label: 'Hampshire' },
    { slug: 'middlesex', label: 'Middlesex' },
    { slug: 'worcester', label: 'Worcester' },
  ],
  MN: [
    { slug: 'dakota',   label: 'Dakota' },
    { slug: 'hennepin', label: 'Hennepin' },
    { slug: 'olmsted',  label: 'Olmsted' },
    { slug: 'stearns',  label: 'Stearns' },
  ],
  CO: [
    { slug: 'adams',   label: 'Adams' },
    { slug: 'elpaso',  label: 'El Paso' },
    { slug: 'larimer', label: 'Larimer' },
    { slug: 'weld',    label: 'Weld' },
  ],
}

export function normalizeCounty(input) {
  // Strip trailing "county", lowercase, and remove all spaces so "El Paso" → "elpaso"
  return input.trim().toLowerCase().replace(/\s+county\s*$/i, '').trim().replace(/\s+/g, '')
}

export function getCountyData(stateId, countyName) {
  const stateData = countyDataByState[stateId]
  if (!stateData) return getGenericData(stateId)
  const slug = normalizeCounty(countyName)
  return stateData[slug] || stateData.default
}

// Generic fallback for states without seeded county data
function getGenericData(stateId) {
  return {
    siteControl: {
      availableLand: true,
      landNotes: "County-level land data not yet seeded for this state. Check USDA Web Soil Survey for farmland class and EPA NWI for wetland mapping.",
      wetlandWarning: false,
      wetlandNotes: null,
      landUseNotes: "Review local county zoning and state solar siting guidelines before committing to a site.",
    },
    interconnection: {
      servingUtility: "See state IX notes",
      queueStatus: "Check utility queue",
      queueStatusCode: "unknown",
      easeScore: null,
      avgStudyTimeline: "Varies",
      queueNotes: "Detailed county-level interconnection data not yet available for this state. See state overview for IX conditions.",
    },
  }
}

export default countyDataByState
