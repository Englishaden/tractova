/**
 * Shared PAD-US protected-land primitives — used by the bulk seed/build
 * (scripts/seed-padus-protected.mjs) and the prod re-sync handler
 * (api/scrapers/_refresh-padus-protected.js, which upserts the committed
 * artifact). Pure so the rollup + name-join logic is unit-testable.
 *
 * Source: USGS Protected Areas Database of the U.S. (PAD-US) 4.1 — the
 * "Uni_Counties" vector-analysis summary CSV (acres of protected land per
 * county × GAP status). GAP 1 + 2 = managed for biodiversity / strict
 * protection (effectively undevelopable); GAP 3 = multiple-use (e.g. some
 * BLM/USFS land that CAN host energy); GAP 4 = no known mandate. We treat the
 * GAP 1+2 share of county land as the "protected / undevelopable" signal.
 *
 * Two-layer honesty (see SiteControlCard + /methodology): the protected acreage
 * is observed (PAD-US); the GAP 1+2 choice + the % thresholds that flag a
 * land-supply constraint are Tractova's disclosed synthesis.
 */

const ACRES_PER_SQM = 1 / 4046.8564224

// GAP status codes counted as protected/undevelopable for the screen.
export const PROTECTED_GAP = new Set(['1', '2'])

export function sqMetersToAcres(sqm) {
  return (Number(sqm) || 0) * ACRES_PER_SQM
}

// Normalize a county name for a (state, name) join across the PAD-US CSV and
// the Census Gazetteer. Strips the unit suffix (County / Parish / Borough /
// Census Area / Municipality / Municipio / city) + punctuation + the optional
// ", ST" tail, lowercases, and collapses whitespace. "St."/"Ste." → "saint" so
// e.g. "St. Louis" matches "Saint Louis". Note independent cities ("X city")
// are kept distinct from the same-named county ("X County") by the suffix being
// stripped — those collisions (VA/MD/MO/NV) are reconciled on FIPS at join time,
// not here, so we deliberately DON'T fold "city" into the county name.
export function normalizeCountyName(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  // Drop a trailing ", ST" (PAD-US BndryName carries it; Gazetteer NAME doesn't)
  s = s.replace(/,\s*[A-Z]{2}\s*$/i, '')
  // Fold diacritics (Doña → dona) via NFD + strip the combining-mark block.
  s = s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const isCity = /\bcity\b/.test(s) && !/\bcity and borough\b/.test(s)
  s = s
    .replace(/\b(county|parish|census area|city and borough|borough|municipality|municipio|city)\b/g, '')
    .replace(/[.'’]/g, '')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Re-tag an independent city so it doesn't collide with the like-named county.
  return isCity ? `${s} #city` : s
}

// Join key: STATE::normalized-name.
export function countyKey(state, rawName) {
  return `${String(state).toUpperCase()}::${normalizeCountyName(rawName)}`
}

// Roll PAD-US county rows up into protected acreage per county key.
// Each row: { state, boundaryName, gapStatus, acres }. Returns
// Map<key, { gap12Acres, gap123Acres }>.
export function rollupProtectedByCounty(rows) {
  const out = new Map()
  for (const r of rows) {
    if (!r || r.acres == null) continue
    const key = countyKey(r.state, r.boundaryName)
    let agg = out.get(key)
    if (!agg) { agg = { gap12Acres: 0, gap123Acres: 0 }; out.set(key, agg) }
    const gap = String(r.gapStatus).trim()
    if (PROTECTED_GAP.has(gap)) agg.gap12Acres += r.acres
    if (gap === '1' || gap === '2' || gap === '3') agg.gap123Acres += r.acres
  }
  return out
}

// protected_area_pct = GAP 1+2 acres / county land acres × 100, capped at 100
// (PAD-US polygons can marginally exceed the Gazetteer land area from boundary-
// vintage mismatch + water inclusion). null land area → null (no fabricated 0).
export function protectedPct(protectedAcres, landAcres) {
  if (!(landAcres > 0)) return null
  const pct = (protectedAcres / landAcres) * 100
  return Number(Math.min(100, Math.max(0, pct)).toFixed(2))
}

// Categorical site read from the GAP 1+2 share. Thresholds are Tractova's
// disclosed synthesis (subject to weight sign-off); only 'constrained' drives a
// site penalty. A high protected share means little private land is available
// to acquire/site within the county.
//   minimal     < 15%  → ample private land
//   moderate    15–40% → some land locked up
//   constrained ≥ 40%  → most of the county is protected (land-supply gate)
export function protectedConstraint(pct) {
  if (pct == null || Number.isNaN(pct)) return null
  if (pct < 15) return 'minimal'
  if (pct < 40) return 'moderate'
  return 'constrained'
}
