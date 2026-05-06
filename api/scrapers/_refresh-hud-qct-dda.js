/**
 * HUD QCT / DDA handler — federal LIHTC designation overlay per county
 *
 * Pulls the 2026 QCT and DDA layers from HUD User's ArcGIS FeatureServers:
 *   - QUALIFIED_CENSUS_TRACTS_2026: per-tract polygons. GEOID concatenates
 *     STATE + COUNTY + TRACT (2+3+6 = 11 digits). Substring(0,5) = county_fips.
 *     Aggregated to per-county count + tract list.
 *   - Difficult_Development_Areas_2026: mixed metro/non-metro. For non-metro
 *     (DDA_TYPE='NM'), DDA_CODE has format `NCNTY{state_fips}{county_fips}...`
 *     so we can parse county_fips from chars 5-9. Metro DDAs are at ZCTA
 *     level and are skipped here (would require ZCTA->county crosswalk; v2).
 *
 * Why this matters: counties with high QCT density have concentrated low-
 * income household populations. Several state CS programs (NY VDER,
 * IL Shines low-income carve-out, MA SMART LMI adder) give bonus credits
 * for projects with QCT-overlap subscriber bases.
 */
import {
  supabaseAdmin,
  FIPS_TO_USPS,
  fetchArcgisPaged,
} from './_scraperBase.js'

const HUD_QCT_URL = 'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/QUALIFIED_CENSUS_TRACTS_2026/FeatureServer/0/query'
const HUD_DDA_URL = 'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/Difficult_Development_Areas_2026/FeatureServer/0/query'

export default async function refreshHudQctDda() {
  // 1. QCT layer — per tract.
  let qctRows
  try {
    qctRows = await fetchArcgisPaged(
      HUD_QCT_URL,
      '1=1',
      'GEOID,STATE,COUNTY,TRACT,NAME'
    )
  } catch (err) {
    return { ok: false, error: `HUD QCT layer fetch failed: ${err.message}` }
  }

  // 2. DDA layer — mixed; we only consume the non-metro rows here.
  let ddaRows
  try {
    ddaRows = await fetchArcgisPaged(
      HUD_DDA_URL,
      '1=1',
      'ZCTA5,DDA_CODE,DDA_TYPE,DDA_NAME'
    )
  } catch (err) {
    return { ok: false, error: `HUD DDA layer fetch failed: ${err.message}` }
  }

  if (qctRows.length < 50) {
    return { ok: false, error: `HUD QCT returned only ${qctRows.length} rows; expected thousands. Aborting.` }
  }

  // Aggregate QCTs by county.
  const byCounty = new Map()
  for (const a of qctRows) {
    const stateFips  = a.STATE
    const countyFips = a.COUNTY
    if (!stateFips || !countyFips) continue
    const usps = FIPS_TO_USPS[stateFips]
    if (!usps) continue
    const fips = `${stateFips}${countyFips}`
    const tractGeoid = a.GEOID || `${stateFips}${countyFips}${a.TRACT || ''}`

    const existing = byCounty.get(fips) || {
      county_fips:        fips,
      state:              usps,
      county_name:        null,
      qct_count:          0,
      qct_tract_geoids:   [],
      is_non_metro_dda:   false,
      dda_name:           null,
      dda_code:           null,
      dataset_year:       2026,
      last_updated:       new Date().toISOString(),
      source:             'HUD User QCT 2026 + DDA 2026 (LIHTC designation layers)',
    }
    existing.qct_count += 1
    if (existing.qct_tract_geoids.length < 200) existing.qct_tract_geoids.push(tractGeoid)
    byCounty.set(fips, existing)
  }

  // Layer non-metro DDAs onto the per-county map. DDA_CODE format for NM:
  //   NCNTY{state_fips}{county_fips}N{state_fips}{county_fips}
  //   chars 5..9 = 5-digit FIPS
  let nmDdaCount = 0
  let metroDdaSkipped = 0
  for (const a of ddaRows) {
    if (a.DDA_TYPE !== 'NM') { metroDdaSkipped++; continue }
    const code = a.DDA_CODE || ''
    if (!code.startsWith('NCNTY') || code.length < 10) continue
    const fips = code.slice(5, 10)
    if (!/^\d{5}$/.test(fips)) continue
    const stateFips = fips.slice(0, 2)
    const usps = FIPS_TO_USPS[stateFips]
    if (!usps) continue

    nmDdaCount++
    const existing = byCounty.get(fips) || {
      county_fips:        fips,
      state:              usps,
      county_name:        a.DDA_NAME || null,
      qct_count:          0,
      qct_tract_geoids:   [],
      is_non_metro_dda:   false,
      dda_name:           null,
      dda_code:           null,
      dataset_year:       2026,
      last_updated:       new Date().toISOString(),
      source:             'HUD User QCT 2026 + DDA 2026 (LIHTC designation layers)',
    }
    existing.is_non_metro_dda = true
    existing.dda_name = a.DDA_NAME || existing.dda_name
    existing.dda_code = a.DDA_CODE || existing.dda_code
    if (!existing.county_name && a.DDA_NAME) existing.county_name = a.DDA_NAME
    byCounty.set(fips, existing)
  }

  const rows = Array.from(byCounty.values())
  if (rows.length < 50) {
    return { ok: false, error: `Only ${rows.length} counties aggregated; expected hundreds. Aborting.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('hud_qct_dda_data')
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

  // Sample preference: a county with both QCT density AND non-metro DDA flag
  const sample = rows.find(r => r.qct_count >= 5 && r.is_non_metro_dda) ||
                 rows.find(r => r.qct_count >= 10) ||
                 rows[0]

  return {
    ok:                       true,
    counties_with_designation: upserted,
    qct_layer_rows:           qctRows.length,
    dda_layer_rows:           ddaRows.length,
    non_metro_dda_count:      nmDdaCount,
    metro_dda_skipped:        metroDdaSkipped,
    sample_county:            sample,
  }
}
