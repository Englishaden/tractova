/**
 * Offtake-rate derivation / refresh (Phase 4b).
 *
 * Re-pulls every state's commercial retail rate (¢/kWh) from EIA via the SHARED
 * helper (api/lib/_eiaCommercialRates.js — the same fetch the substations cron
 * uses, so the two never drift) and:
 *   - refreshes docs/eia-861/commercial-retail-rates.json — the SOURCED rate
 *     layer backing CI_OFFTAKE_SCORES (mirrors the docs/dsire-net-billing/
 *     on-disk-sourcing convention);
 *   - re-derives the new-cohort `score` via the disclosed formula
 *     (offtakeScoreFromRate) — the two-layer-honesty contract;
 *   - reports DRIFT for ALL states between the live EIA rate and the committed
 *     sidecar, so the hand-tuned legacy scores (TX/CA/FL…) get flagged for a
 *     re-tune when their underlying rate moves materially (the formula is NOT
 *     auto-applied to those — their market-depth boost is editorial).
 *
 * Why offline (not a prod cron): the sourced rate layer is a COMMITTED file +
 * a build-time constant (CI_OFFTAKE_SCORES) — a serverless function can't commit
 * to git, and the offtake SCORE reads the constant, not the DB. Freshness is
 * auto-DETECTED by scripts/audit-check.mjs (fails CI when review_due passes) +
 * scripts/check-data-vintages.mjs (probes EIA for a newer vintage); this script
 * is the re-source step that detection triggers. Same model as nmtc_lic /
 * solar_costs.
 *
 *   Needs EIA_API_KEY in .env.local (Vercel-only normally). Without it, prints a
 *   skip + exits 0 (like check-data-vintages).
 *
 *   Usage:  node scripts/seed-offtake-rates.mjs            # dry-run: fetch + drift report
 *           node scripts/seed-offtake-rates.mjs --write    # also rewrite the sidecar JSON
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchCommercialRates, offtakeScoreFromRate, OFFTAKE_FORMULA } from '../api/lib/_eiaCommercialRates.js'

// ── env loader (same pattern as the other seeds) ──
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
} catch { /* no .env.local */ }

const WRITE = process.argv.slice(2).includes('--write')
const SIDECAR = resolve(process.cwd(), 'docs/eia-861/commercial-retail-rates.json')
const ALL_50_DC = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const apiKey = process.env.EIA_API_KEY
if (!apiKey) {
  console.log('⏭  No EIA_API_KEY in .env.local — skipping the live offtake-rate pull.')
  console.log('   (The key is normally Vercel-only. Add it locally to run this re-source step.)')
  console.log('   Freshness is still auto-gated by scripts/audit-check.mjs (review_due) +')
  console.log('   scripts/check-data-vintages.mjs. Nothing to do without the key.')
  process.exit(0)
}

const sidecar = JSON.parse(readFileSync(SIDECAR, 'utf8'))
const newCohort = sidecar.new_cohort || {}

console.log(`→ Fetching commercial ¢/kWh for ${ALL_50_DC.length} states/DC from EIA (formula: ${OFFTAKE_FORMULA})`)
const results = await fetchCommercialRates(ALL_50_DC, apiKey)
const byState = new Map(results.map(r => [r.stateId, r]))

const errors = results.filter(r => r.error)
if (errors.length) console.log(`   ⚠ ${errors.length} states errored: ${errors.map(e => `${e.stateId}(${e.error})`).join(', ')}`)

// Drift report (all states): live rate vs the committed sidecar new_cohort rate.
let cohortDrift = 0
console.log('\n── New-cohort drift (formula-derived states) ──')
for (const [state, row] of Object.entries(newCohort)) {
  const live = byState.get(state)
  if (!live || live.error) { console.log(`   ${state}: live fetch failed — keeping committed ${row.commercial_cents_kwh}¢`); continue }
  const newScore = offtakeScoreFromRate(live.rateCentsKwh)
  const moved = Math.abs(live.rateCentsKwh - row.commercial_cents_kwh) >= 0.5 || newScore !== row.score
  if (moved) {
    cohortDrift++
    console.log(`   ${state}: ${row.commercial_cents_kwh}¢→${live.rateCentsKwh}¢  score ${row.score}→${newScore}${live.period ? `  (EIA ${live.period})` : ''}`)
  }
}
if (!cohortDrift) console.log('   (no material drift — committed new-cohort rates still current)')

// Hand-tuned legacy states aren't formula-driven; just surface the live rate so
// a big move flags an editorial re-tune. We DON'T auto-edit those scores.
console.log('\n── Legacy hand-tuned + gated states — live rate (FYI, scores not auto-derived) ──')
const legacy = ALL_50_DC.filter(s => !(s in newCohort))
console.log('   ' + legacy.map(s => { const r = byState.get(s); return `${s}:${r && !r.error ? r.rateCentsKwh + '¢' : '—'}` }).join('  '))

if (!WRITE) {
  console.log('\n(dry-run — re-run with --write to rewrite the sidecar new_cohort + vintage/fetched/review_due)')
  process.exit(0)
}

// ── --write: refresh the sidecar new_cohort rates+scores + meta ──
for (const [state, row] of Object.entries(newCohort)) {
  const live = byState.get(state)
  if (!live || live.error) continue
  row.commercial_cents_kwh = live.rateCentsKwh
  row.score = offtakeScoreFromRate(live.rateCentsKwh)
}
// Bump fetched to today; reviewer sets the EIA vintage + a fresh review_due.
// (We don't synthesize a vintage string — that comes from the EIA table header.)
const today = new Date().toISOString().slice(0, 10)
sidecar.fetched = today
sidecar._refresh_note = `Rates refreshed ${today} by scripts/seed-offtake-rates.mjs (live EIA). Reviewer: confirm the EIA EPM 5.6.B vintage string + bump review_due, then regenerate the CI_OFFTAKE_SCORES new-cohort block in src/lib/scoreEngine.js to match these scores.`
writeFileSync(SIDECAR, JSON.stringify(sidecar, null, 2) + '\n')
console.log(`\n✓ Rewrote ${SIDECAR} (${Object.keys(newCohort).length} new-cohort states refreshed).`)
console.log('  ⏭ Next: update the EIA `vintage` + `review_due` by hand, then sync the CI_OFFTAKE_SCORES')
console.log('    new-cohort block in src/lib/scoreEngine.js (the eiaCommercialRates test pins them to the formula).')
