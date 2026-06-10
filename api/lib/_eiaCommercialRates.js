/**
 * Shared EIA commercial-retail-rate primitives — the ONE place the EIA Open Data
 * v2 retail-sales (commercial sector) fetch + the offtake-score formula live, so
 * the two consumers don't drift or duplicate:
 *
 *   1. api/refresh-substations.js  — monthly cron, writes the commercial ¢/kWh
 *      for the 8 TRACKED_STATES to revenue_rates.ci_retail_rate_cents_kwh.
 *   2. scripts/seed-offtake-rates.mjs — offline all-50 derivation that refreshes
 *      docs/eia-861/commercial-retail-rates.json (the sourced rate layer backing
 *      CI_OFFTAKE_SCORES) + reports drift vs the committed scores.
 *
 * Two-layer honesty: `commercial_cents_kwh` is OBSERVED (EIA, cited); the 0-100
 * offtake `score` is Tractova's DISCLOSED synthesis via offtakeScoreFromRate.
 * Pure / fetch-injected so the URL build, parse, and formula are unit-testable
 * without a live EIA key.
 *
 * Source: EIA Electric Power Monthly, Table 5.6.B (Commercial sector), via the
 * EIA Open Data v2 electricity/retail-sales endpoint. Requires EIA_API_KEY
 * (Vercel env only — never in the client bundle or the repo).
 */

export const EIA_RETAIL_SALES_URL = 'https://api.eia.gov/v2/electricity/retail-sales/data/'

// Build the EIA v2 retail-sales request for one state's latest commercial annual
// price (¢/kWh). The api_key is a query param (EIA's only auth mode).
export function buildRetailSalesUrl(stateId, apiKey) {
  const url = new URL(EIA_RETAIL_SALES_URL)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('frequency', 'annual')
  url.searchParams.set('data[0]', 'price')
  url.searchParams.set('facets[stateid][]', stateId)
  url.searchParams.set('facets[sectorid][]', 'COM')   // Commercial sector
  url.searchParams.set('sort[0][column]', 'period')
  url.searchParams.set('sort[0][direction]', 'desc')
  url.searchParams.set('length', '1')
  return url.toString()
}

// Parse an EIA v2 retail-sales response → { rateCentsKwh, period } or { error }.
// Rejects missing / non-numeric / out-of-band prices (EIA prices are ¢/kWh, so a
// plausible commercial rate is 0 < c <= 100) so a bad payload can't poison a score.
export function parseCommercialRate(json) {
  const row = json?.response?.data?.[0]
  if (!row || row.price == null) return { error: 'no price data returned' }
  const rateCentsKwh = parseFloat(row.price)
  if (Number.isNaN(rateCentsKwh) || rateCentsKwh <= 0 || rateCentsKwh > 100) {
    return { error: `invalid price ${row.price}` }
  }
  return { rateCentsKwh, period: row.period }
}

// Fetch the latest commercial ¢/kWh for a list of states, in parallel (each call
// is independent; mirrors the substations cron's parallelism so a 50-state pull
// stays well inside a function budget). `fetchImpl` injected for tests.
// Returns [{ stateId, rateCentsKwh, period }] | [{ stateId, error }] per state.
export async function fetchCommercialRates(stateIds, apiKey, fetchImpl = fetch, { timeoutMs = 10000 } = {}) {
  if (!apiKey) throw new Error('EIA_API_KEY required')
  const settled = await Promise.allSettled(stateIds.map(async (stateId) => {
    const res = await fetchImpl(buildRetailSalesUrl(stateId, apiKey), { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return { stateId, error: `HTTP ${res.status}` }
    const parsed = parseCommercialRate(await res.json())
    return { stateId, ...parsed }
  }))
  return settled.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { stateId: stateIds[i], error: r.reason?.message || String(r.reason) }
  )
}

// The DISCLOSED offtake-score synthesis for retail-rate-anchored (non-hand-tuned)
// states: score = clamp(round(34 + 1.8 · ¢/kWh), 45, 72). This is the single
// source for the formula that backs the new-cohort CI_OFFTAKE_SCORES entries +
// the docs/eia-861 sidecar (a unit test pins the committed values to this fn).
// New-cohort states get NO deep-market boost (thin / non-ISO markets — retail is
// the honest dominant offtake signal); the hand-tuned legacy states (TX/CA/FL…)
// are NOT produced by this formula.
export const OFFTAKE_FORMULA = 'clamp(round(34 + 1.8 × commercial ¢/kWh), 45, 72)'
export function offtakeScoreFromRate(centsKwh) {
  if (centsKwh == null || Number.isNaN(centsKwh)) return null
  return Math.max(45, Math.min(72, Math.round(34 + 1.8 * centsKwh)))
}
