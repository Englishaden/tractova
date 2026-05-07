import { isAdminFromBearer } from './_admin-auth.js'
import { applyCors } from './_cors.js'
import { axiomLog } from './lib/_axiomLog.js'
import { supabaseAdmin, applyStaleTolerance, logCronRun } from './scrapers/_scraperBase.js'
import refreshLmi from './scrapers/_refresh-lmi.js'
import refreshStateProgramsViaDsire from './scrapers/_refresh-state-programs.js'
import refreshCountyAcs from './scrapers/_refresh-county-acs.js'
import refreshNews from './scrapers/_refresh-news.js'
import refreshRevenueStacksViaDsire from './scrapers/_refresh-revenue-stacks.js'
import refreshEnergyCommunity from './scrapers/_refresh-energy-community.js'
import refreshHudQctDda from './scrapers/_refresh-hud-qct-dda.js'
import refreshNmtcLic from './scrapers/_refresh-nmtc-lic.js'
import refreshGeospatialFarmland from './scrapers/_refresh-geospatial-farmland.js'
import refreshSolarCosts from './scrapers/_refresh-solar-costs.js'

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

const SUPPORTED_SOURCES = ['lmi', 'state_programs', 'county_acs', 'news', 'revenue_stacks', 'energy_community', 'hud_qct_dda', 'nmtc_lic', 'geospatial_farmland', 'solar_costs']

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
  if (requested === 'all')       sources = SUPPORTED_SOURCES.filter(s => s !== 'solar_costs')
  else if (requested === 'fast') sources = SUPPORTED_SOURCES.filter(s => s !== 'nmtc_lic' && s !== 'solar_costs')
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
      else if (source === 'state_programs')  result = await refreshStateProgramsViaDsire()
      else if (source === 'county_acs')      result = await refreshCountyAcs()
      else if (source === 'news')              result = await refreshNews()
      else if (source === 'revenue_stacks')    result = await refreshRevenueStacksViaDsire()
      else if (source === 'energy_community')  result = await refreshEnergyCommunity()
      else if (source === 'hud_qct_dda')       result = await refreshHudQctDda()
      else if (source === 'nmtc_lic')          result = await refreshNmtcLic()
      else if (source === 'geospatial_farmland') result = await refreshGeospatialFarmland()
      else if (source === 'solar_costs')         result = await refreshSolarCosts()
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
      axiomLog('error', `refresh-data ${source} threw`, {
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
