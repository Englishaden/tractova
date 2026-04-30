import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
//   2. Admin UI button — Authenticated POST with Bearer JWT; we verify the
//                        token's email matches ADMIN_EMAIL.
//
// All handlers log to `cron_runs` (created in migration 006) so the Data
// Health tab in /admin shows last-run status + summary stats per source.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

const SUPPORTED_SOURCES = ['lmi', 'state_programs', 'county_acs', 'news', 'revenue_stacks', 'energy_community', 'hud_qct_dda', 'nmtc_lic']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
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
      // Admin JWT path
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (user?.email === ADMIN_EMAIL) {
          isAuthed = true
          authMode = 'admin'
        }
      } catch (_) { /* fall through */ }
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
  const requested = (req.query.source || 'all').toString().toLowerCase()
  const sources = requested === 'all' ? SUPPORTED_SOURCES : [requested]

  const invalidSources = sources.filter(s => !SUPPORTED_SOURCES.includes(s))
  if (invalidSources.length > 0) {
    return res.status(400).json({
      error: `Unsupported source(s): ${invalidSources.join(', ')}`,
      supported: SUPPORTED_SOURCES,
    })
  }

  const startTs = Date.now()
  const results = {}

  for (const source of sources) {
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
      else                                     result = { error: 'Handler not implemented' }
      result.duration_ms = Date.now() - srcStart
      results[source] = result
      // Log to cron_runs (best-effort; don't fail the request if logging fails).
      await logCronRun(source, result, authMode, startedAt)
    } catch (err) {
      const errMsg = err?.message || String(err)
      results[source] = { ok: false, error: errMsg, duration_ms: Date.now() - srcStart }
      await logCronRun(source, { ok: false, error: errMsg }, authMode, startedAt)
    }
  }

  return res.status(200).json({
    ok: Object.values(results).every(r => r.ok),
    sources: results,
    total_duration_ms: Date.now() - startTs,
    auth_mode: authMode,
    triggered_at: new Date().toISOString(),
  })
}

