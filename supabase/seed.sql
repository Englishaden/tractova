-- ─────────────────────────────────────────────────────────────────────────────
-- Tractova — Seed Data
-- Converted from static JS files (statePrograms.js, countyData.js, newsFeed.js)
-- Run AFTER schema.sql. Safe to re-run — uses ON CONFLICT DO UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── state_programs ────────────────────────────────────────────────────────────

insert into state_programs
  (id, name, cs_status, cs_program, capacity_mw, lmi_required, lmi_percent,
   ix_difficulty, ix_notes, program_notes, enrollment_rate_mw_per_month,
   last_verified, updated_by)
values

-- ACTIVE PROGRAMS
('IL','Illinois','active','Illinois Shines',450,true,50,'moderate',
 'ComEd territory manageable; Ameren more backlogged. MISO queue improving post-Order 2023.',
 'CEJA expanded the program significantly. Strong LMI adder. Competitive but well-structured.',
 14,'2026-03-15','seed'),

('MN','Minnesota','active','Community Solar Garden',200,false,0,'easy',
 'Xcel Energy and smaller co-ops have headroom. MISO interconnection process relatively transparent.',
 'Mature program, Xcel waitlist moving steadily. Good ROI on small projects.',
 null,'2026-02-20','seed'),

('NY','New York','active','NY-Sun / Value Stack',500,true,20,'hard',
 'NYISO backlog significant. Con Ed territory very hard. Upstate utilities (NYSEG, RG&E) more accessible.',
 'Value Stack compensation is strong. Complex program rules. Long study timelines in downstate.',
 20,'2026-03-28','seed'),

('MD','Maryland','active','Maryland CS Program',300,true,40,'moderate',
 'PJM territory — moderate difficulty. BGE and Pepco have capacity. Delmarva can be tricky.',
 'Strong state support. LMI requirement manageable. Good fit for small developers.',
 null,'2026-03-01','seed'),

('CO','Colorado','active','Colorado Community Solar',400,true,25,'easy',
 'Xcel Energy Colorado has capacity. Rural co-ops in WACM have good headroom.',
 '2MW cap removed. Strong IRA ITC adder eligibility. Developer-friendly program structure.',
 8,'2026-04-01','seed'),

('NJ','New Jersey','active','Community Solar Energy Pilot',150,true,51,'hard',
 'PJM / JCP&L and PSE&G territories congested. High upgrade costs common.',
 'High LMI requirement creates subscriber complexity. Above-market TREC values help economics.',
 10,'2026-02-14','seed'),

('ME','Maine','active','Maine Shared Energy',100,false,0,'moderate',
 'ISO-NE. CMP and Versant territories. Queue backlog improving. Small grid limits project size.',
 'Smaller market but high state support. Good for developers targeting New England.',
 null,'2026-01-30','seed'),

('OR','Oregon','active','Oregon CS Program',200,true,30,'moderate',
 'PacifiCorp and Pacific Power territories. WAPA interconnection improving. Some rural headroom.',
 'PUC expanded program capacity in 2025. Strong environmental co-benefits scoring.',
 null,'2026-03-10','seed'),

('WA','Washington','active','Washington Shared Renewables',150,true,20,'moderate',
 'Puget Sound Energy territory primary. BPA interconnection has capacity. Co-ops accessible.',
 'Clean Energy Transformation Act drives strong demand signal. Moderate developer competition.',
 null,'2026-02-05','seed'),

('HI','Hawaii','active','Hawaii Community-Based Renewable Energy',50,true,30,'very_hard',
 'Island grid constraints severe. HECO hosting capacity analysis required. Queue very slow.',
 'High electricity prices make economics strong if you can get through interconnection. Very hard.',
 null,'2026-01-15','seed'),

('NM','New Mexico','active','New Mexico Community Solar',100,true,30,'easy',
 'PNM territory has headroom. Western interconnection (WAPA/WestConnect). Relatively fast studies.',
 'LMI adder expanded in 2026. Growing market, lower developer saturation than eastern states.',
 null,'2026-03-20','seed'),

('VA','Virginia','active','Virginia CS Program',250,true,30,'moderate',
 'Dominion Energy Virginia reforming IX process. AEP territory accessible. PJM territory.',
 'VCEA mandates drive program growth. Dominion improving processes under SCC pressure.',
 null,'2026-03-05','seed'),

('CT','Connecticut','active','Shared Clean Energy Facility',75,true,20,'moderate',
 'ISO-NE. Eversource and UI territories. Small state means limited sites but good program support.',
 'New 50MW tranche added for 2026. Small project cap (2MW). Tight site availability.',
 null,'2026-02-28','seed'),

('RI','Rhode Island','active','Rhode Island CS Program',50,false,0,'moderate',
 'ISO-NE. National Grid territory. Small grid, limited capacity for large projects.',
 'Very small market. Good for regional developers already active in New England.',
 null,'2026-01-10','seed'),

-- LIMITED PROGRAMS
('MA','Massachusetts','limited','SMART (Solar Massachusetts Renewable Target)',80,true,40,'moderate',
 'ISO-NE. Eversource and National Grid. Block 8 nearly full — watch for Block 9 announcement.',
 'Program nearly at capacity. Watch for next block opening. Strong IRA adder eligibility.',
 8,'2026-04-05','seed'),

('CA','California','limited','VNEM / NEM-ST (Virtual Net Energy Metering)',300,true,51,'hard',
 'CAISO extremely backlogged. Cluster study reform ongoing. IOU territories (PG&E, SCE, SDG&E) congested.',
 'Complex regulatory environment. NEM 3.0 reduced economics. Better fits large C&I than CS.',
 null,'2026-03-18','seed'),

('FL','Florida','limited','SolarTogether (FPL) / Duke Energy CS',200,false,0,'hard',
 'Utility-sponsored programs only. FPL and Duke control the queue. Independent developer access limited.',
 'Utility-run programs — very difficult for independent developers to access.',
 null,'2026-02-01','seed'),

-- PENDING
('MI','Michigan','pending','Michigan CS Program (Pending Launch)',0,true,30,'moderate',
 'MISO territory. Consumers Energy and DTE territories. Queue open but slow.',
 'Legislation passed in 2023. Rules under development at MPSC. Watch for 2026 launch.',
 null,'2026-03-25','seed'),

('WI','Wisconsin','pending','Wisconsin Shared Solar (Proposed)',0,false,0,'moderate',
 'MISO territory. We Energies and Madison Gas & Electric. Some headroom in co-op territories.',
 'Bill introduced but not passed. Developers tracking for early-mover advantage.',
 null,'2026-01-05','seed'),

