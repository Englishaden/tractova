/**
 * One-shot probe: list every state with cs_status IN ('active','limited')
 * and the current installed_cost_per_watt (or NULL) from revenue_rates.
 *
 * Used to scope the Lazard LCOE+ v18 recalibration — we want to know which
 * states need new revenue_rates entries vs which just need an update.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
if (!url || !key) throw new Error('Missing supabase creds')
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: programs, error: progErr } = await admin
  .from('state_programs')
  .select('id, name, cs_status, capacity_mw, lmi_percent, lmi_required, ix_difficulty, cs_program')
  .in('cs_status', ['active', 'limited'])
  .order('cs_status', { ascending: false })
  .order('id', { ascending: true })
if (progErr) throw progErr

const { data: rates, error: rateErr } = await admin
  .from('revenue_rates')
  .select('state_id, installed_cost_per_watt, capacity_factor_pct, bill_credit_cents_kwh, rec_per_mwh, label, ci_installed_cost_per_watt, bess_installed_cost_per_kwh')
if (rateErr) throw rateErr

const ratesByState = Object.fromEntries((rates || []).map(r => [r.state_id, r]))

console.log(`\nFound ${programs.length} active+limited CS states:\n`)
console.log('STATE  STATUS    CS$/W    CF%    Bill¢   REC$/MWh  LMI%  IX-diff      Program')
console.log('─'.repeat(105))
for (const p of programs) {
  const rr = ratesByState[p.id] || {}
  const csW = rr.installed_cost_per_watt != null ? `$${Number(rr.installed_cost_per_watt).toFixed(2)}` : '—'
  const cf = rr.capacity_factor_pct != null ? `${rr.capacity_factor_pct}%` : '—'
  const bc = rr.bill_credit_cents_kwh != null ? `${rr.bill_credit_cents_kwh}¢` : '—'
  const rec = rr.rec_per_mwh != null ? `$${Number(rr.rec_per_mwh).toFixed(2)}` : '—'
  console.log(
    `${p.id.padEnd(6)} ${p.cs_status.padEnd(9)} ${csW.padEnd(8)} ${cf.padEnd(6)} ${bc.padEnd(7)} ${rec.padEnd(9)} ${(p.lmi_percent ?? '—').toString().padEnd(5)} ${(p.ix_difficulty ?? '—').padEnd(12)} ${(p.cs_program ?? '').slice(0, 30)}`
  )
}

const curated = programs.filter(p => ratesByState[p.id]?.installed_cost_per_watt != null)
const uncurated = programs.filter(p => !ratesByState[p.id]?.installed_cost_per_watt)
console.log(`\nSummary: ${curated.length} have CS $/W, ${uncurated.length} need entries`)
console.log(`  Has $/W: ${curated.map(p => p.id).join(', ')}`)
console.log(`  Missing: ${uncurated.map(p => p.id).join(', ')}`)