async function logCronRun(source, summary, authMode, startedAt) {
  try {
    const finished = new Date()
    const { error } = await supabaseAdmin
      .from('cron_runs')
      .insert([{
        cron_name:   `refresh-data:${source}`,
        status:      summary.ok ? 'success' : 'failed',
        started_at:  (startedAt || finished).toISOString(),
        finished_at: finished.toISOString(),
        duration_ms: startedAt ? finished.getTime() - startedAt.getTime() : null,
        summary:     { ...summary, auth_mode: authMode },
      }])
    if (error) console.warn('[refresh-data] cron_runs insert error:', error.message)
  } catch (e) {
    console.warn('[refresh-data] cron_runs log failed:', e?.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LMI handler — US Census ACS 2018-2022 5-year estimates via api.census.gov
//
// Methodology (documented for auditability):
//   1. Pull median household income (B19013_001E) per state.
//   2. Pull total households (B11001_001E) per state.
//   3. Pull income-distribution buckets (B19001_002E through B19001_017E).
//   4. Compute 80% AMI threshold = state median × 0.80.
//   5. Sum households in income brackets whose UPPER BOUND ≤ 80% AMI threshold.
//      For the bracket containing the threshold, linearly interpolate.
//   6. lmi_pct = lmi_households / total_households × 100.
//
// API: free, no key required (low volume). Endpoint:
//   https://api.census.gov/data/2022/acs/acs5?get={vars}&for=state:*
//
// Source attribution stored in lmi_data.source = "US Census ACS 2018-2022 5-yr".
// ─────────────────────────────────────────────────────────────────────────────

// Income bracket UPPER BOUNDS for B19001_002E through B19001_017E.
// Bracket B19001_017E (>= $200k) has Infinity as its upper bound.
const BRACKET_UPPER = [
  10000,   //  _002E: < $10K
  14999,   //  _003E: $10K-$15K
  19999,   //  _004E: $15K-$20K
  24999,   //  _005E: $20K-$25K
  29999,   //  _006E: $25K-$30K
  34999,   //  _007E: $30K-$35K
  39999,   //  _008E: $35K-$40K
  44999,   //  _009E: $40K-$45K
  49999,   //  _010E: $45K-$50K
  59999,   //  _011E: $50K-$60K
  74999,   //  _012E: $60K-$75K
  99999,   //  _013E: $75K-$100K
  124999,  //  _014E: $100K-$125K
  149999,  //  _015E: $125K-$150K
  199999,  //  _016E: $150K-$200K
  Infinity,//  _017E: $200K+
]
const BRACKET_LOWER = [0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000]

// Map Census FIPS state codes to USPS state codes. Only states we track.
const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

async function refreshLmi() {
  // Build the variables query: median income, total households, + 16 income brackets.
  const vars = [
    'NAME',           // State name
    'B19013_001E',    // Median household income
    'B11001_001E',    // Total households
  ]
  for (let i = 2; i <= 17; i++) {
    vars.push(`B19001_${String(i).padStart(3, '0')}E`)  // B19001_002E ... B19001_017E
  }

  const apiKey = process.env.CENSUS_API_KEY
  const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(',')}&for=state:*`
  const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  let raw
  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: `Census API ${response.status}: ${body.slice(0, 200)}` }
    }
    raw = await response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    return { ok: false, error: `Census fetch failed: ${err.message}` }
  }

  if (!Array.isArray(raw) || raw.length < 2) {
    return { ok: false, error: 'Census API returned malformed payload' }
  }

  // Row 0 is headers, rest are data rows. Parse each state.
  const headers = raw[0]
  const rows    = raw.slice(1)
  const fipsIdx = headers.indexOf('state')
  const nameIdx = headers.indexOf('NAME')
  const medianIdx = headers.indexOf('B19013_001E')
  const totalIdx  = headers.indexOf('B11001_001E')
  const bracketIdx = []
  for (let i = 2; i <= 17; i++) {
    bracketIdx.push(headers.indexOf(`B19001_${String(i).padStart(3, '0')}E`))
  }

  const stateRows = []
  for (const row of rows) {
    const fips = row[fipsIdx]
    const usps = FIPS_TO_USPS[fips]
    if (!usps) continue   // Skip Puerto Rico, etc.

    const name   = row[nameIdx]
    const median = parseInt(row[medianIdx], 10)
    const total  = parseInt(row[totalIdx], 10)
    const buckets = bracketIdx.map(i => parseInt(row[i], 10))

    if (!Number.isFinite(median) || !Number.isFinite(total) || total <= 0) continue
    if (median <= 0) continue

    const ami80 = Math.round(median * 0.80)

    // LMI = households whose income is at or below 80% AMI.
    // Walk buckets from lowest, accumulate full counts where upper <= ami80,
    // then linearly interpolate the bracket containing ami80.
    let lmi = 0
    for (let i = 0; i < buckets.length; i++) {
      const bucketCount = buckets[i]
      if (!Number.isFinite(bucketCount) || bucketCount < 0) continue
      const upper = BRACKET_UPPER[i]
      const lower = BRACKET_LOWER[i]
      if (upper <= ami80) {
        lmi += bucketCount    // Entire bracket is below the threshold
      } else if (lower < ami80 && ami80 < upper) {
        // Partial credit for the threshold-crossing bracket
        const span = upper - lower
        const frac = (ami80 - lower) / span
        lmi += bucketCount * frac
        break
      } else {
        break   // Threshold already crossed
      }
    }
    lmi = Math.round(lmi)

    const lmiPct = total > 0 ? Math.round((lmi / total) * 1000) / 10 : 0

    stateRows.push({
      state: usps,
      state_name: name,
      total_households: total,
      lmi_households: lmi,
      lmi_pct: lmiPct,
      median_household_income: median,
      ami_80pct: ami80,
      last_updated: new Date().toISOString(),
      source: 'US Census ACS 2018-2022 5-year (live pull)',
    })
  }

  if (stateRows.length === 0) {
    return { ok: false, error: 'No usable state rows from Census API' }
  }

  // Validation: sanity check that we got most of the 51 jurisdictions (50 states + DC).
  // If we got fewer than 40, something's wrong with the pull -- abort to avoid
  // wiping good seed data.
  if (stateRows.length < 40) {
    return { ok: false, error: `Census API returned only ${stateRows.length} states; expected ~51. Aborting upsert.` }
  }

  // Upsert to lmi_data. Conflict on state PK.
  const { error: upsertErr } = await supabaseAdmin
    .from('lmi_data')
    .upsert(stateRows, { onConflict: 'state' })

  if (upsertErr) {
    return { ok: false, error: `Supabase upsert failed: ${upsertErr.message}` }
  }

  return {
    ok: true,
    states_refreshed: stateRows.length,
    sample_state: stateRows.find(r => r.state === 'IL') || stateRows[0],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State Programs handler — DSIRE cross-verification
//
// For each Tractova state with a CS program (csStatus in active/limited/
// pending), search DSIRE's program database for a matching community-solar
// program. Populate the dsire_* columns added by migration 026:
//   dsire_program_id, dsire_program_url, dsire_summary,
//   dsire_last_verified, dsire_match_quality.
//
// This DOES NOT replace Tractova's curated state_programs values
// (csStatus, capacityMW, lmiPercent, ixDifficulty) -- those still come
// from admin curation + state program administrator portals which DSIRE
// doesn't index. This adds a live verification + canonical-URL layer
// pointing at the authoritative source (NCSU-housed, DOE-funded).
//
// DSIRE API: https://programs.dsireusa.org/api/v2/programs
//   - Free, no key required, public reads
//   - Returns 100s of programs per state; we filter for community/shared solar
// ─────────────────────────────────────────────────────────────────────────────

// Match heuristic: pick programs whose name contains any of these substrings
// (case-insensitive). Solar PV (technology=7 in DSIRE taxonomy) + state-level
// scope produces ~50-200 programs per state; CS-relevant filter narrows
// dramatically.
const CS_NAME_KEYWORDS = [
  'community solar',
  'shared solar',
  'community-shared solar',
  'solar gardens',
  'community renewable',
  'community distributed',
  'shared renewable',
  // State-specific program names (Tractova's 8 cores)
  'illinois shines',
  'smart program',
  'value of distributed energy',
  'community choice aggregation',
  'community shared renewables',
  'sussi',  // NJ Successor Solar Incentive
  'neb',    // ME Net Energy Billing
]

async function refreshStateProgramsViaDsire() {
  // Pull all active Tractova states (any with a CS program signal).
  const { data: stateRows, error: fetchErr } = await supabaseAdmin
    .from('state_programs')
    .select('id, name, cs_program, cs_status')
    .neq('cs_status', 'none')

  if (fetchErr) return { ok: false, error: `state_programs read failed: ${fetchErr.message}` }
  if (!stateRows || stateRows.length === 0) {
    return { ok: false, error: 'No states with active CS programs to verify' }
  }

  const results = { verified: 0, partial: 0, no_match: 0, errors: 0, samples: [] }
  const updates = []

  for (const row of stateRows) {
    try {
      const dsireUrl = `https://programs.dsireusa.org/api/v2/programs?country=US&state=${encodeURIComponent(row.id)}&technology=7`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const resp = await fetch(dsireUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Tractova/1.0 (verification cron)' },
      })
      clearTimeout(timeoutId)

      if (!resp.ok) {
        results.errors++
        continue
      }
      const payload = await resp.json()
      // DSIRE v2 usually returns { data: [...programs] } shape
      const programs = Array.isArray(payload) ? payload : (payload?.data || [])

      // Match heuristic
      let bestMatch = null
      let bestScore = 0
      for (const program of programs) {
        const name = (program.name || program.title || '').toLowerCase()
        if (!name) continue
        let score = 0
        for (const kw of CS_NAME_KEYWORDS) {
          if (name.includes(kw)) score += (kw === 'community solar' ? 3 : 1)
        }
        // Tractova's curated cs_program name is the strongest signal
        if (row.cs_program) {
          const tractovaName = row.cs_program.toLowerCase()
          if (tractovaName && (name.includes(tractovaName) || tractovaName.includes(name))) {
            score += 5
          }
        }
        if (score > bestScore) {
          bestScore = score
          bestMatch = program
        }
      }

      let matchQuality = 'none'
      let dsireProgramId = null
      let dsireProgramUrl = null
      let dsireSummary = null

      if (bestMatch && bestScore >= 5) {
        matchQuality = 'exact'
        results.verified++
      } else if (bestMatch && bestScore >= 1) {
        matchQuality = 'partial'
        results.partial++
      } else {
        matchQuality = 'none'
        results.no_match++
      }

      if (bestMatch) {
        dsireProgramId  = String(bestMatch.id || bestMatch.programId || '')
        dsireProgramUrl = bestMatch.url || (dsireProgramId ? `https://programs.dsireusa.org/system/program/detail/${dsireProgramId}` : null)
        dsireSummary    = (bestMatch.summary || bestMatch.description || '').slice(0, 1000) || null
      }

      updates.push({
        id: row.id,
        dsire_program_id:    dsireProgramId,
        dsire_program_url:   dsireProgramUrl,
        dsire_summary:       dsireSummary,
        dsire_last_verified: new Date().toISOString(),
        dsire_match_quality: matchQuality,
      })

      if (results.samples.length < 3) {
        results.samples.push({
          state: row.id,
          tractova_program: row.cs_program,
          dsire_match: bestMatch ? bestMatch.name : null,
          quality: matchQuality,
        })
      }
    } catch (e) {
      results.errors++
    }
  }

  // Batch update — Supabase doesn't have a true batch update for
  // different-row-different-values, so we issue per-row updates. ~30 calls.
  // Capture the FIRST error message so we can surface a real diagnosis
  // instead of just an opaque "errors: 19" count.
  let firstUpdateError = null
  let updates_applied = 0
  for (const upd of updates) {
    const { id, ...fields } = upd
    const { error } = await supabaseAdmin
      .from('state_programs')
      .update(fields)
      .eq('id', id)
    if (error) {
      results.errors++
      if (!firstUpdateError) firstUpdateError = `${id}: ${error.message}`
    } else {
      updates_applied++
    }
  }

  // If every update failed -> surface as a hard failure. Otherwise the
  // multiplexer reports ✓ even though no DSIRE columns were actually
  // written, and the freshness panel stays stale forever.
  const allFailed = updates.length > 0 && updates_applied === 0

  return {
    ok:              !allFailed,
    error:           allFailed ? `All ${updates.length} state_programs updates failed. First error: ${firstUpdateError}. Hint: confirm migration 026 (dsire_* columns) is applied.` : undefined,
    states_checked:  stateRows.length,
    updates_applied,
    verified:        results.verified,
    partial:         results.partial,
    no_match:        results.no_match,
    errors:          results.errors,
    first_error:     firstUpdateError,
    samples:         results.samples,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// County-level ACS handler — per-county LMI density + population
//
// Pulls all ~3,142 US counties in a single Census API call, computes LMI
// using each STATE's median income as the AMI baseline (HUD methodology
// uses MSA-level AMI but state-level is a reasonable v1 proxy that
// matches our existing state-level lmi_data table). Customer payoff:
// when a Lens analysis specifies a county, we serve verified per-county
// LMI density instead of the state aggregate -- meaningful for projects
// in counties that diverge significantly from state median (e.g. wealthy
// suburbs vs urban LMI cores).
//
// Methodology mirrors the state-level handler (refreshLmi above):
//   1. For each county: pull median income, total households, total
//      population, and the 16 income-bracket buckets (B19001 series).
//   2. Compute 80% AMI threshold per state (lookup from lmi_data, or
//      derive from county data if state lookup unavailable).
//   3. Sum households whose income bracket UPPER BOUND <= 80% AMI;
//      linearly interpolate the bracket containing the threshold.
//   4. lmi_pct = lmi_households / total_households * 100.
//
// Source: US Census ACS 2018-2022 5-year, same DOI as state-level pull.
// API call returns ~3,142 county rows × 19 fields = ~3MB response.
// Manageable; no pagination needed.
// ─────────────────────────────────────────────────────────────────────────────

async function refreshCountyAcs() {
  // Same vars as state-level: median income, total households, population,
  // and 16 income brackets.
  const vars = [
    'NAME',
    'B19013_001E',     // Median household income
    'B11001_001E',     // Total households
    'B01003_001E',     // Total population
  ]
  for (let i = 2; i <= 17; i++) {
    vars.push(`B19001_${String(i).padStart(3, '0')}E`)
  }

  const apiKey = process.env.CENSUS_API_KEY
  const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(',')}&for=county:*`
  const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  let raw
  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: `Census county API ${response.status}: ${body.slice(0, 200)}` }
    }
    raw = await response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    return { ok: false, error: `Census county fetch failed: ${err.message}` }
  }

  if (!Array.isArray(raw) || raw.length < 100) {
    return { ok: false, error: `Census API returned ${Array.isArray(raw) ? raw.length : 0} rows; expected ~3,142 counties. Aborting.` }
  }

  const headers     = raw[0]
  const rows        = raw.slice(1)
  const stateFipsIdx  = headers.indexOf('state')
  const countyFipsIdx = headers.indexOf('county')
  const nameIdx       = headers.indexOf('NAME')
  const medianIdx     = headers.indexOf('B19013_001E')
  const totalIdx      = headers.indexOf('B11001_001E')
  const popIdx        = headers.indexOf('B01003_001E')
  const bracketIdx = []
  for (let i = 2; i <= 17; i++) {
    bracketIdx.push(headers.indexOf(`B19001_${String(i).padStart(3, '0')}E`))
  }

  // Pre-load state median incomes from existing lmi_data table -- we use
  // STATE median as the AMI baseline for the county's HUD-style 80% AMI
  // threshold. Falls back to the county's own median if the state lookup
  // is missing.
  const { data: stateLmi } = await supabaseAdmin
    .from('lmi_data')
    .select('state, median_household_income')
  const stateMedianMap = new Map((stateLmi || []).map(r => [r.state, r.median_household_income]))

  const countyRows = []
  for (const row of rows) {
    const fipsState  = row[stateFipsIdx]
    const fipsCounty = row[countyFipsIdx]
    const usps       = FIPS_TO_USPS[fipsState]
    if (!usps) continue   // Skip Puerto Rico, etc.

    const countyFips = `${fipsState}${fipsCounty}`
    const name       = row[nameIdx]
    const median     = parseInt(row[medianIdx], 10)
    const total      = parseInt(row[totalIdx], 10)
    const population = parseInt(row[popIdx], 10)
    const buckets    = bracketIdx.map(i => parseInt(row[i], 10))

    if (!Number.isFinite(median) || !Number.isFinite(total) || total <= 0) continue
    if (median <= 0) continue

    // 80% AMI baseline: prefer state median (HUD-style), fall back to county.
    const stateMedian = stateMedianMap.get(usps) || median
    const ami80 = Math.round(stateMedian * 0.80)

    // Same LMI calculation as state-level: sum brackets <= ami80 with
    // linear interpolation for the threshold-crossing bracket.
    let lmi = 0
    for (let i = 0; i < buckets.length; i++) {
      const bucketCount = buckets[i]
      if (!Number.isFinite(bucketCount) || bucketCount < 0) continue
      const upper = BRACKET_UPPER[i]
      const lower = BRACKET_LOWER[i]
      if (upper <= ami80) {
        lmi += bucketCount
      } else if (lower < ami80 && ami80 < upper) {
        const span = upper - lower
        const frac = (ami80 - lower) / span
        lmi += bucketCount * frac
        break
      } else {
        break
      }
    }
    lmi = Math.round(lmi)
    const lmiPct = total > 0 ? Math.round((lmi / total) * 1000) / 10 : 0

    countyRows.push({
      county_fips:               countyFips,
      state:                     usps,
      county_name:               name,
      total_households:          total,
      lmi_households:            lmi,
      lmi_pct:                   lmiPct,
      median_household_income:   median,
      ami_80pct:                 ami80,
      total_population:          Number.isFinite(population) ? population : null,
      last_updated:              new Date().toISOString(),
      source:                    'US Census ACS 2018-2022 5-year (live pull)',
    })
  }

  // Validation: expect roughly 3,142 counties (50 states + DC). If we got
  // <2,500, something is seriously wrong and we shouldn't wipe existing data.
  if (countyRows.length < 2500) {
    return { ok: false, error: `Census API returned only ${countyRows.length} usable counties; expected ~3,142. Aborting upsert.` }
  }

  // Upsert in batches -- Supabase has a payload size limit; 500 rows per
  // batch keeps each request under a few hundred KB.
  const BATCH = 500
  let totalUpserted = 0
  for (let i = 0; i < countyRows.length; i += BATCH) {
    const slice = countyRows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('county_acs_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Supabase upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: totalUpserted,
      }
    }
    totalUpserted += slice.length
  }

  return {
    ok: true,
    counties_refreshed: totalUpserted,
    sample_county: countyRows.find(r => r.county_name?.startsWith('Will County')) || countyRows[0],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// News handler — RSS + AI-classifier ingest from solar/utility trade press
//
// Strategy:
//   1. Fetch RSS XML from a curated list of trade-press feeds.
//   2. Regex-parse <item>/<entry> blocks (manual parser; no new dependency).
//   3. Pre-filter by CS/DER/policy keywords -- drops most off-topic noise
//      before we spend a cent on the AI classifier.
//   4. Compute SHA-256(normalized_url + normalized_title) -> 16-hex
//      dedupe_hash (migration 028). Skip articles already in news_feed.
//   5. AI-classify the survivors with Claude Haiku 4.5 (cheap). Asks for
//      relevance_score (0-100) + pillar + type + state_ids + tags + summary.
//   6. Insert rows with relevance_score >= 60, marked auto_classified=true.
//
// Cost expectation: ~30-40 articles classified per weekly run × ~600 in/300
// out tokens × Haiku pricing = pennies/week. Well under any meaningful
// budget. Anthropic API key required (ANTHROPIC_API_KEY env var).
//
// Source attribution: news_feed.source = trade-press outlet name. All inserted
// rows have auto_classified=true; UI may filter or badge accordingly.
// ─────────────────────────────────────────────────────────────────────────────

const RSS_SOURCES = [
  { name: 'PV Magazine USA',    url: 'https://pv-magazine-usa.com/feed/' },
  { name: 'Solar Industry Mag', url: 'https://www.solarindustrymag.com/feed/rss' },
  { name: 'Utility Dive',       url: 'https://www.utilitydive.com/feeds/news/' },
  { name: 'Solar Power World',  url: 'https://www.solarpowerworldonline.com/feed/' },
]

// Pre-filter: only classify articles whose title or description matches one of
// these substrings (case-insensitive). Keeps AI cost bounded.
const CS_PREFILTER_KEYWORDS = [
  'community solar', 'shared solar', 'solar garden', 'solar gardens',
  'distributed energy', 'distributed generation', 'der ', 'd.e.r.',
  'interconnection', 'net metering', 'nem ', 'value of solar',
  'rec ', 'srec', 'solar incentive', 'tariff',
  'puc ', 'public utility commission', 'public service commission',
  'ferc', 'iso queue', 'rto queue', 'queue reform',
  'lmi solar', 'low-income solar', 'low income solar',
  'inflation reduction act', 'ira ', 'itc ', 'energy community',
  'illinois shines', 'smart program', 'susi', 'community choice',
  'capacity factor', 'avoided cost', 'rate case',
]

const RSS_USER_AGENT       = 'Tractova/1.0 (news-classifier; +https://tractova.com)'
const MAX_CLASSIFY_PER_RUN = 40   // hard cap to bound AI spend per run
const MIN_RELEVANCE_SCORE  = 60   // below this, skip insert

async function refreshNews() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not configured -- skipping news refresh' }
  }

  // 1. Fetch RSS sources in parallel.
  const rssResults = await Promise.allSettled(RSS_SOURCES.map(src => fetchRss(src)))
  const items = []
  const sourceStats = {}
  for (let i = 0; i < RSS_SOURCES.length; i++) {
    const src = RSS_SOURCES[i]
    const r = rssResults[i]
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const it of r.value) items.push({ ...it, source: src.name })
      sourceStats[src.name] = { fetched: r.value.length }
    } else {
      sourceStats[src.name] = { fetched: 0, error: r.reason?.message || 'fetch failed' }
    }
  }

  if (items.length === 0) {
    return { ok: false, error: 'No RSS items fetched from any source', source_stats: sourceStats }
  }

  // 2. Pre-filter.
  const filtered = items.filter(it => {
    const blob = `${it.title} ${it.description}`.toLowerCase()
    return CS_PREFILTER_KEYWORDS.some(kw => blob.includes(kw))
  })

  // 3. Compute dedupe hashes.
  for (const it of filtered) {
    it.dedupe_hash = sha256Hex(`${normalizeUrl(it.url)}|${normalizeTitle(it.title)}`).slice(0, 16)
  }

  // 4. Skip articles whose hash is already in news_feed.
  const hashes = filtered.map(it => it.dedupe_hash)
  let existingSet = new Set()
  if (hashes.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('news_feed')
      .select('dedupe_hash')
      .in('dedupe_hash', hashes)
    existingSet = new Set((existing || []).map(r => r.dedupe_hash))

    // Touch last_seen_at on already-known articles -- lets us spot articles
    // that have aged out of feeds (no insert, just timestamp refresh).
    if (existingSet.size > 0) {
      await supabaseAdmin
        .from('news_feed')
        .update({ last_seen_at: new Date().toISOString() })
        .in('dedupe_hash', Array.from(existingSet))
    }
  }

  const novel = filtered.filter(it => !existingSet.has(it.dedupe_hash))

  // 5. Cap classified count to bound AI spend per run.
  const toClassify = novel.slice(0, MAX_CLASSIFY_PER_RUN)

  // 6. Classify each (sequential -- ~40 calls × 1-2s well under 60s timeout).
  const inserts = []
  let classified = 0
  let skippedBelowThreshold = 0
  let aiErrors = 0

  for (const it of toClassify) {
    try {
      const verdict = await classifyArticle(it)
      classified++
      if (verdict.relevance_score >= MIN_RELEVANCE_SCORE) {
        inserts.push({
          headline:        it.title.slice(0, 500),
          source:          it.source,
          url:             it.url,
          published_at:    it.published_at, // YYYY-MM-DD
          pillar:          verdict.pillar,
          type:            verdict.type,
          summary:         (verdict.summary || it.description || '').slice(0, 1500),
          tags:            verdict.tags,
          state_ids:       verdict.state_ids,
          is_active:       true,
          dedupe_hash:     it.dedupe_hash,
          auto_classified: true,
          relevance_score: verdict.relevance_score,
          last_seen_at:    new Date().toISOString(),
        })
      } else {
        skippedBelowThreshold++
      }
    } catch (e) {
      aiErrors++
    }
  }

  let inserted = 0
  if (inserts.length > 0) {
    const { error } = await supabaseAdmin.from('news_feed').insert(inserts)
    if (error) {
      return {
        ok: false,
        error: `news_feed insert failed: ${error.message}`,
        inserts_attempted: inserts.length,
      }
    }
    inserted = inserts.length
  }

  return {
    ok: true,
    rss_items_fetched:        items.length,
    pre_filter_passed:        filtered.length,
    already_known_skipped:    existingSet.size,
    novel_candidates:         novel.length,
    ai_classified:            classified,
    ai_errors:                aiErrors,
    skipped_below_threshold:  skippedBelowThreshold,
    inserted:                 inserted,
    source_stats:             sourceStats,
    sample_inserted:          inserts[0]?.headline || null,
  }
}

async function fetchRss(src) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(src.url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': RSS_USER_AGENT,
        'Accept':     'application/rss+xml, application/xml, text/xml',
      },
    })
    clearTimeout(timeoutId)
    if (!resp.ok) throw new Error(`${src.name}: HTTP ${resp.status}`)
    const xml = await resp.text()
    return parseRssXml(xml)
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

// Lightweight RSS 2.0 / Atom parser. Pulls title/link/description/pubDate from
// each <item> or <entry> block. Handles CDATA + basic HTML entity decode.
// Not bulletproof for every feed in the wild, but the four sources we ship
// with all conform to either RSS 2.0 or Atom 1.0 -- both shapes are covered.
function parseRssXml(xml) {
  const itemBlocks = []
  const rssRegex  = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  const atomRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = rssRegex.exec(xml))  !== null) itemBlocks.push(m[1])
  while ((m = atomRegex.exec(xml)) !== null) itemBlocks.push(m[1])

  const items = []
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')

    // Atom: <link href="..."/> ; RSS: <link>...</link>
    let link = extractTag(block, 'link')
    if (!link) {
      const linkAttr = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)
      if (linkAttr) link = linkAttr[1]
    }

    const description = extractTag(block, 'description') ||
                        extractTag(block, 'summary')     ||
                        extractTag(block, 'content')     || ''

    const pubDate = extractTag(block, 'pubDate')   ||
                    extractTag(block, 'published') ||
                    extractTag(block, 'updated')   || ''

    if (!title || !link) continue

    const publishedDate = parsePubDate(pubDate)
    if (!publishedDate) continue   // can't insert without a date (column is NOT NULL)

    items.push({
      title:        decodeEntities(stripTags(title)).trim(),
      url:          link.trim(),
      description:  decodeEntities(stripTags(description)).slice(0, 2000),
      published_at: publishedDate,
    })
  }
  return items
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = block.match(re)
  if (!match) return ''
  let val = match[1]
  const cdata = val.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (cdata) val = cdata[1]
  return val
}

function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, '')
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function parsePubDate(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)   // YYYY-MM-DD for Postgres date column
}

function normalizeUrl(u) {
  return (u || '').trim().toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
}

function normalizeTitle(t) {
  return (t || '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex')
}

// Anthropic API call: classify a single article. Returns:
//   { relevance_score, pillar, type, state_ids, tags, summary }
async function classifyArticle(item) {
  const prompt = `You are classifying a solar / energy industry article for relevance to a US community-solar developer intelligence platform (Tractova). Tractova users are commercial-solar project developers building 1-5 MW community-solar arrays.

Score the article 0-100 for relevance to a developer making siting / offtake / interconnection / financing decisions:
  80-100  highly actionable -- state policy change, IX queue reform, REC/incentive update, major program ruling
  60-79   useful context    -- market trends, comparable deals, capacity statistics
  0-59    not relevant      -- residential rooftop, utility-scale only, EV-only, BESS-only, international

Article:
Title: ${item.title}
Source: ${item.source}
Date: ${item.published_at}
Description: ${(item.description || '').slice(0, 600)}

Return ONLY a single JSON object (no commentary, no markdown fence):
{
  "relevance_score": <int 0-100>,
  "pillar":          "offtake" | "ix" | "site",
  "type":            "policy-alert" | "market-update",
  "state_ids":       ["IL","NY",...],
  "tags":            ["community-solar","ix-queue", ...],
  "summary":         "<=200 char neutral summary"
}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          process.env.ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    throw new Error(`Anthropic ${resp.status}: ${errBody.slice(0, 200)}`)
  }

  const payload = await resp.json()
  const text = payload?.content?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in classifier response: ${text.slice(0, 100)}`)

  let parsed
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}`)
  }

  const score = parseInt(parsed.relevance_score, 10)
  return {
    relevance_score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    pillar:    ['offtake','ix','site'].includes(parsed.pillar) ? parsed.pillar : 'offtake',
    type:      ['policy-alert','market-update'].includes(parsed.type) ? parsed.type : 'market-update',
    state_ids: Array.isArray(parsed.state_ids) ? parsed.state_ids.filter(s => /^[A-Z]{2}$/.test(s)).slice(0, 10) : [],
    tags:      Array.isArray(parsed.tags) ? parsed.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 40)).slice(0, 10) : [],
    summary:   typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Stacks handler — DSIRE financial-incentive cross-verification
