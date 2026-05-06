/**
 * Geospatial Farmland handler — USDA SSURGO prime-farmland coverage per county
 *
 * Fast half of Path B: per-county prime_farmland_pct derived from SSURGO
 * (Soil Survey Geographic Database). Pulls one aggregate query per state
 * from USDA Soil Data Access (T-SQL POST), maps the SSURGO areasymbol to
 * 5-digit county FIPS, upserts into county_geospatial_data.
 *
 * Why split from the slow NWI half: SSURGO returns ~3,200 survey areas in
 * ~5s total. NWI per-county polygon queries take ~6h serial. Two cadences:
 * SSURGO weekly via this multiplexed cron, NWI quarterly via local seed
 * script (scripts/seed-county-geospatial-nwi.mjs).
 *
 * areasymbol → county_fips mapping:
 *   - 49 states (incl. AK at the format level): areasymbol = ST + 3-digit
 *     county FIPS suffix (verified against TIGER for IL/CA/AL: clean match).
 *   - CT: 2 statewide areas (CT601/CT602) — average them, assign uniformly
 *     to all 8 CT counties resolved via county_acs_data.
 *   - RI: 1 statewide area (RI600) — assign uniformly to all 5 RI counties.
 *   - AK: 137 NRCS-defined survey regions vs 30 boroughs; the suffix-as-FIPS
 *     pattern doesn't apply (AK600 ≠ borough FIPS 02600). Skip AK in v1
 *     (negligible CS market) — county-level row stays absent until we wire
 *     a fuzzy areaname→borough matcher.
 *   - Territories (AS/GU/MH/MP/PW/VI): out of 50-state scope, skipped.
 *
 * Prime farmland classes (matched via IN clause, not LIKE) — calibrated
 * against the SSURGO mapunit.farmlndcl distribution probed 2026-05-01.
 */
import {
  supabaseAdmin,
  FIPS_TO_USPS,
} from './_scraperBase.js'

const SSURGO_PRIME_FARMLAND_CLASSES = [
  'All areas are prime farmland',
  'Prime farmland if drained',
  'Prime farmland if irrigated',
  'Prime farmland if drained and either protected from flooding or not frequently flooded during the growing season',
  'Prime farmland if irrigated and drained',
  'Prime farmland if subsoiled, completely removing the root inhibiting soil layer',
  'Prime farmland if protected from flooding or not frequently flooded during the growing season',
]

async function ssurgoQuery(sql) {
  const body = new URLSearchParams({
    QUERY: sql,
    FORMAT: 'JSON+COLUMNNAME',
  })
  const r = await fetch('https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'tractova-refresh/1.0',
    },
    body: body.toString(),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) }
  catch { return { ok: false, status: r.status, raw: text.slice(0, 300) } }
  return { ok: r.ok && Array.isArray(json.Table), status: r.status, json }
}

