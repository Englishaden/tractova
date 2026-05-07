import { computeSubScores, safeScore } from './scoreEngine'

// ── Alert detection ──────────────────────────────────────────────────────────
const STATUS_RANK = { active: 3, limited: 2, pending: 1, none: 0 }

// 2026-05-05 (A.6 + A.7): alerts now carry `kind` (concern | data_update |
// neutral) so the card pill can render distinct colors per kind — a
// "data refreshed" event is a GOOD thing and shouldn't share the amber
// "concern" color. Each alert also carries an `evidence` block (A.7) with
// source-field changed, as-of timestamps, and source URL so the user can
// trace the rationale, not just see "what."
/**
 * Compute the alerts for a saved project by diffing its at-save snapshot
 * against the current live state_program + county data. Each alert has
 * `level` (urgent / warning / info), `kind` (concern / data_update /
 * neutral) for color taxonomy, and `evidence` (field, before, after,
 * verifiedAt, sourceUrl) for the "why?" tooltip.
 *
 * @param {object} project — saved project row including the at-save snapshot fields
 * @param {object} stateProgramMap — keyed by state id → live state_program row
 * @param {object} [countyDataMap] — keyed by county_fips → live county_intelligence
 * @returns {Array<{level, kind, title, detail, evidence?}>}
 */
export function getAlerts(project, stateProgramMap, countyDataMap = {}) {
  const current = stateProgramMap[project.state]
  if (!current) return []

  const alerts = []
  const savedRank   = STATUS_RANK[project.csStatus]   ?? 2
  const currentRank = STATUS_RANK[current.csStatus]   ?? 2

  if (currentRank < savedRank) {
    if (current.csStatus === 'limited') {
      alerts.push({
        level: 'warning', kind: 'concern', pillar: 'Offtake',
        label: 'Capacity Limited',
        detail: `${current.name} program moved to limited capacity`,
        evidence: {
          field: 'state_programs.cs_status',
          before: project.csStatus, after: current.csStatus,
          beforeLabel: 'when you saved this project',
          afterLabel: current.lastVerified ? `verified ${formatVerifiedDate(current.lastVerified)}` : 'most recent verification',
          sourceUrl: current.dsireProgramUrl || 'https://programs.dsireusa.org/',
          sourceLabel: 'DSIRE program detail',
        },
      })
    } else if (current.csStatus === 'none' || current.csStatus === 'pending') {
      alerts.push({
        level: 'urgent', kind: 'concern', pillar: 'Offtake',
        label: 'Program Closed',
        detail: `${current.name} CS program is no longer active`,
        evidence: {
          field: 'state_programs.cs_status',
          before: project.csStatus, after: current.csStatus,
          beforeLabel: 'when you saved this project',
          afterLabel: current.lastVerified ? `verified ${formatVerifiedDate(current.lastVerified)}` : 'most recent verification',
          sourceUrl: current.dsireProgramUrl || 'https://programs.dsireusa.org/',
          sourceLabel: 'DSIRE program detail',
        },
      })
    }
  }

  // Score-drop alert must use the SAME inputs as the visual card display so the
  // delta the user sees in the alert matches the score they see on the card.
  // Previous bug: alert recomputed with countyData=null while the card recomputed
  // with countyData from countyDataMap, producing inconsistent deltas. Now both
  // paths read from countyDataMap (lazy-populated as cards expand). When the
  // map hasn't filled yet for this (state, county), we fall back to null —
  // the score will refine as countyDataMap populates and the alert re-renders.
  const cd = countyDataMap[`${project.state}::${project.county}`] || null
  const currentSubs = computeSubScores(current, cd, project.stage, project.technology)
  const currentLiveScore = safeScore(currentSubs.offtake, currentSubs.ix, currentSubs.site)
  if (project.feasibilityScore != null && currentLiveScore < project.feasibilityScore - 10) {
    alerts.push({
      level: 'warning', kind: 'concern', pillar: 'Market',
      label: 'Score Drop',
      detail: `Feasibility index fell from ${project.feasibilityScore} → ${currentLiveScore} (recomputed for ${project.technology || 'CS'} at ${project.stage || 'current stage'})`,
      evidence: {
        field: 'feasibility_score (computed)',
        before: project.feasibilityScore, after: currentLiveScore,
        beforeLabel: 'at save time',
        afterLabel: 'live recompute (current state_program + county data)',
        sourceUrl: null,
        sourceLabel: 'Feasibility Index = weighted offtake + IX + site sub-scores',
      },
    })
  }

  const IX_RANK = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }
  if (project.ixDifficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ixDifficulty] ?? 0)) {
    alerts.push({
      level: 'warning', kind: 'concern', pillar: 'IX',
      label: 'Queue Harder',
      detail: `${current.name} IX difficulty increased to ${current.ixDifficulty.replace('_', ' ')}`,
      evidence: {
        field: 'state_programs.ix_difficulty',
        before: project.ixDifficulty, after: current.ixDifficulty,
        beforeLabel: 'when you saved',
        afterLabel: 'most recent IX queue scrape',
        sourceUrl: null,
        sourceLabel: 'Curated from ISO/RTO interconnection-queue data',
      },
    })
  }

  if (current.updatedAt) {
    const updatedAt = new Date(current.updatedAt)
    const savedAt   = new Date(project.savedAt)
    const ageDays   = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (updatedAt > savedAt && ageDays < 90) {
      const fmt = updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      alerts.push({
        level: 'info', kind: 'data_update', pillar: null,
        label: 'Data Refreshed',
        detail: `${current.name} data updated ${fmt}`,
        evidence: {
          field: 'state_programs.updated_at',
          before: project.savedAt ? new Date(project.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          after: updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          beforeLabel: 'when you saved',
          afterLabel: 'most recent refresh',
          sourceUrl: null,
          sourceLabel: 'Weekly DSIRE verification cron + manual admin curation',
        },
      })
    }
  }

  return alerts
}

function formatVerifiedDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return 'recent' }
}

// ── Alert chip ───────────────────────────────────────────────────────────────
// 2026-05-05 (A.6): style by `kind` (concern vs data_update vs neutral) for
// the chip palette, since the user's intuition is that alerts of different
// KIND should look different at a glance. Within concern, level (urgent vs
// warning) bumps the saturation. data_update gets a green/teal palette
// distinct from amber/red so good news is visibly separable from concerns.
const ALERT_STYLES = {
  // concern variants
  urgent:      { chip: 'bg-red-50 border-red-300 text-red-800',           dot: 'bg-red-600'     },
  warning:     { chip: 'bg-amber-50 border-amber-300 text-amber-800',     dot: 'bg-amber-500'   },
  // data_update — green palette
  data_update: { chip: 'bg-emerald-50 border-emerald-300 text-emerald-800', dot: 'bg-emerald-500' },
  // legacy neutral (pre-kind-taxonomy alerts) — teal
  info:        { chip: 'bg-teal-50 border-teal-300 text-teal-800',         dot: 'bg-teal-500'    },
}

/**
 * Picks a color palette for an alert chip based on `kind`. data_update
 * alerts render emerald (good news!) so they don't share the amber/red
 * concern palette and visually drown out actual concerns on the same
 * project card.
 *
 * @param {{level:string, kind:string}} alert
 * @returns {{bg:string, border:string, text:string, dot:string}}
 */
export function alertStyleFor(alert) {
  if (alert.kind === 'data_update') return ALERT_STYLES.data_update
  return ALERT_STYLES[alert.level] || ALERT_STYLES.info
}
