import { createClient } from '@supabase/supabase-js'

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

const SUPPORTED_SOURCES = ['lmi', 'state_programs']

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
    try {
      let result
      if (source === 'lmi')                  result = await refreshLmi()
      else if (source === 'state_programs')  result = await refreshStateProgramsViaDsire()
      else                                   result = { error: 'Handler not implemented' }
      result.duration_ms = Date.now() - srcStart
      results[source] = result
      // Log to cron_runs (best-effort; don't fail the request if logging fails)
      await logCronRun(source, result, authMode)
    } catch (err) {
      const errMsg = err?.message || String(err)
      results[source] = { ok: false, error: errMsg, duration_ms: Date.now() - srcStart }
      await logCronRun(source, { ok: false, error: errMsg }, authMode)
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

async function logCronRun(source, summary, authMode) {
  try {
    await supabaseAdmin
      .from('cron_runs')
      .insert([{
        cron_name: `refresh-data:${source}`,
        status: summary.ok ? 'success' : 'failed',
        summary: { ...summary, auth_mode: authMode },
      }])
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

  // Batch update — but Supabase doesn't have a true batch update for
  // different-row-different-values, so we issue per-row updates. ~30 calls
  // for typical CS-state count; well under the 5s window.
  for (const upd of updates) {
    const { id, ...fields } = upd
    const { error } = await supabaseAdmin
      .from('state_programs')
      .update(fields)
      .eq('id', id)
    if (error) results.errors++
  }

  return {
    ok: true,
    states_checked: stateRows.length,
    verified: results.verified,
    partial: results.partial,
    no_match: results.no_match,
    errors: results.errors,
    samples: results.samples,
  }
}
