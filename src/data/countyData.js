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
  MD: {
    summary: "Maryland CS bill credits (retail rate offset, BGE/Pepco/Delmarva tariff) + MD SREC-II market + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder in qualifying zones.",
    irecMarket: "Active — PJM-GATS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10%",
    netMeteringStatus: "CS bill credit via utility tariff",
  },
  NJ: {
    summary: "NJ CS bill credits (retail rate offset) + TREC (Transition Renewable Energy Certificate, ~$152/MWh historically) + IRA ITC 30% base + 10% LMI adder. High 51% LMI subscriber requirement.",
    irecMarket: "Active — PJM-GATS",
    itcBase: "30%",
    itcAdder: "LMI +10%",
    netMeteringStatus: "CS bill credit via program tariff",
  },
  ME: {
    summary: "Maine Shared Energy bill credits (retail avoided cost rate) + NEPOOL-GIS REC market + IRA ITC 30% base. No LMI requirement. Strong state policy support.",
    irecMarket: "Active — NEPOOL-GIS",
    itcBase: "30%",
    itcAdder: "Energy Community +10% in qualifying rural areas",
    netMeteringStatus: "CS bill credit via CMP/Versant tariff",
  },
  OR: {
    summary: "Oregon Clean Electricity Program (OCEP) bill credits (retail rate offset) + OR REC market (WREGIS) + IRA ITC 30% base + 10% LMI adder. PGE and Pacific Power tariff structures differ.",
    irecMarket: "Active — WREGIS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10% in qualifying areas",
    netMeteringStatus: "CS bill credit via OCEP tariff",
  },
  WA: {
    summary: "Washington Shared Renewables bill credits (retail rate offset via PSE or Pacific Power) + WA REC market (WREGIS, smaller) + IRA ITC 30% base. Clean Energy Transformation Act supports subscriber demand.",
    irecMarket: "Active — WREGIS",
    itcBase: "30%",
    itcAdder: "LMI +10% where applicable",
    netMeteringStatus: "CS bill credit via utility tariff (PSE / Pacific Power)",
  },
  VA: {
    summary: "Virginia CS bill credits (retail rate offset via Dominion/AEP tariff) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder (many qualifying areas). VCEA mandates drive program growth.",
    irecMarket: "Active — PJM-GATS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10%",
    netMeteringStatus: "CS bill credit via Dominion/AEP tariff",
  },
  CT: {
    summary: "CT Shared Clean Energy Facility (SCEF) bill credits (avoided cost adder) + IRA ITC 30% base. 2MW project cap. ZREC/LREC grandfathered for earlier projects. Small program — economics tighter than MA.",
    irecMarket: "Active — NEPOOL-GIS",
    itcBase: "30%",
    itcAdder: "LMI +10%",
    netMeteringStatus: "CS bill credit via Eversource/UI SCEF tariff",
  },
  RI: {
    summary: "Rhode Island CS bill credits (retail rate offset via National Grid tariff) + NEPOOL-GIS REC market + IRA ITC 30% base. Small program (50 MW total). No LMI requirement.",
    irecMarket: "Active — NEPOOL-GIS",
    itcBase: "30%",
    itcAdder: "Energy Community +10% in qualifying areas",
    netMeteringStatus: "CS bill credit via National Grid RI tariff",
  },
  NM: {
    summary: "New Mexico CS bill credits (retail rate offset via PNM/EPE tariff) + NM REC market (WREGIS) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder (widely applicable in NM). High solar resource.",
    irecMarket: "Active — WREGIS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10% (broadly applicable)",
    netMeteringStatus: "CS bill credit via PNM/El Paso Electric tariff",
  },
  HI: {
    summary: "Hawaii CBRE (Community-Based Renewable Energy) bill credits (avoided cost rate + adders, ~$0.35–0.42/kWh value on Oahu) + IRA ITC 30% base + 10% LMI adder. Island grid high rates make credit values strong — if you can get through interconnection.",
    irecMarket: "Active — WREGIS (Hawaii branch)",
    itcBase: "30%",
    itcAdder: "LMI +10%",
    netMeteringStatus: "CBRE bill credit via HECO/MECO/HELCO tariff",
  },
  CA: {
    summary: "California NEM-ST / VNEM bill credits (NEM 3.0 export rates, reduced from NEM 2.0) + WREGIS REC market + IRA ITC 30% base + 10% LMI adder + 20% Low-Income Community adder. NEM 3.0 significantly reduced export value for new projects.",
    irecMarket: "Active — WREGIS",
    itcBase: "30%",
    itcAdder: "LMI +10%, Low-Income Community +20%, Energy Community +10%",
    netMeteringStatus: "NEM-ST export credit (NEM 3.0 export rate applies)",
  },
  FL: {
    summary: "FPL SolarTogether / Duke Energy CS credits (utility-set compensation, not independently negotiated) + IRA ITC 30%. Independent developer CS economics very limited — utility-controlled program structure. C&I solar better fit for Florida.",
    irecMarket: "Limited — SERC/Florida RECs",
    itcBase: "30%",
    itcAdder: "LMI +10% where applicable",
    netMeteringStatus: "Utility CS program credit (SolarTogether / Duke CS tariff)",
  },
  MI: {
    summary: "Michigan CS program rules pending at MPSC — expected bill credit structure similar to Minnesota. IRA ITC 30% base + LMI adder + Energy Community adder in qualifying areas (significant in former auto manufacturing regions). Watch MPSC for final rules.",
    irecMarket: "Active — MRETS (in anticipation)",
    itcBase: "30%",
    itcAdder: "LMI +10%, Energy Community +10% (broadly applicable in MI)",
    netMeteringStatus: "Program rules pending — bill credit structure expected",
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

  // ── MARYLAND ──────────────────────────────────────────────────────────────
  MD: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Rural Maryland has productive agricultural land — mix of prime farmland and marginal acreage. Chesapeake Bay watershed means wetland risk varies significantly by county and site elevation.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Maryland CS projects (typically ≤2MW) are primarily regulated at the county level — no state-level generation permit required at this scale. County solar energy zoning varies widely — check local ordinances before site commitment.",
      },
      interconnection: {
        servingUtility: "BGE (Baltimore Gas & Electric)",
        queueStatus: "Open — moderate",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "PJM territory. BGE and Pepco have reasonable capacity outside the Baltimore/DC urban cores. Delmarva Power (Eastern Shore) can be slower. MISO-to-PJM seam not a factor in MD.",
      },
    },
    frederick: {
      siteControl: {
        availableLand: true,
        landNotes: "Strong agricultural county west of Baltimore/DC metro. Mix of prime farmland and rolling terrain. Good parcel availability in northern and western portions.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Frederick County has a relatively permissive solar zoning framework. Agricultural solar overlay allows ground-mount with special exception in most districts. Strong developer activity in recent years.",
      },
      interconnection: {
        servingUtility: "Potomac Edison (FirstEnergy)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "14–18 months",
        queueNotes: "Potomac Edison (FirstEnergy) serves Frederick County. PJM territory with reasonable capacity. Several CS projects have successfully interconnected here. Good option for DC-market subscriber base.",
      },
    },
    washington: {
      siteControl: {
        availableLand: true,
        landNotes: "Westernmost MD county — Hagerstown metro fringe with large rural agricultural areas. Contiguous parcels available. Lower land values than central MD. Low wetland risk on upland sites.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Washington County zoning is developer-friendly for energy projects. Ag land widely available. Energy Community adder likely applicable — check DOE qualifying census tracts.",
      },
      interconnection: {
        servingUtility: "Potomac Edison (FirstEnergy)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Potomac Edison PJM territory with good headroom in western MD. Hagerstown-area substations accessible. Underutilized by developers compared to central MD — worth targeting.",
      },
    },
    princegeorges: {
      siteControl: {
        availableLand: false,
        landNotes: "Suburban DC county — highly developed with limited agricultural parcels. Best opportunities are brownfields, rooftops, or the rural eastern fringe near the Charles County line.",
        wetlandWarning: true,
        wetlandNotes: "Patuxent River watershed wetlands throughout eastern portions. MDE Wetlands and Waterways permit required for any work within tidal or non-tidal wetlands.",
        landUseNotes: "PG County has strong environmental review requirements. Large solar projects face community opposition in many areas. Eastern county rural fringe (Brandywine, Upper Marlboro area) is most accessible for ground-mount.",
      },
      interconnection: {
        servingUtility: "Pepco (Exelon)",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "22–30 months",
        queueNotes: "Pepco DC metro territory is congested. High network upgrade costs common for projects near the urban core. Eastern county rural areas served by Pepco have better capacity than the urban core.",
      },
    },
    annearundel: {
      siteControl: {
        availableLand: true,
        landNotes: "Mix of suburban Baltimore fringe and rural agricultural land in southern portions. Western Anne Arundel County has the best large-parcel opportunity. Chesapeake Bay proximity means wetland risk on low-lying sites.",
        wetlandWarning: true,
        wetlandNotes: "Bay watershed NWI check critical for any site within 2 miles of water bodies. MDE Critical Area designation (1,000-ft buffer from Bay and tidal tributaries) restricts development.",
        landUseNotes: "Anne Arundel County zoning requires special exception for solar over 2MW. Severn and Odenton areas are suburban with limited opportunity. Southern county (Davidsonville, Lothian) has better agricultural parcel access.",
      },
      interconnection: {
        servingUtility: "BGE (Baltimore Gas & Electric)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–20 months",
        queueNotes: "BGE serves Anne Arundel County. Suburban load is strong — good for subscriber acquisition. Southern county substations have more headroom than northern/Annapolis area.",
      },
    },
  },

  // ── NEW JERSEY ────────────────────────────────────────────────────────────
  NJ: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "New Jersey is the most densely populated state — available land is constrained statewide. Best CS opportunities are in the southern agricultural counties (Salem, Cumberland, Burlington). Pine Barrens areas have restrictions.",
        wetlandWarning: true,
        wetlandNotes: "NJ DEP wetlands are pervasive — statewide freshwater and coastal wetlands require thorough NWI analysis. NJDEP Freshwater Wetlands Protection Act requires permits for any disturbance within 150ft of a wetland.",
        landUseNotes: "Most NJ municipalities have solar-friendly zoning under state preemption, but local setback rules vary. Pine Barrens Pinelands CMP restricts development in Pinelands management area. Check Highlands Area designations in northwest NJ.",
      },
      interconnection: {
        servingUtility: "PSE&G",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "22–30 months",
        queueNotes: "PJM territory. PSE&G (northern NJ) and JCP&L (central) are congested — high network upgrade costs common. ACE (Atlantic City Electric, southern NJ) has better capacity. 51% LMI subscriber requirement adds project complexity.",
      },
    },
    burlington: {
      siteControl: {
        availableLand: true,
        landNotes: "Central/south NJ — mix of agricultural land and Pinelands-adjacent areas. Avoid Pinelands Management Area (development restrictions). Best parcels are in western Burlington County agricultural areas (Bordentown, Columbus area).",
        wetlandWarning: true,
        wetlandNotes: "Rancocas Creek watershed has extensive freshwater wetlands. NJDEP freshwater wetlands permit likely needed — run NWI before site commitment.",
        landUseNotes: "Check Pinelands CMP designation for all Burlington County sites — Pinelands Protection Area vs. Pinelands Preservation Area have very different constraints. Western agricultural townships are most accessible.",
      },
      interconnection: {
        servingUtility: "JCP&L (Jersey Central Power & Light)",
        queueStatus: "Limited — moderate backlog",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "20–26 months",
        queueNotes: "JCP&L serves central/south Burlington County. Better capacity than PSE&G northern territory. PJM cluster study impacts vary. Bordentown and Mt. Holly area substations have seen CS project activity.",
      },
    },
    salem: {
      siteControl: {
        availableLand: true,
        landNotes: "Most agricultural county in NJ — large contiguous parcels of active farmland available. Lowest land values in the state. Delaware River floodplain on western edge requires wetland check.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Salem County is the most permissive for solar in New Jersey. Agricultural solar generally welcomed. Township sign-off straightforward in most municipalities. Best CS developer opportunity in the state.",
      },
      interconnection: {
        servingUtility: "Atlantic City Electric (Exelon)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–22 months",
        queueNotes: "ACE territory (south NJ) has better capacity than northern utilities. Several CS projects have successfully commissioned in Salem County. Substation capacity generally available for sub-5MW projects.",
      },
    },
    gloucester: {
      siteControl: {
        availableLand: true,
        landNotes: "South suburban NJ — mix of agricultural and suburban land. Eastern portions near Camden County are more developed; western and southern areas have good parcel availability.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Gloucester County has active farmland preservation program — check preserved farmland status before approaching landowners. South Jersey industrial corridor (Logan Township area) has brownfield opportunity.",
      },
      interconnection: {
        servingUtility: "Atlantic City Electric (Exelon)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "ACE territory with moderate capacity. South Jersey substations more accessible than northern NJ. Logan Township and Mullica Hill areas are well-served for distribution interconnection.",
      },
    },
    hunterdon: {
      siteControl: {
        availableLand: true,
        landNotes: "Northwest NJ rural county — rolling farmland with good parcel availability. Some conservation easements on prime farmland. Highlands Area designation in northern portions — check resource mapping before site selection.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Hunterdon County has a strong land preservation program. Verify farmland preservation status. Highlands Preservation Area in northern Hunterdon (High Bridge, Clinton area) restricts development significantly.",
      },
      interconnection: {
        servingUtility: "JCP&L (Jersey Central Power & Light)",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "20–26 months",
        queueNotes: "JCP&L northwest NJ territory. Moderate capacity outside the Highlands area. Flemington and Whitehouse Station areas have better substation access than northern county.",
      },
    },
  },

  // ── MAINE ─────────────────────────────────────────────────────────────────
  ME: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Maine has abundant rural land — mix of agricultural, forestry, and cleared land. Southern counties have better agricultural land; northern counties (Aroostook) have large potato/grain farms. Forest clearing is politically sensitive.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Maine DEP Site Law review required for projects over 3MW or 20 acres. Natural Resources Protection Act (NRPA) permits needed near water bodies or wetlands. Most rural towns have minimal solar-specific zoning.",
      },
      interconnection: {
        servingUtility: "Central Maine Power (CMP / Avangrid)",
        queueStatus: "Open — moderate",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "ISO-NE interconnection. CMP serves most of the state. Versant Power (formerly Emera Maine) serves northern and eastern counties. Small grid limits project size — stay under 5MW for smoother process.",
      },
    },
    kennebec: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Maine agricultural county — mix of small farms, hay fields, and cleared land. Augusta area has moderate parcel availability. Good solar resource for Maine standards.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Kennebec County municipalities are generally solar-friendly. Augusta and Waterville urban areas have more complex zoning; rural townships flexible. DEP Site Law review required over 3MW.",
      },
      interconnection: {
        servingUtility: "Central Maine Power (CMP / Avangrid)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "CMP central Maine territory. Augusta-area substations accessible for distribution interconnection. Good option for sub-5MW CS projects. ISO-NE Zone F applies.",
      },
    },
    somerset: {
      siteControl: {
        availableLand: true,
        landNotes: "North-central Maine — large rural parcels, low land values, strong timber and agricultural land. Best opportunity for large contiguous CS sites in Maine. Remote but land is very accessible.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Somerset County is among the most permissive in Maine for energy development. Limited planning infrastructure in unorganized territories. Town-by-town zoning in organized areas — generally permissive.",
      },
      interconnection: {
        servingUtility: "Central Maine Power (CMP / Avangrid)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "CMP upper territory has good headroom. Lower development pressure than southern Maine. Skowhegan-area substations accessible. Lower subscriber acquisition density in rural Somerset is the trade-off.",
      },
    },
    york: {
      siteControl: {
        availableLand: true,
        landNotes: "Southern Maine — most developed county in state. Biddeford–Saco corridor suburban; rural western York County (Limington, Waterboro, Acton) has agricultural land. Suburban parcel availability is tight.",
        wetlandWarning: true,
        wetlandNotes: "Coastal and riverine wetlands throughout — Saco River, Mousam River corridors. NRPA permits required within 250ft of wetlands. Coastal shoreland zoning applies near coast.",
        landUseNotes: "Southern York County municipalities are most complex for solar permitting in Maine. Towns like Kennebunk, Wells, and Ogunquit have conservation-oriented zoning. Inland western York towns (Limington, Newfield) are more accessible.",
      },
      interconnection: {
        servingUtility: "Central Maine Power (CMP / Avangrid)",
        queueStatus: "Limited — southern ME congestion",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Southern Maine CMP territory sees more developer competition. Sanford and Biddeford-area substations partially loaded. Best for sub-3MW projects. Proximity to NH/MA subscriber markets is a subscriber acquisition advantage.",
      },
    },
    penobscot: {
      siteControl: {
        availableLand: true,
        landNotes: "Bangor metro area in eastern Maine. Mix of suburban/commercial land near Bangor and agricultural/forested rural land in outer areas. Orono and Old Town have some brownfield opportunity.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Penobscot County rural townships are permissive. Bangor city has more complex zoning. Versant Power territory — different utility process than CMP. University of Maine presence (Orono) provides CS subscriber base.",
      },
      interconnection: {
        servingUtility: "Versant Power (formerly Emera Maine)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Versant Power (eastern/northern Maine) has better queue capacity than CMP southern territory. Bangor area substations accessible. ISO-NE Zone F. Fewer developers targeting this territory — underserved opportunity.",
      },
    },
  },

  // ── OREGON ────────────────────────────────────────────────────────────────
  OR: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Willamette Valley agricultural land is the primary CS opportunity. High-value farmland (Exclusive Farm Use zoning) restricts conversion in many areas. Eastern Oregon has large tracts of rangeland and dryland agriculture.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Oregon's statewide land use planning system (Goal 3 Agricultural Lands) strictly protects EFU-zoned farmland. Ground-mount solar on prime farmland requires county exception — very difficult to obtain. Focus on marginal ag land, rangeland, or disturbed sites.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp)",
        queueStatus: "Open — moderate",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Pacific Power (PacifiCorp) serves most of Oregon outside Portland metro. Portland General Electric (PGE) serves metro Portland area. WECC/WestConnect interconnection. Rural Pacific Power substations have reasonable headroom.",
      },
    },
    marion: {
      siteControl: {
        availableLand: true,
        landNotes: "Salem area — Willamette Valley center. Mix of prime agricultural (EFU) and marginal farmland. Focus on non-prime land, south-facing slopes, or already-disturbed parcels to avoid EFU exception process.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Marion County EFU zoning is strictly enforced. Exception process for solar on prime farmland is lengthy and uncertain. Best opportunities: non-EFU marginal land, industrial zones, or commercial parcels near Salem. Verify soil class before leasing.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp) / Portland General Electric",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Marion County sits near the PGE/Pacific Power boundary — confirm serving utility by site location. Salem-area substations accessible for both utilities. WECC interconnection with reasonable capacity.",
      },
    },
    yamhill: {
      siteControl: {
        availableLand: true,
        landNotes: "Wine country Willamette Valley — highly productive agricultural land. Most county is EFU-zoned. Focus on non-prime marginal land (Class IV–VI soils), gravel pits, or already-disturbed parcels to avoid exception process.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Yamhill County EFU protection is strong — county is politically invested in farmland preservation and wine industry. Solar exception process for prime farmland very difficult. Marginal land focus is essential. McMinnville rural fringe has some opportunity.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "Pacific Power northwest Oregon territory. McMinnville substation accessible. Moderate queue — fewer developers targeting Yamhill than larger Willamette Valley counties.",
      },
    },
    linn: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Willamette Valley — mix of grass seed farms, grain fields, and timber. EFU applies to prime land. Grass seed and grain land (Class III–IV soils) sometimes accessible for solar exception. Eastern Linn County has rangeland.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Linn County zoning is similar to other Willamette Valley counties — EFU protection is strong but not as politically charged as Yamhill or Polk. Eastern county and Santiam Canyon area more flexible. Albany and Lebanon urban fringe has brownfield opportunity.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Linn County has good Pacific Power distribution capacity. Albany-area substations well-positioned for CS projects. Lower developer saturation than Marion County. Good target for developers entering the Oregon market.",
      },
    },
    lane: {
      siteControl: {
        availableLand: true,
        landNotes: "Eugene metro area plus eastern Coast Range and Cascades. Agricultural land in the Willamette Valley floor (south Eugene, Junction City, Creswell). Forest land in eastern/western hills. EFU applies to valley floor farmland.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Lane County has a strong environmental community (Eugene influence). EFU farmland exception difficult to obtain — focus on non-prime, marginal, or already-disturbed land. Junction City and Creswell areas have best CS site opportunities.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp) / EWEB (Eugene Water & Electric Board)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Eugene area served by a mix of Pacific Power and EWEB (municipal utility). EWEB has its own interconnection process — allow extra time for municipal coordination. Pacific Power rural Lane County has reasonable headroom.",
      },
    },
  },

  // ── WASHINGTON ────────────────────────────────────────────────────────────
  WA: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Eastern Washington has the best CS opportunity — high solar resource, large agricultural parcels, lower land values. Western WA (Puget Sound region) is heavily forested and developed with limited large parcel availability.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Washington Critical Areas Ordinance (CAO) applies statewide — wetlands, fish/wildlife habitats, frequently flooded areas all regulated at county level. Eastern WA counties generally permissive for solar on agricultural land.",
      },
      interconnection: {
        servingUtility: "Puget Sound Energy (PSE)",
        queueStatus: "Open — moderate",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "PSE serves western WA. Pacific Power (PacifiCorp) and co-ops/PUDs serve eastern WA. BPA transmission backbone. Eastern WA co-ops and PUDs have good headroom for small CS projects. WECC interconnection.",
      },
    },
    yakima: {
      siteControl: {
        availableLand: true,
        landNotes: "Eastern WA irrigated agricultural county. Excellent solar resource (highest in WA). Large apple, hops, and wine grape operations. Dryland wheat and rangeland parcels available in outer areas. Strong landowner interest in solar lease revenue.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Yakima County is receptive to energy development. Agricultural zoning permits solar with county conditional use permit. Yakima Valley wine country has some preservation interest but not as restrictive as western WA. Strong CS opportunity.",
      },
      interconnection: {
        servingUtility: "Pacific Power (PacifiCorp) / Yakima Valley Power (co-op)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Pacific Power eastern WA territory with good capacity. BPA transmission available for larger projects. Yakima-area substations accessible. Co-op territories (Yakima Valley Power) have their own interconnection processes — verify serving utility by site.",
      },
    },
    grant: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Washington — highest solar resource in the state. Large dryland wheat, potato, and orchard parcels. Channeled Scablands terrain in eastern portions — low wetland risk. Columbia Basin Project irrigation areas have productive farmland.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Grant County is one of the most permissive for energy development in Washington. Strong track record of large-scale solar interconnections. County ordinances updated to accommodate solar — a developer-friendly environment.",
      },
      interconnection: {
        servingUtility: "Grant County PUD (public utility district)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "10–16 months",
        queueNotes: "Grant County PUD has excellent capacity and a relatively streamlined interconnection process for a public utility. BPA transmission backbone. Multiple large solar projects in queue and operating. Best interconnection conditions in Washington.",
      },
    },
    franklin: {
      siteControl: {
        availableLand: true,
        landNotes: "Tri-Cities area (Kennewick/Richland/Pasco). Mix of irrigated agricultural land and dryland wheat parcels. Pasco area has strong parcel availability. Good solar resource. DOE/Hanford Site proximity — check land use restrictions in northern county.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Franklin County permissive for solar energy development. Pasco urban fringe growing rapidly — target outer rural parcels. Hanford Site (northern county) creates buffer zone — do not site within the Hanford Reach National Monument boundaries.",
      },
      interconnection: {
        servingUtility: "Franklin PUD / Pacific Power (PacifiCorp)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Franklin PUD and Pacific Power both serve the county. BPA transmission at Hanford substation provides strong backbone. Tri-Cities load center supports CS subscriber acquisition. Good conditions for sub-5MW CS projects.",
      },
    },
    kittitas: {
      siteControl: {
        availableLand: true,
        landNotes: "Ellensburg area — agricultural valley floor with rangeland and dryland farming. Good solar resource east of the Cascades. Lower land values than western WA. Mix of irrigated hay fields and dryland wheat.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Kittitas County has been site of significant wind and solar development. County ordinances are familiar with renewable energy permitting. Conservation easements on some ag land — verify before leasing.",
      },
      interconnection: {
        servingUtility: "Puget Sound Energy (PSE)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "PSE serves Kittitas County via eastern WA transmission corridor. Ellensburg-area substations accessible. PSE has processed numerous renewable interconnections in the county. Good but not as strong as Grant or Yakima counties.",
      },
    },
  },

  // ── VIRGINIA ──────────────────────────────────────────────────────────────
  VA: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Virginia Piedmont and Shenandoah Valley offer the strongest CS site opportunities — good agricultural land, adequate solar resource, and moderate land values. Northern Virginia is too developed; coastal Virginia has wetland and chesapeake watershed constraints.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Virginia requires a Permit by Rule (PBR) for solar facilities 1–150MW filed with DEQ. Local zoning varies significantly — many rural Piedmont counties have adopted solar energy ordinances since the VCEA passage.",
      },
      interconnection: {
        servingUtility: "Dominion Energy Virginia",
        queueStatus: "Open — reforming",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "PJM territory. Dominion Energy Virginia is the primary utility and has been reforming its interconnection process under SCC pressure. AEP (Appalachian Power) serves western VA with better queue conditions. NOVEC serves northern VA co-op territory.",
      },
    },
    spotsylvania: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Virginia Piedmont — good agricultural land with moderate parcel availability. The region already hosts some of Virginia's largest solar projects (Spotsylvania Solar Project is nationally notable). Landowner familiarity with solar leases is high.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Spotsylvania County updated its solar zoning ordinance after the large Spotsylvania Solar controversy. Review current conditional use permit requirements carefully. Some community opposition to large ground-mount projects. Sub-5MW CS projects face less resistance than utility-scale.",
      },
      interconnection: {
        servingUtility: "Dominion Energy Virginia",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Dominion territory with good transmission access in Spotsylvania. Strong load center nearby (Fredericksburg). Existing large solar interconnections have established the process in this county. Reasonable conditions for CS-scale projects.",
      },
    },
    augusta: {
      siteControl: {
        availableLand: true,
        landNotes: "Shenandoah Valley — strong agricultural county with large productive farms. Good solar resource on the valley floor. Lower land values than Piedmont. Staunton-Waynesboro area urban fringe has some constraint; rural valley is accessible.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Augusta County has a permissive approach to solar siting under Virginia's PBR framework. Agricultural solar zoning provisions accommodate ground-mount CS. Shenandoah Valley farmland less politically charged than eastern Piedmont.",
      },
      interconnection: {
        servingUtility: "Dominion Energy Virginia / Appalachian Power (AEP)",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Augusta County sits near the Dominion/AEP territory boundary — verify serving utility by site. AEP territory (western portions) has better queue conditions than Dominion. Staunton-area substations accessible. Underutilized by CS developers — good early-mover opportunity.",
      },
    },
    fauquier: {
      siteControl: {
        availableLand: true,
        landNotes: "Northern Virginia rural county — mix of horse farms, agricultural land, and vineyard country. High land values given proximity to DC. Conservation easements common on prime farmland (Virginia Outdoors Foundation, Piedmont Environmental Council).",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Fauquier County is a conservation-oriented community — verify easement status before engaging landowners. Agricultural solar allowed by right under 2MW in some zoning districts. County has been receptive to well-sited CS projects. Subscriber base is strong given DC proximity.",
      },
      interconnection: {
        servingUtility: "Dominion Energy Virginia / NOVEC",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–22 months",
        queueNotes: "Dominion serves most of Fauquier; NOVEC covers the northeastern corner. NOVEC (co-op) has a different interconnection process — allow for co-op timeline variance. Dominion Warrenton-area substations have reasonable capacity.",
      },
    },
    albemarle: {
      siteControl: {
        availableLand: true,
        landNotes: "Charlottesville metro area. Mix of agricultural land and forest in outer county areas. University of Virginia presence creates strong subscriber market. Conservation easements on some farmland — verify before leasing.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Albemarle County updated its solar ordinance to accommodate CS-scale projects. University of Virginia and tech employer subscriber base is strong. Rural areas (Earlysville, Esmont, North Garden) have accessible parcels. Conservation community is vocal — site selection matters.",
      },
      interconnection: {
        servingUtility: "Dominion Energy Virginia",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Dominion central Virginia territory. Charlottesville load center supports strong subscriber acquisition. Rural Albemarle substations (Earlysville, Scottsville area) have good capacity. UVA serves as a potential large CS offtaker.",
      },
    },
  },

  // ── CONNECTICUT ───────────────────────────────────────────────────────────
  CT: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Connecticut is densely developed and forested — available agricultural land is limited statewide. Best opportunities are in northeastern and northwestern CT (Tolland, Windham, Litchfield counties). Forest clearing is politically very sensitive.",
        wetlandWarning: true,
        wetlandNotes: "CT Inland Wetlands and Watercourses Act applies statewide. Local inland wetlands agency (IWA) approval required for any disturbance within regulated area. Upland review area (typically 100ft) also triggers review.",
        landUseNotes: "CT DEEP SCEF program caps projects at 2MW. Most towns regulate solar under their inland wetlands commission and local zoning. Check for SCEF program slots — program is block-based and fills quickly.",
      },
      interconnection: {
        servingUtility: "Eversource CT",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "20–28 months",
        queueNotes: "ISO-NE. Eversource CT and United Illuminating (UI/Avangrid, New Haven–Bridgeport area) are the two utilities. Small state means limited interconnection points — substation capacity is a real constraint. 2MW project cap helps manage queue impact.",
      },
    },
    hartford: {
      siteControl: {
        availableLand: true,
        landNotes: "Central CT — Hartford urban core has very limited land. Northern Hartford County (Granby, Simsbury, Suffield, Windsor Locks) has agricultural parcels and is the primary CS opportunity in the county. Tobacco farmland historically available.",
        wetlandWarning: true,
        wetlandNotes: "Connecticut River floodplain wetlands extensive in south Hartford County. Farmington River and Salmon Brook corridors also have regulated wetlands. CTDEEP NWI mapping required before site selection.",
        landUseNotes: "Northern Hartford County towns (Granby, Suffield, Enfield) are more receptive to solar than urban core. Tobacco farm parcels are well-suited to CS — already cleared and productive soil. Setback requirements from residential areas common.",
      },
      interconnection: {
        servingUtility: "Eversource CT",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "20–26 months",
        queueNotes: "Eversource CT territory. Hartford metro distribution is heavily loaded near the urban core. Northern county rural substations (Windsor Locks, Suffield) have better capacity. At 2MW project cap, distribution interconnection is generally feasible.",
      },
    },
    tolland: {
      siteControl: {
        availableLand: true,
        landNotes: "Northeast CT rural county. Mix of agricultural fields, horse farms, and forest. Good parcel availability. Lower land values than Fairfield or Hartford counties. Some active dairy/crop operations willing to lease portions.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Tolland County towns are generally receptive to solar — less community opposition than coastal or metro areas. Coventry, Stafford, and Willington townships have permissive local regulations. IWA review still required — inland wetlands agency process is standard.",
      },
      interconnection: {
        servingUtility: "Eversource CT",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Eversource CT northeastern territory has better capacity than urban areas. Vernon and Stafford area substations accessible. Fewer competing projects in the queue for northeastern CT — good for securing early SCEF program slots.",
      },
    },
    windham: {
      siteControl: {
        availableLand: true,
        landNotes: "Northeast corner of CT — \"Quiet Corner.\" Most rural county in CT with strong agricultural tradition. Good parcel availability, lowest land values in the state. Some dairy farm conversions possible.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Windham County townships are among the most permissive in CT for solar. Killingly, Thompson, Putnam, and Pomfret have minimal developer opposition. IWA process still applies but typically straightforward on upland farm sites.",
      },
      interconnection: {
        servingUtility: "Eversource CT",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "16–22 months",
        queueNotes: "Eversource CT eastern fringe territory has the best capacity in the state. Minimal competing project load in this corner of CT. Best interconnection conditions in Connecticut for CS-scale projects.",
      },
    },
    litchfield: {
      siteControl: {
        availableLand: true,
        landNotes: "Northwest CT — Berkshire foothills with mix of agricultural valley land and forest. Topographic constraints on hillside sites. Good agricultural parcels in valley floors (Torrington, Litchfield, Goshen areas).",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Litchfield County is a conservation-oriented area — land trust activity is high. Check Land Trust of Litchfield Hills and similar easement inventories before engaging landowners. Agricultural valley floor sites less encumbered.",
      },
      interconnection: {
        servingUtility: "Eversource CT",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Eversource CT northwest territory. Torrington and Winsted area substations accessible. Moderate capacity — lower developer activity than central CT. At 2MW cap, distribution interconnection is typically manageable.",
      },
    },
  },

  // ── RHODE ISLAND ──────────────────────────────────────────────────────────
  RI: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Rhode Island is the smallest state — land is constrained statewide. Washington County (South County) has the best agricultural parcel availability. Providence County is largely suburban. Coastal proximity means wetland risk is elevated throughout.",
        wetlandWarning: true,
        wetlandNotes: "RI Freshwater Wetlands Act and Coastal Resources Management Council (CRMC) regulations apply. Statewide wetland buffer requirements — DEM review required near wetlands. Coastal wetlands require CRMC approval.",
        landUseNotes: "RI RIDERM Wetlands and CRMC coastal regs apply. Most RI towns have adopted solar energy development ordinances. Small project size (program limits) means parcels of 5–20 acres are sufficient. Town-by-town zoning review required.",
      },
      interconnection: {
        servingUtility: "National Grid RI",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "ISO-NE. National Grid is the sole distribution utility in Rhode Island. Small grid limits project size — stay under 5MW for standard distribution review. Queue has improved since 2024 RI PUC process reforms.",
      },
    },
    washington: {
      siteControl: {
        availableLand: true,
        landNotes: "\"South County\" — most rural county in RI. Best agricultural parcel availability in the state. Mix of active farms, horse operations, and cleared land. Coastal proximity requires wetland diligence on low-lying sites.",
        wetlandWarning: true,
        wetlandNotes: "Salt ponds, freshwater wetlands, and CRMC coastal areas throughout Washington County. Run RIDEM NWI and CRMC maps before site selection. Buffer requirements vary by wetland type.",
        landUseNotes: "South County towns (Richmond, Hopkinton, Exeter, West Greenwich) are the most permissive in RI for solar. Agricultural parcels of 20–60 acres available at reasonable lease rates. Charlestown and Westerly coastal communities more restrictive.",
      },
      interconnection: {
        servingUtility: "National Grid RI",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–22 months",
        queueNotes: "National Grid western RI territory has better capacity than Providence-area substations. Richmond and Hopkinton area distribution accessible. Best interconnection conditions in the state for CS-scale projects.",
      },
    },
    providence: {
      siteControl: {
        availableLand: false,
        landNotes: "Providence County is largely urbanized and suburban. Limited large agricultural parcels. Best opportunities are commercial/industrial rooftops, parking canopies, or brownfields (former industrial sites near Providence have available land).",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Urban Providence and suburban communities (Cranston, Pawtucket) have limited solar site availability at CS scale. Brownfield and rooftop community solar models better suited here. Northern Providence County (Smithfield, Scituate reservoir area) has some rural parcel access.",
      },
      interconnection: {
        servingUtility: "National Grid RI",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "20–28 months",
        queueNotes: "National Grid Providence metro territory is the most congested in RI. Urban load pockets and aging distribution infrastructure create upgrade risk. Suburban fringe (Smithfield, Johnston) has better capacity than urban core.",
      },
    },
    kent: {
      siteControl: {
        availableLand: true,
        landNotes: "Suburban central RI. Warwick and Cranston are heavily developed; Coventry and West Warwick have some rural and semi-rural parcels. Limited but workable CS opportunities on the west side of the county.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Coventry (western Kent County) has the most accessible parcels. Coventry has an active solar energy ordinance. Warwick is too suburban for ground-mount CS. Check town-by-town zoning.",
      },
      interconnection: {
        servingUtility: "National Grid RI",
        queueStatus: "Limited",
        queueStatusCode: "limited",
        easeScore: 5,
        avgStudyTimeline: "18–24 months",
        queueNotes: "Central RI National Grid territory. Coventry and West Warwick substations have moderate capacity. Better than Providence core but not as accessible as Washington County.",
      },
    },
  },

  // ── NEW MEXICO ────────────────────────────────────────────────────────────
  NM: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "New Mexico has abundant land — desert rangeland, dryland agriculture, and Bureau of Land Management parcels. High solar resource statewide. Private land concentration is highest in the Rio Grande valley corridor and eastern plains.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "New Mexico state land and BLM land are common — verify fee ownership vs. state/federal lease land before site selection. County zoning is generally permissive for solar. Rio Grande corridor has some cultural resource and ACE permitting considerations.",
      },
      interconnection: {
        servingUtility: "PNM Resources (Public Service New Mexico)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "WestConnect/WECC interconnection. PNM serves central and north-central NM. El Paso Electric serves south NM. Xcel Energy NM serves northeast. Rural areas have reasonable headroom. Energy Community adder widely applicable in NM — check qualifying census tracts.",
      },
    },
    bernalillo: {
      siteControl: {
        availableLand: true,
        landNotes: "Albuquerque metro county. Urban core is developed but outer areas (Rio Rancho fringe, East Mountains, South Valley) have available land. High desert terrain — minimal wetland risk. Strong solar resource (300+ days/year).",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Bernalillo County has a solar-friendly development framework. South Valley and West Mesa areas have industrial and agricultural land available. Rio Grande Bosque ACE/NM EMNRD restrictions apply within 200ft of the river corridor.",
      },
      interconnection: {
        servingUtility: "PNM Resources",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–16 months",
        queueNotes: "PNM Albuquerque area has strong load and good distribution capacity. South Valley and Pajarito substations accessible. Strong subscriber base in metro ABQ. PNM has streamlined small CS interconnection for sub-5MW projects.",
      },
    },
    valencia: {
      siteControl: {
        availableLand: true,
        landNotes: "South of Albuquerque — Rio Grande valley and upland mesas. Mix of irrigated agricultural land and dry rangeland. Los Lunas and Belen areas have good parcel availability. Excellent solar resource.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Valencia County permissive for solar development. County zoning allows ground-mount solar in agricultural and rural zones without complex exception process. Energy Community adder likely applicable — former mining/manufacturing communities in county.",
      },
      interconnection: {
        servingUtility: "PNM Resources",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "10–14 months",
        queueNotes: "PNM south metro territory has excellent capacity. Los Lunas and Belen substations are accessible and have seen CS project activity. One of the strongest CS interconnection opportunities in New Mexico.",
      },
    },
    doñaana: {
      siteControl: {
        availableLand: true,
        landNotes: "Las Cruces metro county — Chihuahuan Desert terrain with mix of irrigated agricultural land (pecans, chile) and dry rangeland. Excellent solar resource (highest in NM). Large parcel availability on desert floor.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Doña Ana County permissive for solar development. Las Cruces urban area has standard zoning; county unincorporated areas very flexible. Rio Grande corridor ACE considerations on riparian sites. Afton and Hatch areas have agricultural land with solar lease interest.",
      },
      interconnection: {
        servingUtility: "El Paso Electric (EPE) / PNM Resources",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Doña Ana County split between EPE (south and east) and PNM (north). Verify serving utility by site. EPE has reasonable capacity and has processed multiple solar interconnections in the Las Cruces area. Strong load center supports CS subscriber acquisition.",
      },
    },
    sandoval: {
      siteControl: {
        availableLand: true,
        landNotes: "Rio Rancho metro area and northern rural county. Rio Rancho suburban growth area is being developed but outer county (Bernalillo area, Cuba, Placitas) has rangeland and agricultural parcels. Good solar resource.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Sandoval County has adopted a solar-friendly zoning framework. Rio Rancho municipal area has its own planning department. Outer county (unincorporated) is more flexible. Jemez Springs and Cuba areas have rural land with solar potential.",
      },
      interconnection: {
        servingUtility: "PNM Resources",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "PNM north metro and rural territory. Rio Rancho substations have strong load. Rural Sandoval County has good headroom. PNM has streamlined sub-5MW CS interconnection in this service area.",
      },
    },
  },

  // ── HAWAII ────────────────────────────────────────────────────────────────
  HI: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Hawaii land is extremely constrained — most land is either state conservation, agricultural (AG-zoned), or very high value. Best CS opportunities are on marginal agricultural land, brownfield/industrial parcels, or rooftops. Land costs are very high.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Hawaii State Land Use Commission (LUC) zones all land statewide: Urban, Rural, Agricultural, Conservation. Ground-mount solar on Conservation land is prohibited. Agricultural land solar requires county special permit. SMA (Special Management Area) applies near coasts.",
      },
      interconnection: {
        servingUtility: "Hawaiian Electric (HECO)",
        queueStatus: "Saturated — hosting capacity critical",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "30–48+ months",
        queueNotes: "Island grid constraints are severe — HECO hosting capacity analysis is mandatory before any project commitment. Queue backlog has been significant. HECO CBRE program has interconnection caps by circuit. High electricity rates make economics strong if you can interconnect.",
      },
    },
    honolulu: {
      siteControl: {
        availableLand: false,
        landNotes: "Oahu — densely developed across most of the island. Best CS opportunities are rooftop, parking canopy, or brownfield. Limited agricultural land in central Oahu (Ewa Plain) but most is developed or under development. Military base proximity restricts many areas.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Honolulu County (entire island of Oahu) zoning is the most complex in Hawaii. DPP (Honolulu Dept of Planning and Permitting) review required. Military installation buffers apply in Ewa, Kapolei areas. Rooftop and parking canopy CS better fit than ground-mount on Oahu.",
      },
      interconnection: {
        servingUtility: "Hawaiian Electric (HECO Oahu)",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 2,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "HECO Oahu grid is the most constrained in Hawaii. Hosting capacity often near zero on many circuits. CBRE program has allocated most Oahu capacity. Not recommended for new small developers — very high barrier to entry.",
      },
    },
    maui: {
      siteControl: {
        availableLand: true,
        landNotes: "Maui County includes Maui, Molokai, and Lanai. Central Maui valley (Wailuku–Kahului area) has some agricultural land. Upcountry Maui has agricultural parcels (former sugarcane land now in diversified agriculture). Land costs are high.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Maui County Planning Dept reviews all projects. Former sugarcane plantation land (Maui Land & Pineapple holdings) represents the best CS opportunity on the island. Hawaiian cultural impact assessment required for most projects. SMA applies near coast.",
      },
      interconnection: {
        servingUtility: "Maui Electric (MECO / Hawaiian Electric subsidiary)",
        queueStatus: "Limited — improving",
        queueStatusCode: "limited",
        easeScore: 4,
        avgStudyTimeline: "24–36 months",
        queueNotes: "MECO Maui grid is smaller than Oahu and has seen some capacity improvement post-2023 interconnection reforms. Kahului area substations have better access than remote resort areas. Somewhat better conditions than Oahu but still challenging.",
      },
    },
    hawaii: {
      siteControl: {
        availableLand: true,
        landNotes: "Big Island — most land area in state but development is concentrated on coasts. Hamakua Coast agricultural lands (former sugarcane) are the primary CS site opportunity. South Kohala and North Kona dryland areas have large parcels available at lower cost.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Hawaii County Planning Dept review required. Former sugarcane plantation land on Hamakua Coast has large parcels with motivated landowners. Volcanic hazard zones (Zone 1–2) not suitable for permanent energy infrastructure. Cultural resource surveys required statewide.",
      },
      interconnection: {
        servingUtility: "Hawaii Electric Light Company (HELCO / Hawaiian Electric subsidiary)",
        queueStatus: "Open — multiple circuits",
        queueStatusCode: "open",
        easeScore: 5,
        avgStudyTimeline: "20–30 months",
        queueNotes: "HELCO Big Island has multiple distribution circuits with varying capacity. Hilo-side (wet side) and Kona-side (dry side) are separate load pockets with different hosting capacity profiles. Better conditions than Oahu — more viable for CS developers willing to navigate the island grid.",
      },
    },
  },

  // ── CALIFORNIA ────────────────────────────────────────────────────────────
  CA: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Valley (San Joaquin and Sacramento valleys) has the best CS site opportunities — large agricultural parcels, high solar resource, and established developer activity. SGMA (Sustainable Groundwater Management Act) fallowed farmland is an emerging site opportunity.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "California CEQA review required for most solar projects. Williamson Act contracted farmland has strong legal protections — verify contract status before leasing. Many San Joaquin Valley counties have adopted large-scale solar ordinances. Desert areas (Mojave, Coachella) have federal land and NEPA considerations.",
      },
      interconnection: {
        servingUtility: "Pacific Gas & Electric (PG&E)",
        queueStatus: "Saturated — cluster study backlog",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "30–48+ months",
        queueNotes: "CAISO queue has a massive backlog — cluster study reform is ongoing but timelines remain very long. PG&E, SCE, and SDG&E territories all severely congested. NEM 3.0 has reduced community solar economics. California is very difficult for small independent CS developers.",
      },
    },
    fresno: {
      siteControl: {
        availableLand: true,
        landNotes: "San Joaquin Valley center — large agricultural parcels widely available. SGMA fallowed farmland (lands retired from irrigation due to groundwater sustainability plans) is an excellent CS site opportunity. High solar resource (best in CA for CS).",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Fresno County adopted a large-scale solar ordinance. Williamson Act contracts present — verify before engaging landowners (cancellation takes 9 years or nonrenewal process). SGMA fallowed land is Williamson Act-free in many cases. Strong developer activity in the county.",
      },
      interconnection: {
        servingUtility: "Pacific Gas & Electric (PG&E)",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "PG&E Central Valley territory is extremely backlogged. High network upgrade costs common. CAISO cluster study groupings create long waits even for sub-5MW CS projects. Not recommended for first-time CA developers — very high interconnection barrier.",
      },
    },
    kings: {
      siteControl: {
        availableLand: true,
        landNotes: "South San Joaquin Valley. Strong SGMA fallowed farmland opportunity — significant acreage retired from irrigation. Large contiguous parcels available at lower cost than Fresno County. Excellent solar resource.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Kings County has been receptive to solar on fallowed farmland. Williamson Act contracts present — same process applies as Fresno County. SGMA fallowed land is often Williamson Act-free. Hanford and Lemoore area substations are the interconnection hubs.",
      },
      interconnection: {
        servingUtility: "Pacific Gas & Electric (PG&E) / Southern California Edison (SCE)",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "Kings County sits at the PG&E/SCE boundary — verify utility by site location. Both territories are severely congested. Long queue timelines regardless of utility. Wait for CAISO cluster study reform progress before committing.",
      },
    },
    sanbernardino: {
      siteControl: {
        availableLand: true,
        landNotes: "Largest county in the continental US — Mojave Desert dominates. Mix of private desert land, BLM, and state land. Inland Empire (Fontana, Ontario area) is suburban but High Desert (Victorville, Barstow) has large parcels at low cost.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Desert valley floor sites: BLM and DRECP (Desert Renewable Energy Conservation Plan) designations control large portions. High Desert private land (Lucerne Valley, Hesperia area) is more accessible. Desert tortoise surveys required on undisturbed land. CEQA applies.",
      },
      interconnection: {
        servingUtility: "Southern California Edison (SCE)",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "SCE Inland Empire and High Desert territories are severely backlogged. Desert interconnection points (Victorville, Barstow area) congested by large-scale projects. Sub-5MW CS projects face the same queue as utility-scale in CAISO.",
      },
    },
    riverside: {
      siteControl: {
        availableLand: true,
        landNotes: "Mix of suburban Inland Empire (Riverside, Moreno Valley) and desert (Coachella Valley, Palm Springs, Desert Center). Desert areas have large private land parcels. Coachella Valley agricultural land (date palms, citrus) has some CS opportunity.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Riverside County desert development: check DRECP, Salton Sea proximity, and tribal cultural resource areas (Agua Caliente, Cabazon territories). Coachella Valley has adopted solar energy development standards. Wind energy conflict zones in San Gorgonio Pass area.",
      },
      interconnection: {
        servingUtility: "Southern California Edison (SCE)",
        queueStatus: "Saturated",
        queueStatusCode: "saturated",
        easeScore: 3,
        avgStudyTimeline: "36–48+ months",
        queueNotes: "SCE desert territory is severely congested. Coachella Valley and Desert Center substations oversubscribed. CAISO cluster study delays apply. Not a viable path for small independent CS developers without significant interconnection expertise and capital.",
      },
    },
  },

  // ── FLORIDA ───────────────────────────────────────────────────────────────
  FL: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Florida has available agricultural land (citrus, sod, cattle) in central FL. However, independent CS developer access is severely limited by utility-run program structures. Site acquisition only makes sense if pursuing a FPL SolarTogether or Duke CS partnership.",
        wetlandWarning: true,
        wetlandNotes: "Florida wetlands are extensive and protected under state and federal law. ACOE Section 404 and FDEP Wetlands permits required for any disturbance. Florida wetland soils (histosols) are common even on upland-appearing sites — soil survey critical.",
        landUseNotes: "Florida's community solar market is utility-controlled — FPL SolarTogether and Duke Energy CS are subscription programs where the utility owns the solar facility. Independent developers cannot easily enter as project owners in the current structure.",
      },
      interconnection: {
        servingUtility: "Florida Power & Light (FPL / NextEra)",
        queueStatus: "Utility-controlled — limited independent access",
        queueStatusCode: "limited",
        easeScore: 2,
        avgStudyTimeline: "N/A for independent developers",
        queueNotes: "FPL and Duke Energy Florida run utility-owned CS programs — independent developer interconnection for CS is not the standard path. If pursuing C&I solar (not CS), FRCC interconnection is moderately accessible. Florida is not a viable market for small independent CS developers under the current regulatory framework.",
      },
    },
    orange: {
      siteControl: {
        availableLand: false,
        landNotes: "Orlando metro county — highly developed. Limited agricultural parcels. Tourism and suburban development dominate. Best opportunity is commercial rooftop or C&I solar, not CS ground-mount.",
        wetlandWarning: true,
        wetlandNotes: "Central Florida wetlands and lakes are extensive. FDEP and ACOE review required for any ground disturbance near water features.",
        landUseNotes: "Orange County development is primarily urban/suburban. CS in Florida is utility-program-driven — independent developer entry not viable in Orange County.",
      },
      interconnection: {
        servingUtility: "Duke Energy Florida",
        queueStatus: "Utility-controlled",
        queueStatusCode: "limited",
        easeScore: 2,
        avgStudyTimeline: "N/A for independent developers",
        queueNotes: "Duke Energy Florida territory. Utility-run CS program — independent developer participation extremely limited.",
      },
    },
    polk: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Florida phosphate and citrus county. Some agricultural land available as citrus operations decline (citrus greening disease). Phosphate mine reclamation sites offer brownfield opportunity. Higher wetland risk than most of Florida.",
        wetlandWarning: true,
        wetlandNotes: "Phosphate mining disturbed land may have ACOE jurisdiction. Florida wetlands pervasive in lowlands and former mining areas — thorough site assessment required.",
        landUseNotes: "Polk County permissive for energy development given mining history. Independent CS developer path still blocked by FPL/Duke program structure. Citrus land is best pursued as C&I solar or for positioning when FL CS policy opens up.",
      },
      interconnection: {
        servingUtility: "Duke Energy Florida / Florida Power & Light (FPL)",
        queueStatus: "Utility-controlled",
        queueStatusCode: "limited",
        easeScore: 2,
        avgStudyTimeline: "N/A for independent developers",
        queueNotes: "Split between Duke Energy Florida and FPL territory. Both are utility-controlled CS programs. Monitor for Florida CS policy reform — Polk County would be a strong early-mover opportunity if the market opens to independent developers.",
      },
    },
  },

  // ── MICHIGAN ──────────────────────────────────────────────────────────────
  MI: {
    default: {
      siteControl: {
        availableLand: true,
        landNotes: "Michigan has strong agricultural land statewide — Lower Peninsula crop farming (corn, soybeans, fruit belt) and large contiguous parcels available. Upper Peninsula has abundant land but a smaller subscriber market. CS program rules are pending at MPSC.",
        wetlandWarning: true,
        wetlandNotes: "Michigan has extensive wetlands protected under Part 303 of NREPA. EGLE permit required for wetland impacts. Great Lakes coastal zone and inland lake setbacks apply. Wetland mapping (MIRIS and NWI) required before site commitment.",
        landUseNotes: "Michigan zoning is highly decentralized — township-level zoning authority. Many townships have not yet adopted solar energy ordinances. Engage local townships early. MPSC CS program rules expected in 2026 — position sites now for first-mover advantage.",
      },
      interconnection: {
        servingUtility: "Consumers Energy / DTE Energy",
        queueStatus: "Open — MISO queue",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "16–24 months",
        queueNotes: "MISO territory. Consumers Energy (western/lower MI) and DTE Energy (southeastern MI) are the primary utilities. MISO interconnection process has improved post-Order 2023. Small co-ops and municipal utilities serve some rural areas. Program rules still pending — interconnect applications can still be filed ahead of CS program launch.",
      },
    },
    kent: {
      siteControl: {
        availableLand: true,
        landNotes: "Grand Rapids metro county. Mix of suburban and agricultural land in outer county areas. Byron Center, Lowell, and Sparta areas have good agricultural parcel availability. Wetland check required — lower Grand River basin has riverine wetlands.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Kent County is a strong CS target — Grand Rapids is a sustainability-forward city with corporate subscriber base. Suburban townships (Byron Township, Gaines) updating zoning for solar. Rural western Kent County (Sparta area) is most accessible for ground-mount CS.",
      },
      interconnection: {
        servingUtility: "Consumers Energy",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 6,
        avgStudyTimeline: "14–20 months",
        queueNotes: "Consumers Energy western MI territory. Grand Rapids-area substations have good capacity. MISO interconnection improving. Kent County has seen C&I solar activity and is well-positioned for CS once MPSC rules publish.",
      },
    },
    isabella: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Michigan agricultural county. Mix of corn/soybean farmland and sugar beet operations. Large contiguous parcels available. Low wetland risk on upland sites. Mt. Pleasant area (Central Michigan University) provides subscriber market.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Isabella County townships are generally permissive for agricultural energy development. Tribal sovereignty (Saginaw Chippewa Tribal Nation) is significant in Isabella County — ensure any site is on non-tribal fee land. Soaring Eagle Casino / tribal territory awareness important.",
      },
      interconnection: {
        servingUtility: "Consumers Energy",
        queueStatus: "Open — good headroom",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Central MI Consumers Energy territory with good headroom. Mt. Pleasant and Shepherd area substations accessible. Lower developer competition than southeast MI. Strong early-mover opportunity for the first CS projects once MPSC rules launch.",
      },
    },
    gratiot: {
      siteControl: {
        availableLand: true,
        landNotes: "Central Michigan flat agricultural county. Strong corn/soybean and sugar beet farmland. Large contiguous parcels readily available. Very low wetland risk on upland sites. Low land values.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Gratiot County is among the most accessible for agricultural solar in Michigan. Township zoning is generally permissive or has minimal solar-specific requirements. Ithaca (county seat) area has some township solar ordinances in development.",
      },
      interconnection: {
        servingUtility: "Consumers Energy",
        queueStatus: "Open — excellent headroom",
        queueStatusCode: "open",
        easeScore: 8,
        avgStudyTimeline: "10–16 months",
        queueNotes: "Central MI Consumers territory with excellent substation capacity. Ithaca and Alma area substations accessible and underutilized for renewable energy. Best interconnection conditions in Michigan for future CS development. Priority county to position sites in ahead of program launch.",
      },
    },
    clinton: {
      siteControl: {
        availableLand: true,
        landNotes: "Lansing metro fringe county. Mix of suburban (east) and agricultural (west/north) land. St. Johns area and rural western Clinton County have good parcel availability. Moderate wetland risk near Looking Glass River.",
        wetlandWarning: false,
        wetlandNotes: null,
        landUseNotes: "Clinton County is well-positioned for CS — Lansing metro subscriber base is strong (state government, Michigan State University). Rural township zoning generally permissive. Check for agricultural preservation program designations in prime farmland areas.",
      },
      interconnection: {
        servingUtility: "Consumers Energy / Lansing Board of Water & Light (BWL)",
        queueStatus: "Open",
        queueStatusCode: "open",
        easeScore: 7,
        avgStudyTimeline: "12–18 months",
        queueNotes: "Consumers Energy central MI territory. Lansing BWL (municipal) serves Lansing city — rural Clinton County is Consumers territory. St. Johns area substations accessible. Proximity to Lansing load center supports subscriber acquisition for future CS projects.",
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helper
// Normalizes county display name → slug (lowercase, no spaces/suffix)
// Falls back to state default if specific county not found
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeCounty(input) {
  // Strip trailing "county", lowercase, remove apostrophes, and collapse spaces
  // "El Paso" → "elpaso", "Prince George's" → "princegeorges", "Doña Ana" → "doñaana"
  return input.trim().toLowerCase().replace(/\s+county\s*$/i, '').trim().replace(/'/g, '').replace(/\s+/g, '')
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
      landNotes: "Statewide assessment — use USDA Web Soil Survey for farmland classification and EPA NWI for wetland mapping at the parcel level.",
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
      queueNotes: "State-level IX conditions apply. Contact the serving utility directly for queue position and hosting capacity details.",
    },
  }
}

export default countyDataByState