-- NO ACTIVE PROGRAM
('AL','Alabama','none',null,0,false,0,'moderate','Alabama Power (Southern Company). Limited renewable policy. No CS framework.',null,null,null,'seed'),
('AK','Alaska','none',null,0,false,0,'very_hard','Isolated grids. No interconnection to continental grid.',null,null,null,'seed'),
('AZ','Arizona','none',null,0,false,0,'moderate','APS and SRP territories. WECC interconnection. Some interest from APS in virtual programs.','APS virtual power program pilots underway. Watch for CS framework.',null,null,'seed'),
('AR','Arkansas','none',null,0,false,0,'moderate','Entergy Arkansas and OG&E. MISO South. Limited renewable policy.',null,null,null,'seed'),
('DE','Delaware','none',null,0,false,0,'hard','PJM territory. Delmarva Power. Small state, limited sites.','Discussing CS framework. Small market.',null,null,'seed'),
('GA','Georgia','none',null,0,false,0,'moderate','Georgia Power (Southern Company). No CS program. Net metering limited.',null,null,null,'seed'),
('ID','Idaho','none',null,0,false,0,'easy','Idaho Power in WECC. Some headroom. No CS framework.',null,null,null,'seed'),
('IN','Indiana','none',null,0,false,0,'moderate','Duke Energy Indiana, AEP Indiana, NIPSCO. MISO territory. Limited policy support.',null,null,null,'seed'),
('IA','Iowa','none',null,0,false,0,'easy','MidAmerican Energy, Alliant Energy. MISO. Strong wind portfolio limits CS interest.',null,null,null,'seed'),
('KS','Kansas','none',null,0,false,0,'easy','Evergy (SPP territory). Good interconnection access but no CS policy.',null,null,null,'seed'),
('KY','Kentucky','none',null,0,false,0,'moderate','LG&E/KU and Duke Energy Kentucky. Limited renewable framework.',null,null,null,'seed'),
('LA','Louisiana','none',null,0,false,0,'moderate','Entergy Louisiana. MISO South. No CS framework.',null,null,null,'seed'),
('MS','Mississippi','none',null,0,false,0,'moderate','Entergy Mississippi. Limited renewable policy.',null,null,null,'seed'),
('MO','Missouri','none',null,0,false,0,'moderate','Ameren Missouri, KCP&L. MISO. Some interest in CS but no framework.','Ameren piloting shared solar. Watch for legislation.',null,null,'seed'),
('MT','Montana','none',null,0,false,0,'easy','NorthWestern Energy. WECC. Limited market size.',null,null,null,'seed'),
('NE','Nebraska','none',null,0,false,0,'easy','All public power (NPPD, LES, OPPD). SPP. No IOU, different framework needed.',null,null,null,'seed'),
('NV','Nevada','none',null,0,false,0,'moderate','NV Energy (WECC). Some CS interest but no formal program.','NV Energy exploring shared solar. Worth monitoring.',null,null,'seed'),
('NH','New Hampshire','none',null,0,false,0,'moderate','Eversource NH. ISO-NE. Small market.','Discussing CS framework similar to Maine. Watch for legislation.',null,null,'seed'),
('NC','North Carolina','none',null,0,false,0,'hard','Duke Energy Carolinas / Progress. SERC. Large C&I solar market but no CS program.','HB951 opened C&I solar. CS policy not yet developed.',null,null,'seed'),
('ND','North Dakota','none',null,0,false,0,'easy','Xcel Energy, Montana-Dakota Utilities. SPP/MISO. Wind-heavy market.',null,null,null,'seed'),
('OH','Ohio','none',null,0,false,0,'hard','AEP Ohio, FirstEnergy, Duke Energy Ohio. PJM. OVEC capacity concerns. Complex queue.','CS bill introduced but stalled. Watching PJM queue reform impact.',null,null,'seed'),
('OK','Oklahoma','none',null,0,false,0,'easy','PSO, OG&E. SPP territory. Strong wind but no CS policy.',null,null,null,'seed'),
('PA','Pennsylvania','none',null,0,false,0,'hard','PPL, PECO, Duquesne Light, West Penn. PJM. High upgrade costs. Complex queue.','CS legislation introduced multiple sessions. AEPS RPS driver.',null,null,'seed'),
('SC','South Carolina','none',null,0,false,0,'moderate','Dominion SC, Duke Energy Carolinas. SERC.',null,null,null,'seed'),
('SD','South Dakota','none',null,0,false,0,'easy','Xcel Energy, Basin Electric. SPP/MISO.',null,null,null,'seed'),
('TN','Tennessee','none',null,0,false,0,'moderate','TVA territory. Federal utility — different framework. No CS program.',null,null,null,'seed'),
('TX','Texas','none',null,0,false,0,'moderate','ERCOT (separate grid). Large C&I market but no CS program. PUCT oversight.','Large solar market, no CS framework. Some C&I virtual PPAs active.',null,null,'seed'),
('UT','Utah','none',null,0,false,0,'moderate','Rocky Mountain Power (PacifiCorp). WECC. RMP has a small CS-like program but very limited.','RMP ''Solar Subscription'' program exists but tiny. Not a real CS market yet.',null,null,'seed'),
('VT','Vermont','none',null,0,false,0,'moderate','Green Mountain Power, Central Vermont PS. ISO-NE. Very small market.','GMP has group net metering. Technically a CS analog but very small capacity.',null,null,'seed'),
('WV','West Virginia','none',null,0,false,0,'moderate','Appalachian Power (AEP). PJM. Coal-heavy policy environment.',null,null,null,'seed'),
('WY','Wyoming','none',null,0,false,0,'easy','Rocky Mountain Power, Black Hills Energy. WECC. Minimal policy support.',null,null,null,'seed')

on conflict (id) do update set
  name                         = excluded.name,
  cs_status                    = excluded.cs_status,
  cs_program                   = excluded.cs_program,
  capacity_mw                  = excluded.capacity_mw,
  lmi_required                 = excluded.lmi_required,
  lmi_percent                  = excluded.lmi_percent,
  ix_difficulty                = excluded.ix_difficulty,
  ix_notes                     = excluded.ix_notes,
  program_notes                = excluded.program_notes,
  enrollment_rate_mw_per_month = excluded.enrollment_rate_mw_per_month,
  last_verified                = coalesce(excluded.last_verified, state_programs.last_verified),
  updated_by                   = excluded.updated_by;

-- ── revenue_stacks ────────────────────────────────────────────────────────────

