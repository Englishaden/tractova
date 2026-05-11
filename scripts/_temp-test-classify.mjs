// One-shot: hit the deployed /api/lens-insight policy-classify endpoint
// with a minimal payload and dump the response shape. If draft has a
// raw_provisions key with structured values, v=5 (tool use) is live.
// If draft is missing raw_provisions / discovery_metadata, v=5 didn't deploy.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of raw.split(/\r?\n/)) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data } = await supa.auth.signInWithPassword({
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
})
const token = data.session.access_token

// Use distinctive text so we don't collide with any existing cache entry.
const testText = `Test policy classification payload, ${new Date().toISOString()} — Maine LD 1777 sample: Projects 1-3 MW AC charged $2.80/kW AC monthly; 3-5 MW AC charged $6/kW AC monthly. Effective Jan 1 2025. Existing community solar projects affected retroactively. No safe-harbor clause for already-energized projects.`

const t0 = Date.now()
const resp = await fetch('https://www.tractova.com/api/lens-insight', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    action:        'policy-classify',
    rawText:       testText,
    stateHint:     'ME',
    eventNameHint: 'LD 1777 (test probe)',
  }),
})
const dur = Date.now() - t0
const body = await resp.text()
console.log('HTTP:', resp.status, 'duration:', dur, 'ms')
let json = null
try { json = JSON.parse(body) } catch {}
if (!json) {
  console.log('BODY (raw):', body.slice(0, 600))
} else {
  console.log('top-level keys:', Object.keys(json).join(', '))
  if (json.draft) {
    const d = json.draft
    console.log('\n--- DRAFT ---')
    console.log('keys:', Object.keys(d).sort().join(', '))
    console.log('has raw_provisions?', 'raw_provisions' in d, 'value:', JSON.stringify(d.raw_provisions))
    console.log('has discovery_metadata?', 'discovery_metadata' in d, 'value:', JSON.stringify(d.discovery_metadata))
    console.log('impact_confidence:', d.impact_confidence)
    console.log('impact fields: capex=', d.capex_impact_per_mw_usd, '| irr=', d.irr_impact_bps, '| ongoing=', d.ongoing_fee_per_mw_yr_usd, '| haircut=', d.revenue_haircut_pct)
    console.log('\nimpact_methodology (' + (d.impact_methodology?.length || 0) + ' chars):')
    console.log(d.impact_methodology)
  }
  if (json.fallback) {
    console.log('\nFALLBACK reason:', json.reason)
  }
}
