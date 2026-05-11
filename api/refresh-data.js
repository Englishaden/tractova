import { isAdminFromBearer } from './_admin-auth.js'
import { applyCors } from './_cors.js'
import { axiomLog } from './lib/_axiomLog.js'
import { supabaseAdmin, applyStaleTolerance, logCronRun } from './scrapers/_scraperBase.js'
import refreshLmi from './scrapers/_refresh-lmi.js'
import refreshCountyAcs from './scrapers/_refresh-county-acs.js'
import refreshNews from './scrapers/_refresh-news.js'
import refreshEnergyCommunity from './scrapers/_refresh-energy-community.js'
import refreshHudQctDda from './scrapers/_refresh-hud-qct-dda.js'
import refreshNmtcLic from './scrapers/_refresh-nmtc-lic.js'
import refreshGeospatialFarmland from './scrapers/_refresh-geospatial-farmland.js'
import refreshSolarCosts from './scrapers/_refresh-solar-costs.js'
import refreshPolicyScan from './scrapers/_scan-policy-candidates.js'
// DSIRE scrapers (state_programs + revenue_stacks) removed 2026-05-11:
// DSIRE's free API was deprecated to a $4,950/yr licensed model, and the
// integration had never produced a successful row across the entire
// cron_runs history. Manual state-program curation via /admin remains the
// canonical source for state_programs + revenue_stacks data.

