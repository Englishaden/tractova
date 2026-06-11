// ─────────────────────────────────────────────────────────────────────────────
// programData.js — Live data service layer
//
// Single interface between Supabase and the React app.
// Replaces all static imports from src/data/ across the codebase.
//
// Caching: in-memory, 1-hour TTL. Data changes ~1-2x/week so every page load
// hitting Supabase would be wasteful. Stale data is served while fresh fetch
// runs in the background (stale-while-revalidate).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const _cache = {}

async function withCache(key, fetcher) {
  const now = Date.now()
  const hit = _cache[key]
  if (hit) {
    if (now - hit.ts < CACHE_TTL_MS) return hit.data
    // Stale — serve cached value and refresh in background
    fetcher().then(data => { _cache[key] = { data, ts: Date.now() } }).catch(err => console.error('[programData] background refresh failed:', key, err))
    return hit.data
  }
  const data = await fetcher()
  _cache[key] = { data, ts: now }
  return data
}

// ── Feasibility score formula ─────────────────────────────────────────────────
// Computed from live fields — never stored. Change a row in Supabase and
// every consumer reflects it on the next fetch with no code deploy needed.
//
// Formula inputs: cs_status, capacity_mw, lmi_percent, ix_difficulty
export function computeFeasibilityScore(row) {
  const base = { active: 65, limited: 40, pending: 18, none: 5 }[row.cs_status] ?? 5

  const mw = row.capacity_mw ?? 0
  const capacity =
    mw > 1000 ? 12 :
    mw > 500  ? 8  :
    mw > 100  ? 4  :
    mw > 0    ? 2  : 0

  const lmi = row.lmi_percent ?? 0
  const lmiPenalty =
    lmi >= 40 ? -14 :
    lmi >= 25 ? -7  :
    lmi >= 10 ? -3  : 0

  const ix = {
    easy:      12,
    moderate:  3,
    hard:      -10,
    very_hard: -22,
  }[row.ix_difficulty] ?? 3

  return Math.min(95, Math.max(1, base + capacity + lmiPenalty + ix))
}

// ── Program runway ─────────────────────────────────────────────────────────────
// Returns null if enrollment rate not seeded for this state.
// urgency: 'strong' (>24mo) | 'moderate' (13–24mo) | 'watch' (7–12mo) | 'urgent' (≤6mo)
export function computeRunway(row) {
  if (!row.enrollment_rate_mw_per_month || !(row.capacity_mw > 0)) return null
  const months = Math.round(row.capacity_mw / row.enrollment_rate_mw_per_month)
  const urgency =
    months > 24 ? 'strong'   :
    months > 12 ? 'moderate' :
    months > 6  ? 'watch'    : 'urgent'
  return { months, urgency }
}

// ── Normalize a Supabase row to camelCase + computed fields ──────────────────
function normalize(row) {
  return {
    id:                        row.id,
    name:                      row.name,
    csStatus:                  row.cs_status,
    csProgram:                 row.cs_program,
    capacityMW:                row.capacity_mw ?? 0,
    lmiRequired:               row.lmi_required ?? false,
    lmiPercent:                row.lmi_percent ?? 0,
    ixDifficulty:              row.ix_difficulty,
    ixNotes:                   row.ix_notes,
    programNotes:              row.program_notes,
    enrollmentRateMWPerMonth:  row.enrollment_rate_mw_per_month ?? null,
    lastVerified:              row.last_verified,
    updatedAt:                 row.updated_at,
    coverageTier:              row.coverage_tier ?? 'light',
    // DSIRE verification fields removed 2026-05-11. Columns still exist
    // in state_programs (migration 026) but are all NULL and the scraper
    // was removed. Schema cleanup deferred to a follow-up migration.
    // Computed — never stored
    feasibilityScore:          computeFeasibilityScore(row),
    runway:                    computeRunway(row),
  }
}

// ── getStatePrograms ──────────────────────────────────────────────────────────
// Returns all 51 state rows with computed feasibilityScore + runway.
//
// F-01 data-tiering: a signed-in user reads the full `state_programs` base
// table (ix_difficulty present → the feasibility score is exact). An anonymous
// preview visitor reads the coarse `state_programs_public` view, which omits
// the synthesized columns (ix_difficulty / *_notes / enrollment_rate); normalize()
// tolerates them being absent and the score falls back to the moderate-ix default
// — an intentional approximate teaser, not the proprietary score. Migration 084
// (Stage 3) revokes anon's base read; until then both paths still work.
export async function getStatePrograms() {
  const { data: { session } } = await supabase.auth.getSession()
  const source = session?.user ? 'state_programs' : 'state_programs_public'
  return withCache(`state_programs:${source}`, async () => {
    const { data, error } = await supabase
      .from(source)
      .select('*')
      .order('name')
    if (error) throw error
    return data.map(normalize)
  })
}

// ── getStateProgram ───────────────────────────────────────────────────────────
// Single state by ID — uses cached full list to avoid extra round-trip.
export async function getStateProgram(id) {
  const all = await getStatePrograms()
  return all.find(s => s.id === id) ?? null
}

// ── getStateProgramMap ────────────────────────────────────────────────────────
// Returns { IL: {...}, NY: {...}, ... } — drop-in replacement for stateById.
export async function getStateProgramMap() {
  const all = await getStatePrograms()
  return Object.fromEntries(all.map(s => [s.id, s]))
}

// ── getCountyData ─────────────────────────────────────────────────────────────
// Fetches county intelligence with automatic fallback to the state 'default' row.
// county parameter can be a display name ("Cook County") — normalisation handled here.
//
// Result includes a `geospatial` block when the county has a row in
// county_geospatial_data (NWI wetlands + SSURGO prime farmland — Path B
// closes the 32-state coverage gap of county_intelligence). scoreEngine
// preferentially reads geospatial when present.
export async function getCountyData(stateId, countyName) {
  const slug = normalizeCountySlug(countyName)

  return withCache(`county:${stateId}:${slug}`, async () => {
    // Curated layer: county_intelligence (slug-based, only ~18 states seeded)
    const { data: exact } = await supabase
      .from('county_intelligence')
      .select('*')
      .eq('state_id', stateId)
      .eq('county_slug', slug)
      .maybeSingle()

    let curated = exact ? shapeCounty(exact) : null
    if (!curated) {
      const { data: fallback } = await supabase
        .from('county_intelligence')
        .select('*')
        .eq('state_id', stateId)
        .eq('county_slug', 'default')
        .maybeSingle()
      curated = fallback ? shapeCounty(fallback) : null
    }

    // Live layer: county_geospatial_data via county_acs_data → county_fips.
    // Same FIPS-resolution pattern as getNmtcLic / getHudQctDda.
    const geospatial = await fetchCountyGeospatial(stateId, countyName)

    if (!curated && !geospatial) return null
    return { ...(curated || {}), geospatial: geospatial || null }
  })
}

// ── resolveCountyFips ─────────────────────────────────────────────────────────
// Resolve a dropdown county display name → county_fips via county_acs_data (the
// canonical FIPS source). Disambiguates independent-city / county name
// collisions: VA Fairfax/Franklin/Richmond/Roanoke, MD Baltimore, MO St. Louis.
// The dropdown marks the independent city with a ' (city)' suffix (see
// src/data/allCounties.json); Census names it '{base} city, {State}' vs the
// county '{base} County, {State}'. A naive ILIKE '%name%' matched BOTH and
// returned an arbitrary FIPS — so the wrong county's wetland / farmland / NMTC /
// HUD data could load. Returns the 5-digit FIPS or null.
async function resolveCountyFips(stateId, countyName) {
  const rawName = String(countyName || '').trim()
  if (!stateId || !rawName) return null
  const wantCity = /\(city\)\s*$/i.test(rawName)
  const base = rawName
    .replace(/\s*\(city\)\s*$/i, '')
    .replace(/,.*$/, '')
    .replace(/\s+(county|parish|borough|census area|municipality)$/i, '')
    .trim()
  // Census independent cities end with ' city' (pre-comma); counties end with
  // ' County'. The $-anchor correctly keeps 'Charles City County' / 'James City
  // County' classified as counties (they end in 'County', not 'city').
  const stripType = (cn) => String(cn).replace(/,.*$/, '')
    .replace(/\s+(county|parish|borough|census area|municipality|city)$/i, '').trim().toLowerCase()
  const isCityRow = (cn) => /\bcity$/i.test(String(cn).replace(/,.*$/, '').trim())
  const baseL = base.toLowerCase()
  const pick = (rows) => {
    if (!rows || rows.length === 0) return null
    // Prefer an EXACT base-name match so 'Lake' doesn't grab 'Lake of the Woods'
    // (prefix-match would). Fall back to all prefix candidates only if none match.
    let cands = rows.filter(r => stripType(r.county_name) === baseL)
    if (cands.length === 0) cands = rows
    const m = wantCity
      ? cands.find(r => isCityRow(r.county_name))
      : (cands.find(r => !isCityRow(r.county_name)) || cands[0])
    return m?.county_fips ?? null
  }
  // Prefix-match the Census leading token (base + space) so 'Will ' can't match
  // 'Williamson'; disambiguate city-vs-county among candidates in JS.
  const { data } = await supabase
    .from('county_acs_data')
    .select('county_fips, county_name')
    .eq('state', stateId)
    .ilike('county_name', `${base} %`)
    .limit(12)
  if (data && data.length) return pick(data)
  // Fallback for odd Census spellings that don't prefix-match (e.g. no type word).
  const { data: d2 } = await supabase
    .from('county_acs_data')
    .select('county_fips, county_name')
    .eq('state', stateId)
    .ilike('county_name', `%${base}%`)
    .limit(12)
  return pick(d2)
}

