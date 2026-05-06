/**
 * LBNL Tracking the Sun — annual ingestion of per-state PV installed-cost
 * percentiles. Stores OBSERVED upstream truth in solar_cost_index (the table
 * is data lineage; engine still reads Tractova's 2026-forward synthesis from
 * revenue_rates.installed_cost_per_watt — see migration 048 header).
 *
 * Cadence: cron fires Nov 1 each year (LBNL releases new TTS in mid-October;
 * 2-week buffer for late-publishing). Manual reseed via
 * scripts/seed-solar-cost-index.mjs.
 *
 * LBNL_TTS_CSV_URL env var:
 *   The URL to the LBNL TTS public CSV. LBNL's filename convention is
 *   TTS_LBNL_public_file_DD-MMM-YYYY_all.csv (e.g. 29-Sep-2025). Update this
 *   env var when LBNL publishes a new vintage. If unset, the handler returns
 *   ok:false with a clear seed-script fallback message.
 *
 * Filter mirrors scripts/aggregate-tts-cs-scale.mjs (the Phase A aggregator):
 *   non-residential customer segments, 0.5-5 MW DC ("LBNL large non-res"),
 *   install years within the last 36 months (most-recent year ± 2). Sample
 *   sanity caps applied to filter parse-bug rows ($/W < 0.50 or > 8.00).
 */
import { supabaseAdmin } from './_scraperBase.js'

const TTS_VALID_USPS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

const TTS_NON_RES_SEGMENTS = new Set([
  'COM', 'NON-RES', 'AGRICULTURAL', 'SCHOOL', 'GOV', 'NON-PROFIT', 'OTHER TAX-EXEMPT',
])

// Sector size bracket — matches Phase A aggregator (0.5-5 MW LBNL large non-res).
const TTS_SIZE_MIN_KW = 500
const TTS_SIZE_MAX_KW = 5000

// Reject obviously bad rows (price-in-cents / size-in-W parse bugs).
const TTS_DOLLARS_PER_WATT_FLOOR = 0.50
const TTS_DOLLARS_PER_WATT_CEIL  = 8.00

// Tier ladder — MUST mirror scripts/seed-solar-cost-index.mjs constants
// exactly. If these drift between the two files, refreshes will flip rows
// between tiers between scheduled runs. Update both in lockstep.
const TTS_TIER_FLOOR      = 3   // n<3 → not published, falls through to Tier B
const TTS_TIER_MODEST_MIN = 10  // n=10-39 → 'modest'
const TTS_TIER_STRONG_MIN = 40  // n>=40  → 'strong'

function ttsAssignTier(n) {
  if (n >= TTS_TIER_STRONG_MIN) return 'strong'
  if (n >= TTS_TIER_MODEST_MIN) return 'modest'
  if (n >= TTS_TIER_FLOOR)      return 'thin'
  return null
}

function ttsPercentile(sortedArr, p) {
  if (!sortedArr.length) return null
  const idx = Math.max(0, Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length)))
  return sortedArr[idx]
}

