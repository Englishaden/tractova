/**
 * Incremental USFWS NWI wetland refresh — the "NWI cron" (2026-06 audit, Wave 3).
 *
 * NWI wetland coverage is now COMPLETE (all 3,143 counties). It began as a
 * one-time LOCAL seed that stalled at ~700 because (1) per-county NWI ArcGIS
 * queries take ~5-7s — a full pass is ~1.5h, far past Vercel's 300s cron limit —
 * and (2) NWI's server hard-throttles under sustained load (the original
 * PARALLEL=4 bulk seed got throttled after ~700). So this is NOT a full-pass
 * cron. Each run nibbles a small,
 * throttle-safe BATCH of the STALEST counties (wetland missing first, then
 * oldest), at PARALLEL=2, under a hard time budget — resumable, so weekly runs
 * steadily freshened + completed coverage. A bulk backfill, if ever needed again,
 * stays the local script (scripts/seed-county-geospatial-nwi.mjs), which has no
 * 300s ceiling.
 *
 * Honest by construction: failures are recorded (ok=false) so cron_runs + the
 * staleness monitor reflect the truth; merge-upsert touches only the wetland
 * columns, leaving the live SSURGO farmland columns intact.
 */
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'
import { fetchCountyGeometries, nwiAggregate, categorizeWetland, pctFromAcres } from './_nwiWetland.js'

// Throttle-safe per-run bounds. PARALLEL=2 is the seed script's empirically-safe
// baseline (4 triggered NWI's hard throttle). TIME_BUDGET leaves headroom under
// the 300s function cap. BATCH caps the candidate pull (and the TIGER IN-list).
const BATCH = 80
const PARALLEL = 2
const TIME_BUDGET_MS = 230_000
const REFRESH_AGE_DAYS = 180  // re-refresh wetland rows older than this

export default async function refreshGeospatialWetland() {
  const start = Date.now()
  const cutoff = new Date(Date.now() - REFRESH_AGE_DAYS * 86400000).toISOString()

  // Candidates: rows missing wetland coverage (the ~2,400-county backlog) OR
  // stale ones, missing-first then oldest-first. Counties get a row from the
  // farmland refresh, so the gap lives as wetland-null rows on existing rows.
  const { data: candidates, error: candErr } = await supabaseAdmin
    .from('county_geospatial_data')
    .select('county_fips')
    .or(`wetland_coverage_pct.is.null,wetland_last_updated.lt.${cutoff}`)
    .order('wetland_last_updated', { ascending: true, nullsFirst: true })
    .limit(BATCH)
  if (candErr) return { ok: false, error: `candidate query: ${candErr.message}`, processed: 0, failed: 0 }
  if (!candidates || candidates.length === 0) {
    return { ok: true, processed: 0, failed: 0, note: 'no missing/stale wetland rows — coverage current' }
  }

  // How many remain overall (visibility into backfill progress).
  const { count: remaining } = await supabaseAdmin
    .from('county_geospatial_data')
    .select('county_fips', { count: 'exact', head: true })
    .or(`wetland_coverage_pct.is.null,wetland_last_updated.lt.${cutoff}`)

  // Geometry + AREALAND (denominator) for exactly this batch, one TIGER query.
  let counties
  try {
    counties = await fetchCountyGeometries(candidates.map(c => c.county_fips))
  } catch (e) {
    return { ok: false, error: e.message, processed: 0, failed: 0, remaining: remaining ?? null }
  }

  let processed = 0
  let failed = 0
  let timedOut = false
  const failures = []

  for (let i = 0; i < counties.length; i += PARALLEL) {
    if (Date.now() - start > TIME_BUDGET_MS) { timedOut = true; break }
    const batch = counties.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(batch.map(async (c) => {
      const agg = await nwiAggregate(c.geometry)
      if (!agg.ok) throw new Error(`NWI ${c.county_fips}: ${agg.error}`)
      const pct = pctFromAcres(agg.wetAcres, c.area_acres)
      const { error } = await supabaseAdmin
        .from('county_geospatial_data')
        .upsert({
          county_fips:           c.county_fips,
          state:                 c.state,
          wetland_coverage_pct:  pct,
          wetland_category:      categorizeWetland(pct),
          wetland_feature_count: agg.featureCount,
          wetland_acres:         Math.round(agg.wetAcres),
          wetland_last_updated:  new Date().toISOString(),
        }, { onConflict: 'county_fips' })  // merge — leaves SSURGO farmland columns intact
      if (error) throw new Error(`upsert ${c.county_fips}: ${error.message}`)
    }))
    for (const s of settled) {
      if (s.status === 'fulfilled') processed += 1
      else { failed += 1; if (failures.length < 8) failures.push(s.reason?.message || 'unknown') }
    }
  }

  // ok=false when the run did real work but EVERYTHING failed (NWI throttling /
  // outage) — that should surface as a failed cron, not a silent no-op. A run
  // that processed at least one county, or had no candidates, is a success.
  const ok = processed > 0
  return {
    ok,
    processed,
    failed,
    timedOut,
    remaining: remaining ?? null,
    batch: counties.length,
    elapsed_ms: Date.now() - start,
    ...(failures.length ? { sample_failures: failures } : {}),
    ...(!ok ? { error: 'all NWI queries in this batch failed (likely throttling/outage)' } : {}),
  }
}
