/**
 * Shared utilities for the api/refresh-data.js scraper modules.
 *
 * Each scraper in this directory is a single-source data pull (LMI,
 * county ACS, news, energy community, etc.). They share a small set
 * of primitives — the Supabase service-role client, the Census fetch
 * helper with hard-timeout, the cron_runs logger, the FIPS→USPS map,
 * and the income-bracket constants — so we centralize them here
 * rather than duplicating across 10 files.
 *
 * Mirrors the helper-module convention used by api/_admin-auth.js
 * and api/_cors.js: ESM imports, JSDoc-style file header, leading
 * underscore in the filename to flag this as an internal helper.
 */
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'

// Re-export so the 10 scraper files that already import `supabaseAdmin`
// from this base module keep working without churn.
export { supabaseAdmin }

// ─────────────────────────────────────────────────────────────────────────────
// Stale tolerance for slow-moving Census ACS sources.
//
// Census publishes ACS data once per year. A weekly refresh failure means
// nothing if last week's pull is still in the database -- that data IS the
// current annual release. Without tolerance, a transient Census 503 turns
// the Data Health panel red and triggers fixed-it-yesterday alarms even
// though no user-visible data is stale.
//
// We keep ok=false (the refresh attempt did fail) so cron_runs records the
// truth and the *next* stale-check finds the genuine last-good run -- not a
// chain of softened "successes". The UI keys off `stale_tolerated` to render
// the source as amber-OK rather than red.
// ─────────────────────────────────────────────────────────────────────────────
export const STALE_TOLERANT_SOURCES = new Set(['lmi', 'county_acs', 'nmtc_lic'])
export const STALE_WINDOW_DAYS = 90

export async function applyStaleTolerance(source, originalResult) {
  if (!STALE_TOLERANT_SOURCES.has(source)) return originalResult
  if (originalResult.ok) return originalResult

  const { data, error } = await supabaseAdmin
    .from('cron_runs')
    .select('finished_at')
    .eq('cron_name', `refresh-data:${source}`)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
  if (error) {
    console.warn('[stale-tolerance] cron_runs lookup failed:', error.message)
    return originalResult
  }
  const lastGood = data?.[0]?.finished_at
  if (!lastGood) return originalResult

  const ageMs = Date.now() - new Date(lastGood).getTime()
  const ageDays = Math.floor(ageMs / 86400000)
  if (ageDays > STALE_WINDOW_DAYS) return originalResult

  return {
    ...originalResult,
    stale_tolerated: true,
    last_good_at: lastGood,
    days_since_last_good: ageDays,
    stale_window_days: STALE_WINDOW_DAYS,
  }
}

export async function logCronRun(source, summary, authMode, startedAt) {
  try {
    const finished = new Date()
    const { error } = await supabaseAdmin
      .from('cron_runs')
      .insert([{
        cron_name:   `refresh-data:${source}`,
        status:      summary.ok ? 'success' : 'failed',
        started_at:  (startedAt || finished).toISOString(),
        finished_at: finished.toISOString(),
        duration_ms: startedAt ? finished.getTime() - startedAt.getTime() : null,
        summary:     { ...summary, auth_mode: authMode },
      }])
    if (error) console.warn('[refresh-data] cron_runs insert error:', error.message)
  } catch (e) {
    console.warn('[refresh-data] cron_runs log failed:', e?.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Census fetch. Single attempt with a hard timeout. Census API returns 503
// ("undergoing maintenance or busy") under load -- we deliberately do NOT
// retry, because retry storms compound the problem (3 retries × 51 NMTC
// states × 4 inner-parallel = blew past the 300s function budget). Refresh
// is user-triggered or weekly cron; transient 503s are acceptable. The
// non-Census sources keep running and the user can re-click.
//
// User-Agent: many .gov APIs deprioritize requests with the default node
// undici UA. A descriptive UA with a contact channel is the polite way to
// identify ourselves and may avoid soft-throttling.
// ─────────────────────────────────────────────────────────────────────────────
export const CENSUS_UA = 'Tractova/1.0 (community-solar intel; aden.walker67@gmail.com)'

export async function censusFetch(url, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': CENSUS_UA, 'Accept': 'application/json' },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Income bracket UPPER BOUNDS for B19001_002E through B19001_017E.
// Bracket B19001_017E (>= $200k) has Infinity as its upper bound.
export const BRACKET_UPPER = [
  10000,   //  _002E: < $10K
  14999,   //  _003E: $10K-$15K
  19999,   //  _004E: $15K-$20K
  24999,   //  _005E: $20K-$25K
  29999,   //  _006E: $25K-$30K
  34999,   //  _007E: $30K-$35K
  39999,   //  _008E: $35K-$40K
  44999,   //  _009E: $40K-$45K
  49999,   //  _010E: $45K-$50K
  59999,   //  _011E: $50K-$60K
  74999,   //  _012E: $60K-$75K
  99999,   //  _013E: $75K-$100K
  124999,  //  _014E: $100K-$125K
  149999,  //  _015E: $125K-$150K
  199999,  //  _016E: $150K-$200K
  Infinity,//  _017E: $200K+
]
export const BRACKET_LOWER = [0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000]

// Map Census FIPS state codes to USPS state codes. Only states we track.
export const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers used by multiple ArcGIS-backed scrapers.
//
// normalizeCountyName: strips trailing "County", "Parish" (LA), "Borough" (AK),
// "Census Area" suffixes and non-alphanumerics so DSIRE/HUD/NETL/ACS county
// strings line up across pipelines. Used by energy_community + nmtc_lic.
//
// fetchArcgisPaged: paginates an Esri FeatureServer query (maxRecordCount
// is typically 2000 per layer). Used by energy_community + hud_qct_dda.
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeCountyName(raw) {
  return (raw || '')
    .toLowerCase()
    .replace(/\s+county$/, '')
    .replace(/\s+parish$/, '')   // Louisiana
    .replace(/\s+borough$/, '')  // Alaska
    .replace(/\s+census area$/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

const ARCGIS_PAGE_SIZE = 2000

export async function fetchArcgisPaged(baseUrl, where, fields) {
  const all = []
  let offset = 0
  let safety = 0
  while (safety++ < 20) {  // hard cap: 20 pages = 40K records
    const url =
      `${baseUrl}?where=${encodeURIComponent(where)}` +
      `&outFields=${encodeURIComponent(fields)}` +
      `&returnGeometry=false&f=json` +
      `&resultOffset=${offset}&resultRecordCount=${ARCGIS_PAGE_SIZE}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    let payload
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Tractova/1.0 (energy-community cron)' },
      })
      clearTimeout(timeoutId)
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`)
      }
      payload = await resp.json()
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
    if (payload.error) {
      throw new Error(`ArcGIS server error: ${payload.error?.message || JSON.stringify(payload.error)}`)
    }
    const features = payload.features || []
    for (const f of features) all.push(f.attributes || {})
    if (features.length < ARCGIS_PAGE_SIZE) break
    offset += ARCGIS_PAGE_SIZE
  }
  return all
}
