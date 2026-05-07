import { createClient } from '@supabase/supabase-js'
import { isAdminFromBearer } from './_admin-auth.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Data Refresh Cron
//
// Runs monthly (1st of each month, 6 AM UTC). Two tasks:
//
// 1. Substations — Downloads EIA Form 860 Schedule 2 (Plant level) data,
//    filters to substations in tracked states, upserts to substations table.
//
// 2. Retail Electricity Rates — Downloads EIA state-average retail rates,
//    upserts to revenue_rates.ci_retail_rate_cents_kwh for C&I PPA model.
//
// Data source: EIA Open Data API (api.eia.gov)
// ─────────────────────────────────────────────────────────────────────────────

const TRACKED_STATES = ['IL', 'NY', 'MA', 'MN', 'CO', 'NJ', 'MD', 'ME']

// Voltage threshold — we only care about substations >= 69kV for solar IX
const MIN_VOLTAGE_KV = 69

// Max capacity — filter to substations relevant for DG/community solar
const MAX_CAPACITY_MW = 1000

// EIA state FIPS → abbreviation mapping
const FIPS_TO_STATE = {
  '17': 'IL', '36': 'NY', '25': 'MA', '27': 'MN',
  '08': 'CO', '34': 'NJ', '24': 'MD', '23': 'ME',
}

async function fetchEIAData() {
  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) {
    console.log('No EIA_API_KEY set — skipping EIA fetch, using existing data')
    return null
  }

  // Parallel per-state — sequential 8 × 15s timeout would exceed the 60s
  // Vercel function budget on slow EIA runs (occasional 504s observed).
  // Each state's call is independent; no shared mutable state across them.
  const settled = await Promise.allSettled(TRACKED_STATES.map(async (stateId) => {
    const url = new URL('https://api.eia.gov/v2/electricity/facility-fuel/data/')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('frequency', 'annual')
    url.searchParams.set('data[0]', 'capacity')
    url.searchParams.set('facets[state][]', stateId)
    url.searchParams.set('sort[0][column]', 'capacity')
    url.searchParams.set('sort[0][direction]', 'desc')
    url.searchParams.set('length', '100')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`EIA HTTP ${res.status}`)
    const json = await res.json()
    const rows = json?.response?.data || []

    const stateResults = []
    for (const row of rows) {
      const capacity = parseFloat(row.capacity)
      if (!capacity || capacity > MAX_CAPACITY_MW) continue
      stateResults.push({
        state_id: stateId,
        name: row.plantName || row.plant_name || `Plant ${row.plantid || row.plant_id}`,
        lat: parseFloat(row.latitude) || null,
        lon: parseFloat(row.longitude) || null,
        // voltage_kv omitted — EIA doesn't include it; preserves existing values on upsert
        capacity_mw: capacity,
        utility: row.operator_name || row.operatorName || null,
      })
    }
    return stateResults
  }))

  const results = []
  for (let i = 0; i < TRACKED_STATES.length; i++) {
    const r = settled[i]
    if (r.status === 'fulfilled') results.push(...r.value)
    else console.error(`EIA fetch error for ${TRACKED_STATES[i]}:`, r.reason?.message || r.reason)
  }

  return results.length > 0 ? results : null
}