async function fetchCountyGeospatial(stateId, countyName) {
  if (!stateId || !countyName) return null
  const countyFips = await resolveCountyFips(stateId, countyName)
  if (!countyFips) return null

  const { data: geo } = await supabase
    .from('county_geospatial_data')
    .select('*')
    .eq('county_fips', countyFips)
    .maybeSingle()
  if (!geo) return null

  return {
    countyFips:           geo.county_fips,
    state:                geo.state,
    wetlandCoveragePct:   geo.wetland_coverage_pct,
    wetlandCategory:      geo.wetland_category,
    wetlandFeatureCount:  geo.wetland_feature_count,
    wetlandAcres:         geo.wetland_acres,
    wetlandLastUpdated:   geo.wetland_last_updated,
    wetlandSource:        geo.wetland_source,
    primeFarmlandPct:     geo.prime_farmland_pct,
    primeFarmlandAcres:   geo.prime_farmland_acres,
    totalSurveyedAcres:   geo.total_surveyed_acres,
    ssurgoAreasymbol:     geo.ssurgo_areasymbol,
    farmlandLastUpdated:  geo.farmland_last_updated,
    farmlandSource:       geo.farmland_source,
    // FEMA NRI flood (migrations 077→078) — null until the flood_nri ingest
    // lands; the score engine applies no flood penalty while null.
    floodRiskScore:       geo.flood_risk_score,
    floodRiskRating:      geo.flood_risk_rating,
    floodLastUpdated:     geo.flood_last_updated,
    // Slope (USGS 3DEP) + protected land (USGS PAD-US) — Phase 3 site layers
    // (migration 081). null until the slope seed / protected_land ingest reaches
    // this county → no site penalty while null.
    slopeDevelopablePct:  geo.slope_developable_pct,
    slopeMeanDeg:         geo.slope_mean_deg,
    slopeLastUpdated:     geo.slope_last_updated,
    protectedAreaPct:     geo.protected_area_pct,
    protectedGap123Pct:   geo.protected_gap123_pct,
    protectedLastUpdated: geo.protected_last_updated,
  }
}

