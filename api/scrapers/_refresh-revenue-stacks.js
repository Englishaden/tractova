/**
 * Revenue Stacks handler — DSIRE financial-incentive cross-verification
 *
 * For each row in revenue_stacks (one per state), search DSIRE's program
 * database for the most relevant FINANCIAL incentive (REC, SREC, ITC adder,
 * net-metering tariff, value-of-solar, performance-based incentive) and
 * populate the dsire_* columns added by migration 029.
 *
 * Like state_programs DSIRE verification, this DOES NOT replace Tractova's
 * curated values (irec_market, itc_base, itc_adder, net_metering_status,
 * summary). It augments them with a verification timestamp + canonical URL.
 *
 * Match heuristic differs from state_programs: instead of searching for
 * program-name keywords like "community solar", we look for incentive-style
 * keywords (REC, SREC, ITC, net metering, value of solar, etc.) since
 * revenue_stacks documents the financial-incentive layer rather than the
 * program identity.
 */
import { supabaseAdmin } from './_scraperBase.js'

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

export default async function refreshRevenueStacksViaDsire() {
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
  // Capture first upstream-fetch error so first_error reflects what DSIRE
  // actually said (mirrors the fix in _refresh-state-programs.js).
  let firstFetchError = null

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

      if (!resp.ok) {
        results.errors++
        if (!firstFetchError) {
          const body = await resp.text().catch(() => '')
          firstFetchError = `${row.state_id}: HTTP ${resp.status} from DSIRE — ${body.slice(0, 140)}`
        }
        continue
      }
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
      if (!firstFetchError) firstFetchError = `${row.state_id}: ${e?.message || String(e)}`
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

  // Honest success criterion (mirrors state_programs fix): if every state
  // 403'd, updates.length is 0, so the old check `updates.length > 0 &&
  // updates_applied === 0` evaluated to false and the cron passed silently.
  const noWorkDone = updates_applied === 0 && results.verified === 0 && results.partial === 0
  const allFailed = noWorkDone && stackRows.length > 0
  const reportedError = firstFetchError || firstUpdateError

  return {
    ok:              !allFailed,
    error:           allFailed
      ? `revenue_stacks DSIRE pipeline did no useful work across ${stackRows.length} states. First error: ${reportedError || '(none captured)'}. Hint: DSIRE may have changed access policy or migration 029 may be missing.`
      : undefined,
    states_checked:  stackRows.length,
    updates_applied,
    verified:        results.verified,
    partial:         results.partial,
    no_match:        results.no_match,
    errors:          results.errors,
    first_error:     reportedError,
    samples:         results.samples,
  }
}