insert into revenue_stacks (state_id, summary, irec_market, itc_base, itc_adder, net_metering_status)
values
('IL','Illinois Shines REC payments ($/kWh, 15-yr contract) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder where applicable. Capacity factor ~15–17%.','Active — GATS-based','30%','LMI +10%, Energy Community +10%','Virtual NEM via Illinois Shines program'),
('NY','Value Stack (CDG bill credit — 6¢–11¢/kWh depending on zone) + IRA ITC 30% base + LMI adder + NY-Sun incentive for eligible projects. NYC/downstate rates strongest.','Active — NYGATS','30%','LMI +10%, Low-Income Community +20%','CDG credit via Value Stack'),
('MA','SMART Block 8 incentive (fixed ¢/kWh declining-block adder, 10-yr) + IRA ITC 30% + LMI adder + SREC II market for older projects. New blocks tightening.','Active — NEPOOL-GIS','30%','LMI +10%, Energy Community +10%','SMART compensation + net metering'),
('MN','Xcel Solar Garden compensation rate (fixed ¢/kWh, 25-yr, index-based) + IRA ITC 30%. No LMI adder required but voluntary LMI projects can access bonus REC pricing.','Active — MRETS','30%','Energy Community +10% in qualifying zones','Solar Garden credits via Xcel compensation tariff'),
('CO','Xcel CS compensation rate (REC + capacity + energy, ¢/kWh, 20-yr) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder. 2MW cap lifted.','Active — WREGIS','30%','LMI +10%, Energy Community +10%','CS bill credit via Xcel Colorado Solar Garden tariff'),
('MD','Maryland CS bill credits (retail rate offset, BGE/Pepco/Delmarva tariff) + MD SREC-II market + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder in qualifying zones.','Active — PJM-GATS','30%','LMI +10%, Energy Community +10%','CS bill credit via utility tariff'),
('NJ','NJ CS bill credits (retail rate offset) + TREC (~$152/MWh historically) + IRA ITC 30% base + 10% LMI adder. High 51% LMI subscriber requirement.','Active — PJM-GATS','30%','LMI +10%','CS bill credit via program tariff'),
('ME','Maine Shared Energy bill credits (retail avoided cost rate) + NEPOOL-GIS REC market + IRA ITC 30% base. No LMI requirement. Strong state policy support.','Active — NEPOOL-GIS','30%','Energy Community +10% in qualifying rural areas','CS bill credit via CMP/Versant tariff'),
('OR','Oregon Clean Electricity Program (OCEP) bill credits (retail rate offset) + OR REC market (WREGIS) + IRA ITC 30% base + 10% LMI adder. PGE and Pacific Power tariff structures differ.','Active — WREGIS','30%','LMI +10%, Energy Community +10% in qualifying areas','CS bill credit via OCEP tariff'),
('WA','Washington Shared Renewables bill credits (retail rate offset via PSE or Pacific Power) + WA REC market (WREGIS, smaller) + IRA ITC 30% base.','Active — WREGIS','30%','LMI +10% where applicable','CS bill credit via utility tariff (PSE / Pacific Power)'),
('VA','Virginia CS bill credits (retail rate offset via Dominion/AEP tariff) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder (many qualifying areas).','Active — PJM-GATS','30%','LMI +10%, Energy Community +10%','CS bill credit via Dominion/AEP tariff'),
('CT','CT Shared Clean Energy Facility (SCEF) bill credits (avoided cost adder) + IRA ITC 30% base. 2MW project cap.','Active — NEPOOL-GIS','30%','LMI +10%','CS bill credit via Eversource/UI SCEF tariff'),
('RI','Rhode Island CS bill credits (retail rate offset via National Grid tariff) + NEPOOL-GIS REC market + IRA ITC 30% base. Small program (50 MW total).','Active — NEPOOL-GIS','30%','Energy Community +10% in qualifying areas','CS bill credit via National Grid RI tariff'),
('NM','New Mexico CS bill credits (retail rate offset via PNM/EPE tariff) + NM REC market (WREGIS) + IRA ITC 30% base + 10% LMI adder + 10% Energy Community adder (widely applicable in NM).','Active — WREGIS','30%','LMI +10%, Energy Community +10% (broadly applicable)','CS bill credit via PNM/El Paso Electric tariff'),
('HI','Hawaii CBRE bill credits (avoided cost rate + adders, ~$0.35–0.42/kWh value on Oahu) + IRA ITC 30% base + 10% LMI adder. Island grid high rates make credit values strong.','Active — WREGIS (Hawaii branch)','30%','LMI +10%','CBRE bill credit via HECO/MECO/HELCO tariff'),
('CA','California NEM-ST / VNEM bill credits (NEM 3.0 export rates, reduced from NEM 2.0) + WREGIS REC market + IRA ITC 30% base + 10% LMI adder + 20% Low-Income Community adder.','Active — WREGIS','30%','LMI +10%, Low-Income Community +20%, Energy Community +10%','NEM-ST export credit (NEM 3.0 export rate applies)'),
('FL','FPL SolarTogether / Duke Energy CS credits (utility-set compensation, not independently negotiated) + IRA ITC 30%. Independent developer CS economics very limited.','Limited — SERC/Florida RECs','30%','LMI +10% where applicable','Utility CS program credit (SolarTogether / Duke CS tariff)'),
('MI','Michigan CS program rules pending at MPSC — expected bill credit structure similar to Minnesota. IRA ITC 30% base + LMI adder + Energy Community adder in qualifying areas.','Active — MRETS (in anticipation)','30%','LMI +10%, Energy Community +10% (broadly applicable in MI)','Program rules pending — bill credit structure expected')

on conflict (state_id) do update set
  summary             = excluded.summary,
  irec_market         = excluded.irec_market,
  itc_base            = excluded.itc_base,
  itc_adder           = excluded.itc_adder,
  net_metering_status = excluded.net_metering_status;

-- ── county_intelligence ───────────────────────────────────────────────────────
-- Includes all explicitly seeded counties from countyData.js.
-- Every state with a revenue_stack also gets a 'default' fallback row.

insert into county_intelligence
  (state_id, county_slug, serving_utility, queue_status, queue_status_code,
   ease_score, avg_study_timeline, queue_notes,
   available_land, land_notes, wetland_warning, wetland_notes, land_use_notes)
values

-- ── ILLINOIS ──────────────────────────────────────────────────────────────────
('IL','default','Ameren Illinois','Open','open',6,'14–20 months',
 'Ameren territories generally accessible. Sub-5MW projects routed through expedited process. MISO Order 2023 reforms improving queue efficiency.',
 true,'Mix of prime agricultural and marginal land. Check USDA farmland class (Class I/II land will draw scrutiny). Large contiguous parcels available in rural counties.',
 false,null,'Review county zoning for solar energy overlay. Most rural IL counties permit ground-mount solar by right or with a special use permit. Township sign-off sometimes needed.'),