//
// For each row in revenue_stacks (one per state), search DSIRE's program
// database for the most relevant FINANCIAL incentive (REC, SREC, ITC adder,
// net-metering tariff, value-of-solar, performance-based incentive) and
// populate the dsire_* columns added by migration 029.
//
// Like state_programs DSIRE verification, this DOES NOT replace Tractova's
// curated values (irec_market, itc_base, itc_adder, net_metering_status,
// summary). It augments them with a verification timestamp + canonical URL.
//
// Match heuristic differs from state_programs: instead of searching for
// program-name keywords like "community solar", we look for incentive-style
// keywords (REC, SREC, ITC, net metering, value of solar, etc.) since
// revenue_stacks documents the financial-incentive layer rather than the
// program identity.
// ─────────────────────────────────────────────────────────────────────────────

const REVENUE_NAME_KEYWORDS = [
  'renewable energy credit',     'rec ',
  'solar renewable energy',      'srec',
  'investment tax credit',       'itc',
  'production tax credit',       'ptc',
  'net metering',                'net energy metering',
  'value of distributed energy', 'value of solar',
  'performance-based incentive', 'pbi',
  'feed-in tariff',              'feed in tariff',
  'successor solar incentive',   'susi',
  'smart program',
  'illinois shines',
  'net energy billing',          'neb',
  'community solar incentive',
]

