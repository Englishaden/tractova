/**
 * Scenario commentary — DEPRECATED under the 5-pillar signal model
 * Action: 'scenario-commentary'
 *
 * This handler used to narrate Scenario Studio's dollar pro-forma deltas
 * (Y1 revenue, IRR, payback, NPV, DSCR, equity IRR, LCOE). Tractova removed
 * the synthesized-dollars financial layer in favor of a 5-pillar signal model
 * (Offtake · Interconnection · Incentives · Site · Policy & Timing — all
 * 0-100 signals, NO dollars), so there is no dollar pro-forma left to
 * interpret. The handler is reduced to a stub: it no longer calls Anthropic
 * and returns a clear "not available in the signal model" response. The file
 * is kept (not deleted) because lens-insight.js imports + routes to it.
 */
import { SCENARIO_COMMENTARY_STUB } from '../prompts/scenario-commentary.js'

export default async function handleScenarioCommentary(_body, res) {
  return res.status(200).json({
    commentary: null,
    fallback:   true,
    reason:     'not_available_signal_model',
    message:    SCENARIO_COMMENTARY_STUB,
  })
}
