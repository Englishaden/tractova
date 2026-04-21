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
    fetcher().then(data => { _cache[key] = { data, ts: Date.now() } }).catch(() => {})
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
  return withCache('state_program_map', async () => {
    const all = await getStatePrograms()
    return Object.fromEntries(all.map(s => [s.id, s]))
  })
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

// ── invalidateCache ───────────────────────────────────────────────────────────
// Call this after any admin write to force a fresh fetch on next access.
export function invalidateCache(key) {
  if (key) {
    delete _cache[key]
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k])
  }
}