function normalizeCountySlug(name) {
  if (!name) return 'default'
  return name
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function shapeCounty(row) {
  return {
    siteControl: {
      availableLand: row.available_land,
      landNotes:     row.land_notes,
      wetlandWarning: row.wetland_warning,
      wetlandNotes:  row.wetland_notes,
      landUseNotes:  row.land_use_notes,
    },
    interconnection: {
      servingUtility:    row.serving_utility,
      queueStatus:       row.queue_status,
      queueStatusCode:   row.queue_status_code,
      easeScore:         row.ease_score,
      avgStudyTimeline:  row.avg_study_timeline,
      queueNotes:        row.queue_notes,
    },
    lastVerified: row.last_verified,
  }
}

// ── getRevenueStack ───────────────────────────────────────────────────────────
export async function getRevenueStack(stateId) {
  return withCache(`revenue:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('revenue_stacks')
      .select('*')
      .eq('state_id', stateId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      summary:           data.summary,
      irecMarket:        data.irec_market,
      itcBase:           data.itc_base,
      itcAdder:          data.itc_adder,
      netMeteringStatus: data.net_metering_status,
      // DSIRE verification fields removed 2026-05-11; columns still exist
      // in revenue_stacks (migration 029) but all NULL. Schema cleanup
      // deferred to a follow-up migration.
    }
  })
}

// ── getEnergyCommunity ────────────────────────────────────────────────────────
// IRA §45/§48 Energy Community bonus credit eligibility per county. Returns
// null if the county is not flagged as an Energy Community in any layer
// (which means: not eligible for the +10% ITC bonus via this data path).
// Brownfield qualification is site-specific and not covered here -- users
// are pointed at energycommunities.gov for per-site verification.
export async function getEnergyCommunity(stateId, countyName) {
  if (!stateId || !countyName) return null
  const slug = (countyName || '')
    .toLowerCase()
    .replace(/\s+county$/, '')
    .replace(/\s+parish$/, '')
    .replace(/\s+borough$/, '')
    .replace(/\s+census area$/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
  if (!slug) return null

  return withCache(`energy_community:${stateId}:${slug}`, async () => {
    const { data, error } = await supabase
      .from('energy_community_data')
      .select('*')
      .eq('state', stateId)
      .eq('county_name_normalized', slug)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      countyFips:               data.county_fips,
      state:                    data.state,
      countyName:               data.county_name,
      isEnergyCommunity:        !!(data.qualifies_via_msa || data.qualifies_via_coal_closure),
      qualifiesViaMsa:          !!data.qualifies_via_msa,
      qualifiesViaCoalClosure:  !!data.qualifies_via_coal_closure,
      msaAreaName:              data.msa_area_name,
      coalClosureTractCount:    data.coal_closure_tract_count || 0,
      ffeQualified:             !!data.ffe_qualified,
      ecQualified:              !!data.ec_qualified,
      datasetVersion:           data.dataset_version,
      lastUpdated:              data.last_updated,
    }
  })
}

// ── getNmtcLic ────────────────────────────────────────────────────────────────
// IRA §48(e) Category 1 Low-Income Communities Bonus Credit eligibility per
// county. Returns the per-county count of NMTC LIC tracts from the authoritative
// CDFI determination (ACS 2016-2020, via the DOE §48(e) layers). A project sited
// in any qualifying tract picks up the +10% ITC bonus credit. Stacks with Energy
// Community for compound bonus (potentially +20%).
export async function getNmtcLic(stateId, countyName) {
  if (!stateId || !countyName) return null
  return withCache(`nmtc_lic:${stateId}:${countyName.toLowerCase()}`, async () => {
    const countyFips = await resolveCountyFips(stateId, countyName)
    if (!countyFips) return null

    const { data, error } = await supabase
      .from('nmtc_lic_data')
      .select('*')
      .eq('county_fips', countyFips)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      countyFips:                data.county_fips,
      state:                     data.state,
      countyName:                data.county_name,
      totalTractsInCounty:       data.total_tracts_in_county || 0,
      qualifyingTractsCount:     data.qualifying_tracts_count || 0,
      qualifyingTractGeoids:     data.qualifying_tract_geoids || [],
      datasetVersion:            data.dataset_version,
      source:                    data.source,
      lastUpdated:               data.last_updated,
      isEligible:                (data.qualifying_tracts_count || 0) > 0,
    }
  })
}

// ── getHudQctDda ──────────────────────────────────────────────────────────────
// HUD federal LIHTC designation overlay per county. Returns per-county QCT
// count + non-metro DDA flag if the county has any designation; otherwise
// null (no QCTs and not a non-metro DDA -- still possibly inside a metro
// DDA which is ZCTA-level and not covered here).
export async function getHudQctDda(stateId, countyName) {
  if (!stateId || !countyName) return null
  // Look up county_fips via county_acs_data (canonical FIPS source)
  const slug = (countyName || '').toLowerCase().trim()
  return withCache(`hud_qct_dda:${stateId}:${slug}`, async () => {
    const countyFips = await resolveCountyFips(stateId, countyName)
    if (!countyFips) return null

    const { data, error } = await supabase
      .from('hud_qct_dda_data')
      .select('*')
      .eq('county_fips', countyFips)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      countyFips:        data.county_fips,
      state:             data.state,
      countyName:        data.county_name,
      qctCount:          data.qct_count || 0,
      qctTractGeoids:    data.qct_tract_geoids || [],
      isNonMetroDda:     !!data.is_non_metro_dda,
      ddaName:           data.dda_name,
      ddaCode:           data.dda_code,
      datasetYear:       data.dataset_year,
      lastUpdated:       data.last_updated,
    }
  })
}

// ── getStateProgramDeltas ─────────────────────────────────────────────────────
// V3 Wave 1.4: reads state_programs_snapshots and returns WoW (or most-
// recent-pair) feasibility-score deltas per state. Returns an empty Map
// when fewer than 2 snapshots per state exist (typical for the first
// 1-3 weeks after migration 038 lands). Markets on the Move falls back
// to its current recency-only sort when the map is empty.
//
// We pull snapshot pairs with a window function (latest + second-latest
// per state). Since this runs from the client, we rely on RLS to permit
// anon/authenticated read access on the snapshots table.
export async function getStateProgramDeltas({ minDaysApart = 4 } = {}) {
  // F-01: snapshot feasibility_score is synthesized IP — Pro/authed-only. An
  // anonymous visitor gets an empty Map, so the Home "Markets on the Move"
  // ticker falls back to recency-sorted movers (no week-over-week deltas)
  // rather than reading the gated snapshots table. Migration 084 enforces this
  // server-side; this keeps the anon preview from requesting a table it can't read.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return new Map()
  return withCache('state_program_deltas', async () => {
    // Pull last ~120 days of snapshots. ~50 states × ~16 weekly rows each
    // = ~800 rows worst case -- trivial.
    const cutoff = new Date(Date.now() - 120 * 86400 * 1000).toISOString()
    const { data, error } = await supabase
      .from('state_programs_snapshots')
      .select('state_id, feasibility_score, snapshot_at')
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: false })
    if (error) {
      console.warn('[state_programs_snapshots] read failed:', error.message)
      return new Map()
    }
    if (!data || data.length === 0) return new Map()

    // Group by state, pick the latest two snapshots that are at least
    // `minDaysApart` apart (avoids artificial deltas from same-day reruns).
    const byState = new Map()
    for (const row of data) {
      if (!byState.has(row.state_id)) byState.set(row.state_id, [])
      byState.get(row.state_id).push(row)
    }
    const deltas = new Map()
    for (const [state, rows] of byState.entries()) {
      if (rows.length < 2) continue
      const latest = rows[0]
      // Walk backwards for the first row that's >=minDaysApart from latest
      const latestTs = new Date(latest.snapshot_at).getTime()
      const prev = rows.slice(1).find(r =>
        latestTs - new Date(r.snapshot_at).getTime() >= minDaysApart * 86400 * 1000
      )
      if (!prev) continue
      const cur  = parseFloat(latest.feasibility_score)
      const prevScore = parseFloat(prev.feasibility_score)
      if (!Number.isFinite(cur) || !Number.isFinite(prevScore)) continue
      const delta = Math.round(cur - prevScore)
      if (delta === 0) continue   // unchanged states aren't "moving"
      deltas.set(state, {
        delta,
        curScore:   cur,
        prevScore,
        latestAt:   latest.snapshot_at,
        previousAt: prev.snapshot_at,
      })
    }
    return deltas
  })
}

// ── getDashboardMetricsHistory ────────────────────────────────────────────────
// 2026-05-27 Dashboard revamp v2: 8-week trailing history for the MetricsBar
// KPI cards. Derived from EXISTING tables, no new schema:
//   • csCoverage / pipelineLoad / avgCapacity — from `state_programs_snapshots`
//     (the same table getStateProgramDeltas reads from)
//   • policyPulse — from `news_feed` (counts per ISO week)
//   • ixHeadroom — returns null (no per-week IX-utility history source yet;
//     card renders the live value without sparkline + a graceful footer note)
//
// Per data-honesty memory: derived series only — if the underlying
// snapshots have <4 weeks of pairs available, the returned arrays are
// shorter (or empty). The MetricsBar then renders the live value
// without a sparkline — never fabricates frames.
//
// Returns:
//   {
//     csCoverage:    [{ week: 'YYYY-Www', value: number }, ...],
//     pipelineLoad:  [{ week, value }, ...],
//     avgCapacity:   [{ week, value }, ...],
//     policyPulse:   [{ week, value }, ...],
//     ixHeadroom:    null,
//   }
export async function getDashboardMetricsHistory({ weeks = 8 } = {}) {
  return withCache(`dashboard_metrics_history:${weeks}w`, async () => {
    // Compute the cutoff: weeks * 7 days back, plus a small slop so the
    // earliest snapshot week has a clean week-bucket.
    const cutoffMs = Date.now() - (weeks + 1) * 7 * 86400 * 1000
    const cutoffISO = new Date(cutoffMs).toISOString()

    // ── Pull snapshots + news in parallel ────────────────────────────────
    const [snapsRes, newsRes] = await Promise.allSettled([
      // F-01: read the coarse view (state_id/cs_status/capacity_mw/snapshot_at —
      // all non-IP, no feasibility_score) so this aggregate works for anon too,
      // and survives the migration-084 base-table REVOKE.
      supabase
        .from('state_programs_snapshots_public')
        .select('state_id, cs_status, capacity_mw, snapshot_at')
        .gte('snapshot_at', cutoffISO)
        .order('snapshot_at', { ascending: true }),
      supabase
        .from('news_feed')
        .select('pillar, published_at')
        .eq('is_active', true)
        .gte('published_at', cutoffISO.slice(0, 10))
        .order('published_at', { ascending: true }),
    ])

    // ── ISO-week bucketing helper. We bucket snapshot rows + news rows
    // into the same canonical "YYYY-Www" keys so the sparklines align. ──
    const toIsoWeek = (dateLike) => {
      const d = new Date(dateLike)
      const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const dayNum = date.getUTCDay() || 7
      date.setUTCDate(date.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
      const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
      return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
    }

    // ── csCoverage / pipelineLoad / avgCapacity — group snapshots by
    //    (state_id, week), keep the latest snapshot per state per week
    //    (a state could be re-snapshotted same week if a refresh re-fires;
    //    we want the snapshot-of-record per week). Then aggregate. ──
    const csCoverage   = []
    const pipelineLoad = []
    const avgCapacity  = []

    if (snapsRes.status === 'fulfilled' && Array.isArray(snapsRes.value.data)) {
      // Map<weekKey, Map<state_id, lastRow>>
      const byWeek = new Map()
      for (const row of snapsRes.value.data) {
        const wk = toIsoWeek(row.snapshot_at)
        if (!byWeek.has(wk)) byWeek.set(wk, new Map())
        // Last-write-wins (input is ordered ascending, so we keep the
        // latest row per state per week).
        byWeek.get(wk).set(row.state_id, row)
      }
      // Iterate weeks in order, derive the 3 series.
      const sortedWeeks = Array.from(byWeek.keys()).sort()
      for (const wk of sortedWeeks) {
        const states = Array.from(byWeek.get(wk).values())
        const activeCount = states.filter((r) => r.cs_status === 'active').length
        const liveStates  = states.filter((r) => r.cs_status === 'active' || r.cs_status === 'limited')
        const totalMW     = liveStates.reduce((s, r) => s + (Number(r.capacity_mw) || 0), 0)
        const avgMW       = liveStates.length > 0 ? Math.round(totalMW / liveStates.length) : 0
        csCoverage  .push({ week: wk, value: activeCount })
        pipelineLoad.push({ week: wk, value: Math.round(totalMW) })
        avgCapacity .push({ week: wk, value: avgMW })
      }
    }

    // ── policyPulse — count news items per ISO week. Counts ALL pillars
    //    (matches the live `policyAlertsThisWeek` aggregator's definition).
    //    Ship 2.1 extension: also return `policyPulseByPillar` — a list of
    //    weeks where each row is { week, offtake, ix, site, policy } counts.
    //    Used by Analytics tab Chart 5 (stacked area). Keeps the simple
    //    `policyPulse` total for the existing MetricsBar sparkline. ──
    const policyPulse = []
    const policyPulseByPillar = []
    if (newsRes.status === 'fulfilled' && Array.isArray(newsRes.value.data)) {
      // Bucket: week -> { offtake, ix, site, policy, total }
      const byWeek = new Map()
      for (const row of newsRes.value.data) {
        const wk = toIsoWeek(row.published_at)
        const cur = byWeek.get(wk) || { offtake: 0, ix: 0, site: 0, policy: 0, total: 0 }
        cur.total += 1
        const p = row.pillar
        if (p === 'offtake' || p === 'ix' || p === 'site' || p === 'policy') cur[p] += 1
        byWeek.set(wk, cur)
      }
      const sortedWeeks = Array.from(byWeek.keys()).sort()
      for (const wk of sortedWeeks) {
        const b = byWeek.get(wk)
        policyPulse.push({ week: wk, value: b.total })
        policyPulseByPillar.push({ week: wk, offtake: b.offtake, ix: b.ix, site: b.site, policy: b.policy })
      }
    }

    return {
      csCoverage,
      pipelineLoad,
      avgCapacity,
      policyPulse,
      policyPulseByPillar,
      ixHeadroom: null, // No history source yet — see plan `warm-foraging-charm.md`.
    }
  })
}

// ── getLibraryProjectsByState ─────────────────────────────────────────────────
// 2026-05-28 Dashboard v2.5 — live globe markers (authed path). Queries the
// `projects` table for the current user, groups by state, returns top-N states
// by saved-project count.
//
// Returns: [{ stateId, count, totalMw, latestSavedAt }] sorted by count desc.
// Empty array if the user has no saved projects or is signed-out (RLS gates
// the query to the user's own rows).
//
// Used by DashboardGlobe to draw "your saved markets" pulsing markers on the
// idle globe.
export async function getLibraryProjectsByState({ topN = 7 } = {}) {
  return withCache(`library_projects_by_state:${topN}`, async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('state, mw, saved_at')
    if (error) {
      console.warn('[getLibraryProjectsByState] read failed:', error.message)
      return []
    }
    if (!data || data.length === 0) return []

    const byState = new Map()
    for (const row of data) {
      if (!row.state) continue
      const cur = byState.get(row.state) || { stateId: row.state, count: 0, totalMw: 0, latestSavedAt: null }
      cur.count += 1
      cur.totalMw += Number(row.mw) || 0
      const ts = row.saved_at ? new Date(row.saved_at).getTime() : 0
      const latestTs = cur.latestSavedAt ? new Date(cur.latestSavedAt).getTime() : 0
      if (ts > latestTs) cur.latestSavedAt = row.saved_at
      byState.set(row.state, cur)
    }
    return Array.from(byState.values())
      .sort((a, b) => b.count - a.count || b.totalMw - a.totalMw)
      .slice(0, topN)
  })
}

// ── getTopCsStatesByActivity ──────────────────────────────────────────────────
// 2026-05-28 Dashboard v2.5 — live globe markers (signed-out / preview fallback).
// Aggregates real operating CS projects from LBNL Sharing the Sun (`cs_projects`)
// by state, returning the top-N states by project count. Public-data fallback
// for visitors with no saved-library context.
//
// Returns: [{ stateId, count, totalMw }] sorted by count desc.
export async function getTopCsStatesByActivity({ topN = 7 } = {}) {
  return withCache(`top_cs_states:${topN}`, async () => {
    // Pull a wide range (PostgREST default 1000; range to 4999 to be safe).
    // We only need state + size_mw; minimal column set keeps payload tight.
    const { data, error } = await supabase
      .from('cs_projects')
      .select('state, system_size_mw_ac')
      .range(0, 4999)
    if (error) {
      console.warn('[getTopCsStatesByActivity] read failed:', error.message)
      return []
    }
    if (!data || data.length === 0) return []

    const byState = new Map()
    for (const row of data) {
      if (!row.state) continue
      const cur = byState.get(row.state) || { stateId: row.state, count: 0, totalMw: 0 }
      cur.count += 1
      cur.totalMw += Number(row.system_size_mw_ac) || 0
      byState.set(row.state, cur)
    }
    return Array.from(byState.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
  })
}

// ── getCsProjectsAggByState ───────────────────────────────────────────────────
// 2026-05-28 Analytics tab — Chart 7: "Operating CS Projects per State"
// (LBNL Sharing the Sun ground truth). Aggregates `cs_projects` by state,
// returning count + total MW AC + median MW per state. Cached 1h via withCache.
//
// Distinct from `getTopCsStatesByActivity` (which returns top-N only) — this
// one returns ALL states so the Analytics chart can sort/filter as needed.
export async function getCsProjectsAggByState() {
  return withCache('cs_projects_agg_by_state', async () => {
    const { data, error } = await supabase
      .from('cs_projects')
      .select('state, system_size_mw_ac')
      .range(0, 4999)
    if (error) {
      console.warn('[getCsProjectsAggByState] read failed:', error.message)
      return []
    }
    if (!data || data.length === 0) return []

    // Group by state, collect sizes for median calc
    const byState = new Map()
    for (const row of data) {
      if (!row.state) continue
      const cur = byState.get(row.state) || { stateId: row.state, count: 0, totalMw: 0, sizes: [] }
      cur.count += 1
      const mw = Number(row.system_size_mw_ac) || 0
      cur.totalMw += mw
      if (mw > 0) cur.sizes.push(mw)
      byState.set(row.state, cur)
    }
    return Array.from(byState.values())
      .map((r) => {
        const sorted = r.sizes.slice().sort((a, b) => a - b)
        const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
        return { stateId: r.stateId, count: r.count, totalMw: Math.round(r.totalMw * 10) / 10, median: Math.round(median * 100) / 100 }
      })
      .sort((a, b) => b.count - a.count)
  })
}

// ── getCsSubscriptionMixByState ───────────────────────────────────────────────
// 2026-05-28 Ship 2.2 (Markets & Policy tab) — operating CS capacity broken
// out by SUBSCRIPTION CHANNEL per state, from LBNL/NREL Sharing the Sun
// (`cs_projects.subscription_marketer`). This is the honest read of "who
// subscribes / markets these projects": Utility-run, Third-party, or a
// Combination. Source uses a handful of label variants ('Utility' vs
// 'Utility-run', 'Third-party' vs 'Third Party', etc.) which we normalize
// into four buckets; anything null / blank / unrecognized falls into
// `unknown` (disclosed in the chart footer — NOT silently dropped).
//
// NB: Sharing the Sun does NOT publish a residential/commercial/municipal
// subscriber split, so we don't fabricate one. MW sums use system_size_mw_ac.
//
// Returns: [{ stateId, total, utility, thirdParty, combination, unknown }]
// (MW, rounded to 0.1) sorted by total MW desc. Cached 1h via withCache.
export async function getCsSubscriptionMixByState() {
  return withCache('cs_subscription_mix_by_state', async () => {
    const { data, error } = await supabase
      .from('cs_projects')
      .select('state, subscription_marketer, system_size_mw_ac')
      .range(0, 4999)
    if (error) {
      console.warn('[getCsSubscriptionMixByState] read failed:', error.message)
      return []
    }
    if (!data || data.length === 0) return []

    // Normalize the free-text marketer label into one of four buckets.
    const bucketFor = (raw) => {
      const s = String(raw || '').trim().toLowerCase()
      if (!s) return 'unknown'
      if (s.includes('combination') || s.includes('both') || s.includes('hybrid')) return 'combination'
      if (s.includes('third') || s.includes('3rd') || s.includes('marketer')) return 'thirdParty'
      if (s.includes('utility')) return 'utility'
      return 'unknown'
    }

    const byState = new Map()
    for (const row of data) {
      if (!row.state) continue
      const cur = byState.get(row.state) || { stateId: row.state, total: 0, utility: 0, thirdParty: 0, combination: 0, unknown: 0 }
      const mw = Number(row.system_size_mw_ac) || 0
      cur.total += mw
      cur[bucketFor(row.subscription_marketer)] += mw
      byState.set(row.state, cur)
    }

    const round1 = (n) => Math.round(n * 10) / 10
    return Array.from(byState.values())
      .map((r) => ({
        stateId:     r.stateId,
        total:       round1(r.total),
        utility:     round1(r.utility),
        thirdParty:  round1(r.thirdParty),
        combination: round1(r.combination),
        unknown:     round1(r.unknown),
      }))
      .sort((a, b) => b.total - a.total)
  })
}

// ── getNewsFeed ───────────────────────────────────────────────────────────────
// Returns active news items sorted by published_at descending.
export async function getNewsFeed() {
  return withCache('news_feed', async () => {
    const { data, error } = await supabase
      .from('news_feed')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
    if (error) throw error
    return data.map(row => ({
      id:       row.id,
      headline: row.headline,
      source:   row.source,
      url:      row.url,
      date:     row.published_at,
      pillar:   row.pillar,
      type:     row.type,
      summary:  row.summary,
      tags:     row.tags ?? [],
      stateIds: row.state_ids ?? [],
    }))
  })
}

// ── getPucDockets ─────────────────────────────────────────────────────────────
// V3 Wave 2 — returns active PUC dockets, optionally filtered to a state.
// Cached for 1h via withCache (puc_dockets:{state} or puc_dockets:all).
// Closed / inactive dockets are filtered out by default.
export async function getPucDockets({ state, includeClosed = false } = {}) {
  const cacheKey = state ? `puc_dockets:${state}` : 'puc_dockets:all'
  return withCache(cacheKey, async () => {
    let query = supabase
      .from('puc_dockets')
      .select('*')
      .eq('is_active', true)
      .order('filed_date', { ascending: false, nullsFirst: false })
    if (state) query = query.eq('state', state)
    if (!includeClosed) query = query.neq('status', 'closed')
    const { data, error } = await query
    if (error) {
      console.warn('[puc_dockets] fetch failed:', error.message)
      return []
    }
    return (data || []).map(row => ({
      id:               row.id,
      state:            row.state,
      pucName:          row.puc_name,
      docketNumber:     row.docket_number,
      title:            row.title,
      status:           row.status,
      pillar:           row.pillar,
      impactTier:       row.impact_tier,
      filedDate:        row.filed_date,
      commentDeadline:  row.comment_deadline,
      decisionTarget:   row.decision_target,
      summary:          row.summary,
      sourceUrl:        row.source_url,
      lastUpdated:      row.last_updated,
    }))
  })
}

// ── getComparableDeals ────────────────────────────────────────────────────────
// V3 Wave 2 — comparable / market deal database. Returns active deals,
// optionally filtered by state, technology, county, or MW range. Sorted
// by recency (filing_date desc) by default. Cached for 1h via withCache.
//
// Common usage from Lens: getComparableDeals({ state, technology, mwRange: [mw*0.5, mw*2] })
// Common usage from admin panel: getComparableDeals({ includeInactive: true }) for bulk view.
export async function getComparableDeals({ state, technology, county, mwRange, includeInactive = false } = {}) {
  const cacheKey = `comparable_deals:${state || 'all'}:${technology || 'all'}:${county || 'all'}:${mwRange ? mwRange.join('-') : 'all'}:${includeInactive ? 'all' : 'active'}`
  return withCache(cacheKey, async () => {
    let query = supabase
      .from('comparable_deals')
      .select('*')
      .order('filing_date', { ascending: false, nullsFirst: false })
    if (!includeInactive) query = query.eq('is_active', true)
    if (state)            query = query.eq('state', state)
    if (technology)       query = query.eq('technology', technology)
    if (county)           query = query.ilike('county', county)
    if (mwRange)          query = query.gte('mw', mwRange[0]).lte('mw', mwRange[1])
    const { data, error } = await query
    if (error) {
      console.warn('[comparable_deals] fetch failed:', error.message)
      return []
    }
    return (data || []).map(row => ({
      id:                   row.id,
      state:                row.state,
      county:               row.county,
      technology:           row.technology,
      mw:                   row.mw,
      status:               row.status,
      developer:            row.developer,
      estimatedCapexPerW:   row.estimated_capex_per_w,
      offtakeSummary:       row.offtake_summary,
      ixDifficulty:         row.ix_difficulty,
      servingUtility:       row.serving_utility,
      source:               row.source,
      sourceUrl:            row.source_url,
      filingDate:           row.filing_date,
      codTarget:            row.cod_target,
      notes:                row.notes,
      lastUpdated:          row.last_updated,
    }))
  })
}

// ── getLmiData ────────────────────────────────────────────────────────────────
// V3 Wave 2 — state-level LMI (≤80% AMI) household intelligence for the
// Subscriber Acquisition Intel layer. Returns null if the state isn't seeded
// (caller falls back to a nationwide median in the UI). Cached 1h via
// withCache. Data source: US Census ACS 2018-2022 5-year estimates,
// seeded in migration 025; Phase 2 cron will refresh annually.
export async function getLmiData(stateId) {
  if (!stateId) return null
  return withCache(`lmi_data:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('lmi_data')
      .select('*')
      .eq('state', stateId.toUpperCase())
      .maybeSingle()
    if (error) {
      console.warn('[lmi_data] fetch failed:', error.message)
      return null
    }
    if (!data) return null
    return {
      state:                 data.state,
      stateName:             data.state_name,
      totalHouseholds:       data.total_households,
      lmiHouseholds:         data.lmi_households,
      lmiPct:                Number(data.lmi_pct),
      medianHouseholdIncome: data.median_household_income,
      ami80Pct:              data.ami_80pct,
      lastUpdated:           data.last_updated,
      source:                data.source,
    }
  })
}

