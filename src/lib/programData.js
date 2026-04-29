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
export async function getCountyData(stateId, countyName) {
  const slug = normalizeCountySlug(countyName)

  return withCache(`county:${stateId}:${slug}`, async () => {
    // Try exact county first
    const { data: exact } = await supabase
      .from('county_intelligence')
      .select('*')
      .eq('state_id', stateId)
      .eq('county_slug', slug)
      .maybeSingle()

    if (exact) return shapeCounty(exact)

    // Fall back to state default
    const { data: fallback } = await supabase
      .from('county_intelligence')
      .select('*')
      .eq('state_id', stateId)
      .eq('county_slug', 'default')
      .maybeSingle()

    return fallback ? shapeCounty(fallback) : null
  })
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
      summary:          data.summary,
      irecMarket:       data.irec_market,
      itcBase:          data.itc_base,
      itcAdder:         data.itc_adder,
      netMeteringStatus: data.net_metering_status,
    }
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
// Shape: { iso, utilities: [{ name, projectsInQueue, mwPending, ... }] }
export async function getIXQueueData(stateId) {
  return withCache(`ix_queue:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('ix_queue_data')
      .select('*')
      .eq('state_id', stateId)
      .order('utility_name')
    if (error) throw error
    if (!data || data.length === 0) return null
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
      })),
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
  }
}

// ── getRevenueRates ──────────────────────────────────────────────────────────
// Returns full revenue rate data for a state (CS + C&I + BESS fields).
export async function getRevenueRates(stateId) {
  return withCache(`revenue_rates:${stateId}`, async () => {
    const { data, error } = await supabase
      .from('revenue_rates')
      .select('*')
      .eq('state_id', stateId)
      .maybeSingle()
    if (error) throw error
    return data
  })
}

// ── getAllRevenueRates ────────────────────────────────────────────────────────
export async function getAllRevenueRates() {
  return withCache('revenue_rates_all', async () => {
    const { data, error } = await supabase
      .from('revenue_rates')
      .select('*')
      .order('state_id')
    if (error) throw error
    return data || []
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
