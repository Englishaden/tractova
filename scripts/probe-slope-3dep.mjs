/**
 * Probe: USGS 3DEP ImageServer county slope statistics — Phase 3a feasibility.
 *
 * Verifies LIVE (per CLAUDE.md §3 — never build against an unprobed endpoint):
 *   1. TIGER county polygon → 3DEP `computeStatisticsHistograms` with the
 *      "Slope Degrees" rendering rule returns stats + a histogram.
 *   2. The histogram is fine-grained enough to derive "% of county terrain at
 *      gentle grade" (solar-developable share).
 *   3. A LARGE western county works at a coarser pixel size (8000×8000 cap).
 *
 * Usage: node scripts/probe-slope-3dep.mjs
 */
import { fetchCountyGeometries, NWI_UA, simplifyRing } from '../api/scrapers/_nwiWetland.js'

const IMAGESERVER = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'

// % grade → degrees: atan(grade/100). 5% = 2.862°, 10% = 5.711°, 15% = 8.531°.
const GRADE_5_DEG = Math.atan(0.05) * 180 / Math.PI
const GRADE_15_DEG = Math.atan(0.15) * 180 / Math.PI

async function slopeStats(geometry, pixelMeters) {
  const rings = (geometry?.rings || []).map(r => simplifyRing(r, 300))
  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
    renderingRule: JSON.stringify({ rasterFunction: 'Slope Degrees' }),
    pixelSize: JSON.stringify({ x: pixelMeters, y: pixelMeters, spatialReference: { wkid: 102100 } }),
    f: 'json',
  })
  const r = await fetch(`${IMAGESERVER}/computeStatisticsHistograms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': NWI_UA },
    body: body.toString(),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { return { ok: false, error: `non-JSON: ${text.slice(0, 200)}` } }
  if (json.error) return { ok: false, error: JSON.stringify(json.error).slice(0, 300) }
  return { ok: true, json }
}

function pctBelow(hist, thresholdDeg) {
  // histogram: { size, min, max, counts[] } — bins evenly spaced min→max.
  const { size, min, max, counts } = hist
  const binW = (max - min) / size
  let below = 0, total = 0
  for (let i = 0; i < counts.length; i++) {
    const hi = min + (i + 1) * binW
    total += counts[i]
    if (hi <= thresholdDeg) below += counts[i]
    else if (min + i * binW < thresholdDeg) below += counts[i] * ((thresholdDeg - (min + i * binW)) / binW) // partial bin
  }
  return total > 0 ? (below / total) * 100 : null
}

const CASES = [
  { fips: '11001', label: 'DC (tiny, flat-ish)', px: 30 },
  { fips: '17063', label: 'Grundy IL (small, flat)', px: 30 },
  { fips: '54057', label: 'Mineral WV (small, steep)', px: 30 },
  { fips: '06071', label: 'San Bernardino CA (huge)', px: 90 },
]

const geoms = await fetchCountyGeometries(CASES.map(c => c.fips))
for (const c of CASES) {
  const g = geoms.find(x => x.county_fips === c.fips)
  if (!g) { console.log(`✗ ${c.label}: TIGER geometry missing`); continue }
  const t0 = Date.now()
  const res = await slopeStats(g.geometry, c.px)
  const ms = Date.now() - t0
  if (!res.ok) { console.log(`✗ ${c.label} @${c.px}m: ${res.error} (${ms}ms)`); continue }
  const stats = res.json.statistics?.[0]
  const hist = res.json.histograms?.[0]
  if (!stats || !hist) { console.log(`✗ ${c.label}: missing stats/histogram: ${JSON.stringify(res.json).slice(0, 200)}`); continue }
  const p5 = pctBelow(hist, GRADE_5_DEG)
  const p15 = pctBelow(hist, GRADE_15_DEG)
  console.log(`✓ ${c.label} @${c.px}m (${ms}ms): mean=${stats.mean?.toFixed(2)}° max=${stats.max?.toFixed(1)}° bins=${hist.size} range=[${hist.min?.toFixed(1)},${hist.max?.toFixed(1)}]`)
  console.log(`    ≤5% grade: ${p5?.toFixed(1)}% of county · ≤15% grade: ${p15?.toFixed(1)}%`)
}