// ── getCountyAcsData ──────────────────────────────────────────────────────────
// V3 Wave 2 — per-county Census ACS data (LMI density + population +
// median income). Populated by refresh-data.js?source=county_acs.
//
// Two query modes:
//   - getCountyAcsData(state) returns all counties in the state, sorted by
//     LMI density desc -- useful for the SubscribersTab "Top counties by
//     LMI eligibility" view.
//   - getCountyAcsData(state, county) returns a single county, exact-match
//     on county_name LIKE '{county}%' -- useful in Lens for the project's
//     specific county.
export async function getCountyAcsData(state, county) {
  if (!state) return county ? null : []
  const cacheKey = county
    ? `county_acs:${state}:${county.toLowerCase()}`
    : `county_acs:${state}:_all`
  return withCache(cacheKey, async () => {
    let query = supabase
      .from('county_acs_data')
      .select('*')
      .eq('state', state.toUpperCase())
      .order('lmi_pct', { ascending: false })
    if (county) query = query.ilike('county_name', `${county}%`)
    const { data, error } = await query
    if (error) {
      console.warn('[county_acs] fetch failed:', error.message)
      return county ? null : []
    }
    const rows = (data || []).map(row => ({
      countyFips:              row.county_fips,
      state:                   row.state,
      countyName:              row.county_name,
      totalHouseholds:         row.total_households,
      lmiHouseholds:           row.lmi_households,
      lmiPct:                  Number(row.lmi_pct),
      medianHouseholdIncome:   row.median_household_income,
      ami80Pct:                row.ami_80pct,
      totalPopulation:         row.total_population,
      lastUpdated:             row.last_updated,
      source:                  row.source,
    }))
    return county ? (rows[0] || null) : rows
  })
}

// ── getDashboardMetrics ───────────────────────────────────────────────────────
// Calls the get_dashboard_metrics() Supabase RPC.
// Returns live-computed aggregates — no manual metrics.js entry ever again.
export async function getDashboardMetrics() {
  return withCache('dashboard_metrics', async () => {
    const { data, error } = await supabase.rpc('get_dashboard_metrics')
    if (error) throw error
    return data
  })
}

