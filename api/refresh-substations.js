import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// Substation Refresh Cron
//
// Runs monthly (1st of each month, 6 AM UTC). Downloads EIA Form 860
// Schedule 2 (Plant level) data, filters to substations in our tracked
// states, and upserts to the substations table.
//
// EIA updates annually (typically June/July for prior year data).
// Monthly check ensures we pick up updates promptly when they land.
//
// Data source: EIA Open Data API (api.eia.gov)
// Endpoint: Electricity → Plant Level Data
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

  const results = []

  for (const stateId of TRACKED_STATES) {
    try {
      // EIA API v2 — query plant-level data for solar-relevant substations
      const url = new URL('https://api.eia.gov/v2/electricity/facility-fuel/data/')
      url.searchParams.set('api_key', apiKey)
      url.searchParams.set('frequency', 'annual')
      url.searchParams.set('data[0]', 'capacity')
      url.searchParams.set('facets[state][]', stateId)
      url.searchParams.set('sort[0][column]', 'capacity')
      url.searchParams.set('sort[0][direction]', 'desc')
      url.searchParams.set('length', '100')

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        console.error(`EIA fetch failed for ${stateId}: ${res.status}`)
        continue
      }

      const json = await res.json()
      const rows = json?.response?.data || []

      for (const row of rows) {
        const capacity = parseFloat(row.capacity)
        if (!capacity || capacity > MAX_CAPACITY_MW) continue

        results.push({
          state_id: stateId,
          name: row.plantName || row.plant_name || `Plant ${row.plantid || row.plant_id}`,
          lat: parseFloat(row.latitude) || null,
          lon: parseFloat(row.longitude) || null,
          voltage_kv: null, // EIA facility-fuel doesn't include voltage; keep existing
          capacity_mw: capacity,
          utility: row.operator_name || row.operatorName || null,
        })
      }

      console.log(`EIA: ${stateId} → ${rows.length} rows, ${results.filter(r => r.state_id === stateId).length} after filter`)
    } catch (err) {
      console.error(`EIA fetch error for ${stateId}:`, err.message)
      // Continue — don't let one state block others
    }
  }

  return results.length > 0 ? results : null
}

async function refreshFromEIA(eiaData) {
  const changes = []

  for (const row of eiaData) {
    if (!row.lat || !row.lon) continue // Skip rows without coordinates
    // Validate: skip rows outside reasonable US bounds
    if (row.lat < 24 || row.lat > 50 || row.lon < -125 || row.lon > -66) continue
    // Validate: skip capacity outliers
    if (row.capacity_mw > 5000) continue

    const { error } = await supabaseAdmin
      .from('substations')
      .upsert(row, { onConflict: 'state_id,name' })

    if (error) {
      console.error(`Upsert failed for ${row.state_id}/${row.name}:`, error.message)
    } else {
      changes.push(`${row.state_id}: ${row.name} (${row.capacity_mw} MW)`)
    }
  }

  return changes
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
  // Auth: Vercel cron header or bearer token
  const authHeader = req.headers.authorization
  const cronHeader = req.headers['x-vercel-cron']

  if (!cronHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = new Date()
  const results = { source: 'substation-refresh', changes: 0, errors: [], warnings: [] }

  try {
    const eiaData = await fetchEIAData()

    if (eiaData) {
      const changes = await refreshFromEIA(eiaData)
      results.changes = changes.length

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
    results.errors.push(err.message)
    console.error('Substation refresh failed:', err)
  }

  // Log cron run for observability
  await supabaseAdmin.from('cron_runs').insert({
    cron_name: 'substation-refresh',
    status: results.errors.length > 0 ? 'partial' : 'success',
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    summary: results,
  }).catch(err => console.error('Failed to log cron run:', err.message))

  const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1)
  return res.status(200).json({
    ...results,
    elapsed: `${elapsed}s`,
    tracked_states: TRACKED_STATES,
  })
}
