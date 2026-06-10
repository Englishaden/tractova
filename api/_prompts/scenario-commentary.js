// ─────────────────────────────────────────────────────────────────────────────
// Scenario commentary — DEPRECATED under the 5-pillar signal model
// ─────────────────────────────────────────────────────────────────────────────
// This surface used to narrate the financial-modeling outputs from Scenario
// Studio (Y1 revenue, IRR, payback, NPV, DSCR, equity IRR, LCOE) given the
// input deltas the user dragged on the 9 dollar sliders.
//
// Tractova removed the synthesized-dollars financial layer in favor of a
// 5-pillar signal model (Offtake · Interconnection · Incentives · Site ·
// Policy & Timing — all 0-100 signals, NO dollars). There is no dollar
// pro-forma left for this handler to interpret, so the AI commentary is
// retired rather than re-aimed. The exports below are kept so the handler
// import does not break; they no longer emit any dollar figures.
export const SCENARIO_COMMENTARY_STUB =
  'Scenario commentary is not available in the signal model — Tractova grades feasibility as five 0-100 pillar signals (Offtake, Interconnection, Incentives, Site, Policy & Timing), not dollar pro-formas.'

// Retained for backward-compatible imports. No dollar pro-forma exists in the
// signal model, so there is nothing to narrate; the prompt is unused.
export const SCENARIO_COMMENTARY_PROMPT = SCENARIO_COMMENTARY_STUB
