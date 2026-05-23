/**
 * MD community-solar scraper — Maryland Energy Administration (MEA) Community
 * Solar project list.
 *
 * Source: MEA's public "Maryland Community Solar" page, which links a dated
 * project-list .xlsx (the filename carries a date, so we scrape the page for the
 * current link, then fetch it). Government dataset — clear public-record footing
 * (license: gov; see docs/data-license-rationale.md). Aggregate-only: per-utility
 * counts + MW, never the per-project rows.
 *
 * Found by the 2026-05-23 independent source sweep. This is a genuine COMMUNITY-
 * SOLAR deployment dataset (MD has a real CS program), with per-project utility,
 * size (kW-ac), and "Project Development Status".
 *
 * Signal (cs_pipeline): Status 'In Service' = energized; anything else
 * (Under Construction / Design and Development) = pipeline. Per electric utility
 * (BGE, Pepco, Delmarva, Potomac Edison). No study-months → null; IX score stays
 * on the curated baseline.
 */

const PAGE_URL = 'https://energy.maryland.gov/Pages/MarylandCommunitySolar.aspx'
const ORIGIN = 'https://energy.maryland.gov'

// MEA utility codes → canonical display name.
const UTILITY_CANON = {
  BGE: 'BGE',
  PEPCO: 'Pepco',
  DELMARVA: 'Delmarva',
  PE: 'Potomac Edison',
  POTOMACEDISON: 'Potomac Edison',
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
const canon = (u) => {
  const key = String(u || '').trim().toUpperCase().replace(/\s+/g, '')
  return UTILITY_CANON[key] || String(u || '').trim()
}

async function findXlsxUrl(signal) {
  const res = await fetch(PAGE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Tractova/1.0; +https://tractova.com)' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) throw new Error(`MEA page fetch failed: ${res.status}`)
  const html = await res.text()
  // The community-solar list lives under /SiteAssets/Pages/MarylandCommunitySolar/.
  const m = html.match(/href="([^"]*MarylandCommunitySolar\/[^"]*\.xlsx[^"]*)"/i)
  if (!m) throw new Error('MEA: community-solar .xlsx link not found on page')
  const href = m[1].replace(/&amp;/g, '&')
  return href.startsWith('http') ? href : ORIGIN + href
}

export async function scrapeMdDg(signal) {
  const xlsxUrl = await findXlsxUrl(signal)
  const res = await fetch(xlsxUrl, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`MEA xlsx fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets['Public'] || wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  const hdr = aoa[0] || []
  const ui = hdr.findIndex((h) => /electric utility name/i.test(String(h)))
  const si = hdr.findIndex((h) => /development status/i.test(String(h)))
  const ci = hdr.findIndex((h) => /project size/i.test(String(h)))
  if (ui < 0 || si < 0 || ci < 0) throw new Error(`MEA: column layout shifted (util=${ui} status=${si} size=${ci})`)

  const rows = aoa.slice(1).filter((r) => r && r[ui])
  const byUtil = new Map()
  for (const r of rows) {
    const u = canon(r[ui])
    if (!u) continue
    if (!byUtil.has(u)) byUtil.set(u, { pipeline_n: 0, pipeline_mw: 0, energized_n: 0, energized_mw: 0 })
    const a = byUtil.get(u)
    const mw = num(r[ci]) / 1000  // kW-ac → MW
    if (/^\s*in service\b/i.test(String(r[si] || ''))) { a.energized_n++; a.energized_mw += mw }
    else { a.pipeline_n++; a.pipeline_mw += mw }  // Under Construction / Design & Development
  }

  const fetchedAt = new Date().toISOString()
  const out = []
  for (const [utility, a] of byUtil) {
    if (a.pipeline_n === 0 && a.energized_n === 0) continue
    out.push({
      state_id:            'MD',
      iso:                 'PJM',
      utility_name:        utility,
      projects_in_queue:   a.pipeline_n,
      mw_pending:          Math.round(a.pipeline_mw),
      completed_projects:  a.energized_n,
      completed_mw:        Math.round(a.energized_mw),
      avg_study_months:    null,
      withdrawal_pct:      null,
      avg_upgrade_cost_mw: null,
      queue_trend:         'stable',
      data_source:         'md_mea_cs',
      data_source_url:     PAGE_URL,
      fetched_at:          fetchedAt,
    })
  }
  out.sort((x, y) => y.projects_in_queue - x.projects_in_queue)
  return out
}
