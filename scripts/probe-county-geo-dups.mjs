/**
 * Read-only: characterize the county_geospatial_data row over-count flagged by
 * the coverage matrix (~3,969 rows vs ~3,143 counties). PK is county_fips so
 * there are no exact dups — the extras are FIPS that don't correspond to a real
 * county. Reports: total, malformed FIPS, FIPS not present in county_acs_data
 * (the canonical 3,143), grouped by state, with samples.
 *
 * Usage:  node scripts/probe-county-geo-dups.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function fetchAll(table, cols) {
  const out = []; let from = 0; const page = 1000
  for (;;) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + page - 1)
    if (error) { console.error(`[${table}]`, error.message); process.exit(1) }
    out.push(...data); if (data.length < page) break; from += page
  }
  return out
}

const geo = await fetchAll('county_geospatial_data', 'county_fips, state, ssurgo_areasymbol')
const acs = await fetchAll('county_acs_data', 'county_fips')
const acsSet = new Set(acs.map(r => r.county_fips))

console.log(`county_geospatial_data rows: ${geo.length}`)
console.log(`county_acs_data rows (canonical): ${acs.length}`)
console.log(`distinct geo county_fips: ${new Set(geo.map(r => r.county_fips)).size}`)

const malformed = geo.filter(r => !/^\d{5}$/.test(String(r.county_fips || '')))
console.log(`\nmalformed geo county_fips (not 5 digits): ${malformed.length}`)
if (malformed.length) console.log('  samples:', malformed.slice(0, 15).map(r => `${r.county_fips}(${r.state}|${r.ssurgo_areasymbol || '-'})`).join(', '))

const notInAcs = geo.filter(r => !acsSet.has(r.county_fips))
console.log(`\ngeo FIPS NOT in county_acs_data (the 'extra' rows): ${notInAcs.length}`)
const byState = {}
for (const r of notInAcs) byState[r.state] = (byState[r.state] || 0) + 1
console.log('  by state:', JSON.stringify(Object.fromEntries(Object.entries(byState).sort((a, b) => b[1] - a[1]))))
console.log('  samples:', notInAcs.slice(0, 25).map(r => `${r.county_fips}(${r.state}|ssurgo=${r.ssurgo_areasymbol || '-'})`).join(', '))

// reverse: canonical counties MISSING geospatial coverage
const geoSet = new Set(geo.map(r => r.county_fips))
const missing = acs.filter(r => !geoSet.has(r.county_fips))
console.log(`\ncanonical counties MISSING from geospatial: ${missing.length}`)