// Distribution-level CS-pipeline data sources (vs the legacy ISO queue-depth
// seed/scraper rows). Each state's feed is a different dataset, so each carries
// its own honest UI label + footer note. Adding a state = add its data_source
// here + its scraper in api/scrapers/. See [[project_ix_distribution_data]].
const CS_PIPELINE_SOURCES = {
  nyserda_cdg: {
    label: 'NYSERDA Solar Electric Programs',
    region: 'NY-Sun',
    note: 'NYSERDA Solar Electric Programs (NY-Sun) · all distributed solar, tagged by monetization structure (community solar vs net-metered customer-sited). Pipeline = applied, not yet energized. Updated monthly. A deployment-pipeline signal, not ISO study-queue depth — the IX score uses the curated state baseline.',
  },
  nj_ic_queue: {
    label: 'NJ EDC Interconnection Queue',
    region: 'NJ (multi-EDC)',
    note: 'NJ EDC monthly interconnection queue inventories (BPU Docket QO21010085) · metering type = Community Solar (active queue). Covers JCP&L + PSE&G; Rockland (RECO) currently has 0 CS in queue; ACE pending (file URL JS-gated). A deployment-pipeline signal, not study-queue depth — the IX score uses the curated state baseline.',
  },
  va_dominion_queue: {
    label: 'Dominion VA Interconnection Queue',
    region: 'Dominion VA',
    note: 'Dominion Energy Virginia Queue Status Report (quarterly) · solar projects, sub-50 MW distribution-level (median ~3 MW). Active = pipeline, In Service = energized. A deployment-pipeline signal, not study-queue depth — the IX score uses the curated state baseline.',
  },
  wi_alliant_queue: {
    label: 'Alliant WI DG Solar Queue',
    region: 'Alliant WI territory',
    note: 'Alliant Energy WI distributed-generation queue (weekly) · ALL distributed solar (≈90% residential rooftop, not CS-specific). Shown as live DG-activity context, not a community-solar pipeline. Alliant territory only. The IX score uses the curated state baseline.',
  },
  ca_pge_queue: {
    label: 'PG&E Wholesale Distribution Queue',
    region: 'PG&E territory',
    note: 'PG&E Wholesale Distribution interconnection queue · Solar PV at distribution substations, sub-50 MW (median ~2 MW). CA has no formal community-solar program, so this is a DISTRIBUTION solar queue, not a CS pipeline. Active = pipeline, In Service = energized. Live DG-activity context — the IX score uses the curated state baseline.',
  },
  md_mea_cs: {
    label: 'MD Community Solar Program (MEA)',
    region: 'Maryland EDCs',
    note: 'Maryland Energy Administration community-solar project list · per EDC (BGE, Pepco, Delmarva, Potomac Edison). In Service = energized, Under Construction / Design & Development = pipeline. A real CS deployment signal (MD has a permanent CS program). Updated periodically. The IX score uses the curated state baseline.',
  },
}

// ── getIXQueueData ───────────────────────────────────────────────────────────
// Returns IX queue rows for a state, grouped by utility.
//
// Capture-all-DG (migration 068): the table now holds one row per
// (state, utility, metering_type) — every distribution-DG project, tagged by
// monetization structure, not just Community Solar. We group back to one entry
// per utility for the cards (top-level numbers are the all-structure sum) and
// carry a per-structure `structures[]` breakdown + a state-wide
// `availableStructures` rollup so the Lens structure filter / summary can scope a
// view without re-querying.
//
// Shape: { iso, signalType, source*, utilities: [{ name, projectsInQueue,
//         mwPending, ..., structures: [{ meteringType, ... }] }],
//         availableStructures: [{ meteringType, projectsInQueue, mwPending, ... }],
//         oldestFetchedAt, newestFetchedAt, dataAgeDays }
//
// dataAgeDays is the worst-case (oldest) staleness across utilities — used
// by the UI to flag IX-live data that's drifted past the freshness window.

// Build one per-utility card entry from its (one-or-many) structure rows. The
// top-level numbers sum across structures (the "all structures" view);
// `structures` carries the per-structure split for the Lens filter.
function buildIxUtilityEntry(rows) {
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const anyCompleted = rows.some(r => r.completed_projects != null)
  const firstNonNull = (k) => { const r = rows.find(r => r[k] != null); return r ? r[k] : null }
  const newestFetched = rows.map(r => r.fetched_at).filter(Boolean).sort().slice(-1)[0] || null
  const structures = rows
    .map(r => ({
      meteringType:      r.metering_type || 'unknown',
      projectsInQueue:   r.projects_in_queue,
      mwPending:         r.mw_pending,
      completedProjects: r.completed_projects,
      completedMw:       r.completed_mw,
      queueTrend:        r.queue_trend,
    }))
    .sort((a, b) => (b.projectsInQueue || 0) - (a.projectsInQueue || 0))
  return {
    name:              rows[0].utility_name,
    projectsInQueue:   sum('projects_in_queue'),
    mwPending:         sum('mw_pending'),
    completedProjects: anyCompleted ? sum('completed_projects') : null,
    completedMw:       anyCompleted ? sum('completed_mw') : null,
    avgStudyMonths:    firstNonNull('avg_study_months'),
    withdrawalPct:     firstNonNull('withdrawal_pct'),
    avgUpgradeCostMW:  firstNonNull('avg_upgrade_cost_mw'),
    queueTrend:        rows[0].queue_trend,
    dataSource:        rows[0].data_source,
    fetchedAt:         newestFetched,
    structures,
  }
}

// State-wide totals per metering_type, sorted by pipeline count desc. Drives the
// default summary view (CS = the wedge) + the future Lens structure chips.
function summarizeIxStructures(rows) {
  const by = new Map()
  for (const r of rows) {
    const k = r.metering_type || 'unknown'
    if (!by.has(k)) by.set(k, { meteringType: k, projectsInQueue: 0, mwPending: 0, completedProjects: 0, completedMw: 0, _hasCompleted: false })
    const a = by.get(k)
    a.projectsInQueue += Number(r.projects_in_queue) || 0
    a.mwPending += Number(r.mw_pending) || 0
    if (r.completed_projects != null) { a._hasCompleted = true; a.completedProjects += Number(r.completed_projects) || 0; a.completedMw += Number(r.completed_mw) || 0 }
  }
  return [...by.values()]
    .map(({ _hasCompleted, ...a }) => ({ ...a, completedProjects: _hasCompleted ? a.completedProjects : null, completedMw: _hasCompleted ? a.completedMw : null }))
    .sort((x, y) => (y.projectsInQueue || 0) - (x.projectsInQueue || 0))
}

