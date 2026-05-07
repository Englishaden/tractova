/**
 * Alert classifier — pure detection logic for project-level urgent alerts.
 *
 * Compares a saved project's snapshot fields (cs_status, opportunity_score,
 * ix_difficulty) against the live state-program map and emits an array of
 * alert objects when material regressions are detected. Used by
 * api/send-alerts.js (urgent/policy email + Slack) and reusable from
 * api/send-digest.js when the weekly digest needs the same classification.
 *
 * Mirrors the helper-module convention used by api/lib/_aiCacheLayer.js:
 * ESM imports, JSDoc-style file header, leading underscore in the
 * filename to flag this as an internal helper. Named exports only — no
 * default export, since this is a grab-bag of pure functions.
 *
 * The deterministic feasibility score formula here MUST stay in lockstep
 * with src/lib/programData.js (the client-side computation). Inlined so
 * this serverless function has no client-side import dependency.
 */

export const STATUS_RANK  = { active: 3, limited: 2, pending: 1, none: 0 }
export const STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }
export const IX_RANK      = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }
export const IX_LABEL     = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very hard' }

// Deterministic feasibility score — mirrors programData.js formula exactly.
// Inlined here so this serverless function has no client-side import dependency.
export function computeFeasibilityScore(row) {
  const base     = { active: 65, limited: 40, pending: 18, none: 5 }[row.cs_status] ?? 5
  const mw       = row.capacity_mw ?? 0
  const capacity = mw > 1000 ? 12 : mw > 500 ? 8 : mw > 100 ? 4 : mw > 0 ? 2 : 0
  const lmi      = row.lmi_percent ?? 0
  const lmiP     = lmi >= 40 ? -14 : lmi >= 25 ? -7 : lmi >= 10 ? -3 : 0
  const ix       = { easy: 12, moderate: 3, hard: -10, very_hard: -22 }[row.ix_difficulty] ?? 3
  return Math.min(95, Math.max(1, base + capacity + lmiP + ix))
}

// Build state map from live Supabase rows
export function buildStateMap(rows) {
  return Object.fromEntries(rows.map(r => [r.id, {
    csStatus:         r.cs_status,
    opportunityScore: computeFeasibilityScore(r),
    ixDifficulty:     r.ix_difficulty,
    name:             r.name,
  }]))
}

export function getUrgentAlerts(project, stateMap) {
  const current = stateMap[project.state]
  if (!current) return []
  const alerts = []
  const savedRank   = STATUS_RANK[project.cs_status] ?? 2
  const currentRank = STATUS_RANK[current.csStatus]  ?? 2
  if (currentRank < savedRank) {
    alerts.push(current.csStatus === 'limited'
      ? { level: 'warning', label: 'Capacity Limited', detail: `The ${current.name} community solar program has moved to limited capacity.` }
      : { level: 'urgent',  label: 'Program Closed',   detail: `The ${current.name} community solar program is no longer active.` })
  }
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10) {
    const drop = project.opportunity_score - current.opportunityScore
    alerts.push({
      level: 'warning',
      label: 'Opportunity Score Drop',
      delta: { from: project.opportunity_score, to: current.opportunityScore, change: -drop },
      detail: `Feasibility Index dropped from ${project.opportunity_score} to ${current.opportunityScore} for "${project.name}".`,
    })
  }
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'IX Queue Harder', detail: `Interconnection difficulty increased from ${IX_LABEL[project.ix_difficulty] ?? project.ix_difficulty} to ${IX_LABEL[current.ixDifficulty] ?? current.ixDifficulty}.` })
  return alerts
}
