/**
 * Sub-score coverage matrix — operator's bird's-eye view of data readiness.
 *
 * For all 50 states + DC, reports the data-coverage tier behind each of the
 * three feasibility pillars, read straight from the source tables (no scoring,
 * no AI, no guessing — read-only):
 *
 *   - Offtake   ← state_programs.cs_status   (active / limited / pending / none)
 *   - IX        ← ix_queue_data              (LIVE if rows exist; freshness from
 *                                             oldest fetched_at → fresh/STALE;
 *                                             else "curated" — no live queue feed)
 *   - Site      ← county_geospatial_data     (LIVE = N counties with NWI/SSURGO)
 *
 * This is the aggregate version of the per-project LIVE / RESEARCHED / STALE
 * badges the Lens already shows — same signals, all states on one page, so you
 * can see where the data is solid vs. a gap before recording onboarding.
 *
 * Usage:  node scripts/coverage-matrix.mjs
 * Cost: $0 (anon-key reads only). Read-only.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / anon key in .env.local'); process.exit(1) }
const sb = createClient(URL, KEY)

const STALE_DAYS = 14 // IX live data older than this reads STALE (scraper lag)

const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','D.C.'],['FL','Florida'],
  ['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],
  ['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],
  ['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],
  ['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],
  ['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],
  ['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],
  ['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],
  ['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
]

// Fetch every row of a table/column set, paging past Supabase's 1000-row cap.
async function fetchAll(table, columns) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

const programs = await fetchAll('state_programs', '*')
const ix = await fetchAll('ix_queue_data', 'state_id, fetched_at')
const geo = await fetchAll('county_geospatial_data', 'state')

// Index by state
const progBy = new Map()
for (const p of programs) progBy.set(p.id ?? p.state_id, p)

const ixBy = new Map() // state -> { count, oldest }
for (const r of ix) {
  const s = r.state_id; if (!s) continue
  const e = ixBy.get(s) || { count: 0, oldest: null }
  e.count++
  if (r.fetched_at && (!e.oldest || r.fetched_at < e.oldest)) e.oldest = r.fetched_at
  ixBy.set(s, e)
}

const geoBy = new Map() // state -> county count
for (const r of geo) { const s = r.state; if (!s) continue; geoBy.set(s, (geoBy.get(s) || 0) + 1) }

const ageDays = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null

const rows = STATES.map(([id, name]) => {
  const p = progBy.get(id)
  const offtake = p?.cs_status ?? p?.csStatus ?? 'none'
  const ixe = ixBy.get(id)
  let ixCell
  if (!ixe) ixCell = 'curated'
  else {
    const d = ageDays(ixe.oldest)
    ixCell = d != null && d > STALE_DAYS ? `LIVE·STALE ${d}d` : `LIVE ${d ?? '?'}d`
  }
  const counties = geoBy.get(id) || 0
  const site = counties > 0 ? `LIVE ${counties}co` : 'none'
  return { id, name, offtake, ix: ixCell, ixLive: !!ixe, ixStale: ixe ? ageDays(ixe.oldest) > STALE_DAYS : false, site, counties }
})

// ── print matrix ─────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n)
console.log('\nSUB-SCORE COVERAGE MATRIX  ·  all 50 states + DC  ·  read-only from source tables\n')
console.log(pad('STATE', 16) + pad('OFFTAKE (cs_status)', 22) + pad('IX (queue data)', 20) + 'SITE (geospatial)')
console.log('─'.repeat(74))
for (const r of rows) {
  console.log(pad(`${r.id} ${r.name}`, 16) + pad(r.offtake, 22) + pad(r.ix, 20) + r.site)
}

// ── summary ──────────────────────────────────────────────────────────────────
const byStatus = {}
for (const r of rows) byStatus[r.offtake] = (byStatus[r.offtake] || 0) + 1
const ixLive = rows.filter(r => r.ixLive).length
const ixStale = rows.filter(r => r.ixStale).length
const siteLive = rows.filter(r => r.counties > 0).length
console.log('\n── SUMMARY ──')
console.log(`OFFTAKE  · ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(' · ')}`)
console.log(`IX       · ${ixLive}/51 have LIVE queue data · of those, ${ixStale} are STALE (>${STALE_DAYS}d) · ${51 - ixLive} curated-only (no live feed)`)
console.log(`SITE     · ${siteLive}/51 have LIVE geospatial · ${rows.reduce((s, r) => s + r.counties, 0)} counties total`)
console.log('')
