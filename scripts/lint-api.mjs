/**
 * Syntax-checks every JS file under api/ (recursive).
 *
 * Vite build (`npm run build`) only compiles the frontend. Vercel only
 * compiles the API functions on deploy. Locally, a syntax error inside
 * an api/*.js handler ships to prod undetected — and surfaces as HTTP 500
 * for every route on the affected file.
 *
 * Recurses one level into api/scrapers/, api/lib/, api/_prompts/ etc. as
 * the API tree decomposes. Wired into `npm run verify` so it runs before
 * the smoke pass.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

function listJs(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      out.push(...listJs(path))
    } else if (name.endsWith('.js')) {
      out.push(path.replaceAll('\\', '/'))
    }
  }
  return out
}

const files = listJs('api')
let failed = 0
for (const f of files) {
  try {
    execSync(`node --check ${f}`, { stdio: 'pipe' })
  } catch (e) {
    console.error(`✗ ${f}:\n${e.stderr.toString()}`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) with syntax errors`)
  process.exit(1)
}
console.log(`✓ api/**/*.js syntax OK (${files.length} files)`)

// ── Security rules (guardrails spec 2026-06-10 / CLAUDE.md §10) — beyond syntax ──

// Rule 1: Vercel Hobby function cap — never a 13th top-level route.
// (MEMORY: project_vercel_hobby_function_cap — new actions multiplex through
// api/lens-insight.js + api/handlers/_*.js.)
const topLevelRoutes = readdirSync('api').filter(f => f.endsWith('.js') && !f.startsWith('_'))
if (topLevelRoutes.length > 12) {
  console.error(`✗ ${topLevelRoutes.length} top-level api/*.js routes — Vercel Hobby cap is 12.`)
  console.error('  Route new actions through api/lens-insight.js + api/handlers/_*.js.')
  process.exit(1)
}

// Rule 2: child_process is banned under api/ (no shell-outs in serverless handlers).
const CHILD_PROCESS_RE =
  /require\(\s*['"](?:node:)?child_process['"]\s*\)|from\s+['"](?:node:)?child_process['"]/

// Rule 3: fetch() requires either the SSRF guard (api/lib/_urlFetch.js, finding
// F-33) or an entry here naming the trust root. Seeded with every callsite
// verified 2026-06-12 — constant gov/vendor URLs, operator env-config, an
// exact-host allowlist, or a single-origin page-discovered link. A NEW file
// calling fetch() fails until reviewed and added — that review friction is the point.
const FETCH_ALLOWLIST = new Set([
  'api/lib/_urlFetch.js',                          // the SSRF guard itself
  'api/lib/_axiomLog.js',                          // constant Axiom ingest URL (env-config host)
  'api/check-staleness.js',                        // constant api.resend.com
  'api/send-digest.js',                            // constant api.resend.com
  'api/send-alerts.js',                            // constant api.resend.com + exact-host Slack allowlist (F-34)
  'api/refresh-data.js',                           // constant Census ACS diagnostic probe
  'api/refresh-capacity-factors.js',               // constant NREL PVWatts base
  'api/refresh-substations.js',                    // constant EIA base URLs
  'api/handlers/_tract-resolve.js',                // constant Census geocoder host + encoded param (F-43)
  'api/scrapers/_scraperBase.js',                  // shared census/arcgis fetch, constant gov bases
  'api/scrapers/_refresh-ca-dg.js',                // constant PG&E xlsx URL
  'api/scrapers/_refresh-flood-nri.js',            // constant FEMA NRI FeatureServer
  'api/scrapers/_refresh-geospatial-farmland.js',  // constant USDA SSURGO endpoint
  'api/scrapers/_refresh-hosting-capacity.js',     // constant per-utility ArcGIS feeds
  'api/scrapers/_refresh-md-dg.js',                // page-discovered link constrained to energy.maryland.gov (F-07)
  'api/scrapers/_refresh-news.js',                 // constant RSS sources + constant Anthropic endpoint
  'api/scrapers/_refresh-nj-dg.js',                // constant EDC xlsx URLs
  'api/scrapers/_refresh-ny-dg.js',                // constant NYSERDA Socrata endpoint
  'api/scrapers/_refresh-solar-costs.js',          // operator env-config LBNL CSV URL
  'api/scrapers/_refresh-va-dg.js',                // constant Dominion xlsx URL
  'api/scrapers/_refresh-wi-dg.js',                // constant Alliant/WI source URL
])
const FETCH_RE = /\bfetch\s*\(/

let secFailed = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (CHILD_PROCESS_RE.test(src)) {
    console.error(`✗ ${f}: child_process is banned under api/ (CLAUDE.md §10).`)
    secFailed += 1
  }
  if (FETCH_RE.test(src) && !FETCH_ALLOWLIST.has(f)) {
    console.error(`✗ ${f}: direct fetch() — route variable URLs through api/lib/_urlFetch.js,`)
    console.error('  or add this file to FETCH_ALLOWLIST in scripts/lint-api.mjs with a trust-root comment.')
    secFailed += 1
  }
}
if (secFailed > 0) {
  console.error(`\n${secFailed} security-lint failure(s) under api/`)
  process.exit(1)
}
console.log('✓ api security lint OK (fn-cap, child_process, fetch allowlist)')