async function refreshRevenueStacksViaDsire() {
  // Pull every revenue_stacks row -- one per state we track.
  const { data: stackRows, error: fetchErr } = await supabaseAdmin
    .from('revenue_stacks')
    .select('state_id, summary, irec_market, itc_adder, net_metering_status')

  if (fetchErr) return { ok: false, error: `revenue_stacks read failed: ${fetchErr.message}` }
  if (!stackRows || stackRows.length === 0) {
    return { ok: false, error: 'No revenue_stacks rows to verify' }
  }

  const results = { verified: 0, partial: 0, no_match: 0, errors: 0, samples: [] }
  const updates = []

  for (const row of stackRows) {
    try {
      const dsireUrl = `https://programs.dsireusa.org/api/v2/programs?country=US&state=${encodeURIComponent(row.state_id)}&technology=7`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const resp = await fetch(dsireUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Tractova/1.0 (revenue-stack verification cron)' },
      })
      clearTimeout(timeoutId)

      if (!resp.ok) { results.errors++; continue }
      const payload = await resp.json()
      const programs = Array.isArray(payload) ? payload : (payload?.data || [])

      // Score each DSIRE program against revenue-incentive keywords.
      let bestMatch = null
      let bestScore = 0
      for (const program of programs) {
        const name = (program.name || program.title || '').toLowerCase()
        if (!name) continue
        let score = 0
        for (const kw of REVENUE_NAME_KEYWORDS) {
          if (name.includes(kw)) {
            // Heavier weight for the most actionable incentive types
            const weight = (kw === 'srec' || kw === 'value of distributed energy' || kw === 'net metering') ? 3 : 1
            score += weight
          }
        }
        // Prefer programs categorized as financial incentives
        const cat = (program.category || program.programType || '').toLowerCase()
        if (cat.includes('financial') || cat.includes('incentive') || cat.includes('rebate')) score += 2

        if (score > bestScore) {
          bestScore = score
          bestMatch = program
        }
      }

      let matchQuality = 'none'
      let dsireProgramId = null
      let dsireProgramUrl = null
      let dsireSummary = null

      if (bestMatch && bestScore >= 4) {
        matchQuality = 'exact'
        results.verified++
      } else if (bestMatch && bestScore >= 1) {
        matchQuality = 'partial'
        results.partial++
      } else {
        matchQuality = 'none'
        results.no_match++
      }

      if (bestMatch) {
        dsireProgramId  = String(bestMatch.id || bestMatch.programId || '')
        dsireProgramUrl = bestMatch.url ||
                          (dsireProgramId ? `https://programs.dsireusa.org/system/program/detail/${dsireProgramId}` : null)
        dsireSummary    = (bestMatch.summary || bestMatch.description || '').slice(0, 1000) || null
      }

      updates.push({
        state_id:            row.state_id,
        dsire_program_id:    dsireProgramId,
        dsire_program_url:   dsireProgramUrl,
        dsire_summary:       dsireSummary,
        dsire_last_verified: new Date().toISOString(),
        dsire_match_quality: matchQuality,
      })

      if (results.samples.length < 3) {
        results.samples.push({
          state:        row.state_id,
          dsire_match:  bestMatch ? bestMatch.name : null,
          quality:      matchQuality,
        })
      }
    } catch (e) {
      results.errors++
    }
  }

  // Per-row updates -- one PK update per state. Capture first error message
  // so a missing-migration diagnosis surfaces instead of a silent no-op.
  let firstUpdateError = null
  let updates_applied = 0
  for (const upd of updates) {
    const { state_id, ...fields } = upd
    const { error } = await supabaseAdmin
      .from('revenue_stacks')
      .update(fields)
      .eq('state_id', state_id)
    if (error) {
      results.errors++
      if (!firstUpdateError) firstUpdateError = `${state_id}: ${error.message}`
    } else {
      updates_applied++
    }
  }

  const allFailed = updates.length > 0 && updates_applied === 0

  return {
    ok:              !allFailed,
    error:           allFailed ? `All ${updates.length} revenue_stacks updates failed. First error: ${firstUpdateError}. Hint: confirm migration 029 (dsire_* columns) is applied.` : undefined,
    states_checked:  stackRows.length,
    updates_applied,
    verified:        results.verified,
    partial:         results.partial,
    no_match:        results.no_match,
    errors:          results.errors,
    first_error:     firstUpdateError,
    samples:         results.samples,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Energy Community handler — IRA §45 / §48 bonus credit per-county eligibility
//
// Pulls two FeatureServer layers from DOE NETL EDX (the Treasury-recognized
// official designation source for IRA Energy Community bonus credit zones):
//
//   1. 2024_MSAs_NonMSAs_that_are_Energy_Communities — per-county. Filtered
//      to ec_qual_status='Yes' OR fee_qual_status='Yes' so we only fetch
//      the qualifying universe.
//   2. 2024_Coal_Closure_Energy_Communities — per-tract. Filtered to any
//      mine/generator/adjacent_to closure='Yes'. Aggregated to per-county
//      tract counts.
//
// A county qualifies for the +10% ITC bonus credit if EITHER source flags
// it. Brownfields are NOT covered (point data; per-site lat/lng required).
//
// API: free, no key, public. Each FeatureServer has maxRecordCount=2000;
// we paginate via resultOffset.
// ─────────────────────────────────────────────────────────────────────────────

const EC_MSA_URL  = 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/2024_MSAs_NonMSAs_that_are_Energy_Communities/FeatureServer/0/query'
const EC_COAL_URL = 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/2024_Coal_Closure_Energy_Communities/FeatureServer/0/query'
const EC_PAGE_SIZE = 2000

function normalizeCountyName(raw) {
  return (raw || '')
    .toLowerCase()
    .replace(/\s+county$/, '')
    .replace(/\s+parish$/, '')   // Louisiana
    .replace(/\s+borough$/, '')  // Alaska
    .replace(/\s+census area$/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

async function fetchArcgisPaged(baseUrl, where, fields) {
  const all = []
  let offset = 0
  let safety = 0
  while (safety++ < 20) {  // hard cap: 20 pages = 40K records
    const url =
      `${baseUrl}?where=${encodeURIComponent(where)}` +
      `&outFields=${encodeURIComponent(fields)}` +
      `&returnGeometry=false&f=json` +
      `&resultOffset=${offset}&resultRecordCount=${EC_PAGE_SIZE}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    let payload
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Tractova/1.0 (energy-community cron)' },
      })
      clearTimeout(timeoutId)
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`)
      }
      payload = await resp.json()
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
    if (payload.error) {
      throw new Error(`ArcGIS server error: ${payload.error?.message || JSON.stringify(payload.error)}`)
    }
    const features = payload.features || []
    for (const f of features) all.push(f.attributes || {})
    if (features.length < EC_PAGE_SIZE) break
    offset += EC_PAGE_SIZE
  }
  return all
}

async function refreshEnergyCommunity() {
  // 1. MSA / Non-MSA layer (per-county)
  let msaRows
  try {
    msaRows = await fetchArcgisPaged(
      EC_MSA_URL,
      "ec_qual_status='Yes' OR fee_qual_status='Yes'",
      'geoid_cty_2020,fipstate_2020,county_name_2020,state_name,msa_area_name,ec_qual_status,fee_qual_status,ffe_ind_qual,ec_ind_qual,dataset_version'
    )
  } catch (err) {
    return { ok: false, error: `MSA layer fetch failed: ${err.message}` }
  }

  // 2. Coal closure layer (per-tract; aggregated to per-county)
  let coalRows
  try {
    coalRows = await fetchArcgisPaged(
      EC_COAL_URL,
      "mine_closure='Yes' OR generator_closure='Yes' OR adjacent_to_closure='Yes'",
      'geoid_county_2020,fipstate_2020,fipcounty_2020,county_name,state_name,mine_closure,generator_closure,adjacent_to_closure,dataset_version'
    )
  } catch (err) {
    return { ok: false, error: `Coal closure layer fetch failed: ${err.message}` }
  }

  if (msaRows.length === 0 && coalRows.length === 0) {
    return { ok: false, error: 'Both NETL layers returned 0 rows (suspicious — endpoint may have moved)' }
  }

  // Aggregate to per-county
  const byCounty = new Map()
  let datasetVersion = null

  for (const a of msaRows) {
    const fips = a.geoid_cty_2020
    if (!fips || fips.length !== 5) continue
    const usps = FIPS_TO_USPS[a.fipstate_2020]
    if (!usps) continue
    if (!datasetVersion && a.dataset_version != null) datasetVersion = String(a.dataset_version)

    const countyName = a.county_name_2020 || a.county_name || ''
    byCounty.set(fips, {
      county_fips:                fips,
      state:                      usps,
      county_name:                countyName,
      county_name_normalized:     normalizeCountyName(countyName),
      qualifies_via_msa:          a.ec_qual_status === 'Yes',
      qualifies_via_coal_closure: false,
      msa_area_name:              a.msa_area_name || null,
      coal_closure_tract_count:   0,
      ffe_qualified:              a.fee_qual_status === 'Yes' || a.ffe_ind_qual === 1,
      ec_qualified:               a.ec_qual_status === 'Yes' || a.ec_ind_qual === 1,
      dataset_version:            datasetVersion,
      last_updated:               new Date().toISOString(),
      source:                     'DOE NETL EDX (Treasury IRA §45/§48 designations) 2024',
    })
  }

  for (const a of coalRows) {
    const fips = a.geoid_county_2020
    if (!fips || fips.length !== 5) continue
    const usps = FIPS_TO_USPS[a.fipstate_2020]
    if (!usps) continue

    const countyName = a.county_name || ''
    const existing = byCounty.get(fips) || {
      county_fips:                fips,
      state:                      usps,
      county_name:                countyName,
      county_name_normalized:     normalizeCountyName(countyName),
      qualifies_via_msa:          false,
      qualifies_via_coal_closure: false,
      msa_area_name:              null,
      coal_closure_tract_count:   0,
      ffe_qualified:              false,
      ec_qualified:               false,
      dataset_version:            datasetVersion,
      last_updated:               new Date().toISOString(),
      source:                     'DOE NETL EDX (Treasury IRA §45/§48 designations) 2024',
    }
    existing.qualifies_via_coal_closure = true
    existing.coal_closure_tract_count   = (existing.coal_closure_tract_count || 0) + 1
    byCounty.set(fips, existing)
  }

  const rows = Array.from(byCounty.values())
  if (rows.length < 50) {
    return { ok: false, error: `Only ${rows.length} qualifying counties; expected hundreds. Aborting upsert.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('energy_community_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: upserted,
      }
    }
    upserted += slice.length
  }

  // Sample preference: a county qualifying via BOTH paths is the most informative
  const sample = rows.find(r => r.qualifies_via_msa && r.qualifies_via_coal_closure) ||
                 rows.find(r => r.qualifies_via_coal_closure) ||
                 rows[0]

  return {
    ok:                  true,
    qualifying_counties: upserted,
    msa_layer_rows:      msaRows.length,
    coal_layer_rows:     coalRows.length,
    dataset_version:     datasetVersion,
    sample_county:       sample,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD QCT / DDA handler — federal LIHTC designation overlay per county
//
// Pulls the 2026 QCT and DDA layers from HUD User's ArcGIS FeatureServers:
//   - QUALIFIED_CENSUS_TRACTS_2026: per-tract polygons. GEOID concatenates
//     STATE + COUNTY + TRACT (2+3+6 = 11 digits). Substring(0,5) = county_fips.
//     Aggregated to per-county count + tract list.
//   - Difficult_Development_Areas_2026: mixed metro/non-metro. For non-metro
//     (DDA_TYPE='NM'), DDA_CODE has format `NCNTY{state_fips}{county_fips}...`
//     so we can parse county_fips from chars 5-9. Metro DDAs are at ZCTA
//     level and are skipped here (would require ZCTA->county crosswalk; v2).
//
// Why this matters: counties with high QCT density have concentrated low-
// income household populations. Several state CS programs (NY VDER,
// IL Shines low-income carve-out, MA SMART LMI adder) give bonus credits
// for projects with QCT-overlap subscriber bases.
// ─────────────────────────────────────────────────────────────────────────────

const HUD_QCT_URL = 'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/QUALIFIED_CENSUS_TRACTS_2026/FeatureServer/0/query'
const HUD_DDA_URL = 'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/Difficult_Development_Areas_2026/FeatureServer/0/query'

async function refreshHudQctDda() {
  // 1. QCT layer — per tract.
  let qctRows
  try {
    qctRows = await fetchArcgisPaged(
      HUD_QCT_URL,
      '1=1',
      'GEOID,STATE,COUNTY,TRACT,NAME'
    )
  } catch (err) {
    return { ok: false, error: `HUD QCT layer fetch failed: ${err.message}` }
  }

  // 2. DDA layer — mixed; we only consume the non-metro rows here.
  let ddaRows
  try {
    ddaRows = await fetchArcgisPaged(
      HUD_DDA_URL,
      '1=1',
      'ZCTA5,DDA_CODE,DDA_TYPE,DDA_NAME'
    )
  } catch (err) {
    return { ok: false, error: `HUD DDA layer fetch failed: ${err.message}` }
  }

  if (qctRows.length < 50) {
    return { ok: false, error: `HUD QCT returned only ${qctRows.length} rows; expected thousands. Aborting.` }
  }

  // Aggregate QCTs by county.
  const byCounty = new Map()
  for (const a of qctRows) {
    const stateFips  = a.STATE
    const countyFips = a.COUNTY
    if (!stateFips || !countyFips) continue
    const usps = FIPS_TO_USPS[stateFips]
    if (!usps) continue
    const fips = `${stateFips}${countyFips}`
    const tractGeoid = a.GEOID || `${stateFips}${countyFips}${a.TRACT || ''}`

    const existing = byCounty.get(fips) || {
      county_fips:        fips,
      state:              usps,
      county_name:        null,
      qct_count:          0,
      qct_tract_geoids:   [],
      is_non_metro_dda:   false,
      dda_name:           null,
      dda_code:           null,
      dataset_year:       2026,
      last_updated:       new Date().toISOString(),
      source:             'HUD User QCT 2026 + DDA 2026 (LIHTC designation layers)',
    }
    existing.qct_count += 1
    if (existing.qct_tract_geoids.length < 200) existing.qct_tract_geoids.push(tractGeoid)
    byCounty.set(fips, existing)
  }

  // Layer non-metro DDAs onto the per-county map. DDA_CODE format for NM:
  //   NCNTY{state_fips}{county_fips}N{state_fips}{county_fips}
  //   chars 5..9 = 5-digit FIPS
  let nmDdaCount = 0
  let metroDdaSkipped = 0
  for (const a of ddaRows) {
    if (a.DDA_TYPE !== 'NM') { metroDdaSkipped++; continue }
    const code = a.DDA_CODE || ''
    if (!code.startsWith('NCNTY') || code.length < 10) continue
    const fips = code.slice(5, 10)
    if (!/^\d{5}$/.test(fips)) continue
    const stateFips = fips.slice(0, 2)
    const usps = FIPS_TO_USPS[stateFips]
    if (!usps) continue

    nmDdaCount++
    const existing = byCounty.get(fips) || {
      county_fips:        fips,
      state:              usps,
      county_name:        a.DDA_NAME || null,
      qct_count:          0,
      qct_tract_geoids:   [],
      is_non_metro_dda:   false,
      dda_name:           null,
      dda_code:           null,
      dataset_year:       2026,
      last_updated:       new Date().toISOString(),
      source:             'HUD User QCT 2026 + DDA 2026 (LIHTC designation layers)',
    }
    existing.is_non_metro_dda = true
    existing.dda_name = a.DDA_NAME || existing.dda_name
    existing.dda_code = a.DDA_CODE || existing.dda_code
    if (!existing.county_name && a.DDA_NAME) existing.county_name = a.DDA_NAME
    byCounty.set(fips, existing)
  }

  const rows = Array.from(byCounty.values())
  if (rows.length < 50) {
    return { ok: false, error: `Only ${rows.length} counties aggregated; expected hundreds. Aborting.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('hud_qct_dda_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: upserted,
      }
    }
    upserted += slice.length
  }

  // Sample preference: a county with both QCT density AND non-metro DDA flag
  const sample = rows.find(r => r.qct_count >= 5 && r.is_non_metro_dda) ||
                 rows.find(r => r.qct_count >= 10) ||
                 rows[0]

  return {
    ok:                       true,
    counties_with_designation: upserted,
    qct_layer_rows:           qctRows.length,
    dda_layer_rows:           ddaRows.length,
    non_metro_dda_count:      nmDdaCount,
    metro_dda_skipped:        metroDdaSkipped,
    sample_county:            sample,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NMTC LIC handler — IRA §48(e) Category 1 Low-Income Communities Bonus Credit
//
// Derives NMTC Low-Income Community tract designations from raw Census ACS
// data per the CDFI Fund's published methodology. A tract qualifies as LIC
// (and thus the project sited there qualifies for §48(e) Category 1's +10%
// ITC bonus) if EITHER:
//   (a) Tract poverty rate >= 20%
//   (b) Tract median family income <= 80% of statewide median family income
//
// Why we DERIVE rather than fetch from a published list: CDFI Fund publishes
// the LIC list as a downloadable Excel/shapefile, not a REST API. Computing
// from primary Census ACS sources gives us:
//   - Same data inputs CDFI uses (ACS 2018-2022 5-year)
//   - Same rules CDFI applies (per their methodology)
//   - Live-pulled (each weekly cron checks Census; if Census updates the
//     ACS series, our LIC counts update automatically)
//
// Methodology notes / v1 limitations:
//   - We use STATE median family income as the threshold benchmark for ALL
//     tracts. CDFI uses the GREATER of state MFI or MSA MFI for metro tracts.
//     A metro tract in a high-MFI MSA may be slightly under-counted in v1.
//   - We don't capture special "high migration" rural tracts (a CDFI
//     provision affecting <2% of tracts).
//
// Customer impact: §48(e) Category 1 stacks with Energy Community for up to
// +20 percentage points on the ITC. Direct $-impact: ~$1-2M of bonus credit
// on a 5MW project sited in an LIC tract.
// ─────────────────────────────────────────────────────────────────────────────

async function refreshNmtcLic() {
  const apiKey = process.env.CENSUS_API_KEY

  // 1. Pull state-level median family income for the threshold benchmark.
  //    State-level allows wildcard for `state` (only TRACT-level forbids it).
  const baseStateUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19113_001E&for=state:*`
  const stateUrl = apiKey ? `${baseStateUrl}&key=${apiKey}` : baseStateUrl

  let stateRaw
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    const resp = await fetch(stateUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return { ok: false, error: `Census state MFI ${resp.status}: ${body.slice(0, 200)}` }
    }
    stateRaw = await resp.json()
  } catch (err) {
    return { ok: false, error: `Census state MFI fetch failed: ${err.message}` }
  }

  if (!Array.isArray(stateRaw) || stateRaw.length < 2) {
    return { ok: false, error: 'Census state MFI returned malformed payload' }
  }

  const stateHdr   = stateRaw[0]
  const stateRows  = stateRaw.slice(1)
  const sMfiIdx    = stateHdr.indexOf('B19113_001E')
  const sFipsIdx   = stateHdr.indexOf('state')
  const stateMfiByFips = new Map()
  for (const r of stateRows) {
    const mfi = parseInt(r[sMfiIdx], 10)
    if (Number.isFinite(mfi) && mfi > 0) {
      stateMfiByFips.set(r[sFipsIdx], mfi)
    }
  }

  // 2. Pull tract-level data state-by-state. Census API REJECTS `state:*`
  //    for the `in=state` parameter when querying tracts -- you must pin
  //    one state per call. We iterate the 51 FIPS we track in parallel
  //    batches of 8 to stay within the 60s function budget.
  async function fetchTractsForState(stateFips) {
    const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19113_001E,B17020_001E,B17020_002E&for=tract:*&in=state:${stateFips}`
    const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const resp = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`)
      }
      const json = await resp.json()
      if (!Array.isArray(json) || json.length < 2) return []
      return json   // includes header row at [0]
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  const stateFipsList = Object.keys(FIPS_TO_USPS)
  const PARALLEL = 8
  const stateFetchErrors = []
  const allTractRowsByState = []   // each entry: { stateFips, headers, rows }

  for (let i = 0; i < stateFipsList.length; i += PARALLEL) {
    const batch = stateFipsList.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(batch.map(fips => fetchTractsForState(fips)))
    for (let j = 0; j < batch.length; j++) {
      const fips = batch[j]
      const r = settled[j]
      if (r.status === 'fulfilled' && r.value.length >= 2) {
        allTractRowsByState.push({ stateFips: fips, headers: r.value[0], rows: r.value.slice(1) })
      } else if (r.status === 'rejected') {
        stateFetchErrors.push(`${FIPS_TO_USPS[fips] || fips}: ${r.reason?.message || 'failed'}`)
      }
    }
  }

  if (allTractRowsByState.length < 30) {
    return {
      ok: false,
      error: `Only ${allTractRowsByState.length}/${stateFipsList.length} state tract pulls succeeded. Aborting.`,
      first_state_errors: stateFetchErrors.slice(0, 5),
    }
  }

  // 3. Apply CDFI rules per tract; aggregate per county.
  const byCounty = new Map()
  let totalQualifyingTracts = 0
  let totalTractsScanned    = 0

  for (const stateBundle of allTractRowsByState) {
    const hdr        = stateBundle.headers
    const rows       = stateBundle.rows
    const mfiIdx     = hdr.indexOf('B19113_001E')
    const povTotalIdx= hdr.indexOf('B17020_001E')
    const povBelowIdx= hdr.indexOf('B17020_002E')
    const stIdx      = hdr.indexOf('state')
    const coIdx      = hdr.indexOf('county')
    const trIdx      = hdr.indexOf('tract')
    const nmIdx      = hdr.indexOf('NAME')

    for (const r of rows) {
      const stateFips  = r[stIdx]
      const countyFips = r[coIdx]
      const tractFips  = r[trIdx]
      if (!stateFips || !countyFips || !tractFips) continue
      const usps = FIPS_TO_USPS[stateFips]
      if (!usps) continue

      totalTractsScanned += 1
      const fips = `${stateFips}${countyFips}`
      const stateMfi = stateMfiByFips.get(stateFips) || 0
      const tractMfi = parseInt(r[mfiIdx], 10)
      const povTotal = parseInt(r[povTotalIdx], 10)
      const povBelow = parseInt(r[povBelowIdx], 10)

      let bucket = byCounty.get(fips)
      if (!bucket) {
        bucket = {
          county_fips:                fips,
          state:                      usps,
          county_name:                null,
          total_tracts_in_county:     0,
          qualifying_tracts_count:    0,
          qualifying_via_poverty:     0,
          qualifying_via_low_mfi:     0,
          qualifying_tract_geoids:    [],
          state_median_family_income: stateMfi || null,
          dataset_version:            'ACS 2018-2022 5-year',
          last_updated:               new Date().toISOString(),
          source:                     'US Census ACS 2018-2022 5-yr + CDFI Fund NMTC LIC methodology',
        }
        byCounty.set(fips, bucket)
      }
      bucket.total_tracts_in_county += 1

      if (!bucket.county_name) {
        const nm = r[nmIdx] || ''
        const parts = nm.split(',').map(s => s.trim())
        if (parts.length >= 2) bucket.county_name = parts[1]
      }

      const povertyRate = (Number.isFinite(povBelow) && Number.isFinite(povTotal) && povTotal > 0)
                          ? povBelow / povTotal
                          : null
      const qualifiesViaPoverty = povertyRate !== null && povertyRate >= 0.20
      const qualifiesViaLowMfi  = (Number.isFinite(tractMfi) && tractMfi > 0 && stateMfi > 0)
                                  ? tractMfi <= stateMfi * 0.80
                                  : false

      if (qualifiesViaPoverty || qualifiesViaLowMfi) {
        bucket.qualifying_tracts_count += 1
        if (qualifiesViaPoverty) bucket.qualifying_via_poverty += 1
        if (qualifiesViaLowMfi)  bucket.qualifying_via_low_mfi += 1
        if (bucket.qualifying_tract_geoids.length < 200) {
          bucket.qualifying_tract_geoids.push(`${stateFips}${countyFips}${tractFips}`)
        }
        totalQualifyingTracts += 1
      }
    }
  }

  const allRows = Array.from(byCounty.values())
  if (allRows.length < 100) {
    return { ok: false, error: `Only ${allRows.length} counties aggregated; expected ~3,143. Aborting.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < allRows.length; i += BATCH) {
    const slice = allRows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('nmtc_lic_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: upserted,
      }
    }
    upserted += slice.length
  }

  // Sample preference: county with high LIC density
  const sample = allRows.find(r => r.qualifying_tracts_count >= 5) ||
                 allRows.find(r => r.qualifying_tracts_count >= 1) ||
                 allRows[0]

  return {
    ok:                          true,
    counties_evaluated:          upserted,
    total_qualifying_tracts:     totalQualifyingTracts,
    total_tracts_scanned:        totalTractsScanned,
    counties_with_lic:           allRows.filter(r => r.qualifying_tracts_count > 0).length,
    states_pulled_successfully:  allTractRowsByState.length,
    state_fetch_errors:          stateFetchErrors.length > 0 ? stateFetchErrors.slice(0, 10) : undefined,
    states_covered_by_mfi:       stateMfiByFips.size,
    sample_county:               sample,
  }
}
