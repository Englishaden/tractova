// Orphan → Project conversion — Phase 2C of TRACTOVA-UX-001.
//
// An "orphan scenario" is a scenario_snapshots row with project_id=null,
// saved during Lens exploration before the user decided to commit a
// project. Library's Scenarios tab groups them by Lens context (state +
// county + tech); the "Convert to project" CTA in ScenariosView promotes
// the whole group into a Library project in one click — no Lens detour.
//
// This helper does the Supabase work (insert project, attach scenarios,
// log audit). The caller (Library.jsx) handles optimistic state updates.
import { supabase } from './supabase'
import { computeSubScores, safeScore } from './scoreEngine'
import { denormalizeTech } from './scenarioEngine'
import { logProjectEvent } from './projectEvents'

// Convert an orphan scenario group into a Library project. Returns the
// inserted project row (camelCase post-normalize is the caller's job)
// or null on failure.
//
//   group:           the orphan group from ScenariosView ({ state, county,
//                    technology, scenarios: [...] })
//   userId:          auth.uid()
//   stateProgram:    live state_programs row for `group.state` (used for
//                    program name + cs_status + ix_difficulty + score)
//   countyData:      live county_intelligence row (used for site sub-score)
export async function convertOrphanGroupToProject({ group, userId, stateProgram, countyData }) {
  if (!group?.scenarios?.length || !userId) return null

  const head = group.scenarios[0]
  const mw = head?.scenario_inputs?.systemSizeMW
           ?? head?.baseline_inputs?.systemSizeMW
           ?? null
  const techLabel = denormalizeTech(group.technology) || group.technology || null
  const name = `${group.county || group.state} ${mw ? `${mw}MW ` : ''}${techLabel || ''}`.trim() || `${group.state} project`

  // Compute the live score the same way Library cards do — so the new
  // project lands with a score that matches what re-running Lens would
  // show. stage='Prospecting' since the user hasn't committed beyond
  // exploration; they can promote stage later from the project card.
  let liveScore = null
  if (stateProgram) {
    const subs = computeSubScores(stateProgram, countyData, 'Prospecting', techLabel)
    liveScore = safeScore(subs.offtake, subs.ix, subs.site)
  }

  const payload = {
    user_id:             userId,
    name,
    state:               group.state,
    state_name:          stateProgram?.name || group.state,
    county:              group.county || null,
    mw,
    stage:               'Prospecting',
    technology:          techLabel,
    cs_program:          stateProgram?.csProgram   || null,
    cs_status:           stateProgram?.csStatus    || 'none',
    ix_difficulty:       stateProgram?.ixDifficulty || null,
    opportunity_score:   liveScore,
    last_observed_score: liveScore,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('projects')
    .insert(payload)
    .select('*')
    .single()
  if (insertErr || !inserted) {
    console.warn('[orphan→project] insert failed:', insertErr?.message)
    return null
  }

  // Attach every scenario in the group to the new project.
  const ids = group.scenarios.map(s => s.id)
  await supabase
    .from('scenario_snapshots')
    .update({ project_id: inserted.id })
    .in('id', ids)

  // Audit log: project birth (mirrors the Save-from-Lens flow).
  try {
    await logProjectEvent({
      projectId: inserted.id,
      userId,
      kind:      'created',
      detail:    `Project created from ${group.scenarios.length} exploration scenario${group.scenarios.length === 1 ? '' : 's'}: ${name}`,
      meta:      { stage: 'Prospecting', mw, score: liveScore, source: 'orphan_conversion', scenario_count: group.scenarios.length },
    })
  } catch { /* audit failures must not block UI */ }

  return inserted
}
