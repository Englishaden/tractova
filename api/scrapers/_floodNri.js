/**
 * Pure FEMA National Risk Index (NRI) flood helpers — used by the NRI ingest
 * (_refresh-flood-nri.js). Kept pure (no Supabase / no fetch) so the
 * rating-normalization + worst-of-two logic is unit-testable.
 *
 * Source: FEMA NRI Counties FeatureServer (county-keyed, no geometry math).
 *   services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0
 * Fields (confirmed live from the layer metadata, not memory):
 *   STCOFIPS · IFLD_RISKR/IFLD_RISKS (inland/riverine) · CFLD_RISKR/CFLD_RISKS (coastal)
 */

export const NRI_FEATURESERVER = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query'
export const NRI_FLOOD_FIELDS = ['STCOFIPS', 'IFLD_RISKR', 'IFLD_RISKS', 'CFLD_RISKR', 'CFLD_RISKS']

// NRI rating string → canonical token, ranked. Anything unrated / insufficient /
// not-applicable / blank collapses to 'none' (rank 0 — no signal, no penalty).
const RATING_RANK = { none: 0, very_low: 1, relatively_low: 2, relatively_moderate: 3, relatively_high: 4, very_high: 5 }

export function normalizeNriRating(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'very high')           return 'very_high'
  if (s === 'relatively high')     return 'relatively_high'
  if (s === 'relatively moderate') return 'relatively_moderate'
  if (s === 'relatively low')      return 'relatively_low'
  if (s === 'very low')            return 'very_low'
  return 'none'  // "No Rating" / "Insufficient Data" / "Not Applicable" / blank
}

// The site engine treats these two ratings as a flood constraint (floodWarning).
// Single source of truth so the scraper + the score never drift on the threshold.
export function isFloodConstrained(rating) {
  return rating === 'relatively_high' || rating === 'very_high'
}

// Combine inland + coastal into the county's worst flood signal. Returns the
// worse rating (canonical token) + the higher 0-100 score. A county with neither
// rated → { rating: 'none', score: null } (no data → no penalty downstream).
export function worstFlood(inlandRating, inlandScore, coastalRating, coastalScore) {
  const ir = normalizeNriRating(inlandRating)
  const cr = normalizeNriRating(coastalRating)
  const rating = (RATING_RANK[ir] >= RATING_RANK[cr]) ? ir : cr
  const scores = [inlandScore, coastalScore]
    .map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : null)
    .filter(v => v != null)
  const score = scores.length ? Math.round(Math.max(...scores) * 10) / 10 : null
  return { rating, score }
}
