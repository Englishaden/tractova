import { computeSubScores } from './scoreEngine'
import { computeRevenueProjection, hasRevenueData } from './revenueEngine'
import { GLOSSARY_DEFINITIONS } from './glossaryDefinitions'
import { getAlerts } from './alertHelpers'
import { IX_LABEL } from './statusMaps.js'

/**
 * Builds the row array for the Library xlsx export. Each row maps a
 * saved project to flat columns suitable for Excel — sub-scores,
 * revenue projection, alert flags, lineage timestamps.
 *
 * @param {Array<object>} projects — saved project rows
 * @param {object} stateProgramMap — keyed by state id
 * @param {object} [countyDataMap] — keyed by county_fips
 * @returns {Array<object>}
 */
export function buildExportRows(projects, stateProgramMap, countyDataMap = {}) {
  // CS_LABEL is export-specific — uses 'None' instead of the canonical
  // 'Closed' from statusMaps.js (export workbook readability convention).
  const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
  return projects.map(p => {
    const sp = stateProgramMap[p.state] || {}
    const cd = countyDataMap[`${p.state}::${p.county}`] || null
    let revPerMWperYear = ''
    try {
      const mwNum = parseFloat(p.mw) || 0
      if (mwNum > 0 && p.technology === 'Community Solar' && hasRevenueData(p.state)) {
        const proj = computeRevenueProjection(p.state, mwNum)
        if (proj?.year1Revenue) revPerMWperYear = Math.round(proj.year1Revenue / mwNum)
      }
    } catch {}
    const alerts = getAlerts(p, stateProgramMap, countyDataMap).map(a => a.label || a.message || '').filter(Boolean).join('; ')
    const ixNotes = (sp.ixNotes || '').replace(/\s+/g, ' ').slice(0, 200)
    // Sub-scores: same engine the Lens result panel uses, so export numbers
    // are guaranteed to match what the user saw in the app. countyData is
    // best-effort — geospatial cells stay blank for cards never expanded.
    const subs = sp.id ? computeSubScores(sp, cd, p.stage, p.technology) : null
    const wetlandPct = cd?.geospatial?.wetlandCoveragePct
    const farmlandPct = cd?.geospatial?.primeFarmlandPct
    return [
      // Identity
      p.name,
      p.stateName || p.state,
      p.county,
      p.mw ? Number(p.mw) : '',
      p.technology || '',
      p.stage || '',
      // Scores
      p.feasibilityScore ?? '',
      subs && typeof subs.offtake === 'number' ? subs.offtake : '',
      subs && typeof subs.ix === 'number' ? subs.ix : '',
      subs && typeof subs.site === 'number' ? subs.site : '',
      // Program
      CS_LABEL[p.csStatus] || p.csStatus || '',
      p.csProgram || '',
      sp.capacityMW ?? '',
      sp.lmiRequired ? sp.lmiPercent : '',
      sp.runway?.months ?? '',
      // IX
      IX_LABEL[sp.ixDifficulty] || sp.ixDifficulty || '',
      ixNotes,
      // Site — wetland % capped at 100 (NWI overlap can push raw values
      // above 100; the wetland_category bucket is the cleaner signal).
      typeof wetlandPct === 'number' ? Math.round(Math.min(100, wetlandPct) * 10) / 10 : '',
      typeof farmlandPct === 'number' ? Math.round(farmlandPct * 10) / 10 : '',
      // Operations
      p.servingUtility || '',
      revPerMWperYear,
      // Meta
      alerts,
      p.savedAt ? new Date(p.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '',
    ]
  })
}

// ── Methodology + sources sheet ──────────────────────────────────────────────
// Static reference table mapping each scoring pillar to its underlying data
// sources. URLs render as clickable hyperlinks in Excel via cell.l targets.
// When sources change, update this constant — the exported workbook stays
// synced because nothing else in the codebase needs to know about it.
const METHODOLOGY_ROWS = [
  ['Composite (Feasibility Index)', 'Tractova scoreEngine', 'https://www.tractova.com/glossary#feasibility-index', 'Weighted blend: Offtake 40% + IX 35% + Site 25%; per-pillar stage modifiers'],
  ['Offtake — CS programs (50 states)', 'DSIRE — Database of State Incentives', 'https://www.dsireusa.org', 'Program status, capacity remaining, LMI carveout, REC pricing'],
  ['Offtake — REC pricing', 'State regulatory program filings', 'https://www.dsireusa.org', 'Illinois Shines, NJ SREC, MA SMART, MD CS, NY VDER'],
  ['Offtake — C&I (32 states)', 'EIA Form 861 — Commercial Retail Rates', 'https://www.eia.gov/electricity/sales_revenue_price/', 'Calibrated against 2024 commercial retail rates plus market-depth qualitative weights'],
  ['Offtake — BESS (25 states)', 'ISO/RTO capacity-market clearing prices', 'https://www.iso-ne.com/markets-operations/markets/forward-capacity-market', '2024-2025 cycle; CAISO/ERCOT/PJM/NYISO/MISO/ISO-NE'],
  ['IX — NYISO live', 'NYISO Interconnection Queue', 'https://www.nyiso.com/interconnections', 'Live xlsx feed parsed weekly'],
  ['IX — PJM (queue stale)', 'PJM Data Miner 2', 'https://dataminer2.pjm.com/', 'Redistribution-restricted; Tractova may show stale signals only'],
  ['IX — CAISO/ISO-NE/MISO/ERCOT', 'Curated baseline', 'https://www.tractova.com/glossary#ix', 'stateProgram.ixDifficulty enum (easy/moderate/hard/very_hard)'],
  ['Site — Wetlands', 'USFWS National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory', 'County wetland-richness index (overlapping NWI classifications, may exceed 100%); ≥15% triggers wetland warning + Section 404 flag'],
  ['Site — Prime Farmland', 'USDA SSURGO via Soil Data Access', 'https://sdmdataaccess.sc.egov.usda.gov/', 'County prime farmland %; ≥25% flags FPPA conversion-review exposure'],
  ['ITC adders — Energy Community', 'DOE NETL Energy Communities Data Layers', 'https://edx.netl.doe.gov/dataset/energy-communities-data-layers', '+10% bonus eligibility (closed coal / brownfield / fossil-employment tracts)'],
  ['ITC adders — §48(e) Cat 1 LIC', 'HUD QCT/DDA dataset', 'https://www.huduser.gov/portal/datasets/qct.html', '+10% Low-Income Communities adder eligibility'],
  ['ITC adders — NMTC LIC', 'CDFI Fund New Markets Tax Credit', 'https://www.cdfifund.gov/programs-training/programs/new-markets-tax-credit', 'Census-tract LIC eligibility for stacking adders'],
  ['Capacity Factor', 'NREL PVWatts API v8', 'https://pvwatts.nrel.gov/', 'State-level fixed-tilt baseline; refreshed quarterly'],
  ['Demographics — LMI / AMI', 'Census ACS 5-Year Estimates', 'https://www.census.gov/programs-surveys/acs', 'County LMI %, AMI bands for CS subscriber-eligibility math'],
]

/**
 * Companion sheet appended to the xlsx export — explains the scoring
 * methodology + tier framework + IX live-blend semantics.
 *
 * @param {object} XLSX — lazy-loaded xlsx package
 * @returns {object} XLSX worksheet
 */
export function buildMethodologySheet(XLSX) {
  const header = ['Pillar / Component', 'Source', 'URL', 'Notes']
  const ws = XLSX.utils.aoa_to_sheet([header, ...METHODOLOGY_ROWS])
  ws['!cols'] = [{ wch: 32 }, { wch: 36 }, { wch: 56 }, { wch: 60 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  // Wire URL column (C) as clickable hyperlinks. SheetJS hyperlink format:
  // cell.l = { Target: 'https://...', Tooltip: '...' }
  for (let r = 0; r < METHODOLOGY_ROWS.length; r++) {
    const cellAddr = `C${r + 2}`
    const cell = ws[cellAddr]
    const url = METHODOLOGY_ROWS[r][2]
    if (cell && url) cell.l = { Target: url, Tooltip: 'Open in browser' }
  }
  return ws
}

// ── Glossary sheet ───────────────────────────────────────────────────────────
// Pulls from the same canonical source the in-app Glossary page uses. Three
// columns: Term, Short definition, Long definition. Long defs run wide so
// users can read them without clicking through to the app.
/**
 * Companion sheet — glossary of every Tractova-defined term referenced
 * elsewhere in the workbook (Tier A/B/C, Feasibility Index, etc.).
 *
 * @param {object} XLSX — lazy-loaded xlsx package
 * @returns {object} XLSX worksheet
 */
export function buildGlossarySheet(XLSX) {
  const header = ['Term', 'Definition', 'Detail']
  const rows = Object.values(GLOSSARY_DEFINITIONS).map(g => [g.title, g.short, g.long])
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 100 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  // Word-wrap detail column so long defs stay readable without horizontal scroll.
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws[`C${r}`]
    if (cell) cell.s = { alignment: { wrapText: true, vertical: 'top' } }
  }
  return ws
}