('IL','cook','ComEd (Exelon)','Limited — high demand','limited',5,'18–24 months',
 'ComEd northern Illinois territory sees heavy demand. Urban load pockets can create upgrade requirements. Sub-2MW projects may qualify for expedited review.',
 false,'Cook County is heavily urbanized — minimal agricultural parcels. Focus on brownfields, contaminated sites, or commercial rooftops.',
 false,null,'Chicago city zoning complex. Suburban Cook municipalities vary widely. Best opportunity: south and southwest suburban fringe.'),

('IL','champaign','Ameren Illinois','Open — moderate backlog','open',6,'14–18 months',
 'Ameren Decatur load pocket can be congested for larger projects. Sub-5MW projects process faster. 138kV transmission access available near Champaign-Urbana.',
 true,'Prime agricultural county — high concentration of USDA Class I/II farmland. Expect local opposition and county scrutiny for large solar footprints on ag land.',
 false,null,'Champaign County has a solar energy overlay district. Most rural townships allow ground-mount solar with a special use permit. Setback requirements apply.'),

('IL','mclean','Ameren Illinois','Open','open',7,'12–16 months',
 'McLean County sits in a good Ameren transmission corridor. Relatively low queue saturation. Medium-voltage distribution interconnection available at multiple substations.',
 true,'Highly productive farmland county — USDA prime designation widespread. Low wetland risk on upland sites. Strong landowner interest in solar leases.',
 false,null,'McLean County zoning generally permissive for solar. Bloomington-Normal urban area has specific restrictions; rural unincorporated areas are more flexible.'),

('IL','will','ComEd (Exelon)','Open','open',6,'15–20 months',
 'Southern ComEd territory has reasonable capacity. Joliet-area substations have seen renewable projects successfully interconnect. PJM/MISO seam can complicate larger projects.',
 true,'South suburban Chicago fringe — mix of agricultural and industrial land. Good brownfield opportunities near Joliet. Prime ag land in southern portions.',
 true,'Kankakee River tributary wetlands present. Run EPA NWI check on any site below the Illinois & Michigan Canal corridor.',
 'Will County has been proactive in solar zoning. Many townships have adopted solar energy ordinances. Check for industrial brownfield clean energy overlay zones.'),

-- ── NEW YORK ──────────────────────────────────────────────────────────────────
('NY','default','NYSEG','Open — moderate','open',5,'20–28 months',
 'NYISO queue has improved post-2023 reforms. Upstate utilities (NYSEG, RG&E) more accessible than Con Ed downstate. Cluster study impacts vary by zone.',
 true,'Land availability varies widely by region. Upstate NY generally more accessible than downstate. Agricultural land most common in western and central NY.',
 false,null,'Check DEC NWI layer (Article 24 wetlands). All sites within 100ft of wetlands require DEC permit. Many upstate towns have adopted solar local laws.'),

('NY','westchester','Con Edison','Saturated','saturated',2,'36–48+ months',
 'Con Edison territory is among the most congested in the country. NYISO Zone J extremely backlogged. High network upgrade costs common. Not recommended for small developers.',
 false,'Densely developed suburban county — very limited land availability for utility-scale solar. Focus on commercial rooftops or C&I behind-the-meter.',
 true,'Numerous DEC Article 24 freshwater wetlands throughout county. Any site near streams requires thorough NWI analysis.',
 'Strong local opposition to large ground-mount solar. Many Westchester municipalities have enacted solar moratoriums or strict setback requirements.'),

('NY','albany','National Grid / NYSEG','Open','open',5,'22–28 months',
 'National Grid upstate territory has reasonable capacity. NYISO Zone E. Some congestion near Albany metro. Rural sites in southern Albany County generally cleaner to interconnect.',
 true,'Mix of farmland and forest in Albany County. Moderate availability. APA-adjacent northern areas have restrictions. Agricultural land less productive than western NY.',
 false,null,'Albany County comprehensive plan supportive of solar. Many towns have adopted solar local laws. Chapter 70 Article 10 large-scale review threshold is 25MW — stay under for smaller process.'),

('NY','monroe','NYSEG / RG&E (Rochester Gas & Electric)','Open','open',6,'16–22 months',
 'RG&E/NYSEG Rochester territory has moderate headroom. NYISO Zone C. Several recent CS projects successfully interconnected in Monroe and adjacent counties.',
 true,'Rochester metro fringe has good agricultural land in suburban and rural areas. Lake Ontario proximity creates some wetland risk on low-lying sites.',
 false,null,'Monroe County zoning is highly variable by town. Several Rochester-area towns have approved solar energy local laws. Wayne County line (eastern fringe) very permissive.'),

('NY','ulster','Central Hudson Gas & Electric','Limited','limited',4,'24–32 months',
 'Central Hudson (NYISO Zone G) has seen recent congestion from Hudson Valley solar surge. Network upgrade costs rising. Study early and watch for cluster study groupings.',
 true,'Hudson Valley agricultural land available in western portions. Catskill foothills create topographic challenges for larger projects.',
 true,'Rondout Creek and Wallkill River corridors have DEC wetlands. Check NWI before site selection in valley floors.',
 'Ulster County has a progressive energy planning environment. Some towns have adopted community solar–friendly local laws.'),

-- ── MASSACHUSETTS ─────────────────────────────────────────────────────────────
('MA','default','Eversource Energy / National Grid','Limited — SMART Block 8 filling','limited',5,'18–24 months',
 'ISO-NE interconnection. SMART program queue fills by blocks — project must be in queue before block caps. Eversource and National Grid distribution territories have moderate capacity.',
 true,'Wetland risk moderate to high statewide — use MassGIS NWI layer before site selection. Forest clearing politically sensitive in many communities.',
 true,'Massachusetts Wetlands Protection Act is strict — 50ft no-disturb, 100ft buffer. Chapter 61A land conversion process required for agricultural land under preferential tax status.',
 'Most towns have local solar bylaws under Green Communities Act. Check town zoning for dimensional requirements (setbacks, screening). Many towns cap ground-mount at 3–5MW.'),

('MA','worcester','Eversource Energy','Limited','limited',5,'18–24 months',
 'Eversource Central MA territory. SMART Block 8 interconnection slots filling. Distribution capacity varies by substation — check hosting capacity map before site commitment.',
 true,'Central MA has forested land and some agricultural areas. Wetland presence common — check MassGIS NWI before site selection. Capped landfills a strong brownfield opportunity.',
 true,'Chapter 131 Section 40 wetland protection applies. Many sites in Worcester County have vernal pools — NHESP mapping required.',
 'Many Worcester County towns have solar bylaws. Chapter 61A conversion filing needed for farm parcels. Brownfields and disturbed land strongly preferred from a permitting standpoint.'),