// ─────────────────────────────────────────────────────────────────────────────
// Multiplexed data refresh — verified live pulls from regulated / .gov sources
//
// Single function file that fans out to multiple data-source handlers based on
// the ?source= query param. Lets us add new data layers without burning Vercel
// Hobby function slots (currently 12/12 -- this file is one slot, multiplexed
// across all current and future sourced data layers).
//
// Supported sources:
//   ?source=lmi      — Census ACS state-level LMI / income data
//   ?source=all      — runs every supported source in sequence
//
// Auth: TWO paths supported.
//   1. Vercel cron     — Vercel adds an internal x-vercel-signature header
//                        and runs as the cron user. We accept any unauthed
//                        request that arrives via Vercel's own infrastructure
//                        OR matches CRON_SECRET if configured.
//   2. Admin UI button — Authenticated POST with Bearer JWT; we verify
//                        profiles.role='admin' (migration 057). Defense
//                        in depth: legacy email match falls through if
//                        the role lookup fails (migration not yet applied).
//
// All handlers log to `cron_runs` (created in migration 006) so the Data
// Health tab in /admin shows last-run status + summary stats per source.
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_SOURCES = ['lmi', 'county_acs', 'news', 'energy_community', 'hud_qct_dda', 'nmtc_lic', 'geospatial_farmland', 'solar_costs', 'policy_scan']

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  // Either Vercel cron (CRON_SECRET match or no auth header from cron infra)
  // OR admin user JWT (verified by Supabase + email match).
  const authHeader = req.headers.authorization
  let isAuthed = false
  let authMode = ''

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    // CRON_SECRET path
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
      isAuthed = true
      authMode = 'cron-secret'
    } else {
      // Admin JWT path — role-based check via profiles.role (migration 057)
      // with legacy email-match fallback for the rollout window.
      const adminCheck = await isAdminFromBearer(supabaseAdmin, authHeader)
      if (adminCheck.ok) {
        isAuthed = true
        authMode = adminCheck._legacyFallback ? 'admin-legacy-email' : 'admin'
      }
    }
  }

  // Vercel cron infra path: Vercel signs internal cron requests with a
  // x-vercel-cron header. If CRON_SECRET isn't set, we accept these too.
  if (!isAuthed && req.headers['x-vercel-cron']) {
    isAuthed = true
    authMode = 'vercel-cron'
  }

  if (!isAuthed) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Census diagnostic (?debug=1) ────────────────────────────────────────────
  // Lightweight probe surfaced to the admin Data Health panel
  // (DataHealthTab.jsx → CensusDiagnosticPanel). Returns the request/response
  // shape that panel expects: key length + shape sanity, plus a tiny live
  // probe against the Census ACS API.
  // Auth: admin only (the Bearer-JWT check above covers it). Response is
  // small + redacted (no key chars, body sliced).
  if (req.query.debug === '1' || req.query.debug === 'census') {
    const apiKey = process.env.CENSUS_API_KEY || ''
    const trimmed = apiKey.trim()
    const keyLength = trimmed.length
    // Census ACS keys are 40-char hex (lowercase). Allow either case + bare
    // length check so we don't flag valid-but-formatted-differently keys.
    const keyShapeOk = /^[0-9a-fA-F]{40}$/.test(trimmed)
    const whitespaceNote =
      apiKey === trimmed
        ? 'no surrounding whitespace'
        : `surrounding whitespace detected (orig=${apiKey.length} trimmed=${keyLength})`

    // Tiny probe: fetch a single state's NAME — minimal payload, fast,
    // exercises the same auth + endpoint shape the full ACS handlers use.
    const probeUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME&for=state:06${trimmed ? `&key=${trimmed}` : ''}`
    let probeResp = null
    let probeBody = ''
    let probeErr = null
    const probeStart = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30000)
      probeResp = await fetch(probeUrl, { signal: controller.signal })
      clearTimeout(timer)
      probeBody = await probeResp.text().catch(() => '')
    } catch (err) {
      probeErr = err?.message || String(err)
    }
    const durationMs = Date.now() - probeStart

    const headersObj = {}
    if (probeResp) {
      for (const h of ['content-type', 'content-length', 'retry-after', 'cf-ray', 'cf-mitigated']) {
        const v = probeResp.headers.get(h)
        if (v != null) headersObj[h] = v
      }
    }

    return res.status(200).json({
      request: {
        key_length:           keyLength,
        key_shape_ok:         keyShapeOk,
        key_whitespace_check: whitespaceNote,
        vercel_region:        process.env.VERCEL_REGION || 'unknown',
        probe_url_redacted:   probeUrl.replace(/key=[^&]+/, 'key=<redacted>'),
      },
      response: probeErr
        ? { status: null, error: probeErr }
        : {
            status:    probeResp.status,
            headers:   headersObj,
            body_size: probeBody.length,
            body_preview: probeBody.slice(0, 200),
          },
      duration_ms: durationMs,
      auth_mode:   authMode,
    })
  }

  // ── Source routing ──────────────────────────────────────────────────────────
  // Accept either a single source ("lmi"), CSV ("lmi,county_acs"), "all"
  // (every supported source), or "fast" (everything except nmtc_lic, which
  // iterates 51 states and dominates wall time).
  // 'solar_costs' is annual + heavyweight (1.9 GB upstream CSV); kept out of
  // 'all' / 'fast' bundles so the weekly cron + admin Refresh button never
  // trigger it. Runs only via its own annual cron schedule (Nov 1) or
  // explicit ?source=solar_costs from the seed flow.
  const requested = (req.query.source || 'all').toString().toLowerCase()
  let sources
  // policy_scan is excluded from bundles: it has its own weekly schedule, calls
  // Haiku per candidate, and shouldn't fan out alongside the data refreshers.
  if (requested === 'all')       sources = SUPPORTED_SOURCES.filter(s => s !== 'solar_costs' && s !== 'policy_scan')
  else if (requested === 'fast') sources = SUPPORTED_SOURCES.filter(s => s !== 'nmtc_lic' && s !== 'solar_costs' && s !== 'policy_scan')
  else                           sources = requested.split(',').map(s => s.trim()).filter(Boolean)

  const invalidSources = sources.filter(s => !SUPPORTED_SOURCES.includes(s))
  if (invalidSources.length > 0) {
    return res.status(400).json({
      error: `Unsupported source(s): ${invalidSources.join(', ')}`,
      supported: SUPPORTED_SOURCES,
    })
  }

  const startTs = Date.now()
  const results = {}

  // Sources sharing an upstream must be serialized to avoid throttling. The
  // three Census ACS sources (lmi, county_acs, nmtc_lic) all hit
  // api.census.gov, which 503s under concurrent load from a single IP. The
  // remaining sources hit independent APIs and can fan out in parallel.
  const CENSUS_SERIAL = new Set(['lmi', 'county_acs', 'nmtc_lic'])
  const censusGroup = sources.filter(s =>  CENSUS_SERIAL.has(s))
  const otherGroup  = sources.filter(s => !CENSUS_SERIAL.has(s))

  async function runOne(source) {
    const srcStart = Date.now()
    const startedAt = new Date()
    try {
      let result
      if (source === 'lmi')                  result = await refreshLmi()
      else if (source === 'county_acs')      result = await refreshCountyAcs()
      else if (source === 'news')              result = await refreshNews()
      else if (source === 'energy_community')  result = await refreshEnergyCommunity()
      else if (source === 'hud_qct_dda')       result = await refreshHudQctDda()
      else if (source === 'nmtc_lic')          result = await refreshNmtcLic()
      else if (source === 'geospatial_farmland') result = await refreshGeospatialFarmland()
      else if (source === 'solar_costs')         result = await refreshSolarCosts()
      else if (source === 'policy_scan')         result = await refreshPolicyScan()
      else                                     result = { error: 'Handler not implemented' }
      result.duration_ms = Date.now() - srcStart
      result = await applyStaleTolerance(source, result)
      results[source] = result
      // logCronRun receives the raw result -- ok stays false on a failed
      // refresh attempt even if stale-tolerance flagged it as non-fatal,
      // so the next stale-check still finds the *real* last-good run.
      await logCronRun(source, result, authMode, startedAt)
    } catch (err) {
      const errMsg = err?.message || String(err)
      await axiomLog('error', `refresh-data ${source} threw`, {
        route:    'api/refresh-data',
        source,
        authMode,
        error:    errMsg,
        stack:    err?.stack?.slice(0, 2000),
      })
      let result = { ok: false, error: errMsg, duration_ms: Date.now() - srcStart }
      result = await applyStaleTolerance(source, result)
      results[source] = result
      await logCronRun(source, result, authMode, startedAt)
    }
  }

  await Promise.all([
    // Non-Census sources fan out in parallel (independent upstreams).
    ...otherGroup.map(runOne),
    // Census sources run strictly sequentially within their own task.
    (async () => { for (const s of censusGroup) await runOne(s) })(),
  ])

  return res.status(200).json({
    ok: Object.values(results).every(r => r.ok),
    sources: results,
    total_duration_ms: Date.now() - startTs,
    auth_mode: authMode,
    triggered_at: new Date().toISOString(),
  })
}