async function refreshFromEIA(eiaData) {
  // Validate + bucket by state, then issue one batched upsert per state in
  // parallel. Replaces the prior row-by-row sequential upsert which was the
  // dominant tail-latency source on this cron — 8 states × ~100 rows ×
  // ~25ms per supabase round-trip = ~20s spent in supabase alone, which is
  // exactly the drift the latency monitor flagged (p95=34s on a 60s ceiling,
  // 57% utilization, WATCH severity). Parallel batched upsert collapses
  // this to ~1-2s.
  const validRowsByState = {}
  for (const row of eiaData) {
    if (!row.lat || !row.lon) continue                                         // missing coords
    if (row.lat < 24 || row.lat > 50 || row.lon < -125 || row.lon > -66) continue  // outside US bounds
    if (row.capacity_mw > 5000) continue                                       // capacity outlier
    if (!validRowsByState[row.state_id]) validRowsByState[row.state_id] = []
    validRowsByState[row.state_id].push(row)
  }

  const settled = await Promise.allSettled(
    Object.entries(validRowsByState).map(async ([stateId, rows]) => {
      const { error } = await supabaseAdmin
        .from('substations')
        .upsert(rows, { onConflict: 'state_id,name' })
      if (error) throw new Error(`${stateId} batch upsert: ${error.message}`)
      return { stateId, rows }
    })
  )

  const changes = []
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const row of r.value.rows) {
        changes.push(`${row.state_id}: ${row.name} (${row.capacity_mw} MW)`)
      }
    } else {
      console.error('Substation batch upsert failed:', r.reason?.message || r.reason)
    }
  }
  return changes
}

// ── EIA Retail Electricity Rates ──────────────────────────────────────────────
// Fetches state-average retail rates from EIA electricity/retail-sales endpoint.
// Writes to revenue_rates.ci_retail_rate_cents_kwh for C&I PPA model comparisons.
// Data is annual — monthly check picks up new year's data when published.

async function fetchRetailRates() {
  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) return { updated: 0, skipped: 'No EIA_API_KEY' }

  const results = { updated: 0, errors: [], details: [] }

  // Parallel per-state — same reasoning as fetchEIAData. Each state's
  // entire chain (EIA fetch → existing-row read → upsert → optional
  // data_updates audit insert) runs independently; the only shared
  // mutable state is `results`, mutated only after Promise.allSettled
  // resolves.
  const settled = await Promise.allSettled(TRACKED_STATES.map(async (stateId) => {
    const url = new URL('https://api.eia.gov/v2/electricity/retail-sales/data/')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('frequency', 'annual')
    url.searchParams.set('data[0]', 'price')
    url.searchParams.set('facets[stateid][]', stateId)
    url.searchParams.set('facets[sectorid][]', 'COM')  // Commercial sector
    url.searchParams.set('sort[0][column]', 'period')
    url.searchParams.set('sort[0][direction]', 'desc')
    url.searchParams.set('length', '1')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return { stateId, error: `HTTP ${res.status}` }

    const json = await res.json()
    const row = json?.response?.data?.[0]
    if (!row?.price) return { stateId, error: 'no price data returned' }

    const rateCentsKwh = parseFloat(row.price)
    if (isNaN(rateCentsKwh) || rateCentsKwh <= 0 || rateCentsKwh > 100) {
      return { stateId, error: `invalid price ${row.price}` }
    }

    const { data: existing } = await supabaseAdmin
      .from('revenue_rates')
      .select('ci_retail_rate_cents_kwh')
      .eq('state_id', stateId)
      .single()
    const oldRate = existing?.ci_retail_rate_cents_kwh

    const { error } = await supabaseAdmin
      .from('revenue_rates')
      .upsert({ state_id: stateId, ci_retail_rate_cents_kwh: rateCentsKwh }, { onConflict: 'state_id' })

    if (error) return { stateId, error: `upsert failed — ${error.message}` }

    if (oldRate != null && oldRate !== rateCentsKwh) {
      try {
        await supabaseAdmin.from('data_updates').insert({
          table_name: 'revenue_rates',
          row_id: stateId,
          field: 'ci_retail_rate_cents_kwh',
          old_value: String(oldRate),
          new_value: String(rateCentsKwh),
          updated_by: 'eia-retail-rates',
        })
      } catch { /* best-effort logging */ }
    }

    return { stateId, rateCentsKwh, period: row.period }
  }))

  for (let i = 0; i < TRACKED_STATES.length; i++) {
    const stateId = TRACKED_STATES[i]
    const r = settled[i]
    if (r.status === 'rejected') {
      results.errors.push(`${stateId}: ${r.reason?.message || r.reason}`)
      continue
    }
    const v = r.value
    if (v.error) {
      results.errors.push(`${stateId}: ${v.error}`)
    } else {
      results.updated++
      results.details.push(`${stateId}: ${v.rateCentsKwh}¢/kWh (period: ${v.period})`)
    }
  }

  console.log(`Retail rates refresh: ${results.updated} updated, ${results.errors.length} errors`)
  return results
}

