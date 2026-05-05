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
    // DSIRE verification (migration 026 + refresh-data.js?source=state_programs)
    dsireProgramId:            row.dsire_program_id ?? null,
    dsireProgramUrl:           row.dsire_program_url ?? null,
    dsireSummary:              row.dsire_summary ?? null,
    dsireLastVerified:         row.dsire_last_verified ?? null,
    dsireMatchQuality:         row.dsire_match_quality ?? null,
    // Computed — never stored
    feasibilityScore:          computeFeasibilityScore(row),
    runway:                    computeRunway(row),
  }
}

// ── getStatePrograms ──────────────────────────────────────────────────────────
// Returns all 51 state rows with computed feasibilityScore + runway.
export async function getStatePrograms() {
  return withCache('state_programs', async () => {
    const { data, error } = await supabase
      .from('state_programs')
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

async function fetchCountyGeospatial(stateId, countyName) {
  if (!stateId || !countyName) return null
  const cleanName = countyName.replace(/\s+county.*$/i, '').replace(/\s+parish.*$/i, '')
  const { data: acs } = await supabase
    .from('county_acs_data')
    .select('county_fips')
    .eq('state', stateId)
    .ilike('county_name', `%${cleanName}%`)
    .limit(1)
    .maybeSingle()
  if (!acs?.county_fips) return null

  const { data: geo } = await supabase
    .from('county_geospatial_data')
    .select('*')
    .eq('county_fips', acs.county_fips)
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
      // DSIRE verification (migration 029) — null until cron has run for this state
      dsireProgramId:    data.dsire_program_id,
      dsireProgramUrl:   data.dsire_program_url,
      dsireSummary:      data.dsire_summary,
      dsireLastVerified: data.dsire_last_verified,
      dsireMatchQuality: data.dsire_match_quality,
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
// county. Returns per-county count of NMTC LIC tracts derived from raw
// Census ACS data per CDFI Fund's methodology. A project sited in any
// qualifying tract picks up the +10% ITC bonus credit. Stacks with Energy
// Community for compound bonus (potentially +20%).
export async function getNmtcLic(stateId, countyName) {
  if (!stateId || !countyName) return null
  return withCache(`nmtc_lic:${stateId}:${countyName.toLowerCase()}`, async () => {
    // Resolve county_fips via county_acs_data (canonical FIPS source in our schema)
    const { data: acs } = await supabase
      .from('county_acs_data')
      .select('county_fips')
      .eq('state', stateId)
      .ilike('county_name', `%${countyName.replace(/\s+county.*$/i, '')}%`)
      .limit(1)
      .maybeSingle()
    if (!acs?.county_fips) return null

    const { data, error } = await supabase
      .from('nmtc_lic_data')
      .select('*')
      .eq('county_fips', acs.county_fips)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      countyFips:                data.county_fips,
      state:                     data.state,
      countyName:                data.county_name,
      totalTractsInCounty:       data.total_tracts_in_county || 0,
      qualifyingTractsCount:     data.qualifying_tracts_count || 0,
      qualifyingViaPoverty:      data.qualifying_via_poverty || 0,
      qualifyingViaLowMfi:       data.qualifying_via_low_mfi || 0,
      qualifyingTractGeoids:     data.qualifying_tract_geoids || [],
      stateMedianFamilyIncome:   data.state_median_family_income,
      datasetVersion:            data.dataset_version,
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
    // Resolve county_fips from county_acs_data first (single source of truth
    // for FIPS in our schema). Fall back to fuzzy match on hud_qct_dda_data
    // by lower(county_name) if county_acs_data has no row.
    const { data: acs } = await supabase
      .from('county_acs_data')
      .select('county_fips, state, county_name')
      .eq('state', stateId)
      .ilike('county_name', `%${countyName.replace(/\s+county.*$/i, '')}%`)
      .limit(1)
      .maybeSingle()

    if (!acs?.county_fips) return null

    const { data, error } = await supabase
      .from('hud_qct_dda_data')
      .select('*')
      .eq('county_fips', acs.county_fips)
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

// ── getIXQueueData ───────────────────────────────────────────────────────────
// Returns raw IX queue rows for a state, grouped by utility.
// Shape: { iso, utilities: [{ name, projectsInQueue, mwPending, ... }],
//         oldestFetchedAt, newestFetchedAt, dataAgeDays }
//
// dataAgeDays is the worst-case (oldest) staleness across utilities — used
// by the UI to flag IX-live data that's drifted past the freshness window
// (the underlying ISO scrapers are not always reliable; PJM, NYISO, ISO-NE
// scrapers all 404'd as of 2026-04-24, so live data in those ISOs has been
// frozen for >7 days. The UI should signal this honestly rather than imply
// the data is fresh).
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
    return {
      iso: data[0].iso,
      utilities: data.map(row => ({
        name:            row.utility_name,
        projectsInQueue: row.projects_in_queue,
        mwPending:       row.mw_pending,
        avgStudyMonths:  row.avg_study_months,
        withdrawalPct:   row.withdrawal_pct,
        avgUpgradeCostMW: row.avg_upgrade_cost_mw,
        queueTrend:      row.queue_trend,
        fetchedAt:       row.fetched_at,
      })),
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
// Aggregated summary across all utilities for a state + project MW.
// Drop-in replacement for ixQueueEngine.getIXQueueSummary().
export async function getIXQueueSummary(stateId, mwAC) {
  const data = await getIXQueueData(stateId)
  if (!data) return null

  const mw = parseFloat(mwAC) || 5
  const totalProjects = data.utilities.reduce((s, u) => s + u.projectsInQueue, 0)
  const totalMW = data.utilities.reduce((s, u) => s + u.mwPending, 0)
  const weightedStudy = totalProjects > 0 ? data.utilities.reduce((s, u) => s + u.avgStudyMonths * u.projectsInQueue, 0) / totalProjects : 0
  const weightedWithdrawal = totalProjects > 0 ? data.utilities.reduce((s, u) => s + u.withdrawalPct * u.projectsInQueue, 0) / totalProjects : 0
  const weightedUpgrade = totalProjects > 0 ? data.utilities.reduce((s, u) => s + u.avgUpgradeCostMW * u.projectsInQueue, 0) / totalProjects : 0

  const estimatedUpgradeCost = Math.round(weightedUpgrade * mw)
  const congestionLevel = totalProjects > 100 ? 'high' : totalProjects > 50 ? 'moderate' : 'low'

  return {
    iso: data.iso,
    utilities: data.utilities,
    totalProjects,
    totalMW,
    avgStudyMonths: Math.round(weightedStudy),
    avgWithdrawalPct: Math.round(weightedWithdrawal),
    estimatedUpgradeCost,
    avgUpgradeCostPerMW: Math.round(weightedUpgrade),
    congestionLevel,
    // Pass-through staleness metadata so the IX · Live pill can downgrade
    // its badge styling (amber + 'stale Nd' suffix) when the underlying
    // ISO scraper hasn't refreshed within the freshness window.
    dataAgeDays: data.dataAgeDays,
    oldestFetchedAt: data.oldestFetchedAt,
    newestFetchedAt: data.newestFetchedAt,
  }
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