('MA','middlesex','Eversource Energy','Limited','limited',4,'24–30 months',
 'Near-Boston Eversource territory heavily loaded. High network upgrade costs common near urban core. Suburban fringe (western Middlesex) has better capacity.',
 false,'High-density suburban county. Very limited large parcels. Most viable sites are commercial rooftops, parking canopies, or brownfields.',
 true,'Dense wetland network throughout county. Many streams and ponds with 100ft buffer requirements. NHESP rare species mapping important.',
 'Strong environmental review in most Middlesex communities. Chapter 61A land conversion filings for ag parcels. Town center historic districts restrict visual impact.'),

('MA','hampshire','Eversource Energy / National Grid','Open','open',6,'16–22 months',
 'Western MA territory has better capacity than eastern MA. SMART Block opportunities remain open longer here. WMECO (National Grid) substations in some areas.',
 true,'Pioneer Valley agricultural land available. Connecticut River floodplain wetlands require careful siting. Hillside and upland ag land best opportunities.',
 true,'Connecticut River corridor has priority resource areas. Mass Wildlife NHESP layer critical — several species of special concern in area.',
 'Hampshire County towns vary in solar receptiveness. Northampton has progressive policies. Rural towns generally more flexible on setbacks. Chapter 61A conversion process standard.'),

-- ── MINNESOTA ────────────────────────────────────────────────────────────────
('MN','default','Xcel Energy (NSP)','Open','open',7,'10–16 months',
 'Xcel Energy Minnesota has a well-defined Solar Garden process. MISO interconnection relatively transparent. Queue timelines have improved significantly since 2023.',
 true,'Strong agricultural land availability in most counties. Low wetland risk on upland farm sites. Prairie pothole regions (west central MN) require wetland check.',
 false,null,'Minnesota GreenStep Cities program supports solar. Check county ordinance for size limits and setback requirements. Most rural counties have permissive solar ordinances.'),

('MN','hennepin','Xcel Energy (NSP)','Open','open',7,'10–14 months',
 'Metro Xcel territory has strong load and good capacity. Solar Garden applications process efficiently. Distribution-level interconnection widely available across the metro.',
 false,'Minneapolis–St. Paul metro core — minimal agricultural parcels. Focus on commercial rooftops, parking canopies, or peri-urban fringe sites.',
 false,null,'Hennepin County suburban municipalities vary widely in solar ordinances. Several cities have proactive solar policies (Minneapolis, Eden Prairie).'),

('MN','olmsted','Xcel Energy (NSP)','Open — good headroom','open',8,'8–12 months',
 'Olmsted County has excellent Xcel interconnection conditions. Rochester load pocket absorbs Solar Garden output well. One of the stronger CS development counties in Minnesota.',
 true,'Rochester area has productive farmland with strong solar resource. Good contiguous parcels available outside the urban core. Low wetland risk on upland sites.',
 false,null,'Olmsted County zoning permissive for solar. Rochester GreenStep program actively supports renewables. IBM and Mayo Clinic presence drives strong commercial subscriber demand.'),

('MN','stearns','Xcel Energy (NSP)','Open','open',8,'8–12 months',
 'Strong Xcel distribution capacity in Stearns County. Rural substations have headroom. Excellent interconnection conditions for sub-5MW CS projects.',
 true,'Central Minnesota agricultural land — large contiguous parcels widely available. Strong solar resource. Low wetland risk on upland farmland.',
 false,null,'Stearns County recently updated solar ordinance (2024) — generally permissive for ground-mount CS. St. Cloud metro fringe has some restrictions, rural township areas flexible.'),

('MN','dakota','Xcel Energy (NSP)','Open','open',7,'10–14 months',
 'Southern metro Xcel territory with good capacity. Strong load near metro supports CS subscriber acquisition. Dakota Electric Association co-op serves some eastern portions.',
 true,'Southern metro fringe. Mix of suburban and agricultural land. Apple Valley and Eagan urban areas limited; rural southern townships have good parcel availability.',
 false,null,'Dakota County has an active solar program. Many suburban cities have solar-friendly zoning. Farmington and Northfield area rural townships very permissive.'),

-- ── COLORADO ─────────────────────────────────────────────────────────────────
('CO','default','Xcel Energy Colorado','Open','open',7,'10–16 months',
 'Xcel Energy Colorado has a well-managed CS process. WACM (Western Area Colorado-Missouri) interconnection area. Rural co-ops in WACM territory have good headroom.',
 true,'Colorado generally has strong solar resource and available dryland and rangeland parcels. Eastern plains counties have large tracts.',
 false,null,'Check for conservation easements (GOCO, Great Outdoors Colorado land trust designations) — very common on quality agricultural land. County zoning district matters significantly.'),

('CO','weld','Xcel Energy Colorado','Open','open',8,'10–14 months',
 'Excellent Xcel Colorado conditions in Weld County. Fort Lupton and Greeley load centers provide strong offtake. Multiple recent CS projects successfully commissioned here.',
 true,'High Plains agricultural county — large contiguous parcels readily available. Strong solar resource. Oil & gas co-location possible on existing mineral rights. Low wetland risk.',
 false,null,'Weld County is among the most permissive in Colorado for energy development. Mineral rights co-existence common. Strong landowner interest in solar lease revenue.'),

('CO','elpaso','Black Hills Energy / Colorado Springs Utilities','Open','open',6,'12–18 months',
 'Black Hills and CS Utilities territories have reasonable capacity but smaller systems than Xcel. CS Utilities (city-owned) has its own interconnection process — allow extra time for municipal coordination.',
 true,'Colorado Springs metro fringe. Mix of rangeland, dryland agriculture, and suburban residential. Strong solar resource. Some USAF base proximity restrictions — check restricted airspace.',
 false,null,'El Paso County: distinguish Colorado Springs incorporated (complex) vs. county unincorporated (more flexible). Monument and Falcon area rural townships are best opportunities.'),

('CO','larimer','Xcel Energy Colorado','Open','open',7,'10–14 months',
 'Fort Collins metro Xcel territory. Good distribution capacity in rural eastern Larimer County. Loveland–Fort Collins corridor has seen successful CS interconnections.',
 true,'Fort Collins area. Mix of irrigated agricultural land and dryland parcels. Conservation easements common on higher-quality farmland — verify before leasing.',
 false,null,'Larimer County has a strong conservation community. Check GOCO easements and Larimer County Land Stewardship designations. Rural eastern portions (Berthoud, Johnstown area) more flexible.'),

