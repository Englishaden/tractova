/**
 * One-shot seed for cs_specific_yield from CS-developer public fleet pages.
 *
 * Three sources scrape-checked 2026-05-04 (see plan
 * ~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md):
 *   NEXAMP_PUBLIC      ~300-500 projects · AC kW + annual kWh per page
 *   SR_ENERGY_PUBLIC    ~80-150 projects · DC kW + annual kWh on listing
 *   CATALYZE_PUBLIC     ~30 projects · ~30% with full data on listing
 *
 *   Usage:  node scripts/seed-cs-specific-yield.mjs                   # all sources
 *           node scripts/seed-cs-specific-yield.mjs --source=nexamp   # single source
 *           node scripts/seed-cs-specific-yield.mjs --dry-run         # parse + report, no upsert
 *           node scripts/seed-cs-specific-yield.mjs --inspect=nexamp  # dump one raw page for regex tuning
 *
 * Filter rules:
 *   - Both system size AND annual production must be present (else drop)
 *   - SY computed against published basis (AC for Nexamp, DC for SR Energy / Catalyze)
 *   - SY sanity bounds: 600 ≤ SY ≤ 2400 kWh/kWp/yr (drops partial-year rows)
 *
 * The script is resilient to per-page parse failures — projects whose HTML
 * doesn't yield a clean extraction are logged + skipped, never crash the run.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env loader ─────────────────────────────────────────────────────────────
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// ── args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argSet = new Set(args)
const DRY_RUN = argSet.has('--dry-run')
const sourceArg = args.find(a => a.startsWith('--source='))?.split('=')[1]?.toLowerCase()
const inspectArg = args.find(a => a.startsWith('--inspect='))?.split('=')[1]?.toLowerCase()

const SY_FLOOR = 600
const SY_CEIL  = 2400
const UA = 'tractova-fleet-seed/1.0 (+https://tractova.com)'

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchText(url, label = '') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${label || url}: status=${res.status}`)
  return res.text()
}

function decodeHtmlEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function parseNumber(s) {
  if (s == null) return null
  const cleaned = String(s).replace(/[, ]/g, '').replace(/[^\d.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// State extraction from town/city names. Many project pages embed state as
// a USPS code; some as full state name. We try both.
const STATE_NAMES = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
  'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
  'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
  'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  'District of Columbia':'DC',
}
const VALID_USPS = new Set(Object.values(STATE_NAMES))

function extractState(text) {
  // Prefer USPS code matches first (most reliable when present)
  const uspsMatch = text.match(/\b([A-Z]{2})\b/g)
  if (uspsMatch) {
    for (const code of uspsMatch) {
      if (VALID_USPS.has(code)) return code
    }
  }
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (text.includes(name)) return code
  }
  return null
}

// ── Source: Nexamp ─────────────────────────────────────────────────────────
async function scrapeNexamp() {
  console.log(`\n[Nexamp] fetching sitemap…`)
  const sitemap = await fetchText('https://www.nexamp.com/sitemap.xml', 'Nexamp sitemap')
  const projectUrls = [...sitemap.matchAll(/<loc>(https:\/\/www\.nexamp\.com\/project\/[^<]+)<\/loc>/g)]
    .map(m => m[1].trim())
  console.log(`[Nexamp] ${projectUrls.length} project URLs found in sitemap`)

  const rows = []
  const failed = []
  for (let i = 0; i < projectUrls.length; i++) {
    const url = projectUrls[i]
    if (i > 0 && i % 20 === 0) {
      process.stderr.write(`\r  [Nexamp] ${i}/${projectUrls.length} …`)
    }
    try {
      const html = await fetchText(url, 'Nexamp project')
      const decoded = decodeHtmlEntities(html)
      const slug = url.split('/').pop()

      // Extract project name (h1 or <title>)
      const nameMatch = decoded.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                        decoded.match(/<title>([^<]+?)(?:\s*\|\s*Nexamp)?<\/title>/i)
      const projectName = nameMatch ? nameMatch[1].trim() : slug

      // Tuned 2026-05-05 against actual HTML — Nexamp uses Vuetify-rendered
      // <div class="size">N.NN Kilowatts</div> + <div class="location">City, ST</div>
      // + Annual Estimated Production (kWh):</div><div class="data">N,NNN,NNN</div>
      let acKw = null
      const sizeMatch = decoded.match(/class="size"[^>]*>([\d,.]+)\s*Kilowatts?</i)
      if (sizeMatch) acKw = parseNumber(sizeMatch[1])

      let annualKwh = null
      const prodMatch = decoded.match(/Annual Estimated Production[^<]*<\/div>\s*<div[^>]+class="data"[^>]*>([\d,]+)</i) ||
                        decoded.match(/Annual Production[^<]{0,60}<\/div>\s*<div[^>]*>([\d,]+)/i)
      if (prodMatch) annualKwh = parseNumber(prodMatch[1])

      // Location: "<div class="location">Adamstown, MD</div>"
      let state = null, city = null
      const locMatch = decoded.match(/class="location"[^>]*>([^<]+)</i)
      if (locMatch) {
        const loc = locMatch[1].trim()
        // Format "City, ST" — split and validate
        const m = loc.match(/^(.+?),\s*([A-Z]{2})$/)
        if (m && VALID_USPS.has(m[2])) {
          city = m[1].trim()
          state = m[2]
        } else {
          state = extractState(loc)
        }
      }
      if (!state) state = extractState(decoded)

      // Panel count + tracking — Nexamp body text fallbacks
      const panelMatch = decoded.match(/([\d,]+)\s*(?:American-made\s+)?solar\s+modules?/i)
      const panelCount = panelMatch ? parseInt(panelMatch[1].replace(/,/g, ''), 10) : null
      const trackerMatch = decoded.match(/(versatile tracker|single-axis|fixed-tilt|tracker)/i)
      const trackingType = trackerMatch ? trackerMatch[1].toLowerCase() : null

      if (!acKw || !annualKwh || !state || !VALID_USPS.has(state)) {
        failed.push({ url, reason: `acKw=${acKw} kwh=${annualKwh} state=${state}` })
        await sleep(200)
        continue
      }

      const sy = annualKwh / acKw
      if (sy < SY_FLOOR || sy > SY_CEIL) {
        failed.push({ url, reason: `SY=${sy.toFixed(1)} out of [${SY_FLOOR}-${SY_CEIL}]` })
        await sleep(200)
        continue
      }

      rows.push({
        project_id: `NEXAMP:${slug}`,
        project_name: projectName,
        source: 'NEXAMP_PUBLIC',
        source_url: url,
        state,
        city,
        county_fips: null,
        system_size_kw_ac: Number(acKw.toFixed(2)),
        system_size_kw_dc: null,
        capacity_basis: 'AC',
        annual_production_kwh: Math.round(annualKwh),
        specific_yield_kwh_per_kwp_yr: Number(sy.toFixed(1)),
        observed_capacity_factor_pct: Number((sy / 87.6).toFixed(2)),
        cod_year: null,
        panel_count: panelCount,
        tracking_type: trackingType,
        last_updated: new Date().toISOString(),
      })
    } catch (e) {
      failed.push({ url, reason: e.message })
    }
    await sleep(200)
  }
  process.stderr.write(`\r  [Nexamp] ${projectUrls.length}/${projectUrls.length} done.    \n`)
  console.log(`[Nexamp] ${rows.length} rows extracted, ${failed.length} skipped`)
  if (failed.length && failed.length < 20) {
    for (const f of failed.slice(0, 5)) console.log(`  · skipped ${f.url.replace(/^.+\/project\//,'')}: ${f.reason}`)
  }
  return rows
}

// ── Source: SR Energy ──────────────────────────────────────────────────────
// 2026-05-05: SR Energy projects page is a SPA — raw HTTP fetch returns ~4.5 KB
// shell (content rendered via JS). The plan-mode WebFetch (which executes JS)
// previously saw the data, but a raw fetch can't. Skipping for now; would
// need a headless-browser approach (Playwright/Puppeteer) to revisit.
// Returning empty array preserves the multi-source contract.
async function scrapeSrEnergy() {
  console.log(`\n[SR Energy] SKIP — site is a SPA; raw fetch returns shell only. Defer until headless-browser approach.`)
  return []

  // eslint-disable-next-line no-unreachable
  console.log(`\n[SR Energy] fetching listing… (10s crawl-delay per robots.txt)`)
  await sleep(2000)  // courtesy pre-fetch wait
  const html = await fetchText('https://srenergy.com/projects/', 'SR Energy listing')
  const decoded = decodeHtmlEntities(html)

  // Cards repeat in the HTML. We look for blocks containing both kWdc and kWh.
  // SR Energy listing format (per probe): each card has name, state, "X,XXX kWdc", and (sometimes) "X,XXX,XXX kWh".
  // The exact HTML shape may vary; we use a forgiving block-level regex.
  const rows = []
  const blockPattern = /([A-Z][\w &.\-']{1,60})\s*<[^>]*>\s*(?:[\s\S]{0,300}?)([A-Z]{2})\b[\s\S]{0,400}?([\d,]+(?:\.\d+)?)\s*kW\s*(?:dc|DC)\b([\s\S]{0,400}?)/g
  // ↑ This is best-effort. Real implementation may require manual HTML inspection.
  // For now we capture name + state + DC kW; production extracted from same block.

  // Simpler approach: split the HTML on "kWdc" markers and look in each chunk.
  const chunks = decoded.split(/kWdc/i)
  // chunks[0] is preamble; each chunk[i] for i>=1 is the text immediately
  // FOLLOWING a "kWdc" marker — meaning the SIZE was at the END of chunks[i-1].
  // So we re-pair: for each i>=1, the relevant card ends in chunks[i-1] (size) and starts with chunks[i] (production may follow).
  for (let i = 1; i < chunks.length; i++) {
    const before = chunks[i - 1]
    const after = chunks[i]

    // Size: last numeric run in `before` ending right at the kWdc marker.
    const sizeMatch = before.match(/([\d,]+(?:\.\d+)?)\s*$/)
    const dcKw = sizeMatch ? parseNumber(sizeMatch[1]) : null

    // Look back ~400 chars in `before` for project name + state context
    const ctxBefore = before.slice(-600)
    // Project name: header tag like <h3>Bomber</h3> or similar
    const nameMatch = ctxBefore.match(/>([A-Z][\w \-&.']{1,50})<\/(?:h\d|a|p|span|div)/g)
    const projectName = nameMatch ? nameMatch[nameMatch.length - 1].replace(/^[^>]+>|<.*$/g, '').trim() : null

    // State from card area
    const state = extractState(ctxBefore)

    // Production: look ahead in `after` for kWh number
    const ctxAfter = after.slice(0, 600)
    const prodMatch = ctxAfter.match(/([\d,]{6,})\s*kWh/i)
    const annualKwh = prodMatch ? parseNumber(prodMatch[1]) : null

    if (!dcKw || !annualKwh || !state || !VALID_USPS.has(state) || !projectName) continue

    const sy = annualKwh / dcKw
    if (sy < SY_FLOOR || sy > SY_CEIL) continue

    rows.push({
      project_id: `SRENERGY:${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${state}`,
      project_name: projectName,
      source: 'SR_ENERGY_PUBLIC',
      source_url: 'https://srenergy.com/projects/',
      state,
      city: null,
      county_fips: null,
      system_size_kw_ac: null,
      system_size_kw_dc: Number(dcKw.toFixed(2)),
      capacity_basis: 'DC',
      annual_production_kwh: Math.round(annualKwh),
      specific_yield_kwh_per_kwp_yr: Number(sy.toFixed(1)),
      observed_capacity_factor_pct: Number((sy / 87.6).toFixed(2)),
      cod_year: null,
      panel_count: null,
      tracking_type: null,
      last_updated: new Date().toISOString(),
    })
  }

  console.log(`[SR Energy] ${rows.length} rows extracted from listing`)
  return rows
}

// ── Source: Catalyze ───────────────────────────────────────────────────────
// ~30 projects on catalyze.com/projects/; ~30% expose annual production.
// Drop rows missing production.
async function scrapeCatalyze() {
  console.log(`\n[Catalyze] fetching portfolio…`)
  // 2026-05-05: corrected URL from /projects/ to /portfolio/ — Catalyze
  // returns 404 on /projects/ even though it appeared in the original probe.
  const html = await fetchText('https://catalyze.com/portfolio/', 'Catalyze portfolio')
  const decoded = decodeHtmlEntities(html)

  const rows = []
  // Catalyze cards (per probe) carry size + state + city + project type + sometimes production.
  // Use kWdc OR kWac OR MW marker as the anchor; production text "kWh" must appear within the same block.
  const cards = decoded.split(/<(?:article|li|div)[^>]+(?:project|portfolio)/gi)
  for (const card of cards) {
    if (!/(kW|MW)/i.test(card) || !/kWh/i.test(card)) continue
    // Size — try kW first, then MW
    let sizeKw = null, basis = null
    const kwMatch = card.match(/([\d,]+(?:\.\d+)?)\s*kW\s*(ac|AC|dc|DC)/i)
    if (kwMatch) {
      sizeKw = parseNumber(kwMatch[1])
      basis = kwMatch[2].toUpperCase()
    } else {
      const mwMatch = card.match(/([\d,]+(?:\.\d+)?)\s*MW\b/)
      if (mwMatch) {
        sizeKw = parseNumber(mwMatch[1]) * 1000
        basis = 'AC'  // default; Catalyze MW is typically AC
      }
    }
    if (!sizeKw) continue

    const prodMatch = card.match(/([\d,]{6,})\s*kWh/i)
    const annualKwh = prodMatch ? parseNumber(prodMatch[1]) : null
    if (!annualKwh) continue

    const state = extractState(card)
    if (!state) continue

    const nameMatch = card.match(/>([A-Z][\w \-&.']{2,50})<\//)
    const projectName = nameMatch ? nameMatch[1].trim() : `catalyze-${state}-${sizeKw}`

    const sy = annualKwh / sizeKw
    if (sy < SY_FLOOR || sy > SY_CEIL) continue

    rows.push({
      project_id: `CATALYZE:${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${state}`,
      project_name: projectName,
      source: 'CATALYZE_PUBLIC',
      source_url: 'https://catalyze.com/projects/',
      state,
      city: null,
      county_fips: null,
      system_size_kw_ac: basis === 'AC' ? Number(sizeKw.toFixed(2)) : null,
      system_size_kw_dc: basis === 'DC' ? Number(sizeKw.toFixed(2)) : null,
      capacity_basis: basis,
      annual_production_kwh: Math.round(annualKwh),
      specific_yield_kwh_per_kwp_yr: Number(sy.toFixed(1)),
      observed_capacity_factor_pct: Number((sy / 87.6).toFixed(2)),
      cod_year: null,
      panel_count: null,
      tracking_type: null,
      last_updated: new Date().toISOString(),
    })
  }
  console.log(`[Catalyze] ${rows.length} rows extracted from listing`)
  return rows
}

// ── Inspect mode (dump sample HTML for regex tuning) ───────────────────────
if (inspectArg) {
  const inspectUrls = {
    nexamp: 'https://www.nexamp.com/project/adamstown-solar',
    srenergy: 'https://srenergy.com/projects/',
    catalyze: 'https://catalyze.com/portfolio/',
  }
  const url = inspectUrls[inspectArg]
  if (!url) { console.error(`Unknown source: ${inspectArg}`); process.exit(1) }
  console.log(`Fetching ${url}…`)
  const html = await fetchText(url, inspectArg)
  console.log(`Length: ${html.length} bytes`)
  console.log(html.slice(0, 4000))
  process.exit(0)
}

// ── main ───────────────────────────────────────────────────────────────────
const sourcesToRun = sourceArg
  ? [sourceArg]
  : ['nexamp', 'srenergy', 'catalyze']

let allRows = []
for (const source of sourcesToRun) {
  try {
    if (source === 'nexamp')   allRows.push(...await scrapeNexamp())
    if (source === 'srenergy') allRows.push(...await scrapeSrEnergy())
    if (source === 'catalyze') allRows.push(...await scrapeCatalyze())
  } catch (e) {
    console.error(`[${source}] FATAL: ${e.message}`)
  }
}

// Dedup by project_id (in case a project appears in multiple sources)
const byId = new Map()
for (const r of allRows) {
  if (!byId.has(r.project_id)) byId.set(r.project_id, r)
}
allRows = [...byId.values()]

// Per-state summary
const byState = new Map()
for (const r of allRows) {
  if (!byState.has(r.state)) byState.set(r.state, [])
  byState.get(r.state).push(r)
}

console.log(`\n────────────────────────────────────────────────────────────`)
console.log(`Total rows: ${allRows.length} from ${sourcesToRun.length} source(s)`)
console.log()
console.log(`STATE   n     basis   mean SY   mean CF   min SY  max SY`)
console.log(`─────  ─────  ─────  ────────  ────────  ──────  ──────`)
const sortedStates = [...byState.entries()].sort((a, b) => b[1].length - a[1].length)
for (const [state, rs] of sortedStates) {
  const ac = rs.filter(r => r.capacity_basis === 'AC')
  const dc = rs.filter(r => r.capacity_basis === 'DC')
  const groups = [
    ['AC', ac],
    ['DC', dc],
  ].filter(g => g[1].length > 0)
  for (const [basis, gs] of groups) {
    const sys = gs.map(r => r.specific_yield_kwh_per_kwp_yr)
    const meanSy = sys.reduce((a, b) => a + b, 0) / sys.length
    const meanCf = meanSy / 87.6
    console.log(
      `  ${state}   ${gs.length.toString().padStart(4)}    ${basis}    ${meanSy.toFixed(0).padStart(6)}    ${meanCf.toFixed(2).padStart(6)}   ${Math.min(...sys).toFixed(0).padStart(5)}   ${Math.max(...sys).toFixed(0).padStart(5)}`
    )
  }
}
console.log()

if (DRY_RUN) {
  console.log(`[--dry-run] no upsert performed.`)
  process.exit(0)
}

if (allRows.length === 0) {
  console.error(`No rows to upsert. Check parser output / regex against current HTML.`)
  process.exit(1)
}

console.log(`→ Upserting ${allRows.length} rows to cs_specific_yield…`)
const BATCH = 200
let upserted = 0
for (let i = 0; i < allRows.length; i += BATCH) {
  const slice = allRows.slice(i, i + BATCH)
  const { error } = await admin
    .from('cs_specific_yield')
    .upsert(slice, { onConflict: 'project_id' })
  if (error) {
    console.error(`✗ Batch ${i / BATCH} failed: ${error.message}`)
    process.exit(1)
  }
  upserted += slice.length
}
console.log(`✓ Upserted ${upserted} rows.`)
