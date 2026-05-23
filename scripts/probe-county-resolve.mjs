/**
 * Read-only: validate the county-name → FIPS resolution against county_acs_data,
 * mirroring src/lib/programData.js resolveCountyFips. Confirms the independent-
 * city / county collisions resolve to DISTINCT correct FIPS, and that normal
 * counties + parishes + the 'Charles City County' edge still resolve.
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
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function resolveCountyFips(stateId, countyName) {
  const rawName = String(countyName || '').trim()
  if (!stateId || !rawName) return null
  const wantCity = /\(city\)\s*$/i.test(rawName)
  const base = rawName.replace(/\s*\(city\)\s*$/i, '').replace(/,.*$/, '')
    .replace(/\s+(county|parish|borough|census area|municipality)$/i, '').trim()
  const stripType = (cn) => String(cn).replace(/,.*$/, '').replace(/\s+(county|parish|borough|census area|municipality|city)$/i, '').trim().toLowerCase()
  const isCityRow = (cn) => /\bcity$/i.test(String(cn).replace(/,.*$/, '').trim())
  const baseL = base.toLowerCase()
  const pick = (rows) => {
    if (!rows || rows.length === 0) return null
    let cands = rows.filter(r => stripType(r.county_name) === baseL)
    if (cands.length === 0) cands = rows
    const m = wantCity ? cands.find(r => isCityRow(r.county_name)) : (cands.find(r => !isCityRow(r.county_name)) || cands[0])
    return m ? { fips: m.county_fips, name: m.county_name } : null
  }
  const { data } = await supabase.from('county_acs_data').select('county_fips, county_name').eq('state', stateId).ilike('county_name', `${base} %`).limit(12)
  if (data && data.length) return pick(data)
  const { data: d2 } = await supabase.from('county_acs_data').select('county_fips, county_name').eq('state', stateId).ilike('county_name', `%${base}%`).limit(12)
  return pick(d2)
}

const cases = [
  ['VA', 'Fairfax',          '51059'],
  ['VA', 'Fairfax (city)',   '51600'],
  ['VA', 'Franklin',         '51067'],
  ['VA', 'Franklin (city)',  '51620'],
  ['VA', 'Richmond',         '51159'],
  ['VA', 'Richmond (city)',  '51760'],
  ['VA', 'Roanoke',          '51161'],
  ['VA', 'Roanoke (city)',   '51770'],
  ['VA', 'Charles City',     '51036'],  // a COUNTY that contains 'City'
  ['VA', 'James City',       '51095'],  // a COUNTY that contains 'City'
  ['MD', 'Baltimore',        '24005'],
  ['MD', 'Baltimore (city)', '24510'],
  ['MO', 'St. Louis',        '29189'],
  ['MO', 'St. Louis (city)', '29510'],
  ['IL', 'Will',             '17197'],  // must NOT resolve to Williamson (17199)
  ['LA', 'Acadia',           '22001'],  // parish
  ['IL', 'Cook',             '17031'],
  ['MN', 'Lake',             '27075'],  // must NOT grab 'Lake of the Woods' (27077)
  ['MN', 'Lake of the Woods','27077'],
]

console.log('state county(dropdown)        → resolved FIPS / name        [expected]  result')
let pass = 0, fail = 0
for (const [st, name, expected] of cases) {
  const r = await resolveCountyFips(st, name)
  const got = r?.fips ?? 'NULL'
  const ok = got === expected
  if (ok) pass++; else fail++
  console.log(`${st}  ${name.padEnd(20)} → ${String(got).padEnd(6)} ${(r?.name || '').padEnd(28)} [${expected}]  ${ok ? 'PASS' : '*** FAIL ***'}`)
}
console.log(`\n${pass} pass / ${fail} fail`)