('CO','adams','Xcel Energy Colorado','Open','open',7,'10–14 months',
 'Adams County sits in a strong Xcel transmission corridor. Brighton substation area has supported multiple CS and C&I solar projects. DIA-adjacent load provides strong CS subscriber base.',
 true,'Northern Denver metro fringe. Mix of industrial, agricultural, and suburban land. Brighton and Fort Lupton areas have agricultural parcels. Brownfield opportunities near Commerce City.',
 false,null,'Adams County has been receptive to solar in its eastern agricultural areas. Check for airport height restrictions near DIA. Brighton area rural townships are most accessible.'),

-- ── MARYLAND ─────────────────────────────────────────────────────────────────
('MD','default','BGE (Baltimore Gas & Electric)','Open — moderate','open',6,'16–22 months',
 'PJM territory. BGE and Pepco have reasonable capacity outside the Baltimore/DC urban cores. Delmarva Power (Eastern Shore) can be slower.',
 true,'Rural Maryland has productive agricultural land — mix of prime farmland and marginal acreage. Chesapeake Bay watershed means wetland risk varies significantly by county.',
 false,null,'Maryland CS projects (typically ≤2MW) are primarily regulated at the county level. County solar energy zoning varies widely — check local ordinances before site commitment.'),

('MD','frederick','Potomac Edison (FirstEnergy)','Open','open',7,'14–18 months',
 'Potomac Edison (FirstEnergy) serves Frederick County. PJM territory with reasonable capacity. Several CS projects have successfully interconnected here.',
 true,'Strong agricultural county west of Baltimore/DC metro. Mix of prime farmland and rolling terrain. Good parcel availability in northern and western portions.',
 false,null,'Frederick County has a relatively permissive solar zoning framework. Agricultural solar overlay allows ground-mount with special exception in most districts.'),

('MD','washington','Potomac Edison (FirstEnergy)','Open — good headroom','open',7,'12–18 months',
 'Potomac Edison PJM territory with good headroom in western MD. Hagerstown-area substations accessible. Underutilized by developers compared to central MD — worth targeting.',
 true,'Westernmost MD county — Hagerstown metro fringe with large rural agricultural areas. Contiguous parcels available. Lower land values than central MD. Low wetland risk on upland sites.',
 false,null,'Washington County zoning is developer-friendly for energy projects. Ag land widely available. Energy Community adder likely applicable — check DOE qualifying census tracts.'),

('MD','princegeorges','Pepco (Exelon)','Limited','limited',4,'22–30 months',
 'Pepco DC metro territory is congested. High network upgrade costs common for projects near the urban core. Eastern county rural areas served by Pepco have better capacity.',
 false,'Suburban DC county — highly developed with limited agricultural parcels. Best opportunities are brownfields, rooftops, or the rural eastern fringe near the Charles County line.',
 true,'Patuxent River watershed wetlands throughout eastern portions. MDE Wetlands and Waterways permit required for any work within tidal or non-tidal wetlands.',
 'PG County has strong environmental review requirements. Large solar projects face community opposition in many areas.'),

('MD','annearundel','BGE (Baltimore Gas & Electric)','Open','open',6,'16–20 months',
 'BGE serves Anne Arundel County. Suburban load is strong — good for subscriber acquisition. Southern county substations have more headroom than northern/Annapolis area.',
 true,'Mix of suburban Baltimore fringe and rural agricultural land in southern portions. Western Anne Arundel County has the best large-parcel opportunity.',
 true,'Bay watershed NWI check critical for any site within 2 miles of water bodies. MDE Critical Area designation (1,000-ft buffer from Bay and tidal tributaries) restricts development.',
 'Anne Arundel County zoning requires special exception for solar over 2MW. Southern county (Davidsonville, Lothian) has better agricultural parcel access.'),

-- ── NEW JERSEY ────────────────────────────────────────────────────────────────
('NJ','default','PSE&G','Limited','limited',4,'22–30 months',
 'PJM territory. PSE&G (northern NJ) and JCP&L (central) are congested. ACE (Atlantic City Electric, southern NJ) has better capacity. 51% LMI subscriber requirement adds project complexity.',
 true,'New Jersey is the most densely populated state — available land is constrained statewide. Best CS opportunities are in the southern agricultural counties (Salem, Cumberland, Burlington).',
 true,'NJ DEP wetlands are pervasive. NJDEP Freshwater Wetlands Protection Act requires permits for any disturbance within 150ft of a wetland.',
 'Most NJ municipalities have solar-friendly zoning under state preemption. Pine Barrens Pinelands CMP restricts development in Pinelands management area.'),

('NJ','burlington','JCP&L (Jersey Central Power & Light)','Limited — moderate backlog','limited',5,'20–26 months',
 'JCP&L serves central/south Burlington County. Better capacity than PSE&G northern territory. Bordentown and Mt. Holly area substations have seen CS project activity.',
 true,'Central/south NJ — mix of agricultural land and Pinelands-adjacent areas. Avoid Pinelands Management Area. Best parcels are in western Burlington County agricultural areas.',
 true,'Rancocas Creek watershed has extensive freshwater wetlands. NJDEP freshwater wetlands permit likely needed — run NWI before site commitment.',
 'Check Pinelands CMP designation for all Burlington County sites. Western agricultural townships are most accessible.'),

('NJ','salem','Atlantic City Electric (Exelon)','Open','open',6,'18–22 months',
 'ACE territory (south NJ) has better capacity than northern utilities. Several CS projects have successfully commissioned in Salem County. Substation capacity generally available for sub-5MW projects.',
 true,'Most agricultural county in NJ — large contiguous parcels of active farmland available. Lowest land values in the state. Delaware River floodplain on western edge requires wetland check.',
 false,null,'Salem County is the most permissive for solar in New Jersey. Agricultural solar generally welcomed. Best CS developer opportunity in the state.'),

('NJ','gloucester','Atlantic City Electric (Exelon)','Open','open',6,'18–24 months',
 'ACE territory with moderate capacity. South Jersey substations more accessible than northern NJ. Logan Township and Mullica Hill areas are well-served for distribution interconnection.',
 true,'South suburban NJ — mix of agricultural and suburban land. Eastern portions near Camden County are more developed; western and southern areas have good parcel availability.',
 false,null,'Gloucester County has active farmland preservation program — check preserved farmland status before approaching landowners.'),

('NJ','hunterdon','JCP&L (Jersey Central Power & Light)','Limited','limited',5,'20–26 months',
 'JCP&L northwest NJ territory. Moderate capacity outside the Highlands area. Flemington and Whitehouse Station areas have better substation access than northern county.',
 true,'Northwest NJ rural county — rolling farmland with good parcel availability. Some conservation easements on prime farmland. Highlands Area designation in northern portions.',
 false,null,'Hunterdon County has a strong land preservation program. Verify farmland preservation status. Highlands Preservation Area in northern Hunterdon restricts development significantly.'),

