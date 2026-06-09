/**
 * Geocoder proxy — resolve an address to its census TRACT, then check whether
 * that tract is a §48(e) Category 1 NMTC Low-Income-Community tract.
 *
 * Routed through api/lens-insight.js (action 'tract-resolve') because the
 * serverless function cap is at 12/12 — NOT a new top-level api file. The
 * multiplexer Pro-gates + rate-limits before dispatching here.
 *
 * Why NOT the generic SSRF guard (api/lib/_urlFetch.js#assertPublicUrl): that
 * guard is for fetching USER-PROVIDED urls. Here the host + path are a
 * compile-time CONSTANT (the US Census Geocoder); the only user input is
 * `address`, URL-encoded into a query param via URLSearchParams (cannot alter
 * the host/path), and redirect:'error' blocks any inward 302. So there is no
 * user-controlled-URL surface to guard. (CLAUDE.md §9.)
 *
 * The Census Geocoder has NO CORS and is flaky (downtime, no SLA, ~500/day
 * shared limit), so this runs server-side AND fails gracefully: any
 * miss/timeout/error returns { ok:false } and the caller falls back to the
 * honest county-level signal.
 *
 * Honesty: returns the census TRACT an address falls in (a neighborhood-sized
 * area, NOT the literal parcel). isLicTract screens §48(e) Cat 1 eligibility —
 * it is NOT the official IRS determination (verify with tax counsel).
 */
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'
import { extractTractGeoid } from './_tractGeoid.js'

const GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'
const TIMEOUT_MS = 10_000

export default async function handleTractResolve(body, res) {
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  if (address.length < 5 || address.length > 200) {
    return res.status(200).json({ ok: false, reason: 'invalid_address' })
  }

  // Fixed host + encoded param (see header note — no SSRF surface).
  const qs = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    vintage:   'Census2020_Current',
    format:    'json',
  })
  const url = `${GEOCODER}?${qs.toString()}`

  let json
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'User-Agent': 'Tractova/1.0 (lic-tract-lookup; +https://tractova.com)', 'Accept': 'application/json' },
    })
    if (!r.ok) { clearTimeout(timer); return res.status(200).json({ ok: false, reason: `geocoder_http_${r.status}` }) }
    json = await r.json()
  } catch (err) {
    clearTimeout(timer)
    return res.status(200).json({ ok: false, reason: err?.name === 'AbortError' ? 'geocoder_timeout' : 'geocoder_error' })
  }
  clearTimeout(timer)

  const geo = extractTractGeoid(json)
  if (!geo) return res.status(200).json({ ok: false, reason: 'no_match' })

  // Is the resolved tract a §48(e) Cat 1 NMTC LIC tract? Fast PK lookup.
  try {
    const { data, error } = await supabaseAdmin
      .from('nmtc_lic_tracts')
      .select('geoid')
      .eq('geoid', geo.tractGeoid)
      .maybeSingle()
    if (error) {
      // Table missing (migration not applied yet) or query error → return the
      // tract but flag the LIC check unavailable so the client falls back to county.
      return res.status(200).json({ ok: false, reason: 'lic_lookup_unavailable', tractGeoid: geo.tractGeoid, countyGeoid: geo.countyGeoid })
    }
    return res.status(200).json({
      ok: true,
      tractGeoid:     geo.tractGeoid,
      countyGeoid:    geo.countyGeoid,
      isLicTract:     !!data,
      matchedAddress: geo.matchedAddress,
    })
  } catch {
    return res.status(200).json({ ok: false, reason: 'lic_lookup_unavailable', tractGeoid: geo.tractGeoid, countyGeoid: geo.countyGeoid })
  }
}
