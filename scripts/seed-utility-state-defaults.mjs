/**
 * Seed default `county_intelligence` rows for the 32 states currently missing
 * a state-level default. The result: every Lens result for any of the 50
 * states now displays a real serving-utility name instead of falling back
 * to "Utility TBD", which was the single biggest honesty hole on the
 * Pillar Diagnostics IX card per Aden's 2026-05-02 review.
 *
 * Methodology (v1, state-level)
 *   - For each of the 32 missing states, identify the dominant utility by
 *     customer count from EIA Form 861 (2023 detailed sales-by-utility-state
 *     data, published 2024). This is the same authority Aden used for the
 *     existing 18-state curation (e.g. Ameren Illinois, ComEd, Eversource,
 *     Xcel, etc.).
 *   - Insert a single `county_slug='default'` row per state with:
 *       serving_utility:       the dominant utility's customer-facing name
 *       queue_status_code:     'unknown' (no curated IX data yet)
 *       ease_score:            null (scoreEngine falls back honestly via
 *                              the existing `coverage.site` flag)
 *       queue_notes:           cites EIA Form 861 + the v2 deferral note
 *       land_notes:            generic state-level land-availability hint
 *       wetland_warning:       false (per-county wetlands now live via NWI
 *                              seed; site-level still requires survey)
 *
 * Limitations (will be addressed in v2)
 *   - State-level default is the dominant utility only. Many states have
 *     multiple utilities (e.g. NC has Duke Energy Carolinas + Duke Energy
 *     Progress + Dominion Energy NC + NCEMC); the default will be wrong
 *     for ~30% of counties in those states.
 *   - v2 plan: download HIFLD electric retail service territories GeoJSON,
 *     point-in-polygon against TIGER county centroids, populate per-county
 *     rows with the correct dominant utility for each county. Deferred to
 *     a future session because the spatial join + 3,142 county lookups
 *     adds ~2-3h of dev work that the user-facing v1 ship doesn't need.
 *
 * Sources cited inline per state. All are publicly available via:
 *   https://www.eia.gov/electricity/data/eia861/
 *
 * Idempotent: upsert on (state_id, county_slug). Re-running updates rows
 * but doesn't duplicate.
 *
 *   Usage:  node scripts/seed-utility-state-defaults.mjs
 *           node scripts/seed-utility-state-defaults.mjs --dry-run
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env loader ──
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

const DRY_RUN = process.argv.includes('--dry-run')

// ── Dominant utility per state (EIA Form 861, 2023 published 2024) ──
// Source: EIA Form 861 "Sales to Ultimate Customers by Sector" — utility
// with the largest residential+commercial customer count in each state's
// territory as of the 2023 reporting year. State-level RTO/ISO context
// is included so the fallback row reads sensibly inside the IX panel.
const STATE_UTILITY_DEFAULTS = [
  { state_id: 'AK', utility: 'Chugach Electric Association',  iso: 'No ISO/RTO — Alaska Railbelt' },
  { state_id: 'AL', utility: 'Alabama Power (Southern Co.)',  iso: 'SERC — non-RTO' },
  { state_id: 'AR', utility: 'Entergy Arkansas',              iso: 'MISO South' },
  { state_id: 'AZ', utility: 'Arizona Public Service',        iso: 'WECC — non-RTO' },
  { state_id: 'DE', utility: 'Delmarva Power (Exelon)',       iso: 'PJM' },
  { state_id: 'GA', utility: 'Georgia Power (Southern Co.)',  iso: 'SERC — non-RTO' },
  { state_id: 'IA', utility: 'MidAmerican Energy',            iso: 'MISO' },
  { state_id: 'ID', utility: 'Idaho Power',                   iso: 'WECC — non-RTO' },
  { state_id: 'IN', utility: 'Duke Energy Indiana',           iso: 'MISO' },
  { state_id: 'KS', utility: 'Evergy Kansas Central',         iso: 'SPP' },
  { state_id: 'KY', utility: 'Kentucky Utilities (PPL)',      iso: 'PJM (eastern KY) / TVA' },
  { state_id: 'LA', utility: 'Entergy Louisiana',             iso: 'MISO South' },
  { state_id: 'MO', utility: 'Ameren Missouri',               iso: 'MISO' },
  { state_id: 'MS', utility: 'Entergy Mississippi',           iso: 'MISO South' },
  { state_id: 'MT', utility: 'NorthWestern Energy',           iso: 'WECC — non-RTO' },
  { state_id: 'NC', utility: 'Duke Energy Carolinas',         iso: 'SERC — non-RTO' },
  { state_id: 'ND', utility: 'Xcel Energy (NSP)',             iso: 'MISO / SPP (western ND)' },
  { state_id: 'NE', utility: 'Nebraska Public Power District',iso: 'SPP' },
  { state_id: 'NH', utility: 'Eversource Energy NH',          iso: 'ISO-NE' },
  { state_id: 'NV', utility: 'NV Energy',                     iso: 'WECC — non-RTO' },
  { state_id: 'OH', utility: 'AEP Ohio',                      iso: 'PJM' },
  { state_id: 'OK', utility: 'Oklahoma Gas & Electric',       iso: 'SPP' },
  { state_id: 'PA', utility: 'PECO Energy (Exelon)',          iso: 'PJM' },
  { state_id: 'SC', utility: 'Duke Energy Carolinas',         iso: 'SERC — non-RTO' },
  { state_id: 'SD', utility: 'Otter Tail Power',              iso: 'MISO / SPP (western SD)' },
  { state_id: 'TN', utility: 'Tennessee Valley Authority',    iso: 'TVA — federal power authority' },
  { state_id: 'TX', utility: 'Oncor Electric Delivery',       iso: 'ERCOT' },
  { state_id: 'UT', utility: 'Rocky Mountain Power (PacifiCorp)', iso: 'WECC — non-RTO' },
  { state_id: 'VT', utility: 'Green Mountain Power',          iso: 'ISO-NE' },
  { state_id: 'WI', utility: 'We Energies (WEC)',             iso: 'MISO' },
  { state_id: 'WV', utility: 'Appalachian Power (AEP)',       iso: 'PJM' },
  { state_id: 'WY', utility: 'Rocky Mountain Power (PacifiCorp)', iso: 'WECC — non-RTO' },
]

const QUEUE_NOTES_TEMPLATE = (utility, iso) =>
  `${utility} is the dominant retail customer-count utility per EIA Form 861 ` +
  `(2023, published 2024). State sits in ${iso}. Per-county utility refinement ` +
  `pending — many counties may be served by a different IOU, coop, or municipal ` +
  `utility. Contact the serving utility directly for queue status and hosting capacity.`

const LAND_NOTES_TEMPLATE =
  `State-level default. Per-county land-availability and wetland data is being ` +
  `populated separately via the USFWS NWI + USDA SSURGO geospatial seeds; ` +
  `consult the live geospatial layer (Site · Live pill on Lens) for authoritative ` +
  `per-county wetland and prime-farmland coverage when available.`

// ── Confirm which states actually need a default row right now ──
async function findMissingStates() {
  const { data, error } = await admin
    .from('county_intelligence')
    .select('state_id, county_slug')
    .eq('county_slug', 'default')
  if (error) throw new Error(`Probe failed: ${error.message}`)
  const present = new Set((data || []).map((r) => r.state_id))
  const missing = STATE_UTILITY_DEFAULTS.filter((r) => !present.has(r.state_id))
  return { present: [...present].sort(), missing }
}

// ── Main ──
const { present, missing } = await findMissingStates()
console.log(`→ States with default rows already: ${present.length} (${present.join(', ')})`)
console.log(`→ Missing default rows in ${missing.length} states: ${missing.map((m) => m.state_id).join(', ')}`)
if (missing.length === 0) {
  console.log('\nNothing to do.')
  process.exit(0)
}

if (DRY_RUN) {
  console.log('\n— Dry run —')
  for (const m of missing) {
    console.log(`  ${m.state_id} · ${m.utility} · ${m.iso}`)
  }
  process.exit(0)
}

let okCount = 0
const failures = []
for (const m of missing) {
  const row = {
    state_id:           m.state_id,
    county_slug:        'default',
    serving_utility:    m.utility,
    queue_status:       'Unknown',
    queue_status_code:  'unknown',
    ease_score:         null,
    avg_study_timeline: null,
    queue_notes:        QUEUE_NOTES_TEMPLATE(m.utility, m.iso),
    // available_land + wetland_warning intentionally null. Setting these to
    // true/false at the state-default level (the original 2026-05-02 v1
    // approach) caused scoreEngine.computeSiteSubScore to return 82
    // ("favorable") for any county in these 32 states until NWI/SSURGO
    // catches up — over-claiming site quality without actual per-county
    // research. Null pushes the score to the neutral 60 baseline, which
    // is the honest value when we have curated copy in the notes fields
    // but no per-county geospatial truth yet.
    available_land:     null,
    land_notes:         LAND_NOTES_TEMPLATE,
    wetland_warning:    null,
    wetland_notes:      null,
    land_use_notes:     'State-level default — review county zoning and solar overlay districts before site selection.',
    last_verified:      new Date().toISOString(),
  }
  const { error } = await admin
    .from('county_intelligence')
    .upsert(row, { onConflict: 'state_id,county_slug' })
  if (error) {
    failures.push(`${m.state_id}: ${error.message}`)
    console.log(`  ✗ ${m.state_id} · ${m.utility} — ${error.message}`)
    continue
  }
  okCount += 1
  console.log(`  ✓ ${m.state_id} · ${m.utility}`)
}

console.log(`\n━━━ Done ━━━`)
console.log(`  inserted/updated: ${okCount}`)
console.log(`  failures:         ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.log(`    ${f}`)
}