export default async function refreshGeospatialFarmland() {
  const primeIn = SSURGO_PRIME_FARMLAND_CLASSES
    .map(s => `'${s.replace(/'/g, "''")}'`)
    .join(', ')

  // Per-state queries: SDA has a 100s execution-time cap that a single
  // whole-US join across mapunit + legend trips intermittently (returns
  // HTTP 200 with empty `{}` body when it times out — silent failure).
  // Per-state aggregates run in ~80ms each → ~5s for the full 50-state
  // batch, well inside both SDA's per-query budget and our 300s function
  // budget. Probed cleanly in scripts/probe-geospatial.mjs.
  const usps = Object.fromEntries(Object.entries(FIPS_TO_USPS).map(([f, u]) => [u, f]))
  const stateCodes = Object.keys(usps)  // 51: 50 states + DC

  const t0 = Date.now()
  const rows = []
  const stateErrors = []

  // 4-way concurrency: SDA tolerates parallel POSTs cleanly; this keeps the
  // wall-clock down without risking throttling.
  const PARALLEL = 4
  for (let i = 0; i < stateCodes.length; i += PARALLEL) {
    const batch = stateCodes.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(batch.map(async (st) => {
      const sql = `
        SELECT lg.areasymbol, lg.areaname,
          SUM(CASE WHEN mu.farmlndcl IN (${primeIn}) THEN mu.muacres ELSE 0 END) AS prime_acres,
          SUM(mu.muacres) AS total_acres
        FROM legend AS lg INNER JOIN mapunit AS mu ON mu.lkey = lg.lkey
        WHERE lg.areatypename = 'Non-MLRA Soil Survey Area'
          AND lg.areasymbol LIKE '${st}%'
        GROUP BY lg.areasymbol, lg.areaname
      `.trim().replace(/\s+/g, ' ')
      const res = await ssurgoQuery(sql)
      if (!res.ok) throw new Error(`status=${res.status} body=${res.raw || JSON.stringify(res.json).slice(0, 100)}`)
      // Each per-state Table has a header row at [0] then data rows.
      return res.json.Table.slice(1)
    }))
    for (let j = 0; j < batch.length; j++) {
      const st = batch[j]
      const r = settled[j]
      if (r.status === 'fulfilled') rows.push(...r.value)
      else stateErrors.push(`${st}: ${r.reason?.message || 'unknown'}`)
    }
  }

  if (rows.length < 2000) {
    return {
      ok: false,
      error: `SSURGO returned only ${rows.length} survey areas across ${stateCodes.length} states; expected ~3,200. ${stateErrors.length} state errors.`,
      first_state_errors: stateErrors.slice(0, 5),
    }
  }

  // Bucket SSURGO rows by USPS state code (first 2 chars of areasymbol).
  const byState = new Map()
  for (const [sym, name, prime, total] of rows) {
    const st = sym.slice(0, 2)
    const totalAc = Number(total) || 0
    const primeAc = Number(prime) || 0
    if (totalAc <= 0) continue
    if (!byState.has(st)) byState.set(st, [])
    byState.get(st).push({ areasymbol: sym, areaname: name, prime: primeAc, total: totalAc })
  }

  // Build the FIPS-keyed upsert payload. `usps` was already built above
  // when constructing per-state queries — reuse the same map.
  const upsertRows = []
  let mappedCount = 0
  let exceptionStateRows = 0
  const skipped = { ak: 0, territories: 0, malformed: 0 }

  for (const [st, areas] of byState) {
    // Skip out-of-scope: territories and Mexico shoulder.
    if (!usps[st]) {
      skipped.territories += areas.length
      continue
    }

    if (st === 'AK') {
      // 137 NRCS regions vs 30 boroughs — suffix pattern doesn't apply.
      // Skip in v1; UI's site-coverage caption will still say 'fallback' for AK.
      skipped.ak += areas.length
      continue
    }

    if (st === 'CT' || st === 'RI') {
      // 1-2 statewide areas — assign averaged value to all counties via county_acs_data.
      const stateFips = usps[st]
      const totalPrime = areas.reduce((a, x) => a + x.prime, 0)
      const totalAcres = areas.reduce((a, x) => a + x.total, 0)
      const pct = totalAcres > 0 ? (totalPrime / totalAcres) * 100 : 0

      const { data: countyRows } = await supabaseAdmin
        .from('county_acs_data')
        .select('county_fips')
        .eq('state', st)

      for (const cr of countyRows || []) {
        upsertRows.push({
          county_fips:           cr.county_fips,
          state:                 st,
          prime_farmland_pct:    Number(pct.toFixed(2)),
          prime_farmland_acres:  Math.round(totalPrime / (countyRows?.length || 1)),
          total_surveyed_acres:  Math.round(totalAcres / (countyRows?.length || 1)),
          ssurgo_areasymbol:     areas.map(a => a.areasymbol).join(','),
          farmland_last_updated: new Date().toISOString(),
        })
        mappedCount += 1
      }
      exceptionStateRows += areas.length
      continue
    }

    // CONUS standard pattern: areasymbol = ST + 3-digit county FIPS suffix.
    const stateFips = usps[st]
    for (const a of areas) {
      const suffix = a.areasymbol.slice(2)
      if (!/^\d{3}$/.test(suffix)) {
        skipped.malformed += 1
        continue
      }
      const fullFips = `${stateFips}${suffix}`
      const pct = a.total > 0 ? (a.prime / a.total) * 100 : 0
      upsertRows.push({
        county_fips:           fullFips,
        state:                 st,
        prime_farmland_pct:    Number(pct.toFixed(2)),
        prime_farmland_acres:  Math.round(a.prime),
        total_surveyed_acres:  Math.round(a.total),
        ssurgo_areasymbol:     a.areasymbol,
        farmland_last_updated: new Date().toISOString(),
      })
      mappedCount += 1
    }
  }

  if (upsertRows.length < 2500) {
    return {
      ok: false,
      error: `Only ${upsertRows.length} county rows mapped from ${rows.length} SSURGO areas; expected ~3,000+. Aborting.`,
      skipped,
    }
  }

  // Upsert in batches. PostgREST default payload cap is generous; 500/row is comfy.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const slice = upsertRows.slice(i, i + BATCH)
    // Only update farmland fields — leave wetland_* alone so a parallel NWI
    // refresh isn't clobbered. ignoreDuplicates: false = upsert behavior.
    const { error } = await supabaseAdmin
      .from('county_geospatial_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: upserted,
      }
    }
    upserted += slice.length
  }

  // Sample: a county with high prime-farmland % for visual sanity check.
  const sample = upsertRows.find(r => r.prime_farmland_pct >= 80) ||
                 upsertRows.find(r => r.prime_farmland_pct >= 50) ||
                 upsertRows[0]

  return {
    ok:                       true,
    counties_upserted:        upserted,
    ssurgo_areas_returned:    rows.length,
    ssurgo_query_duration_ms: Date.now() - t0,
    counties_with_data:       upsertRows.filter(r => r.prime_farmland_pct > 0).length,
    high_farmland_counties:   upsertRows.filter(r => r.prime_farmland_pct >= 25).length,
    skipped,
    exception_state_rows:     exceptionStateRows,
    state_fetch_errors:       stateErrors.length > 0 ? stateErrors.slice(0, 10) : undefined,
    sample_county:            sample,
  }
}