export async function getIXQueueData(stateId) {
  return withCache(`ix_queue:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('ix_queue_data')
      .select('*')
      .eq('state_id', stateId)
      .order('utility_name')
    if (error) throw error
    if (!data || data.length === 0) return null
    const fetchedAts = data.map(r => r.fetched_at).filter(Boolean).sort()
    const oldestFetchedAt = fetchedAts[0] || null
    const newestFetchedAt = fetchedAts[fetchedAts.length - 1] || null
    const dataAgeDays = oldestFetchedAt
      ? Math.floor((Date.now() - new Date(oldestFetchedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
    // signalType distinguishes the distribution-level CS deployment-pipeline
    // signal (one of CS_PIPELINE_SOURCES) from the legacy ISO queue-depth model.
    // cs_pipeline rows carry no study-months/withdrawal/upgrade-cost — those stay
    // null and the IX score is NOT blended (curated baseline only); the data is
    // shown as live CONTEXT (pipeline vs completed CS projects). sourceMeta drives
    // honest per-source UI labels (each state's feed is a different dataset).
    const csSource = data.find(r => CS_PIPELINE_SOURCES[r.data_source])
    const signalType = csSource ? 'cs_pipeline' : 'queue_depth'
    const sourceMeta = csSource ? CS_PIPELINE_SOURCES[csSource.data_source] : null

    // Group (utility, metering_type) rows back to one entry per utility.
    const byUtil = new Map()
    for (const row of data) {
      if (!byUtil.has(row.utility_name)) byUtil.set(row.utility_name, [])
      byUtil.get(row.utility_name).push(row)
    }

    return {
      iso: data[0].iso,
      signalType,
      sourceLabel:  sourceMeta?.label ?? null,
      sourceRegion: sourceMeta?.region ?? null,
      sourceNote:   sourceMeta?.note ?? null,
      utilities: [...byUtil.values()].map(buildIxUtilityEntry),
      availableStructures: summarizeIxStructures(data),
      oldestFetchedAt,
      newestFetchedAt,
      dataAgeDays,
    }
  })
}

// ── hasIXQueueData ───────────────────────────────────────────────────────────
export async function hasIXQueueData(stateId) {
  const data = await getIXQueueData(stateId)
  return data !== null
}

// ── getIXQueueSummary ────────────────────────────────────────────────────────
// Aggregated summary for a state + project MW, scoped to a monetization-structure
// VIEW. With capture-all-DG (migration 068) a state can hold multiple structures
// (CS / net metering / other); the headline must reflect ONE coherent view or the
// card's "CS projects" copy would mislabel net metering. Default view = Community
// Solar when the state has any CS rows (CS = the wedge), else all structures. The
// Lens passes an explicit `meteringType` to switch views: a tag ('net_metering',
// 'community_solar', …) for one structure, 'all' for every structure, or
// null/undefined for the default. Drop-in for ixQueueEngine.getIXQueueSummary().
export async function getIXQueueSummary(stateId, mwAC, meteringType = null) {
  const data = await getIXQueueData(stateId)
  if (!data) return null

  // Active view: 'all' = every structure; an explicit tag = that one; null/undefined
  // = default to CS when the state has any (the wedge), else every structure.
  const hasCs = data.availableStructures.some(s => s.meteringType === 'community_solar')
  const view = meteringType === 'all' ? null : (meteringType ?? (hasCs ? 'community_solar' : null))

  // Scope each utility to the view's single structure, or keep the all-structure
  // aggregate when view is null. Utilities lacking the view's structure drop out.
  const utilities = view == null
    ? data.utilities
    : data.utilities.flatMap(u => {
        const s = u.structures.find(x => x.meteringType === view)
        if (!s) return []
        return [{
          name: u.name,
          projectsInQueue: s.projectsInQueue,
          mwPending: s.mwPending,
          completedProjects: s.completedProjects,
          completedMw: s.completedMw,
          avgStudyMonths: u.avgStudyMonths,
          withdrawalPct: u.withdrawalPct,
          avgUpgradeCostMW: u.avgUpgradeCostMW,
          queueTrend: s.queueTrend,
          dataSource: u.dataSource,
          fetchedAt: u.fetchedAt,
          structures: [s],
        }]
      })

  const mw = parseFloat(mwAC) || 5
  const totalProjects = utilities.reduce((s, u) => s + u.projectsInQueue, 0)
  const totalMW = utilities.reduce((s, u) => s + u.mwPending, 0)
  const isPipeline = data.signalType === 'cs_pipeline'

  // queue-depth (ISO) signal carries study/withdrawal/upgrade; cs_pipeline does
  // NOT — keep those null rather than fabricating a 0/round.
  const sumW = (key) => utilities.reduce((s, u) => s + (Number(u[key]) || 0) * u.projectsInQueue, 0)
  const avgStudyMonths   = isPipeline || totalProjects === 0 ? null : Math.round(sumW('avgStudyMonths') / totalProjects)
  const avgWithdrawalPct = isPipeline || totalProjects === 0 ? null : Math.round(sumW('withdrawalPct') / totalProjects)
  const avgUpgradeCostPerMW = isPipeline || totalProjects === 0 ? null : Math.round(sumW('avgUpgradeCostMW') / totalProjects)
  const estimatedUpgradeCost = avgUpgradeCostPerMW == null ? null : Math.round(avgUpgradeCostPerMW * mw)

  // Deployment context (cs_pipeline only): projects energized to date. Null when
  // the source reports no energized history (e.g. NJ's active-only queue) —
  // unknown ≠ zero, so the UI omits the stat rather than showing a false 0.
  const hasCompleted = utilities.some(u => u.completedProjects != null)
  const completedProjects = hasCompleted ? utilities.reduce((s, u) => s + (Number(u.completedProjects) || 0), 0) : null
  const completedMw = hasCompleted ? utilities.reduce((s, u) => s + (Number(u.completedMw) || 0), 0) : null

  const congestionLevel = totalProjects > 100 ? 'high' : totalProjects > 50 ? 'moderate' : 'low'

  return {
    iso: data.iso,
    signalType: data.signalType,
    sourceLabel: data.sourceLabel,
    sourceRegion: data.sourceRegion,
    sourceNote: data.sourceNote,
    utilities,
    // Active structure view + the state's structure rollup — lets the Lens render
    // structure chips and switch views without re-querying.
    view,
    availableStructures: data.availableStructures,
    totalProjects,
    totalMW,
    completedProjects,
    completedMw,
    avgStudyMonths,
    avgWithdrawalPct,
    estimatedUpgradeCost,
    avgUpgradeCostPerMW,
    congestionLevel,
    // Pass-through staleness metadata so the IX · Live pill can downgrade
    // its badge styling (amber + 'stale Nd' suffix) when the underlying
    // ISO scraper hasn't refreshed within the freshness window.
    dataAgeDays: data.dataAgeDays,
    oldestFetchedAt: data.oldestFetchedAt,
    newestFetchedAt: data.newestFetchedAt,
  }
}

// ── getHostingCapacity ───────────────────────────────────────────────────────
// Distribution grid HEADROOM per state (from hosting_capacity_data — utility
// hosting-capacity ArcGIS feeds aggregated server-side). Feeds the IX pillar as
// live CONTEXT (grid headroom, NOT a project queue, NOT the SITE-pillar
// geospatial data). Score stays on the curated ixDifficulty baseline. Returns
// null when no utility in the state has a wired feed.
export async function getHostingCapacity(stateId) {
  return withCache(`hosting_capacity:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('hosting_capacity_data')
      .select('*')
      .eq('state', stateId)
      .order('utility_name')
    if (error) throw error
    if (!data || data.length === 0) return null

    const utilities = data.map(r => ({
      name:              r.utility_name,
      sitesWithCapacity: r.cells_with_capacity,   // # grid units that can host ≥5MW (fallback headline)
      sitesByThreshold:  r.sites_by_threshold || null,  // { "1":n, "2":n, "3":n, "5":n, "10":n } — MW→count
      maxAvailMw:        r.max_avail_mw,           // best single location, MW
      thresholdMw:       r.capacity_threshold_mw,
      gridResolution:    r.grid_resolution,
      dataSourceUrl:     r.data_source_url,
      fetchedAt:         r.fetched_at,
    }))
    // NOTE: no cross-utility cell rollup — utilities publish at different grid
    // granularities (feeder vs nodal-segment vs quad), so summing cells / a
    // pooled % would mix units and mislead. We surface per-utility counts + the
    // single comparable headline: the best available MW across the state.
    const maxes = utilities.map(u => u.maxAvailMw).filter(v => v != null)
    return {
      utilities,
      utilityCount: utilities.length,
      thresholdMw: utilities[0]?.thresholdMw ?? 5,
      maxAvailMw: maxes.length ? Math.max(...maxes) : null,  // null when no utility reports a max (e.g. CT's MapServer)
    }
  })
}

// Given a utility's per-threshold buckets and the developer's project MW, return
// { threshold, count } for the smallest CS bucket >= the project size — i.e. the
// number of grid sites that can definitely host a project of that size (most CS
// is 1-5MW, so this matches the developer's actual job). Conservative: if the MW
// falls between buckets, rounds UP to the next bucket. Returns null if no buckets.
export function sitesForMw(sitesByThreshold, mw) {
  if (!sitesByThreshold || typeof sitesByThreshold !== 'object') return null
  const buckets = Object.keys(sitesByThreshold).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!buckets.length) return null
  const m = Number(mw) || 5
  const threshold = buckets.find(b => b >= m) ?? buckets[buckets.length - 1]
  return { threshold, count: sitesByThreshold[String(threshold)] ?? 0 }
}

