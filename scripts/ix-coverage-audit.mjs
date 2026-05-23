/**
 * IX coverage audit — the auditable answer to "have we covered all bases?"
 *
 * WHY THIS EXISTS: "I looked and didn't find more" is unfalsifiable. This script
 * replaces that assertion with a re-runnable artifact. It declares our CURRENT
 * IX-data coverage at the right grain — state × utility × source-TYPE — and then
 * LIVE-PROBES every cell we claim is live, so you can verify two things yourself:
 *   1. ACCURATE  — the endpoint still returns data (prints the live count/status).
 *   2. COMPLETE  — every gap is a visible cell (status 'unchecked' / 'none'),
 *                  not hidden behind a green "done."
 *
 * Source TYPES tracked per utility:
 *   - queue  : distribution interconnection QUEUE (the real CS layer — project list)
 *   - hc     : hosting-capacity / ICA grid-headroom feed
 * (NYSERDA's program-deployment dataset is treated as the NY 'queue' source.)
 *
 * STATUS values (honest taxonomy):
 *   - live      : wired into a scraper + probed-working here
 *   - candidate : a real, fetchable source FOUND (by the 2026-05-23 independent
 *                 3-agent sweep) but NOT yet wired — the queue of work to do
 *   - blocked   : a source exists but is unusable (gated / login / license forbids
 *                 redistribution / wrong-scale field) — reason recorded
 *   - none      : no public source found for this utility+type (corroborated)
 *   - unchecked : we have NOT verified this cell yet (e.g. a utility we only
 *                 covered via the OTHER source type) — these are the real holes
 *
 * LICENSE prong (added 2026-05-23): all three independent agents flagged that
 * almost every UTILITY ArcGIS hosting-capacity feed carries an "unknown / viewer-
 * only" license, while government files (NY Open-NY, MD MEA, ME PUC, FERC OASIS)
 * have clear public-reuse footing. `license` field: 'open' | 'gov' | 'unknown' |
 * 'prohibited'. This is a SEPARATE audit axis from accurate/live — a feed can be
 * live + accurate but legally unsafe to redistribute commercially.
 *
 * Usage:
 *   node scripts/ix-coverage-audit.mjs            # probe + print matrix
 *   node scripts/ix-coverage-audit.mjs --write    # also (re)write docs/ix-coverage-matrix.md
 *   node scripts/ix-coverage-audit.mjs --no-probe # registry only, skip network
 *
 * Re-run it any time. Spot-check any 'live' URL by hand. Challenge the enumeration
 * itself — if a utility or source type is missing from REGISTRY below, that is a
 * miss, and it should be added. See [[project_ix_distribution_data]].
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WRITE = process.argv.includes('--write')
const NO_PROBE = process.argv.includes('--no-probe')

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — every CS state, its distribution utilities, and each source type's
// status + evidence. This is the declarative claim. The prober tests it. If a
// utility is missing here, that's a coverage gap to add (not a silent pass).
// ─────────────────────────────────────────────────────────────────────────────
const UA = { 'User-Agent': 'Tractova IX coverage audit (+https://tractova.com)' }

// helper to keep entries terse
const E = (state, utility, type, status, opts = {}) => ({ state, utility, type, status, ...opts })

const REGISTRY = [
  // ── NY — queue via NYSERDA (covers all IOUs statewide), HC per IOU ──────────
  E('NY', 'All IOUs (NYSERDA CDG)', 'queue', 'live', { dataSource: 'nyserda_cdg', probe: 'socrata', license: 'open',
    url: 'https://data.ny.gov/resource/3x8r-34rs.json', soda: "community_distributed_generation='Yes'" }),
  E('NY', 'Con Edison', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services.arcgis.com/ciPnsNFi1JLWVjva/arcgis/rest/services/CECONY_NodalHCV_Prod/FeatureServer/0' }),
  E('NY', 'National Grid', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/NYSDP/Hosting_Capacity_Data/MapServer/0' }),
  E('NY', 'Orange & Rockland', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services.arcgis.com/ciPnsNFi1JLWVjva/arcgis/rest/services/ORU_NodalHCV_Prod/FeatureServer/0' }),
  E('NY', 'Central Hudson', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services1.arcgis.com/CEN9MBRF2dIzEmKF/arcgis/rest/services/Hosting_Capacity_Stage3/FeatureServer/0' }),
  E('NY', 'NYSEG / RG&E', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services.arcgis.com/c0HK6TaWF3mGiNhc/arcgis/rest/services/HostingCapacity_DCirc_NYSEG_RGE/FeatureServer/0' }),

  // ── NJ — 4 EDCs. Only JCP&L wired. The other 3 are KNOWN HOLES. ─────────────
  E('NJ', 'JCP&L', 'queue', 'live', { dataSource: 'nj_ic_queue', probe: 'http', license: 'gov',
    url: 'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx' }),
  E('NJ', 'PSE&G', 'queue', 'live', { dataSource: 'nj_ic_queue', probe: 'http', license: 'gov',
    url: 'https://nj.pseg.com/-/media/pseg/public-site/documents/pseg-queue-inventory.ashx',
    reason: 'WIRED 2026-05-23: 129 CS / 276 MW. BPU QO21010085 monthly queue.' }),
  E('NJ', 'Rockland Electric (RECO)', 'queue', 'live', { dataSource: 'nj_ic_queue', probe: 'http', license: 'gov',
    url: 'https://cdnc-dcxprod2-sitecore.azureedge.net/-/media/files/oru/documents/saveenergyandmoney/using-private-generation-energy-sources/applying-for-private-generation-interconnection-in-new-jersey/interconnection-queue.xlsx?rev=5d8a63aa5321456f86bb8159eb75aead',
    reason: 'WIRED 2026-05-23: feed live but 0 CS in queue now — auto-appears when CS>0 (separate Yes/No layout handled).' }),
  E('NJ', 'Atlantic City Electric', 'queue', 'candidate', { license: 'gov',
    reason: 'BPU-mandated monthly queue exists, but file link is JS-rendered on atlanticcityelectric.com — needs a headless browser to isolate the URL.' }),
  E('NJ', 'Atlantic City Electric', 'hc', 'blocked', { reason: 'PHI feed Feeder_Large_Gen_HC kW capped at 3MW (murky)' }),

  // ── VA — Dominion queue wired; Appalachian unchecked ────────────────────────
  E('VA', 'Dominion', 'queue', 'live', { dataSource: 'va_dominion_queue', probe: 'http',
    url: 'https://cdn-dominionenergy-prd-001.azureedge.net/-/media/content/large-business-services/files/dominion-energy-virginia-queue-status-report.xlsx' }),
  E('VA', 'Dominion', 'hc', 'blocked', { reason: 'ICA layer only bucketed LIMIT_VAL integer codes, not real MW' }),
  E('VA', 'Appalachian Power', 'queue', 'none', { reason: 'CONFIRMED (agent): PowerClerk app only, no public queue/HC map, absent from DOE Atlas' }),

  // ── WI — Alliant queue wired; other utilities unchecked ─────────────────────
  E('WI', 'Alliant Energy', 'queue', 'live', { dataSource: 'wi_alliant_queue', probe: 'http',
    url: 'https://www.alliantenergy.com/-/media/alliant/documents/ourenergy/customerinterconnection/dg-interconnection-queue.csv?sc_lang=en' }),
  E('WI', 'We Energies', 'queue', 'unchecked', { reason: 'WEC Energy — not verified' }),
  E('WI', 'Madison Gas & Electric', 'queue', 'unchecked', { reason: 'Not verified' }),
  E('WI', 'Xcel (NSPW)', 'queue', 'unchecked', { reason: 'Not verified' }),

  // ── MD — BGE HC wired; queue + PHI unchecked/blocked ────────────────────────
  E('MD', 'BGE', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services3.arcgis.com/agWTKEK7X5K1Bx7o/arcgis/rest/services/BGE_HOSTING_CAPACITY_EPRI_AGOL/FeatureServer/1' }),
  E('MD', 'BGE', 'queue', 'unchecked', { reason: 'CSEGS queue — not verified as a downloadable feed' }),
  E('MD', 'State (MEA)', 'queue', 'candidate', { license: 'gov',
    url: 'https://energy.maryland.gov/Pages/MarylandCommunitySolar.aspx',
    reason: 'MEA Community Solar project list (Excel, quarterly, ~139 projects/204MW by utility) — gov-public CS DEPLOYMENT signal (agent-confirmed). File URL embedded on page — needs extraction.' }),
  E('MD', 'Pepco', 'hc', 'blocked', { reason: 'PHI kW capped 3MW' }),
  E('MD', 'Delmarva', 'hc', 'blocked', { reason: 'PHI kW capped 3MW' }),

  // ── PA (bonus, not a CS state) — PECO HC wired ──────────────────────────────
  E('PA', 'PECO', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis', note: 'PA is not a CS state — bonus coverage',
    url: 'https://services3.arcgis.com/agWTKEK7X5K1Bx7o/arcgis/rest/services/PECO_Available_Distribution_Capacity_Map/FeatureServer/0' }),

  // ── MA — National Grid HC wired; Eversource + queue unchecked ───────────────
  E('MA', 'National Grid', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/MASDP/MASDP_HostingCapacity/MapServer/0' }),
  E('MA', 'Eversource', 'hc', 'unchecked', { reason: 'Not verified' }),
  E('MA', 'All EDCs (DOER)', 'queue', 'blocked', { reason: 'MA DOER interconnection queue is JS/Salesforce-gated' }),

  // ── CT — Eversource HC wired; UI blocked; queue unchecked ───────────────────
  E('CT', 'Eversource', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://epochprodgasdist.eversource.com/wamgasgis/rest/services/EV_Hosting/EV_HC_Capacity_CT/MapServer/0' }),
  E('CT', 'United Illuminating', 'hc', 'blocked', { reason: 'Only SYMBOLCOLOR, no MW field' }),
  E('CT', 'Eversource / UI', 'queue', 'unchecked', { reason: 'PURA docket queue — not verified' }),

  // ── ME — CMP HC wired; Versant blocked; queue unchecked ─────────────────────
  E('ME', 'Central Maine Power', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services.arcgis.com/c0HK6TaWF3mGiNhc/arcgis/rest/services/CMP_Hosting_Capacity/FeatureServer/0' }),
  E('ME', 'Versant', 'hc', 'blocked', { reason: 'SaaS portal, no open feed' }),
  E('ME', 'Central Maine Power', 'queue', 'candidate', { license: 'unknown',
    url: 'https://www.cmpco.com/documents/d/cmp/chapter-324-level-4-public-queue',
    reason: 'CMP "Chapter 324 Level 4 Public Queue" — URL found, but the CDN endpoint TIMES OUT on server fetch (90s) — gated/slow, needs a browser or manual download.' }),
  E('ME', 'Versant', 'queue', 'none', { reason: 'CONFIRMED (agent): queue lives in ME PUC filings only, no clean public file' }),

  // ── RI — RI Energy HC wired; queue unchecked ────────────────────────────────
  E('RI', 'Rhode Island Energy', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/RISDP/Hosting_Capacity_All/MapServer/0' }),
  E('RI', 'Rhode Island Energy', 'queue', 'unchecked', { reason: 'Not verified' }),

  // ── CO — Xcel HC wired; queue unchecked ─────────────────────────────────────
  E('CO', 'Xcel Energy', 'hc', 'blocked', {
    reason: 'DEMOTED 2026-05-23: CO PUC publicly called Xcel grid/HC data "totally useless" — removed from FEEDS + DB row deleted. CO now on curated baseline.' }),
  E('CO', 'Xcel Energy', 'queue', 'candidate', { license: 'unknown',
    reason: 'Xcel "Public DER Queue" — monthly downloadable Excel exists (agent-confirmed); license viewer-only' }),

  // ── MN — Xcel HC wired; queue unchecked ─────────────────────────────────────
  E('MN', 'Xcel Energy', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services1.arcgis.com/eM84fwjsSggLQk61/arcgis/rest/services/NSPM_may2025_popUps/FeatureServer/3' }),
  E('MN', 'Xcel Energy', 'queue', 'candidate', { license: 'unknown',
    url: 'https://mn.my.xcelenergy.com/s/renewable/developers/interconnection',
    reason: 'Xcel "Public DER Queue" Excel exists, but it is served behind a Salesforce Experience Cloud portal (mn.my.xcelenergy.com/s) — JS-gated, needs a browser to reach the file.' }),

  // ── MI — AEP I&M HC wired; DTE/Consumers blocked; queue unchecked ───────────
  E('MI', 'Indiana Michigan Power', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services.arcgis.com/ZnwBsu4Q8SvSAofV/arcgis/rest/services/PROD_MI_HC_GRID/FeatureServer/0' }),
  E('MI', 'DTE', 'hc', 'blocked', { reason: 'Hosting__1 field caps at 1MW' }),
  E('MI', 'Consumers Energy', 'hc', 'unchecked', { reason: 'Not verified' }),
  E('MI', 'DTE / Consumers', 'queue', 'unchecked', { reason: 'Not verified' }),

  // ── CA — SCE + PG&E HC wired; SDG&E unchecked; queue blocked ────────────────
  E('CA', 'SCE', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://drpep.sce.com/arcgis_server/rest/services/hosted/ica_layer/FeatureServer/2' }),
  E('CA', 'PG&E', 'hc', 'live', { dataSource: 'arcgis_hc', probe: 'arcgis',
    url: 'https://services2.arcgis.com/mJaJSax0KPHoCNB6/ArcGIS/rest/services/DRPComplianceRelProd/FeatureServer/3' }),
  E('CA', 'PG&E', 'queue', 'live', { dataSource: 'ca_pge_queue', probe: 'http', license: 'unknown',
    url: 'https://www.pge.com/assets/pge/docs/about/doing-business-with-pge/PublicQueueInterconnection.xlsx',
    reason: 'WIRED 2026-05-23: 852 solar pipeline / 2247 MW + 402 energized (sub-50MW distribution). Not CS-specific (CA has no formal CS program).' }),
  E('CA', 'SDG&E', 'hc', 'none', { reason: 'CONFIRMED (agent): interactive map only, no machine-readable REST/CSV export' }),
  E('CA', 'IOUs (californiadgstats)', 'queue', 'blocked', { license: 'prohibited',
    reason: 'CONFIRMED (agent): californiadgstats terms EXPLICITLY prohibit extraction/redistribution beyond NEM program (view-only)' }),

  // ── Blocked CS states — no open redistribution-safe feed (either type) ───────
  E('IL', 'ComEd', 'hc', 'blocked', { reason: 'HC ArcGIS service token-gated' }),
  E('IL', 'ComEd', 'queue', 'blocked', { reason: 'Queue map-only; Illinois Shines forbids commercial redistribution' }),
  E('IL', 'Ameren IL', 'hc', 'blocked', { reason: 'Text/multi-value MAXGENMW_TXT field, 1.67M cells — cannot stat/CAST' }),
  E('IL', 'Ameren IL', 'queue', 'unchecked', { reason: 'Not verified as a clean feed' }),
  E('FL', 'FPL / Duke / TECO', 'hc', 'none', { reason: 'CONFIRMED (agent): zero FL utilities in DOE Atlas, no HC/ICA maps' }),
  E('FL', 'FPL / Duke / TECO', 'queue', 'none', { reason: 'CONFIRMED (agent): no downloadable queue; only annual FPSC Rule 25-6.065(10) net-metering PDFs (small DG, not CS)' }),
  E('HI', 'Hawaiian Electric', 'hc', 'blocked', { reason: 'Locational Value Maps — nightly web map + address tool, no bulk export' }),
  E('HI', 'Hawaiian Electric', 'queue', 'candidate', { license: 'unknown',
    url: 'https://www.hawaiianelectric.com/clean-energy-hawaii/integration-tools-and-resources/integrated-interconnection-queue',
    reason: 'Integrated Interconnection Queue (IIQ) — Oahu/Maui/Hawaii Island, monthly, circuit-level, ~11,698 PV requests (agent high-conf). Web table — bulk CSV/XLSX export UNCONFIRMED.' }),
  E('NM', 'PNM / El Paso Electric', 'hc', 'none', { reason: 'CONFIRMED (agent): PNM CartoVista is TRANSMISSION POI only; El Paso procedures-only; no distribution HC' }),
  E('NM', 'PNM / El Paso Electric', 'queue', 'none', { reason: 'CONFIRMED (agent): PNM OATI OASIS is TRANSMISSION queue (no CS); El Paso none' }),
  E('OR', 'Portland General / PacifiCorp / Idaho Power', 'queue', 'candidate', { license: 'unknown',
    url: 'https://www.oregoncsp.org/interconnection/',
    reason: 'MISS — all 3 OR IOUs publish DEDICATED Community Solar queues via OATI OASIS (agent high-conf). Most CS-targeted of any state. OASIS web tables — bulk export-ability UNCONFIRMED.' }),
  E('OR', 'Portland General / PacifiCorp', 'hc', 'candidate', { license: 'unknown',
    reason: 'PGE DG Evaluation map + PacifiCorp DG map (DOE Atlas) — ArcGIS, REST endpoint not yet isolated' }),
  E('WA', 'Avista', 'hc', 'candidate', { license: 'unknown',
    url: 'https://experience.arcgis.com/experience/955db80ba1124479a906c0a6edefe1cc/page/Distributed-Energy-Resource-Hosting-Capacity',
    reason: 'RE-CHECK: agent found a feeder-level DER Hosting Capacity Experience Builder app — DIFFERENT from the GEN_MAX_KW 50kW layer I rejected. REST endpoint needs extraction.' }),
  E('WA', 'Puget Sound Energy', 'hc', 'blocked', { reason: 'CONFIRMED (agent): DER+Load maps email-request only, not openly published' }),
  E('WA', 'Avista / PSE', 'queue', 'none', { reason: 'CONFIRMED (agent): no downloadable distribution queue from either IOU' }),
]

// The canonical 19 CS states (cs_status != 'none') — for the completeness check.
const CS_STATES = ['NY','NJ','VA','WI','MD','MA','CT','RI','ME','CO','MN','MI','CA','IL','FL','HI','NM','OR','WA']

// ─────────────────────────────────────────────────────────────────────────────
// PROBES — verify each 'live' cell still returns data.
// ─────────────────────────────────────────────────────────────────────────────
async function probeArcgis(url) {
  const u = `${url}/query?where=1%3D1&returnCountOnly=true&f=json`
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) })
  if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
  const j = await r.json()
  if (j.error) return { ok: false, detail: j.error.message || 'arcgis error' }
  return { ok: (j.count ?? 0) > 0, detail: `${j.count ?? 0} features` }
}
async function probeSocrata(url, where) {
  const u = `${url}?$select=count(1) as n&$where=${encodeURIComponent(where)}`
  const r = await fetch(u, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(40000) })
  if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
  const j = await r.json()
  const n = Number(j?.[0]?.n ?? 0)
  return { ok: n > 0, detail: `${n} rows` }
}
async function probeHttp(url) {
  // Range probe so we don't download a large xlsx/csv just to confirm it's there.
  const r = await fetch(url, { headers: { ...UA, Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(40000) })
  try { await r.body?.cancel() } catch { /* noop */ }
  const len = r.headers.get('content-length')
  return { ok: r.ok || r.status === 206, detail: `HTTP ${r.status}${len ? `, ${len}B` : ''}` }
}
async function probe(e) {
  try {
    if (e.probe === 'arcgis') return await probeArcgis(e.url)
    if (e.probe === 'socrata') return await probeSocrata(e.url, e.soda)
    if (e.probe === 'http') return await probeHttp(e.url)
  } catch (err) { return { ok: false, detail: err.message?.slice(0, 80) || 'error' } }
  return { ok: null, detail: 'no probe' }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────
const ICON = { live: '✅', candidate: '🔶', blocked: '⛔', none: '∅', unchecked: '❓' }

console.log(`\n═══ IX COVERAGE AUDIT — ${new Date().toISOString().slice(0,10)} ═══`)
console.log(`Registry: ${REGISTRY.length} cells across ${new Set(REGISTRY.map(e=>e.state)).size} states.`)
console.log(NO_PROBE ? `(--no-probe: skipping liveness checks)\n` : `Probing all 'live' cells...\n`)

// Probe live + candidate cells that have a probe (bounded parallelism).
const liveCells = REGISTRY.filter(e => (e.status === 'live' || e.status === 'candidate') && e.probe)
let probeResults = new Map()
if (!NO_PROBE) {
  const results = await Promise.all(liveCells.map(async e => [e, await probe(e)]))
  for (const [e, res] of results) probeResults.set(e, res)
}

// Per-state matrix.
const byState = new Map()
for (const e of REGISTRY) { if (!byState.has(e.state)) byState.set(e.state, []); byState.get(e.state).push(e) }
const order = [...CS_STATES, 'PA'].filter(s => byState.has(s))

const mdLines = []
const log = (s) => { console.log(s); mdLines.push(s) }

log(`# IX Coverage Matrix\n`)
log(`> Auto-generated by \`scripts/ix-coverage-audit.mjs\`. Re-run to refresh. Each \`live\` cell is probed against its source endpoint. **Gaps are visible cells (❓ unchecked / ∅ none), not omissions.**\n`)
log(`Legend: ✅ live (probed) · 🔶 candidate (found, not yet wired) · ⛔ blocked (source exists, unusable) · ∅ none found · ❓ unchecked (real gap)\n`)
log(`Cross-checked 2026-05-23 by 3 independent research agents (NE / Midwest-Mountain / West-South) enumerating from scratch.\n`)
log(`| State | Utility | Queue | Hosting capacity | Live probe | Notes |`)
log(`|---|---|:--:|:--:|---|---|`)

for (const st of order) {
  // group by utility within state for a clean two-column (queue|hc) view
  const cells = byState.get(st)
  const utils = [...new Set(cells.map(c => c.utility))]
  for (const util of utils) {
    const q = cells.find(c => c.utility === util && c.type === 'queue')
    const h = cells.find(c => c.utility === util && c.type === 'hc')
    const qIcon = q ? ICON[q.status] : ''
    const hIcon = h ? ICON[h.status] : ''
    const liveCell = [q, h].find(c => c && probeResults.has(c))
    const pr = liveCell ? probeResults.get(liveCell) : null
    const probeStr = pr ? (pr.ok === true ? `✓ ${pr.detail}` : pr.ok === false ? `✗ ${pr.detail}` : pr.detail) : ''
    const reason = [q?.reason, h?.reason].filter(Boolean).join(' · ')
    log(`| ${st} | ${util} | ${qIcon} | ${hIcon} | ${probeStr} | ${reason} |`)
  }
}

// ── Summary + holes ──────────────────────────────────────────────────────────
const tally = REGISTRY.reduce((a, e) => { a[e.status] = (a[e.status]||0)+1; return a }, {})
const probedOk = [...probeResults.values()].filter(r => r.ok === true).length
const probedBad = [...probeResults.values()].filter(r => r.ok === false).length

log(`\n## Summary`)
log(`- Cells: ${REGISTRY.length} — ✅ live ${tally.live||0} · 🔶 candidate ${tally.candidate||0} · ⛔ blocked ${tally.blocked||0} · ∅ none ${tally.none||0} · ❓ unchecked ${tally.unchecked||0}`)
if (!NO_PROBE) log(`- Liveness probes (live + candidate): ${probedOk}/${liveCells.length} returning data${probedBad ? ` · ${probedBad} FAILING (investigate)` : ''}`)

// States with at least one live source (either type).
const liveStates = new Set(REGISTRY.filter(e => e.status === 'live' && CS_STATES.includes(e.state)).map(e => e.state))
const noLive = CS_STATES.filter(s => !liveStates.has(s))
log(`- CS states with ≥1 live source: ${liveStates.size}/19 — ${[...liveStates].sort().join(', ')}`)
log(`- CS states with ZERO live source: ${noLive.length} — ${noLive.join(', ') || '(none)'}`)

log(`\n## 🔶 Candidates found by the independent sweep (real sources, NOT yet wired)`)
log(`> These are the answer to "what did we miss." Ranked roughly by license-safety + CS-relevance.`)
for (const e of REGISTRY.filter(e => e.status === 'candidate')) {
  const pr = probeResults.get(e)
  const probeStr = pr ? (pr.ok === true ? ` [probe ✓ ${pr.detail}]` : pr.ok === false ? ` [probe ✗ ${pr.detail}]` : '') : ''
  log(`- ${e.state} · ${e.utility} · ${e.type} (license: ${e.license || '?'})${probeStr} — ${e.reason || ''}`)
}

log(`\n## License posture (a SEPARATE axis from accurate/live — flagged by all 3 agents)`)
const liveByLicense = REGISTRY.filter(e => e.status === 'live').reduce((a, e) => { const k = e.license || 'unknown'; a[k] = (a[k]||0)+1; return a }, {})
log(`- LIVE feeds by license: ${Object.entries(liveByLicense).map(([k,v]) => `${k}=${v}`).join(' · ')}`)
log(`- 'open' = NY Open-NY (commercial reuse OK). 'gov' = govt/BPU-mandated public filing (strong public-record footing).`)
log(`- 'unknown' = utility ArcGIS "viewer-only" disclaimer — DECISION NEEDED before commercial redistribution. Most live HC feeds are here.`)

log(`\n## Open holes (❓ unchecked — utility×type cells never verified either way)`)
for (const e of REGISTRY.filter(e => e.status === 'unchecked')) {
  log(`- ${e.state} · ${e.utility} · ${e.type} — ${e.reason || ''}`)
}

log(`\n## Failing live probes (if any — a previously-live feed that broke)`)
const failing = [...probeResults.entries()].filter(([, r]) => r.ok === false)
if (!failing.length) log(`- none`)
for (const [e, r] of failing) log(`- ${e.state} · ${e.utility} · ${e.type} — ${r.detail} (${e.url})`)

if (WRITE) {
  const path = resolve(process.cwd(), 'docs/ix-coverage-matrix.md')
  writeFileSync(path, mdLines.join('\n') + '\n', 'utf8')
  console.log(`\n→ wrote ${path}`)
}
console.log(`\nDone.`)
