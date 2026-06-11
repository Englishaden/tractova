import { scoreSavedProject } from './scoreEngine'
import { GLOSSARY_DEFINITIONS } from './glossaryDefinitions'
import { getAlerts } from './alertHelpers'
import { IX_LABEL } from './statusMaps.js'
import { methodologySheetRows, METHODOLOGY_DISCLOSURE } from './dataSources.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : ''

// CSV/spreadsheet formula-injection guard (audit F-44). A cell whose text
// begins with = + - @ or a tab/CR is executed as a formula when the workbook
// is opened in Excel/Sheets/LibreOffice. Most export fields are the user's own
// project data, but `ixNotes` comes from the shared state_programs table
// (admin/scraper-sourced), so one poisoned upstream value would ride into every
// user's export for that state. Prefix-quoting (the standard guard) neutralizes
// the formula while keeping a legitimate leading "-"/"+" readable.
export const sanitizeCell = (v) =>
  (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) ? `'${v}` : v

/**
 * Builds the row array for the Library xlsx export. Each row maps a
 * saved project to flat columns suitable for Excel — the live 5-pillar
 * composite + sub-scores, alert flags, lineage timestamps.
 *
 * @param {Array<object>} projects — saved project rows (normalized)
 * @param {object} stateProgramMap — keyed by state id
 * @param {object} [countyDataMap] — keyed by `${state}::${county}`
 * @param {object} [incentivesMap] — keyed by `${state}::${county}` → ITC eligibility
 * @param {object} [policyEventsMap] — keyed by state → policy events[]
 * @returns {Array<object>}
 */
export function buildExportRows(projects, stateProgramMap, countyDataMap = {}, incentivesMap = {}, policyEventsMap = {}) {
  // CS_LABEL is export-specific — uses 'None' instead of the canonical
  // 'Closed' from statusMaps.js (export workbook readability convention).
  const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
  return projects.map(p => {
    const sp = stateProgramMap[p.state] || {}
    const cd = countyDataMap[`${p.state}::${p.county}`] || null
    const alerts = getAlerts(p, stateProgramMap, countyDataMap, incentivesMap, policyEventsMap).map(a => a.label || a.message || '').filter(Boolean).join('; ')
    const ixNotes = (sp.ixNotes || '').replace(/\s+/g, ' ').slice(0, 200)
    // Canonical 5-pillar score via the same helper the Library cards + Lens use,
    // so export numbers match the in-app values exactly (composite is the LIVE
    // recompute, not the at-save snapshot). countyData / incentives / policy are
    // best-effort — a pillar with no coverage row stays blank (rebalanced out of
    // the composite) rather than printing a fabricated 0.
    const key = `${p.state}::${p.county}`
    const { subs, score } = sp.id
      ? scoreSavedProject(p, sp, cd, { incentives: incentivesMap[key] || null, policyEvents: policyEventsMap[p.state] || null })
      : { subs: null, score: null }
    const wetlandPct = cd?.geospatial?.wetlandCoveragePct
    const farmlandPct = cd?.geospatial?.primeFarmlandPct
    return [
      // Identity — string fields sanitizeCell'd against formula injection (F-44)
      sanitizeCell(p.name),
      sanitizeCell(p.stateName || p.state),
      sanitizeCell(p.county),
      p.mw ? Number(p.mw) : '',
      sanitizeCell(p.technology || ''),
      sanitizeCell(p.stage || ''),
      // Scores — live composite + 5 sub-scores
      num(score),
      subs ? num(subs.offtake) : '',
      subs ? num(subs.ix) : '',
      subs ? num(subs.site) : '',
      subs ? num(subs.incentives) : '',
      subs ? num(subs.policyTiming) : '',
      // Program
      sanitizeCell(CS_LABEL[p.csStatus] || p.csStatus || ''),
      sanitizeCell(p.csProgram || ''),
      sp.capacityMW ?? '',
      sp.lmiRequired ? sp.lmiPercent : '',
      sp.runway?.months ?? '',
      // IX
      sanitizeCell(IX_LABEL[sp.ixDifficulty] || sp.ixDifficulty || ''),
      sanitizeCell(ixNotes),
      // Site — wetland % capped at 100 (NWI overlap can push raw values
      // above 100; the wetland_category bucket is the cleaner signal).
      typeof wetlandPct === 'number' ? Math.round(Math.min(100, wetlandPct) * 10) / 10 : '',
      typeof farmlandPct === 'number' ? Math.round(farmlandPct * 10) / 10 : '',
      // Operations
      sanitizeCell(p.servingUtility || ''),
      // Meta
      sanitizeCell(alerts),
      p.savedAt ? new Date(p.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '',
    ]
  })
}

/**
 * Companion sheet appended to the xlsx export — the pillar→source→URL citation
 * map. Rows come from the shared src/lib/dataSources.js registry (the SAME
 * source the public /methodology page renders), so the sheet and the page can
 * never drift. A standing disclosure note leads the sheet.
 *
 * @param {object} XLSX — lazy-loaded xlsx package
 * @returns {object} XLSX worksheet
 */
export function buildMethodologySheet(XLSX) {
  const header = ['Pillar / Component', 'Source', 'URL', 'Notes']
  const rows = methodologySheetRows()
  // Lead disclosure row spans the Notes column; a blank spacer row separates it
  // from the table so the header still reads as the column titles.
  const disclosure = ['Methodology', '', '', METHODOLOGY_DISCLOSURE]
  const ws = XLSX.utils.aoa_to_sheet([disclosure, [], header, ...rows])
  ws['!cols'] = [{ wch: 40 }, { wch: 44 }, { wch: 56 }, { wch: 90 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 3 }
  // Wire URL column (C) as clickable hyperlinks. The table starts at sheet row 4
  // (1 disclosure + 1 spacer + 1 header), so data row r maps to cell C{r+4}.
  for (let r = 0; r < rows.length; r++) {
    const cell = ws[`C${r + 4}`]
    const url = rows[r][2]
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