// ── solar_cost_index lineage helpers ─────────────────────────────────────────
// solar_cost_index (migration 048) carries OBSERVED LBNL TTS percentiles. We
// expose it as a `solar_cost_lineage` field on the revenue-rates payload so
// the Lens methodology dropdown can show "TTS observed $X.XX/W (n=Y) → 2026
// anchor $Z.ZZ/W" — the engine keeps reading the synthesized $/W from
// revenue_rates.installed_cost_per_watt.
//
// Defensive: tolerate the table not existing yet (migration 048 applied
// out-of-band by Aden in Supabase). Any error → null lineage, no throw.
async function fetchSolarCostLineage(stateId) {
  try {
    const { data, error } = await supabase
      .from('solar_cost_index')
      .select('p10_per_watt, p25_per_watt, p50_per_watt, p75_per_watt, p90_per_watt, install_count, confidence_tier, aggregation_window_years, vintage_year, vintage_window, source, source_url, last_updated')
      .eq('state', stateId)
      .eq('sector', 'large_non_res')
      .order('vintage_year', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data
  } catch {
    return null
  }
}

async function fetchAllSolarCostLineage() {
  try {
    const { data, error } = await supabase
      .from('solar_cost_index')
      .select('state, p10_per_watt, p25_per_watt, p50_per_watt, p75_per_watt, p90_per_watt, install_count, confidence_tier, aggregation_window_years, vintage_year, vintage_window, source, source_url, last_updated')
      .eq('sector', 'large_non_res')
      .order('vintage_year', { ascending: false })
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

// ── getRevenueRates ──────────────────────────────────────────────────────────
// Returns full revenue rate data for a state (CS + C&I + BESS fields).
export async function getRevenueRates(stateId) {
  return withCache(`revenue_rates:${stateId}`, async () => {
    const [ratesRes, lineage] = await Promise.all([
      supabase
        .from('revenue_rates')
        .select('*')
        .eq('state_id', stateId)
        .maybeSingle(),
      fetchSolarCostLineage(stateId),
    ])
    if (ratesRes.error) throw ratesRes.error
    if (!ratesRes.data) return null
    return {
      ...ratesRes.data,
      solar_cost_lineage: lineage,
    }
  })
}

// ── getAllRevenueRates ────────────────────────────────────────────────────────
export async function getAllRevenueRates() {
  return withCache('revenue_rates_all', async () => {
    const [ratesRes, lineageRows] = await Promise.all([
      supabase
        .from('revenue_rates')
        .select('*')
        .order('state_id'),
      fetchAllSolarCostLineage(),
    ])
    if (ratesRes.error) throw ratesRes.error

    // Pick the latest vintage row per state (lineage rows ordered desc).
    const lineageByState = new Map()
    for (const r of lineageRows) {
      if (!lineageByState.has(r.state)) lineageByState.set(r.state, r)
    }

    return (ratesRes.data || []).map((row) => ({
      ...row,
      solar_cost_lineage: lineageByState.get(row.state_id) || null,
    }))
  })
}

// ── Specific Yield lineage (Phase G) ─────────────────────────────────────────
// Per-state aggregate of observed AC capacity factor from CS-developer
// public fleet data (Nexamp + SR Energy + Catalyze). Returns null when the
// table doesn't exist yet (migration 053 not applied) or no rows for state.
//
// Engine continues reading PVWatts modeled capacity factor as primary
// (revenue_rates.capacity_factor_pct). This lineage block is the data
// trust evidence the SpecificYieldPanel surfaces alongside.
//
// Capacity-basis split: AC observations (Nexamp) and DC observations
// (SR Energy / Catalyze) compute SY against different denominators —
// AC-basis SY runs ~17–22% higher than DC-basis SY for the same project.
// We return both groups separately so the UI can show them side-by-side
// rather than averaging across (which would be apples-to-oranges).
export async function getSpecificYieldLineage(stateId) {
  return withCache(`specific_yield:${stateId}`, async () => {
    try {
      // Same 1000-row default-limit caveat as getCsMarketSnapshot. Per-state
      // SY samples are smaller (Nexamp's biggest fleet state is ~600 projects)
      // but explicit range protects against future drift.
      const { data, error } = await supabase
        .from('cs_specific_yield')
        .select('project_id, project_name, source, source_url, system_size_kw_ac, system_size_kw_dc, capacity_basis, annual_production_kwh, specific_yield_kwh_per_kwp_yr, observed_capacity_factor_pct, cod_year, last_updated')
        .eq('state', stateId)
        .range(0, 4999)
      if (error || !data || data.length === 0) return null

      const ac = data.filter(r => r.capacity_basis === 'AC')
      const dc = data.filter(r => r.capacity_basis === 'DC')

      function summarize(rows) {
        if (rows.length === 0) return null
        const sys = rows.map(r => Number(r.specific_yield_kwh_per_kwp_yr))
        const cfs = rows.map(r => Number(r.observed_capacity_factor_pct))
        const sortedCfs = [...cfs].sort((a, b) => a - b)
        const median = sortedCfs[Math.floor(sortedCfs.length / 2)]
        const p25 = sortedCfs[Math.floor(sortedCfs.length * 0.25)]
        const p75 = sortedCfs[Math.floor(sortedCfs.length * 0.75)]
        return {
          count:        rows.length,
          mean_sy:      Number((sys.reduce((s, n) => s + n, 0) / sys.length).toFixed(0)),
          mean_cf:      Number((cfs.reduce((s, n) => s + n, 0) / cfs.length).toFixed(2)),
          median_cf:    Number(median.toFixed(2)),
          p25_cf:       Number(p25.toFixed(2)),
          p75_cf:       Number(p75.toFixed(2)),
          min_sy:       Math.round(Math.min(...sys)),
          max_sy:       Math.round(Math.max(...sys)),
          sources:      [...new Set(rows.map(r => r.source))],
        }
      }

      // Nearest-MW-target sample is computed by the panel using rates.mwInput;
      // here we just return the smallest-to-largest sorted rows for display.
      const sample = [...data]
        .sort((a, b) => Number(b.system_size_kw_ac || b.system_size_kw_dc) - Number(a.system_size_kw_ac || a.system_size_kw_dc))
        .slice(0, 6)

      return {
        state:         stateId,
        total_count:   data.length,
        ac_summary:    summarize(ac),
        dc_summary:    summarize(dc),
        sources_in_use: [...new Set(data.map(r => r.source))],
        last_updated:  data[0]?.last_updated || null,
        sample,
      }
    } catch {
      return null
    }
  })
}

// ── getCsMarketSnapshot ──────────────────────────────────────────────────────
// Per-state aggregate of operating CS projects from cs_projects (NREL Sharing
// the Sun). Returns null when the table doesn't exist (migration 050 not yet
// applied) or no rows for the state.
//
// Powers the Lens "Operating CS Projects" panel — real ground truth on which
// states have a meaningful operating CS market vs. an active program
// designation with thin deployment.
export async function getCsMarketSnapshot(stateId, { sampleMwTarget = null, sampleSize = 6 } = {}) {
  return withCache(`cs_market:${stateId}:${sampleMwTarget ?? 'any'}`, async () => {
    try {
      // Supabase default row limit is 1000. NY has 1,351 CS projects in
      // Sharing the Sun — without an explicit higher limit the query
      // silently truncates and the per-state aggregate is wrong. Use
      // .range(0, 4999) to cover any state's full population (max state
      // is NY at ~1,351; 5,000 is comfortable headroom and below
      // PostgREST's hard ceiling).
      const { data, error } = await supabase
        .from('cs_projects')
        .select('project_id, project_name, city, state, utility_name, utility_type, developer_name, system_size_mw_ac, system_size_mw_dc, vintage_year, lmi_required, lmi_portion_pct, source_release, last_updated')
        .eq('state', stateId)
        .range(0, 4999)
      if (error || !data) return null
      if (data.length === 0) return null

      // Aggregate
      const sizes = data.map(r => Number(r.system_size_mw_ac)).filter(n => !isNaN(n) && n > 0)
      const totalMw = sizes.reduce((s, n) => s + n, 0)
      const sortedSizes = [...sizes].sort((a, b) => a - b)
      const median = sortedSizes.length
        ? sortedSizes[Math.floor(sortedSizes.length / 2)]
        : null
      const vintageYears = data.map(r => r.vintage_year).filter(y => y != null)
      const vintageMin = vintageYears.length ? Math.min(...vintageYears) : null
      const vintageMax = vintageYears.length ? Math.max(...vintageYears) : null
      const last5y = vintageMax != null
        ? data.filter(r => r.vintage_year >= vintageMax - 4).length
        : 0

      // Developer concentration — top 3 by project count (filter null/'.')
      const devCounts = new Map()
      for (const r of data) {
        const dev = r.developer_name
        if (!dev || dev === '.' || dev.length < 2) continue
        devCounts.set(dev, (devCounts.get(dev) || 0) + 1)
      }
      const topDevelopers = [...devCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, projectCount: count }))

      // Utility-type mix (Investor Owned / Cooperative / Municipal / etc.)
      const utilityTypeCounts = new Map()
      for (const r of data) {
        const t = r.utility_type
        if (!t) continue
        utilityTypeCounts.set(t, (utilityTypeCounts.get(t) || 0) + 1)
      }
      const utilityTypeMix = [...utilityTypeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }))

      // LMI penetration (subset where lmi_required === true)
      const lmiRequiredCount = data.filter(r => r.lmi_required === true).length
      const lmiPctValues = data.map(r => r.lmi_portion_pct).filter(p => p != null && p > 0)
      const lmiAvgPct = lmiPctValues.length
        ? lmiPctValues.reduce((s, n) => s + Number(n), 0) / lmiPctValues.length
        : null

      // Sample projects: closest to target MW if provided, otherwise largest.
      let sample
      if (sampleMwTarget != null && sampleMwTarget > 0) {
        sample = [...data]
          .filter(r => r.system_size_mw_ac != null)
          .sort((a, b) => Math.abs(a.system_size_mw_ac - sampleMwTarget) - Math.abs(b.system_size_mw_ac - sampleMwTarget))
          .slice(0, sampleSize)
      } else {
        sample = [...data]
          .filter(r => r.system_size_mw_ac != null)
          .sort((a, b) => b.system_size_mw_ac - a.system_size_mw_ac)
          .slice(0, sampleSize)
      }

      return {
        state: stateId,
        projectCount: data.length,
        totalOperationalMwAc: Number(totalMw.toFixed(1)),
        medianSizeMwAc: median != null ? Number(median.toFixed(2)) : null,
        vintageMin,
        vintageMax,
        recentInstallsLast5y: last5y,
        topDevelopers,
        utilityTypeMix,
        lmiRequiredCount,
        lmiAvgPct: lmiAvgPct != null ? Number(lmiAvgPct.toFixed(1)) : null,
        sourceRelease: data[0]?.source_release || null,
        lastUpdated: data[0]?.last_updated || null,
        sample,
      }
    } catch {
      return null
    }
  })
}

// ── getCsProjectsAsComparables ───────────────────────────────────────────────
// Per-state operating CS projects from cs_projects (NREL Sharing the Sun)
// shaped to match the comparable_deals card schema so ComparableDealsPanel
// can render them seamlessly alongside the curated benchmarks. This is the
// option-3 substitute for the mostly-empty curated comparable_deals table.
//
// Filters:
//   - state match
//   - if mwRange = [lo, hi] provided, system_size_mw_ac must fall within
//   - technology filter is informational only — Sharing the Sun is all CS,
//     so 'Community Solar' / 'Hybrid' both match this dataset; 'BESS' / 'C&I'
//     return empty (those aren't CS projects)
//
// Returns rows shaped like:
//   { id, mw, technology, status, state, county, developer, servingUtility,
//     filingDate (cod proxy from vintage_year), source, sourceUrl, notes }
//
// Defensive: returns [] when cs_projects table doesn't exist yet or no rows.
export async function getCsProjectsAsComparables({ state, technology, mwRange } = {}) {
  if (!state) return []
  // BESS / C&I aren't CS — Sharing the Sun has only community solar.
  if (technology && technology !== 'Community Solar' && technology !== 'Hybrid') return []

  return withCache(`cs_comparables:${state}:${mwRange?.[0] ?? '_'}:${mwRange?.[1] ?? '_'}`, async () => {
    try {
      let q = supabase
        .from('cs_projects')
        .select('project_id, project_name, city, state, utility_name, utility_type, developer_name, system_size_mw_ac, vintage_year, lmi_required, lmi_portion_pct, source_release')
        .eq('state', state)
        .range(0, 4999)

      if (mwRange && mwRange.length === 2) {
        q = q.gte('system_size_mw_ac', mwRange[0]).lte('system_size_mw_ac', mwRange[1])
      }
      const { data, error } = await q
      if (error || !data || data.length === 0) return []

      return data.map((p) => ({
        id:                p.project_id,
        name:              p.project_name || null,
        mw:                p.system_size_mw_ac,
        technology:        'Community Solar',
        status:            'operational',                 // Sharing the Sun = operating only
        state:             p.state,
        county:            null,                          // Sharing the Sun publishes city/town not county
        developer:         p.developer_name && p.developer_name !== '.' ? p.developer_name : null,
        servingUtility:    p.utility_name || null,
        filingDate:        p.vintage_year ? `${p.vintage_year}-01-01` : null,
        codTarget:         p.vintage_year ? `${p.vintage_year}-01-01` : null,
        source:            'NREL Sharing the Sun',
        sourceUrl:         'https://www.nrel.gov/solar/market-research-analysis/community-solar-data.html',
        notes:             [
          p.city ? `${p.city}, ${p.state}` : null,
          p.utility_type ? `${p.utility_type} utility` : null,
          p.lmi_required ? `LMI required${p.lmi_portion_pct ? ` (${Math.round(p.lmi_portion_pct)}%)` : ''}` : null,
        ].filter(Boolean).join(' · '),
        // Phase G hint for downstream use — internal flag the panel can
        // optionally check to badge the card differently. Not required.
        _csProjectsBacked: true,
      }))
    } catch {
      return []
    }
  })
}

