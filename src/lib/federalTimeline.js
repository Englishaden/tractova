// Federal incentive TIMING rules engine — Pillar 5 (Policy & Timing) input.
//
// This is a RULES ENGINE over published federal law/guidance, NOT financial
// synthesis. It assigns a RISK TIER (clear / watch / at_risk) to a project's
// ability to capture the §48E / §45Y tax credits given its stage + target COD,
// and surfaces FEOC + Safe-Harbor procedural risk. No dollars are produced —
// the whole point of the 5-pillar pivot is to express federal exposure as an
// honest risk signal rather than a fabricated $ number.
//
// ── Source of the dates (verify against current Treasury/IRS guidance) ──
// OBBBA (One Big Beautiful Bill Act) era, as summarized by Wood Mackenzie,
// "Outlook for US solar worsens under the OBBBA" (fetched 2026-05):
//   • §48E (ITC) / §45Y (PTC), commercial/utility scale:
//       - Start construction ON/BEFORE Jul 4 2026 → ~4-yr continuity window to
//         be placed in service (PIS ~through 2030).
//       - Start construction AFTER Jul 4 2026 → must be PIS by END of 2027.
//       - Credits otherwise sunset after 2027.
//   • §25D residential credit: ends after 2025 (out of our scope — DG/CS).
//   • FEOC (Foreign Entity of Concern): restrictions apply to projects starting
//     construction in 2026; Treasury has NOT finalized start-of-construction
//     rules → genuine uncertainty → we score this as "watch", never a false-
//     precise penalty.
//   • Safe Harbor: the 5% cost safe harbor was eliminated for projects
//     >1.5 MWac as of Sep 2 2025 → start-of-construction must meet the
//     Physical Work Test (procedural risk for larger DG/CS projects).
//
// IMPORTANT: these dates are federal and uniform across states; re-verify each
// quarter against IRS/Treasury notices. The engine degrades to a neutral tier
// when it lacks the inputs to judge (no fabrication of certainty).

export const FEDERAL_TIMELINE = {
  socCutoff: '2026-07-04',        // §48E/§45Y start-of-construction continuity cutoff
  postCutoffPisDeadline: '2027-12-31', // PIS deadline if SoC after the cutoff
  feocConstructionYear: 2026,     // FEOC restrictions apply to SoC in 2026 (rules pending)
  safeHarborChange: '2025-09-02', // 5% safe harbor removed >1.5 MWac → Physical Work Test
  safeHarborMwThreshold: 1.5,
  source: 'OBBBA via Wood Mackenzie (2026-05) — re-verify vs IRS/Treasury guidance',
}

// Stages (must match STAGES in lensFormConstants.js) grouped by whether the
// project can plausibly establish start-of-construction by the Jul 4 2026
// cutoff. This is the decisive question post-OBBBA: late-stage projects can
// safe-harbor the generous window; early-stage projects fall into the brutal
// end-2027 PIS regime.
const LATE_STAGES  = new Set(['NTP (Notice to Proceed)', 'Construction', 'Operational'])
const MID_STAGE    = 'Development'
// everything else (Prospecting / Site Control / Pre-Development) = early

const TIER_SCORE = { clear: 85, watch: 55, at_risk: 25 }
const NEUTRAL_SCORE = 60

/**
 * Assess a project's federal tax-credit TIMING risk. Pure, no I/O.
 *
 * @param {object} p
 * @param {number|null} [p.codYear] — target commercial-operation year
 * @param {string} [p.stage] — development stage (STAGES value)
 * @param {number|null} [p.mwAc] — project size (MW AC) for the safe-harbor test
 * @returns {{ tier:'clear'|'watch'|'at_risk', score:number, headline:string, reasons:string[] }}
 */
export function assessFederalTiming({ codYear = null, stage = '', mwAc = null } = {}) {
  const reasons = []
  const year = Number.isFinite(Number(codYear)) ? Number(codYear) : null
  const canSafeHarborSoC = LATE_STAGES.has(stage)
  const borderlineSoC = stage === MID_STAGE

  let tier
  if (canSafeHarborSoC) {
    tier = 'clear'
    reasons.push('Stage supports start-of-construction by the Jul 4 2026 cutoff — secures the ~4-year placed-in-service window for the §48E/§45Y credits.')
  } else if (borderlineSoC) {
    tier = 'watch'
    reasons.push('Starting construction by the Jul 4 2026 cutoff is tight from Development stage — miss it and the project must be placed in service by end-2027 to keep §48E/§45Y.')
  } else if (stage) {
    // Early stage (Prospecting / Site Control / Pre-Development) → post-cutoff regime.
    if (year != null && year <= 2027) {
      tier = 'watch'
      reasons.push('Early stage: unlikely to start construction by Jul 4 2026, so §48E/§45Y requires placed-in-service by end-2027 — achievable only on an aggressive schedule.')
    } else {
      tier = 'at_risk'
      reasons.push(`Early stage with target COD ${year != null ? year : 'after 2027'}: likely misses both the Jul 4 2026 start-of-construction cutoff and the end-2027 placed-in-service deadline — §48E/§45Y tax credits at risk under OBBBA.`)
    }
  } else {
    // Not enough info to judge the credit window — stay neutral, do not fabricate certainty.
    return { tier: 'watch', score: NEUTRAL_SCORE, headline: 'Federal timing not yet assessable', reasons: ['Add a development stage (and target COD year) to assess §48E/§45Y timing exposure.'] }
  }

  // FEOC — always a watch-level disclosure for 2026-era starts; rules are pending.
  reasons.push('FEOC restrictions apply to construction starting in 2026 and Treasury has not finalized start-of-construction rules — confirm supply-chain compliance before committing.')

  // Safe harbor / Physical Work Test — procedural risk for larger projects.
  const mw = Number(mwAc)
  if (Number.isFinite(mw) && mw > FEDERAL_TIMELINE.safeHarborMwThreshold) {
    reasons.push(`Projects >${FEDERAL_TIMELINE.safeHarborMwThreshold} MWac can no longer use the 5% cost safe harbor (post Sep 2 2025) — start-of-construction must meet the Physical Work Test.`)
  }

  const headline = tier === 'clear'
    ? 'On track for §48E/§45Y'
    : tier === 'watch'
      ? 'Federal credit window is tight'
      : 'Federal credits at risk'

  return { tier, score: TIER_SCORE[tier], headline, reasons }
}

// Convenience: just the 0-100 score for the Policy & Timing pillar blend.
export function federalTimingScore(input) {
  return assessFederalTiming(input).score
}