export default async function refreshSolarCosts() {
  const url = process.env.LBNL_TTS_CSV_URL
  if (!url) {
    return {
      ok: false,
      error: 'LBNL_TTS_CSV_URL env var not set. Configure it (e.g. https://emp.lbl.gov/sites/default/files/.../TTS_LBNL_public_file_<date>_all.csv) or run scripts/seed-solar-cost-index.mjs locally.',
      hint:  'The LBNL TTS CSV is ~1.9 GB and only updates each October. Local seed script is the canonical refresh path.',
    }
  }

  const t0 = Date.now()
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'tractova-refresh/1.0' },
  })
  if (!resp.ok) {
    return { ok: false, error: `LBNL fetch failed: status=${resp.status}`, url_redacted: url.replace(/\/\/[^/]+/, '//<host>') }
  }
  if (!resp.body) {
    return { ok: false, error: 'LBNL response had no body stream' }
  }

  // Latest install-year is set on first row encountered with a recent date —
  // we don't know in advance whether the file is 2024 or 2025 vintage.
  let latestYearSeen = 0

  // Per-state arrays of $/W values for percentile computation.
  const byState = new Map()
  let header = null
  const colIdx = {}
  let rowsScanned = 0
  let rowsKept = 0

  // Stream-parse line by line to avoid materializing 1.9 GB in memory.
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  function processLine(line) {
    if (header === null) {
      header = line.split(',')
      header.forEach((c, i) => { colIdx[c] = i })
      return
    }
    rowsScanned++
    const f = line.split(',')
    const state = f[colIdx.state]
    if (!TTS_VALID_USPS.has(state)) return

    const seg = f[colIdx.customer_segment]
    if (!TTS_NON_RES_SEGMENTS.has(seg)) return

    const date = f[colIdx.installation_date]
    if (!date || date.length < 4) return
    const year = parseInt(date.slice(0, 4), 10)
    if (!year || year < 2000) return
    if (year > latestYearSeen) latestYearSeen = year

    const size = parseFloat(f[colIdx.PV_system_size_DC])
    if (isNaN(size) || size < TTS_SIZE_MIN_KW || size > TTS_SIZE_MAX_KW) return

    const price = parseFloat(f[colIdx.total_installed_price])
    if (isNaN(price) || price <= 0) return

    const dollarsPerWatt = price / (size * 1000)
    if (dollarsPerWatt < TTS_DOLLARS_PER_WATT_FLOOR || dollarsPerWatt > TTS_DOLLARS_PER_WATT_CEIL) return

    if (!byState.has(state)) byState.set(state, { all: [], byYear: new Map() })
    const bucket = byState.get(state)
    bucket.all.push({ dpw: dollarsPerWatt, year })
    rowsKept++
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      processLine(line)
    }
  }
  if (buffer.length > 0) processLine(buffer.replace(/\r$/, ''))

  const downloadDurationMs = Date.now() - t0

  if (latestYearSeen < 2020 || rowsKept < 100) {
    return {
      ok: false,
      error: `TTS parse anomaly: rows_scanned=${rowsScanned}, rows_kept=${rowsKept}, latest_year=${latestYearSeen}. Source CSV may have changed schema.`,
      download_duration_ms: downloadDurationMs,
    }
  }

  // Use last 3 install years as the aggregation window (matches Phase A).
  const recentYears = new Set([latestYearSeen, latestYearSeen - 1, latestYearSeen - 2])
  const vintageWindow = `${latestYearSeen - 2}-${latestYearSeen}`

  const upsertRows = []
  const stateSummary = []
  for (const [state, bucket] of byState) {
    const recent = bucket.all.filter(r => recentYears.has(r.year)).map(r => r.dpw)
    const tier = ttsAssignTier(recent.length)
    if (!tier) {
      stateSummary.push({ state, install_count: recent.length, status: 'skipped_below_floor' })
      continue
    }
    const sorted = [...recent].sort((a, b) => a - b)
    const row = {
      state,
      sector:                   'large_non_res',
      vintage_year:             latestYearSeen,
      vintage_window:           vintageWindow,
      install_count:            recent.length,
      confidence_tier:          tier,
      aggregation_window_years: 3,
      p10_per_watt:             Number(ttsPercentile(sorted, 10).toFixed(2)),
      p25_per_watt:             Number(ttsPercentile(sorted, 25).toFixed(2)),
      p50_per_watt:             Number(ttsPercentile(sorted, 50).toFixed(2)),
      p75_per_watt:             Number(ttsPercentile(sorted, 75).toFixed(2)),
      p90_per_watt:             Number(ttsPercentile(sorted, 90).toFixed(2)),
      source:                   'LBNL_TTS',
      source_url:               url,
      notes:                    `Tier=${tier}, n=${recent.length}; LBNL Tracking the Sun ${vintageWindow} install years, customer_segment ∈ {COM,NON-RES,AGRICULTURAL,SCHOOL,GOV,NON-PROFIT,OTHER TAX-EXEMPT}, ${TTS_SIZE_MIN_KW}-${TTS_SIZE_MAX_KW} kW DC.`,
      last_updated:             new Date().toISOString(),
    }
    upsertRows.push(row)
    stateSummary.push({ state, install_count: recent.length, tier, p50: row.p50_per_watt, status: 'published' })
  }

  if (upsertRows.length === 0) {
    return {
      ok: false,
      error: `No states cleared the n>=${TTS_TIER_FLOOR} sample floor across ${byState.size} candidate states.`,
      rows_scanned: rowsScanned,
      rows_kept: rowsKept,
      latest_year_seen: latestYearSeen,
      download_duration_ms: downloadDurationMs,
    }
  }

  // Upsert in a single batch — published rows scale with state count
  // (typically ~10-20 after Phase E), well inside PostgREST's payload limit.
  const { error: upsertErr } = await supabaseAdmin
    .from('solar_cost_index')
    .upsert(upsertRows, { onConflict: 'state,sector,vintage_year,source,aggregation_window_years' })
  if (upsertErr) {
    return {
      ok: false,
      error: `Upsert failed: ${upsertErr.message}`,
      attempted_rows: upsertRows.length,
    }
  }

  const tierCounts = {
    strong: upsertRows.filter(r => r.confidence_tier === 'strong').length,
    modest: upsertRows.filter(r => r.confidence_tier === 'modest').length,
    thin:   upsertRows.filter(r => r.confidence_tier === 'thin').length,
  }
  return {
    ok: true,
    rows_scanned: rowsScanned,
    rows_kept_in_window: rowsKept,
    latest_year_seen: latestYearSeen,
    vintage_window: vintageWindow,
    states_published: upsertRows.length,
    tier_counts: tierCounts,
    states_skipped_below_floor: stateSummary.filter(s => s.status === 'skipped_below_floor').length,
    download_duration_ms: downloadDurationMs,
    sample_states: upsertRows.slice(0, 5).map(r => ({ state: r.state, tier: r.confidence_tier, n: r.install_count, p50: r.p50_per_watt })),
  }
}
