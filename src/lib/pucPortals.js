// V3 Wave 2 — PUC e-filing portal directory.
//
// Centralized lookup of state-code -> PUC portal metadata so the
// RegulatoryActivityPanel + Admin tab can deep-link users into each
// state's e-filing system. Tractova-curated docket coverage is
// intentionally selective (key proceedings only); the deep-link buttons
// are the user's escape hatch to the comprehensive long tail.
//
// URLs are PUBLIC e-filing landing pages -- not session-bound. If a
// state's URL changes, update here; both panel and admin surfaces
// inherit. Only the 8 core CS states + a few likely-Tier-2 expansion
// candidates are seeded here for now; everything else falls back to
// the NARUC member directory which lets users find their state PUC.

export const PUC_PORTALS = {
  // ── 8 core CS-deep states (Tier 1 coverage) ─────────────────────────────
  IL: { name: 'Illinois Commerce Commission',          url: 'https://www.icc.illinois.gov/docket',                                              searchHint: 'community solar' },
  NY: { name: 'New York Public Service Commission',    url: 'https://documents.dps.ny.gov/public/MatterManagement/CaseSearch.aspx',             searchHint: 'community DG' },
  MA: { name: 'Massachusetts DPU',                     url: 'https://eeaonline.eea.state.ma.us/dpu/fileroom/dockets/',                          searchHint: 'SMART' },
  MN: { name: 'Minnesota PUC',                         url: 'https://www.edockets.state.mn.us/',                                                searchHint: 'community solar garden' },
  CO: { name: 'Colorado PUC',                          url: 'https://www.dora.colorado.gov/puc-edocket',                                        searchHint: 'community solar' },
  NJ: { name: 'New Jersey BPU',                        url: 'https://www.bpu.state.nj.us/',                                                     searchHint: 'SuSI' },
  ME: { name: 'Maine PUC',                             url: 'https://mpuc-cms.maine.gov/CQM.Public.WebUI/',                                     searchHint: 'NEB' },
  MD: { name: 'Maryland PSC',                          url: 'https://www.psc.state.md.us/search-results/',                                      searchHint: 'community solar' },

  // ── Tier 2 / mid-coverage states with active CS or DER markets ──────────
  CA: { name: 'California PUC',                        url: 'https://apps.cpuc.ca.gov/apex/f?p=401:1:0',                                         searchHint: 'distributed generation' },
  TX: { name: 'Texas PUC',                             url: 'https://interchange.puc.texas.gov/',                                               searchHint: 'distributed generation' },
  AZ: { name: 'Arizona Corporation Commission',        url: 'https://docket.azcc.gov/',                                                         searchHint: 'community solar' },
  NC: { name: 'North Carolina Utilities Commission',   url: 'https://starw1.ncuc.gov/NCUC/Default.aspx',                                        searchHint: 'community solar' },
  OR: { name: 'Oregon PUC',                            url: 'https://apps.puc.state.or.us/edockets/',                                           searchHint: 'community solar' },
  VA: { name: 'Virginia SCC',                          url: 'https://scc.virginia.gov/Casefiles',                                               searchHint: 'shared solar' },
  NV: { name: 'Nevada PUC',                            url: 'https://www.puc.nv.gov/Filing/',                                                   searchHint: 'distributed generation' },
  FL: { name: 'Florida PSC',                           url: 'https://www.floridapsc.com/Pages/CIS/CISMain.aspx',                                searchHint: 'solar' },
  OH: { name: 'Ohio PUC',                              url: 'https://dis.puc.state.oh.us/',                                                     searchHint: 'community solar' },
  PA: { name: 'Pennsylvania PUC',                      url: 'https://www.puc.pa.gov/about-the-puc/case-filings/',                               searchHint: 'community solar' },
}

// Generic fallback for states without a curated portal entry. NARUC's
// member directory has links to every state PUC; users land there and
// click through to their state.
export const NARUC_MEMBER_DIRECTORY = 'https://www.naruc.org/about-naruc/regulatory-commissions/'

export function getPucPortal(stateCode) {
  if (!stateCode) return { name: 'state PUC', url: NARUC_MEMBER_DIRECTORY, searchHint: '' }
  return PUC_PORTALS[stateCode.toUpperCase()] || { name: 'state PUC', url: NARUC_MEMBER_DIRECTORY, searchHint: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparable-deal data sources -- state-agnostic. Surfaced as a unified
// pair on the ComparableDealsPanel empty-state + populated-list footer
// so users can drill into the underlying federal datasets when they want
// the long tail beyond Tractova's curated highlights.
// ─────────────────────────────────────────────────────────────────────────────
export const COMPARABLE_DEAL_SOURCES = [
  {
    name: 'FERC Form 1',
    url:  'https://www.ferc.gov/general-information-1/electric-industry-forms/form-1-electric-utility-annual',
    desc: 'Utility annual reports incl. interconnection agreements',
  },
  {
    name: 'EIA Form 860',
    url:  'https://www.eia.gov/electricity/data/eia860/',
    desc: 'Generator-level capacity, ownership, COD data',
  },
]
