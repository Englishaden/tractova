/**
 * Shared USGS 3DEP slope-ingest primitives — used by the bulk seed
 * (scripts/seed-county-slope.mjs) and the prod re-sync handler
 * (api/scrapers/_refresh-slope.js, which upserts the committed artifact).
 * Pure / fetch-injected so the non-network logic is unit-testable without a
 * live ArcGIS ImageServer.
 *
 * Source: USGS 3D Elevation Program (3DEP) Bare-Earth DEM dynamic ImageServer.
 * Its "Slope Degrees" rendering rule + computeStatisticsHistograms returns a
 * per-county slope histogram, from which we derive the developable-terrain
 * share (% of the county at or below a solar-buildable grade). See the
 * SiteControlCard + /methodology two-layer honesty framing: the slope
 * histogram is observed (3DEP); the grade threshold + the ample/moderate/
 * constrained buckets are Tractova's disclosed synthesis.
 */

export const SLOPE_IMAGESERVER =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'
export const SLOPE_UA = 'Tractova/1.0 (community-solar intel; aden.walker67@gmail.com)'

// Solar-developable grade ceiling. Utility / distribution-scale ground-mount
// PV is comfortable to ~5% grade and workable (with grading / cost) to ~10–15%;
// >15% is generally avoided. We use a 10% grade as the "developable" line — the
// permissive end of comfortable — so the share is a generous read of buildable
// terrain (a county only looks constrained when a real majority is steep).
export const DEVELOPABLE_GRADE_PCT = 10

// grade % → slope degrees: atan(rise/run). 10% grade = 5.71°.
export function gradePctToDegrees(gradePct) {
  return (Math.atan(gradePct / 100) * 180) / Math.PI
}

export const DEVELOPABLE_SLOPE_DEG = gradePctToDegrees(DEVELOPABLE_GRADE_PCT)

// Fraction (0–100) of a slope histogram at or below `thresholdDeg`, with
// linear interpolation across the bin that straddles the threshold. The 3DEP
// histogram is { size, min, max, counts[] } with evenly-spaced bins min→max.
// Returns null when the histogram is empty / malformed (caller treats null as
// "no data" — no penalty, matching the rest of the site engine).
export function pctBelowDegrees(histogram, thresholdDeg) {
  if (!histogram || !Array.isArray(histogram.counts) || histogram.counts.length === 0) return null
  const { size, min, max, counts } = histogram
  if (!(max > min) || !(size > 0)) return null
  const binW = (max - min) / size
  let below = 0
  let total = 0
  for (let i = 0; i < counts.length; i++) {
    const c = Number(counts[i]) || 0
    total += c
    const binLo = min + i * binW
    const binHi = binLo + binW
    if (binHi <= thresholdDeg) below += c
    else if (binLo < thresholdDeg) below += c * ((thresholdDeg - binLo) / binW) // partial bin
  }
  if (!(total > 0)) return null
  return Number(((below / total) * 100).toFixed(2))
}

// Reduce a 3DEP computeStatisticsHistograms response into the stored signal:
//   { meanDeg, maxDeg, developablePct }  — or null when stats/histogram absent.
export function summarizeSlope(response) {
  const stats = response?.statistics?.[0]
  const hist = response?.histograms?.[0]
  if (!stats || !hist) return null
  const developablePct = pctBelowDegrees(hist, DEVELOPABLE_SLOPE_DEG)
  if (developablePct == null) return null
  return {
    meanDeg: stats.mean != null ? Number(stats.mean.toFixed(2)) : null,
    maxDeg: stats.max != null ? Number(stats.max.toFixed(1)) : null,
    developablePct,
  }
}

// Categorical site read from the developable-terrain share. Thresholds are
// Tractova's disclosed synthesis (subject to weight sign-off); only the
// 'constrained' bucket drives a site penalty in the score engine.
//   ample       ≥ 70% of the county at ≤10% grade → no terrain headwind
//   moderate    40–70%                            → some siting friction
//   constrained < 40%                             → terrain-limited county
export function slopeConstraint(developablePct) {
  if (developablePct == null || Number.isNaN(developablePct)) return null
  if (developablePct >= 70) return 'ample'
  if (developablePct >= 40) return 'moderate'
  return 'constrained'
}

// Build the POST body for the 3DEP computeStatisticsHistograms call against a
// county polygon. pixelMeters trades resolution for speed (30 m for small
// counties, 90 m for large western ones — the 8000×8000 image cap forces a
// coarser sample on big extents). Geometry rings should already be simplified.
export function buildSlopeStatsBody(rings, pixelMeters) {
  return new URLSearchParams({
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
    renderingRule: JSON.stringify({ rasterFunction: 'Slope Degrees' }),
    pixelSize: JSON.stringify({ x: pixelMeters, y: pixelMeters, spatialReference: { wkid: 102100 } }),
    f: 'json',
  })
}
