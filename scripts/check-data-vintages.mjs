/**
 * Data vintage watch — event-driven freshness for the static / manually-sourced
 * datasets (2026-06 audit, Phase 1).
 *
 * The offline review_due gate in scripts/audit-check.mjs fails CI on a FIXED
 * calendar date (a guess). This complements it: probe each publisher for the
 * CURRENT published vintage and compare to what we have on disk, so we learn the
 * moment a NEWER vintage actually ships — not on an arbitrary date. When a newer
 * vintage is found, re-source + bump review_due in the docs/*.json sidecar.
 *
 * Design:
 *   - DETECT only. No auto-download, no auto-apply. The human seed step
 *     (node scripts/seed-*.mjs --apply, which prints an impact diff) stays —
 *     LIC is a legally-operative eligibility determination (CLAUDE.md data-honesty
 *     + DOE's "spatial data is for geolocation, not the official determination").
 *   - FAIL OPEN. Network/parse errors warn but never block (exit 0) — we don't
 *     cry wolf on a transient blip or a publisher layout tweak.
 *   - Exit 1 ONLY when a newer vintage is CONFIRMED (actionable signal for a
 *     human / a weekly CI job). Run: `npm run check:vintages`.
 *
 * Not wired into `npm run verify` (that gate stays offline + fast). Run manually
 * or on a weekly schedule.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

// Optional env (for EIA_API_KEY) — same loader as the seed scripts. Absent → EIA check skips.
try {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
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
} catch { /* no .env.local — fine; EIA check will skip without a key */ }

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

// ── LIC (DOE §48e / CDFI NMTC) — date-stamped Excel filename on the DOE catalog ──
async function checkLic() {
  const source = 'LIC §48e (DOE / CDFI NMTC)'
  let sidecar
  try {
    sidecar = JSON.parse(readFileSync(resolve(ROOT, 'docs/cdfi-lic/lic-source.json'), 'utf8'))
  } catch { return { source, status: 'skipped', detail: 'docs/cdfi-lic/lic-source.json not found' } }
  const haveDate = (sidecar.file || '').match(/_(\d{8})\.xlsx/)?.[1] || null
  const url = sidecar.url || 'https://data.nlr.gov/submissions/222'
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'tractova-vintage-watch/1.0' } })
    if (!r.ok) return { source, status: 'error', detail: `HTTP ${r.status} from ${url}` }
    const html = await r.text()
    const dates = [...html.matchAll(/Low-Income-Communities_Excel_(\d{8})\.xlsx/g)].map(m => m[1])
    if (!dates.length) return { source, status: 'error', detail: 'no Excel filename on the page (layout change? re-verify the regex)' }
    const latest = dates.sort().at(-1)
    if (haveDate && latest > haveDate) {
      return { source, status: 'newer', detail: `published ${latest} > ours ${haveDate}. Re-download to data/cdfi-lic/, run \`node scripts/seed-nmtc-lic.mjs --apply\`, bump review_due.` }
    }
    return { source, status: 'current', detail: `latest published ${latest} == ours ${haveDate || '?'}` }
  } catch (e) { return { source, status: 'error', detail: e.message } }
}

// ── EIA commercial retail rates (offtake anchor) — true API, key-gated ──
async function checkEia() {
  const source = 'EIA offtake rates (EPM 5.6.B)'
  const key = process.env.EIA_API_KEY
  if (!key) return { source, status: 'skipped', detail: 'no EIA_API_KEY in env (set it to enable this probe)' }
  let sidecar
  try {
    sidecar = JSON.parse(readFileSync(resolve(ROOT, 'docs/eia-861/commercial-retail-rates.json'), 'utf8'))
  } catch { return { source, status: 'skipped', detail: 'docs/eia-861/commercial-retail-rates.json not found' } }
  const m = (sidecar.vintage || '').match(/([A-Za-z]+)\s+(\d{4})/)
  const haveYM = m && MONTHS[m[1].toLowerCase()] ? `${m[2]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}` : null
  try {
    const u = new URL('https://api.eia.gov/v2/electricity/retail-sales/data/')
    u.searchParams.set('api_key', key)
    u.searchParams.set('frequency', 'monthly')
    u.searchParams.append('data[0]', 'price')
    u.searchParams.append('facets[sectorid][]', 'COM')
    u.searchParams.append('sort[0][column]', 'period')
    u.searchParams.append('sort[0][direction]', 'desc')
    u.searchParams.set('length', '1')
    const r = await fetch(u)
    if (!r.ok) return { source, status: 'error', detail: `HTTP ${r.status} from EIA API` }
    const j = await r.json()
    const latest = j?.response?.data?.[0]?.period || null   // "YYYY-MM"
    if (!latest) return { source, status: 'error', detail: 'no period in EIA API response' }
    if (haveYM && latest > haveYM) {
      return { source, status: 'newer', detail: `EIA latest ${latest} > ours ${haveYM}. Re-source commercial-retail-rates.json, bump review_due.` }
    }
    return { source, status: 'current', detail: `EIA latest ${latest} <= ours ${haveYM || '?'}` }
  } catch (e) { return { source, status: 'error', detail: e.message } }
}

const results = await Promise.all([checkLic(), checkEia()])

const TAG = { current: '✓ current', newer: '⚠ NEWER AVAILABLE', skipped: '· skipped', error: '? error (fail-open)' }
let newer = 0, errors = 0
console.log('— Data vintage watch —')
for (const f of results) {
  console.log(`  ${TAG[f.status].padEnd(20)} ${f.source}: ${f.detail}`)
  if (f.status === 'newer') newer++
  if (f.status === 'error') errors++
}

if (newer > 0) {
  console.log(`\n${newer} source(s) have a NEWER published vintage. Re-source + bump review_due in the docs/*.json sidecar.`)
  console.log('(Detect-only by design — the human seed/impact-diff apply step stays.)')
  process.exitCode = 1   // set, don't process.exit() — lets fetch sockets close cleanly (avoids a Windows libuv teardown assertion)
} else {
  console.log(errors > 0
    ? '\nNo newer vintage confirmed (one or more probes errored — fail-open, not blocking).'
    : '\nAll watched datasets are at the current published vintage.')
}