-- ── DEFAULTS FOR REMAINING ACTIVE/LIMITED/PENDING STATES ─────────────────────
('ME','default','Central Maine Power (CMP / Avangrid)','Open — moderate','open',6,'16–22 months',
 'ISO-NE interconnection. CMP serves most of the state. Versant Power serves northern and eastern counties. Small grid limits project size — stay under 5MW for smoother process.',
 true,'Maine has abundant rural land — mix of agricultural, forestry, and cleared land. Southern counties have better agricultural land; northern counties have large potato/grain farms.',
 false,null,'Maine DEP Site Law review required for projects over 3MW or 20 acres. Natural Resources Protection Act (NRPA) permits needed near water bodies or wetlands.'),

('OR','default','Pacific Power (PacifiCorp)','Open — moderate','open',6,'14–20 months',
 'PacifiCorp and Pacific Power territories. WAPA interconnection improving. Some rural headroom. WECC interconnection area.',
 true,'Oregon has diverse land types — Willamette Valley agricultural land is most accessible. Eastern Oregon has large parcels with strong solar resource.',
 false,null,'Oregon land use planning (Goal 3 agricultural lands) can restrict solar development on prime farmland. EFU zoning allows solar with conditional use permit in most counties.'),

('WA','default','Puget Sound Energy','Open','open',6,'14–20 months',
 'Puget Sound Energy territory primary. BPA interconnection has capacity. Rural co-ops generally accessible. WECC interconnection area.',
 true,'Land availability varies by region. Eastern Washington agricultural land most accessible for large-scale CS. Western Washington limited by terrain and precipitation.',
 false,null,'Washington SEPA review required for significant actions. Check Growth Management Act designations in each county. Eastern WA counties more permissive for agricultural solar.'),

('HI','default','Hawaiian Electric (HECO)','Limited','limited',3,'24–36 months',
 'Island grid constraints severe. HECO hosting capacity analysis required. Queue very slow. Circuit-level capacity analysis mandatory before application.',
 true,'Island geography limits available land. Oahu most constrained — focus on already-disturbed land, brownfields, rooftops. Neighbor islands have more agricultural land.',
 false,null,'Hawaii SMA (Special Management Area) and Conservation District overlap with many sites. DLNR review required for conservation land. Hawaii land use district check essential.'),

('NM','default','PNM (Public Service Company of New Mexico)','Open','open',7,'10–16 months',
 'PNM territory has headroom. Western interconnection (WAPA/WestConnect). Relatively fast studies. El Paso Electric serves southern NM.',
 true,'New Mexico has strong solar resource and large available parcels. Eastern plains counties have excellent agricultural land with minimal conflicts.',
 false,null,'New Mexico land use varies widely. Check BLM surface rights for rural parcels — split estate ownership common. Farmland conversion requirements under NMED minimal.'),

('VA','default','Dominion Energy Virginia','Open — moderate','open',6,'16–22 months',
 'Dominion Energy Virginia reforming IX process per SCC order. AEP territory (western VA) accessible. PJM territory.',
 true,'Virginia has strong agricultural land in the Shenandoah Valley and Piedmont. Tidewater area more constrained. Good parcel availability in most rural counties.',
 false,null,'Virginia CPCN process for large projects; most CS projects under 150MW use smaller permit process. County special use permits standard. DEQ permit for sites near wetlands.'),

('CT','default','Eversource Energy','Limited','limited',5,'16–22 months',
 'ISO-NE. Eversource and UI territories. Small state means limited sites. Distribution hosting capacity varies by circuit — check before site commitment.',
 true,'Connecticut is highly developed but has agricultural land in Litchfield County and eastern CT river valley areas.',
 true,'Connecticut Inland Wetlands Act is strict — local wetlands agency approval required. Many sites have wetland adjacency. Forest clearing politically sensitive.',
 'Most towns have zoning regulations for solar under CGSA. 2MW project cap under SCEF program. Brownfields and developed land strongly preferred.'),

('RI','default','National Grid (Rhode Island)','Limited','limited',5,'18–24 months',
 'ISO-NE. National Grid territory. Small grid, limited capacity for large projects. Distribution circuits generally accessible for sub-2MW projects.',
 true,'Rhode Island is small and densely developed. Best CS opportunities are in southern and western agricultural areas (South Kingstown, Richmond, Hopkinton).',
 true,'Rhode Island Freshwater Wetlands Act applies statewide. Coastal wetlands extensive. DEM wetland mapping check essential for all sites.',
 'RI CRMC (Coastal Resources Management Council) jurisdiction near coast. Agricultural land use commission review for farmland conversion. Small program — limited developer competition.'),

('CA','default','PG&E / SCE / SDG&E','Saturated','saturated',2,'36–48+ months',
 'CAISO extremely backlogged. Cluster study reform ongoing. All three IOU territories (PG&E, SCE, SDG&E) congested. High network upgrade costs standard.',
 true,'California has available land in Central Valley and Inland Empire, but CS program access is the primary constraint, not land.',
 false,null,'California Farmland Conversion is politically sensitive. CEQA review required. Williamson Act contracts on agricultural land require cancellation before conversion.'),

('FL','default','Florida Power & Light (FPL)','Limited','limited',4,'20–30 months',
 'Utility-sponsored programs only. FPL and Duke control the queue. Independent developer access very limited. FRCC interconnection area.',
 true,'Florida has abundant land in central and northern counties. Flatlands in Polk, Highlands, Glades counties have large parcels.',
 true,'Florida wetlands are pervasive — South Florida Water Management District and Northwest Florida Water Management District permits required. USACE Section 404 permit likely.',
 'Florida solar zoning generally favorable but CS program access is the fundamental constraint — not land or interconnection.'),

('MI','default','DTE Energy / Consumers Energy','Open — moderate','open',5,'16–22 months',
 'MISO territory. Consumers Energy and DTE territories. Queue open but CS program rules still pending. MPSC process for CS interconnection expected to streamline post-launch.',
 true,'Michigan has strong agricultural land availability — Lower Peninsula counties have large parcels. Great Lakes proximity creates some wetland risk in coastal areas.',
 false,null,'Michigan Zoning Enabling Act allows municipalities to regulate energy systems. Most rural counties permissive. EGLE permit required near wetlands or water bodies.')

on conflict (state_id, county_slug) do update set
  serving_utility    = excluded.serving_utility,
  queue_status       = excluded.queue_status,
  queue_status_code  = excluded.queue_status_code,
  ease_score         = excluded.ease_score,
  avg_study_timeline = excluded.avg_study_timeline,
  queue_notes        = excluded.queue_notes,
  available_land     = excluded.available_land,
  land_notes         = excluded.land_notes,
  wetland_warning    = excluded.wetland_warning,
  wetland_notes      = excluded.wetland_notes,
  land_use_notes     = excluded.land_use_notes;