// ── getAllIXQueueData ─────────────────────────────────────────────────────────
export async function getAllIXQueueData() {
  return withCache('ix_queue_all', async () => {
    const { data, error } = await supabase
      .from('ix_queue_data')
      .select('*')
      .order('state_id')
    if (error) throw error
    return data || []
  })
}

// ── getSubstations ───────────────────────────────────────────────────────────
// Returns all substations for a state, sorted by capacity descending.
export async function getSubstations(stateId) {
  return withCache(`substations:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('substations')
      .select('*')
      .eq('state_id', stateId)
      .order('capacity_mw', { ascending: false })
    if (error) throw error
    return (data || []).map(row => ({
      name:        row.name,
      lat:         Number(row.lat),
      lon:         Number(row.lon),
      voltageKv:   Number(row.voltage_kv),
      capacityMw:  Number(row.capacity_mw),
      utility:     row.utility,
    }))
  })
}

// ── getAllCountyData ──────────────────────────────────────────────────────────
export async function getAllCountyData(stateId) {
  return withCache(`county_all:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('county_intelligence')
      .select('*')
      .eq('state_id', stateId)
      .order('county_slug')
    if (error) throw error
    return data || []
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// Admin write helpers — all invalidate relevant caches after write
// ══════════════════════════════════════════════════════════════════════════════

export async function updateStateProgram(id, fields) {
  const { error } = await supabase
    .from('state_programs')
    .update({ ...fields, updated_by: 'admin' })
    .eq('id', id)
  if (error) throw error
  invalidateCache('state_programs')
  invalidateCache('state_program_map')
  invalidateCache('dashboard_metrics')
}

export async function updateCountyIntelligence(id, fields) {
  const { error } = await supabase
    .from('county_intelligence')
    .update(fields)
    .eq('id', id)
  if (error) throw error
  invalidateCache('county:*')
  invalidateCache('county_all:*')
}

export async function upsertCountyIntelligence(fields) {
  const { error } = await supabase
    .from('county_intelligence')
    .upsert(fields, { onConflict: 'state_id,county_slug' })
  if (error) throw error
  invalidateCache('county:*')
  invalidateCache('county_all:*')
}

export async function updateRevenueRates(stateId, fields) {
  const { error } = await supabase
    .from('revenue_rates')
    .upsert({ state_id: stateId, ...fields }, { onConflict: 'state_id' })
  if (error) throw error
  invalidateCache(`revenue_rates:${stateId}`)
  invalidateCache('revenue_rates_all')
}

export async function upsertNewsItem(fields) {
  const { error } = await supabase
    .from('news_feed')
    .upsert(fields)
  if (error) throw error
  invalidateCache('news_feed')
  invalidateCache('dashboard_metrics')
}

export async function deleteNewsItem(id) {
  const { error } = await supabase
    .from('news_feed')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
  invalidateCache('news_feed')
  invalidateCache('dashboard_metrics')
}

// ── Comparable Deals admin write helpers ─────────────────────────────────────
export async function upsertComparableDeal(fields) {
  const payload = { ...fields, last_updated: new Date().toISOString() }
  const { error } = await supabase
    .from('comparable_deals')
    .upsert(payload)
  if (error) throw error
  invalidateCache('comparable_deals:*')
}

export async function deleteComparableDeal(id) {
  const { error } = await supabase
    .from('comparable_deals')
    .update({ is_active: false, last_updated: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  invalidateCache('comparable_deals:*')
}

// ── PUC Docket admin write helpers ───────────────────────────────────────────
export async function upsertPucDocket(fields) {
  const payload = { ...fields, last_updated: new Date().toISOString() }
  const { error } = await supabase
    .from('puc_dockets')
    .upsert(payload)
  if (error) throw error
  invalidateCache('puc_dockets:*')
}

export async function deletePucDocket(id) {
  // Soft-delete via is_active=false so the audit trail is preserved.
  const { error } = await supabase
    .from('puc_dockets')
    .update({ is_active: false, last_updated: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  invalidateCache('puc_dockets:*')
}

// ── Policy Impact Events (migration 061) ─────────────────────────────────────
// Quantified enacted-bill effects ($/MW capex, IRR bps, ongoing fees, safe-
// harbor + FEOC flags). Read here for the admin curation UI; the Lens API
// reads the same table server-side via service-role (api/lens-insight.js).
//
// includeUnpublished=true surfaces drafts + pending_admin_review rows for the
// admin review queue. Default returns published rows only.
export async function getPolicyImpactEvents({ state, includeUnpublished = false } = {}) {
  const cacheKey = `policy_impact_events:${state || 'all'}:${includeUnpublished ? 'all' : 'published'}`
  return withCache(cacheKey, async () => {
    let query = supabase
      .from('policy_impact_events')
      .select('*')
      .eq('is_active', true)
      .order('effective_date', { ascending: false, nullsFirst: false })
    if (state) query = query.eq('state', state)
    if (!includeUnpublished) query = query.eq('review_status', 'published')
    const { data, error } = await query
    if (error) {
      console.warn('[policy_impact_events] fetch failed:', error.message)
      return []
    }
    return (data || []).map(row => ({
      id:                          row.id,
      state:                       row.state,
      eventName:                   row.event_name,
      eventType:                   row.event_type,
      effectiveDate:               row.effective_date,
      status:                      row.status,
      pillar:                      row.pillar,
      capexImpactPerMwUsd:         row.capex_impact_per_mw_usd,
      irrImpactBps:                row.irr_impact_bps,
      ongoingFeePerMwYrUsd:        row.ongoing_fee_per_mw_yr_usd,
      revenueHaircutPct:           row.revenue_haircut_pct,
      impactConfidence:            row.impact_confidence,
      impactSeverity:              row.impact_severity,
      impactProbability:           row.impact_probability,
      impactMethodology:           row.impact_methodology,
      appliesToNewApplications:    row.applies_to_new_applications,
      appliesToExistingQueue:      row.applies_to_existing_queue,
      appliesToOperatingProjects:  row.applies_to_operating_projects,
      safeHarborEligible:          row.safe_harbor_eligible,
      safeHarborCutoffDate:        row.safe_harbor_cutoff_date,
      safeHarborNotes:             row.safe_harbor_notes,
      feocComplianceRequired:      row.feoc_compliance_required,
      feocNotes:                   row.feoc_notes,
      minMwAc:                     row.min_mw_ac,
      maxMwAc:                     row.max_mw_ac,
      applicableTechnologies:      row.applicable_technologies,
      applicableStages:            row.applicable_stages,
      summary:                     row.summary,
      analystNote:                 row.analyst_note,
      sourceUrl:                   row.source_url,
      discoveredVia:               row.discovered_via,
      discoveryMetadata:           row.discovery_metadata,
      reviewStatus:                row.review_status,
      verifiedAt:                  row.verified_at,
      createdAt:                   row.created_at,
      updatedAt:                   row.updated_at,
    }))
  })
}

export async function upsertPolicyImpactEvent(fields) {
  // Bump verified_at when publishing — that's the field Lens cache uses to
  // detect "this state's policy context changed, invalidate cached verdicts".
  const payload = { ...fields }
  if (payload.review_status === 'published') {
    payload.verified_at = new Date().toISOString()
  }
  const { error } = await supabase
    .from('policy_impact_events')
    .upsert(payload)
  if (error) throw error
  invalidateCache('policy_impact_events:*')
}

export async function deletePolicyImpactEvent(id) {
  // Soft-delete (preserve audit trail). Bumping verified_at so Lens cache
  // notices the removal.
  const { error } = await supabase
    .from('policy_impact_events')
    .update({ is_active: false, verified_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  invalidateCache('policy_impact_events:*')
}

export async function updateIXQueueRow(id, fields) {
  const { error } = await supabase
    .from('ix_queue_data')
    .update(fields)
    .eq('id', id)
  if (error) throw error
  invalidateCache('ix_queue:*')
  invalidateCache('ix_queue_all')
  invalidateCache('dashboard_metrics')
}

// ── Cross-tab cache invalidation ──────────────────────────────────────────────
// In-memory _cache is per-tab. When admin clicks Refresh in Tab A, Tab A's
// cache clears via the local invalidateCache() call — but Tab B (a Dashboard
// the user left open in another window) keeps serving stale data until the
// 1h TTL expires. BroadcastChannel posts the invalidation to every same-
// origin tab so Dashboard / Library / Search reflect the refresh immediately
// across the whole session.
//
// Defensive: BroadcastChannel isn't available in old browsers or in some
// SSR contexts. Wrapped in `typeof` checks so the rest of the module works
// without it; the fallback is the existing same-tab-only behavior.
const _BROADCAST_NAME = 'tractova-cache'
const _broadcastChannel = (typeof window !== 'undefined' && typeof BroadcastChannel === 'function')
  ? new BroadcastChannel(_BROADCAST_NAME)
  : null

if (_broadcastChannel) {
  _broadcastChannel.onmessage = (ev) => {
    const { type, key } = ev.data || {}
    if (type !== 'invalidate') return
    // Apply locally without re-broadcasting (would loop).
    _applyInvalidate(key)
  }
}

function _applyInvalidate(key) {
  if (!key) {
    Object.keys(_cache).forEach(k => delete _cache[k])
  } else if (key.endsWith('*')) {
    const prefix = key.slice(0, -1)
    Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k] })
  } else {
    delete _cache[key]
  }
}

// Broadcast-only entry point for the admin Refresh flow. Same semantics as
// invalidateCache() but explicitly signals "this is a deliberate, app-wide
// data refresh" — every tab clears, not just this one.
export function invalidateCacheEverywhere(key) {
  _applyInvalidate(key)
  if (_broadcastChannel) {
    try { _broadcastChannel.postMessage({ type: 'invalidate', key }) }
    catch { /* best-effort cross-tab notify */ }
  }
}

// ── invalidateCache ───────────────────────────────────────────────────────────
// Call with a specific key, a prefix (ending in *), or no args to clear all.
export function invalidateCache(key) {
  if (!key) {
    Object.keys(_cache).forEach(k => delete _cache[k])
  } else if (key.endsWith('*')) {
    const prefix = key.slice(0, -1)
    Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k] })
  } else {
    delete _cache[key]
  }
}
