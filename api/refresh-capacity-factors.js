import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// Capacity Factor Refresh — Annual Cron
//
// Fetches solar capacity factors from NREL PVWatts API v8 for each tracked
// state. Uses a representative central lat/lon per state.
//
// Writes to revenue_rates.capacity_factor_pct (Community Solar) and
// revenue_rates.ci_capacity_factor_pct (C&I Solar).
//
// Schedule: quarterly (Jan 1, Apr 1, Jul 1, Oct 1) — capacity factors are
// based on TMY data and rarely change, but quarterly checks catch any
// NREL data updates.
//
// Data source: NREL PVWatts API v8 (developer.nrel.gov)
// Requires: NREL_API_KEY env var (free from developer.nrel.gov)
// ─────────────────────────────────────────────────────────────────────────────

// Representative lat/lon for each tracked state (approximate geographic center
// of major solar development areas, not geometric center of state)
const STATE_COORDS = {
  IL: { lat: 40.10, lon: -89.15 },   // Central IL (Springfield area)
  NY: { lat: 42.65, lon: -73.75 },   // Capital District (Albany area)
  MA: { lat: 42.35, lon: -71.90 },   // Central MA (Worcester area)
  MN: { lat: 44.95, lon: -93.25 },   // Twin Cities metro
  CO: { lat: 39.75, lon: -104.87 },  // Denver metro / Front Range
  NJ: { lat: 40.20, lon: -74.75 },   // Central NJ
  MD: { lat: 39.30, lon: -76.60 },   // Baltimore / Central MD
  ME: { lat: 44.10, lon: -69.80 },   // Central ME (Augusta area)
}

// PVWatts default system assumptions for community solar
const SYSTEM_DEFAULTS = {
  system_capacity: 5000,    // 5 MW DC (typical CS project)
  module_type: 1,           // Standard crystalline silicon
  losses: 14,               // 14% system losses (industry standard)
  array_type: 0,            // Fixed open rack (ground mount)
  tilt: 20,                 // Near-optimal for mid-latitudes
  azimuth: 180,             // South-facing
}

async function fetchCapacityFactor(stateId, coords) {
  const apiKey = process.env.NREL_API_KEY
  if (!apiKey) return null

  const url = new URL('https://developer.nrel.gov/api/pvwatts/v8.json')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('lat', coords.lat)
  url.searchParams.set('lon', coords.lon)
  url.searchParams.set('system_capacity', SYSTEM_DEFAULTS.system_capacity)
  url.searchParams.set('module_type', SYSTEM_DEFAULTS.module_type)
  url.searchParams.set('losses', SYSTEM_DEFAULTS.losses)
  url.searchParams.set('array_type', SYSTEM_DEFAULTS.array_type)
  url.searchParams.set('tilt', SYSTEM_DEFAULTS.tilt)
  url.searchParams.set('azimuth', SYSTEM_DEFAULTS.azimuth)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`PVWatts HTTP ${res.status}`)

  const json = await res.json()
  if (json.errors?.length > 0) throw new Error(json.errors.join('; '))

  const annualKwh = json?.outputs?.ac_annual
  if (!annualKwh) throw new Error('No ac_annual in response')

  // Capacity factor = actual output / theoretical max
  // theoretical max = system_capacity_kW * 8760 hours
  const theoreticalMax = SYSTEM_DEFAULTS.system_capacity * 8760
  const capacityFactor = (annualKwh / theoreticalMax) * 100 // as percentage

  return Math.round(capacityFactor * 10) / 10 // one decimal place
}

export default async function handler(req, res) {
  try {
    return await handlerInner(req, res)
  } catch (err) {
    console.error('[refresh-capacity-factors] uncaught:', err)
    return res.status(500).json({
      error: err?.message || String(err),
      where: 'refresh-capacity-factors',
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })
  }
}

async function handlerInner(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const authHeader = req.headers.authorization
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isBearerAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  let isAdminAuth = false
  if (!isVercelCron && !isBearerAuth && authHeader?.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      if (user?.email === 'aden.walker67@gmail.com') isAdminAuth = true
    } catch (_) { /* fall through */ }
  }

  if (!isVercelCron && !isBearerAuth && !isAdminAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.NREL_API_KEY
  if (!apiKey) {
    return res.status(200).json({ skipped: true, reason: 'No NREL_API_KEY configured' })
  }

  const startedAt = new Date()
  const results = { updated: 0, unchanged: 0, errors: [], details: [] }

  for (const [stateId, coords] of Object.entries(STATE_COORDS)) {
    try {
      const cfPct = await fetchCapacityFactor(stateId, coords)
      if (cfPct == null) continue

      // Validate: reasonable range for US solar (10-30%)
      if (cfPct < 10 || cfPct > 30) {
        results.errors.push(`${stateId}: capacity factor ${cfPct}% outside expected range`)
        continue
      }

      // Fetch existing to detect changes
      const { data: existing } = await supabaseAdmin
        .from('revenue_rates')
        .select('capacity_factor_pct, ci_capacity_factor_pct')
        .eq('state_id', stateId)
        .single()

      const oldCS = existing?.capacity_factor_pct
      const oldCI = existing?.ci_capacity_factor_pct

      // Update both CS and C&I capacity factors (same underlying solar resource)
      const { error } = await supabaseAdmin
        .from('revenue_rates')
        .upsert({
          state_id: stateId,
          capacity_factor_pct: cfPct,
          ci_capacity_factor_pct: cfPct,
        }, { onConflict: 'state_id' })

      if (error) {
        results.errors.push(`${stateId}: upsert failed — ${error.message}`)
        continue
      }

      // Log changes
      if (oldCS !== cfPct || oldCI !== cfPct) {
        results.updated++
        results.details.push(`${stateId}: ${cfPct}% (was CS:${oldCS ?? '—'}, CI:${oldCI ?? '—'})`)

        if (oldCS != null && oldCS !== cfPct) {
          await supabaseAdmin.from('data_updates').insert({
            table_name: 'revenue_rates',
            row_id: stateId,
            field: 'capacity_factor_pct',
            old_value: String(oldCS),
            new_value: String(cfPct),
            updated_by: 'nrel-pvwatts',
          }).catch(() => {})
        }
      } else {
        results.unchanged++
      }

      console.log(`PVWatts ${stateId}: ${cfPct}% capacity factor`)
    } catch (err) {
      results.errors.push(`${stateId}: ${err.message}`)
      console.error(`PVWatts error for ${stateId}:`, err.message)
    }
  }

  // Log cron run
  await supabaseAdmin.from('cron_runs').insert({
    cron_name: 'capacity-factor-refresh',
    status: results.errors.length > 0 ? 'partial' : 'success',
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    summary: results,
  }).catch(err => console.error('Failed to log cron run:', err.message))

  return res.status(200).json({
    ...results,
    elapsed: `${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`,
  })
}