-- ── news_feed ─────────────────────────────────────────────────────────────────

insert into news_feed (headline, source, url, published_at, pillar, type, summary, tags, state_ids)
values
('Illinois Shines capacity expands 300MW under amended CEJA rules — application window opens May 1',
 'IL Commerce Commission','https://www.icc.illinois.gov/','2026-04-08','offtake','policy-alert',
 'The ICC approved a CEJA amendment expanding Illinois Shines by 300MW, with 50% earmarked for LMI subscribers. New application window opens May 1 for Approved Vendor registration.',
 ARRAY['offtake','IL','policy','LMI'],ARRAY['IL']),

('MISO queue reform clears 800+ stalled projects — 14 Midwest states see immediate benefit',
 'MISO','https://www.misoenergy.org/','2026-04-05','ix','market-update',
 'MISO''s Definitive Planning Phase reforms resulted in 823 project withdrawals, reducing active queue backlog by 31%. Small projects under 5MW see fastest queue movement.',
 ARRAY['ix','IL','MN','IN','MI','WI','policy'],ARRAY['IL','MN','IN','MI','WI']),

('New York Value Stack tariff revision increases compensation rates 12% effective June 2026',
 'NYSERDA','https://www.nyserda.ny.gov/','2026-04-03','offtake','market-update',
 'NYSERDA revised Value Stack compensation upward 12% across all CDG project categories. Community DG projects under 5MW see the largest rate increase.',
 ARRAY['offtake','NY','policy'],ARRAY['NY']),

('Colorado removes 2MW project cap — community solar projects up to 10MW now eligible',
 'Colorado PUC','https://puc.colorado.gov/','2026-03-31','offtake','policy-alert',
 'Colorado PUC approved rule amendments removing the 2MW single-project cap. Projects up to 10MW may now qualify for the community solar program, opening the door for larger independent developers.',
 ARRAY['offtake','CO','policy'],ARRAY['CO']),

('Massachusetts SMART Block 8 reaches 90% capacity — DOER signals Block 9 rulemaking this summer',
 'MA DOER','https://www.mass.gov/orgs/department-of-energy-resources','2026-03-28','offtake','policy-alert',
 'SMART Block 8 is now 90% subscribed. DOER has committed to initiating Block 9 rulemaking by July 2026. Developers should monitor closely — new block likely increases compensation adder.',
 ARRAY['offtake','MA','policy','alert'],ARRAY['MA']),

('FERC Order 2023-A compliance filings accepted — 12 transmission owners now compliant',
 'FERC','https://www.ferc.gov/','2026-03-25','ix','market-update',
 'FERC accepted Order 2023-A compliance filings from 12 transmission owners, including several in PJM and MISO. Developers can expect faster initial study timelines beginning Q3 2026.',
 ARRAY['ix','policy','multi-state'],ARRAY[]::text[]),

('Virginia SCC approves Dominion Energy interconnection process reforms — study timelines cut by 30%',
 'Virginia SCC','https://www.scc.virginia.gov/','2026-03-20','ix','market-update',
 'The SCC approved Dominion''s revised Small Generator Interconnection Procedures, mandating 90-day feasibility studies (down from 130 days average). Effective for all applications filed after May 1.',
 ARRAY['ix','VA','policy'],ARRAY['VA']),

('New Mexico expands LMI adder to 30% for qualifying community solar projects',
 'New Mexico PRC','https://www.nmprc.state.nm.us/','2026-03-15','offtake','market-update',
 'The PRC approved amendments to the New Mexico CS program expanding the LMI income-qualified subscriber requirement to 30% and increasing the LMI subscriber rate adder.',
 ARRAY['offtake','NM','LMI','policy'],ARRAY['NM']),

('Maryland opens 2026 community solar application window — 300MW available, deadline June 15',
 'MD PSC','https://www.psc.state.md.us/','2026-03-10','offtake','policy-alert',
 'The Maryland PSC opened the 2026 CS application window for the full 300MW program tranche. Applications accepted through June 15. LMI allocation requirement: 40%.',
 ARRAY['offtake','MD','policy'],ARRAY['MD']),

('IRS releases updated IRA Section 48E guidance — community solar ITC adder eligibility clarified',
 'IRS / Treasury','https://www.irs.gov/credits-deductions/businesses/energy-incentives','2026-03-05','offtake','market-update',
 'IRS released Notice 2026-12 clarifying community solar project eligibility for the Energy Community and Low-Income Community ITC adders under IRA Section 48E. Most projects under 5MW AC qualify.',
 ARRAY['offtake','policy','multi-state','IRA'],ARRAY[]::text[]),

('Connecticut SCEF program adds 50MW tranche — applications accepted starting April 20',
 'CT DEEP / PURA','https://portal.ct.gov/DEEP','2026-03-01','offtake','policy-alert',
 'PURA approved a new 50MW SCEF program tranche for 2026 with updated compensation tariffs. Projects must be under 2MW. LMI requirement: 20%.',
 ARRAY['offtake','CT','policy'],ARRAY['CT']),

('PJM publishes 2025 RTEP results — significant new transmission capacity in MD, VA, NJ corridors',
 'PJM Interconnection','https://www.pjm.com/','2026-02-20','ix','market-update',
 'PJM''s Regional Transmission Expansion Plan identifies 4.2GW of new transmission additions through 2030. Developers in MD, VA, and NJ may see reduced upgrade costs in the next round of interconnection studies.',
 ARRAY['ix','MD','VA','NJ','PA','policy'],ARRAY['MD','VA','NJ']),

('Oregon PUC approves CS program expansion — capacity increases to 200MW for 2026-2027 cycle',
 'Oregon PUC','https://www.oregon.gov/puc/','2026-02-15','offtake','market-update',
 'The PUC expanded the Oregon CS program from 100MW to 200MW for the 2026-2027 program cycle, citing strong subscriber demand and grid reliability co-benefits.',
 ARRAY['offtake','OR','policy'],ARRAY['OR']),

('EPA updates National Wetlands Inventory data for 11 Midwest states — site screening implications',
 'EPA / USFWS','https://www.fws.gov/program/national-wetlands-inventory','2026-02-10','site','policy-alert',
 'USFWS completed the 2025 NWI update for IL, MN, IA, IN, OH, MI, MO, WI, ND, SD, NE. Developers should re-screen site candidates in these states against the updated wetland boundaries.',
 ARRAY['site','policy','multi-state'],ARRAY['IL','MN','IA','IN','OH','MI','MO','WI','ND','SD','NE']);
