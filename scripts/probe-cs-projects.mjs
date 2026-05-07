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

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Get ALL cs_projects rows (4280 rows)
const { data, error, count } = await admin
  .from('cs_projects')
  .select('state', { count: 'exact' })

console.log(`Total rows: ${count}`)
console.log(`Returned rows: ${data?.length || 0}`)

if (data) {
  const byState = {}
  for (const r of data) {
    byState[r.state] = (byState[r.state] || 0) + 1
  }
  console.log(`\nUnique states: ${Object.keys(byState).length}`)
  console.log(`State distribution:`)
  for (const [s, c] of Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  ${s}: ${c}`)
  }
}