async function logUpdate(stateId, changeCount, details) {
  try {
    await supabaseAdmin.from('data_updates').insert({
      table_name: 'substations',
      row_id: stateId || 'all',
      field: 'bulk_refresh',
      old_value: null,
      new_value: `${changeCount} records: ${details}`,
      updated_by: 'substation-refresh-eia',
    })
  } catch (err) {
    console.error('Failed to log update:', err.message)
  }
}

export default async function handler(req, res) {
  try {
    return await handlerInner(req, res)
  } catch (err) {
    console.error('[refresh-substations] uncaught:', err)
    return res.status(500).json({
      error: err?.message || String(err),
      where: 'refresh-substations',
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })
  }
}

async function handlerInner(req, res) {
  // Auth: Vercel cron header, CRON_SECRET bearer, or admin-user JWT.
  const authHeader = req.headers.authorization
  const cronHeader = req.headers['x-vercel-cron']

  const isVercelCron = cronHeader === '1'
  const isBearerAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  let isAdminAuth = false
  if (!isVercelCron && !isBearerAuth && authHeader?.startsWith('Bearer ')) {
    // C1 fix 2026-05-05: role-based admin check via profiles.role (057)
    // with legacy email fallback during rollout.
    const adminCheck = await isAdminFromBearer(supabaseAdmin, authHeader)
    if (adminCheck.ok) isAdminAuth = true
  }

  if (!isVercelCron && !isBearerAuth && !isAdminAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = new Date()
  const results = { source: 'monthly-data-refresh', substations: 0, retailRates: 0, errors: [], warnings: [] }

  // ── Task 1: Substations ──
  try {
    const eiaData = await fetchEIAData()

    if (eiaData) {
      const changes = await refreshFromEIA(eiaData)
      results.substations = changes.length

      if (changes.length > 0) {
        await logUpdate(
          'all',
          changes.length,
          `Updated from EIA. Samples: ${changes.slice(0, 5).join('; ')}`
        )
      }

      console.log(`Substation refresh complete: ${changes.length} upserted from EIA`)
    } else {
      console.log('No EIA data returned — substations unchanged')
      await logUpdate('all', 0, 'No EIA API key or no new data returned')
    }
  } catch (err) {
    results.errors.push(`substations: ${err.message}`)
    console.error('Substation refresh failed:', err)
  }

  // ── Task 2: Retail Electricity Rates ──
  try {
    const rateResults = await fetchRetailRates()
    results.retailRates = rateResults.updated
    if (rateResults.errors?.length > 0) {
      results.warnings.push(...rateResults.errors.map(e => `retail-rates: ${e}`))
    }
    if (rateResults.details?.length > 0) {
      results.retailRateDetails = rateResults.details
    }
  } catch (err) {
    results.errors.push(`retail-rates: ${err.message}`)
    console.error('Retail rates refresh failed:', err)
  }

  // Log cron run for observability
  try {
    await supabaseAdmin.from('cron_runs').insert({
      cron_name: 'monthly-data-refresh',
      status: results.errors.length > 0 ? 'partial' : 'success',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      summary: results,
    })
  } catch (err) {
    console.error('Failed to log cron run:', err.message)
  }

  const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1)
  return res.status(200).json({
    ...results,
    elapsed: `${elapsed}s`,
    tracked_states: TRACKED_STATES,
  })
}
