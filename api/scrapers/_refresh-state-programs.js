/**
 * State Programs handler — DSIRE cross-verification
 *
 * For each Tractova state with a CS program (csStatus in active/limited/
 * pending), search DSIRE's program database for a matching community-solar
 * program. Populate the dsire_* columns added by migration 026:
 *   dsire_program_id, dsire_program_url, dsire_summary,
 *   dsire_last_verified, dsire_match_quality.
 *
 * This DOES NOT replace Tractova's curated state_programs values
 * (csStatus, capacityMW, lmiPercent, ixDifficulty) -- those still come
 * from admin curation + state program administrator portals which DSIRE
 * doesn't index. This adds a live verification + canonical-URL layer
 * pointing at the authoritative source (NCSU-housed, DOE-funded).
 *
 * DSIRE API: https://programs.dsireusa.org/api/v2/programs
 *   - Free, no key required, public reads
 *   - Returns 100s of programs per state; we filter for community/shared solar
 */
import { supabaseAdmin } from './_scraperBase.js'

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

export default async function refreshStateProgramsViaDsire() {
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
        // 2026-05-05 (A.4): bump last_verified on every DSIRE-matched row.
        // Previously the DSIRE cron only updated DSIRE columns; rows that
        // had been verified weeks ago drifted past the 30-day curation
        // threshold even though the weekly cron had touched them.
        // Bumping last_verified here closes the drift loop for any row
        // the DSIRE pipeline successfully matches; manually-curated rows
        // without DSIRE matches still need an admin "verify" action.
        ...(bestMatch ? { last_verified: new Date().toISOString() } : {}),
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

  // V3 Wave 1.4: append a snapshot row per state on every cron run so we
  // accumulate a feasibility-score time series. ~4 weeks of accumulation
  // unlocks WoW deltas on Markets on the Move; ~12 weeks unlocks the IX
  // Velocity / Program Saturation indices. Best-effort -- snapshot failure
  // doesn't fail the parent cron run.
  let snapshots_written = 0
  try {
    const { data: latestStates } = await supabaseAdmin
      .from('state_programs')
      .select('id, feasibility_score, cs_status, capacity_mw, ix_difficulty, lmi_required, lmi_percent')
      .neq('cs_status', 'none')
    if (latestStates && latestStates.length > 0) {
      const snapshotRows = latestStates.map(s => ({
        state_id:          s.id,
        feasibility_score: s.feasibility_score,
        cs_status:         s.cs_status,
        capacity_mw:       s.capacity_mw,
        ix_difficulty:     s.ix_difficulty,
        lmi_required:      s.lmi_required,
        lmi_percent:       s.lmi_percent,
      }))
      const { error: snapErr } = await supabaseAdmin
        .from('state_programs_snapshots')
        .insert(snapshotRows)
      if (snapErr) {
        console.warn('[state_programs_snapshots] insert failed:', snapErr.message)
      } else {
        snapshots_written = snapshotRows.length
      }
    }
  } catch (e) {
    console.warn('[state_programs_snapshots] hook failed:', e?.message)
  }

  return {
    ok:                !allFailed,
    error:             allFailed ? `All ${updates.length} state_programs updates failed. First error: ${firstUpdateError}. Hint: confirm migration 026 (dsire_* columns) is applied.` : undefined,
    states_checked:    stateRows.length,
    updates_applied,
    snapshots_written,
    verified:          results.verified,
    partial:           results.partial,
    no_match:          results.no_match,
    errors:            results.errors,
    first_error:       firstUpdateError,
    samples:           results.samples,
  }
}
