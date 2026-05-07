/**
 * Scenario commentary — 2-3 sentence narrative for a saved Scenario Studio run
 * Action: 'scenario-commentary'
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  SCENARIO_COMMENTARY_PROMPT,
  describeScenarioDeltas,
  formatScenarioOutputs,
} from '../prompts/scenario-commentary.js'
import { buildCacheKey, cacheGet, cacheSet } from '../lib/_aiCacheLayer.js'

export default async function handleScenarioCommentary(body, res) {
  const { stateId, technology, mw, county, baselineInputs, scenarioInputs, outputs, baselineOutputs } = body
  if (!baselineInputs || !scenarioInputs || !outputs) {
    return res.status(400).json({ error: 'baselineInputs, scenarioInputs, outputs required' })
  }

  // Round numeric inputs for cache hashing so 0.18001 vs 0.18 collapse.
  const round = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
      out[k] = typeof v === 'number' ? Math.round(v * 10000) / 10000 : v
    }
    return out
  }
  const cacheKey = buildCacheKey('scenario-commentary', {
    stateId,
    technology,
    mw: Math.round((parseFloat(mw) || 0) * 10) / 10,
    baseline: round(baselineInputs),
    scenario: round(scenarioInputs),
    outputs:  round(outputs),
  })
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return res.status(200).json({ commentary: cached.commentary, cached: true })
  }

  const deltas = describeScenarioDeltas(baselineInputs, scenarioInputs)
  if (deltas.length === 0) {
    const fallback = 'Baseline run — no inputs diverge from the achievable baseline.'
    cacheSet(cacheKey, 'scenario-commentary', { commentary: fallback }, 30 * 24 * 60 * 60)
    return res.status(200).json({ commentary: fallback })
  }

  const lines = []
  lines.push(`PROJECT: ${mw || '?'} MW ${technology || 'Solar'}${county ? ` | ${county} County` : ''}${stateId ? `, ${stateId}` : ''}`)
  lines.push(`\nSCENARIO INPUTS (changes from baseline):`)
  lines.push(...deltas)
  if (baselineOutputs) {
    lines.push(`\nBASELINE OUTPUTS:`)
    lines.push(...formatScenarioOutputs(baselineOutputs))
  }
  lines.push(`\nSCENARIO OUTPUTS:`)
  lines.push(...formatScenarioOutputs(outputs))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        system: SCENARIO_COMMENTARY_PROMPT,
        messages: [{ role: 'user', content: lines.join('\n') }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    let commentary = null
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.commentary && typeof parsed.commentary === 'string') {
        commentary = parsed.commentary.trim()
      }
    } catch {
      // Fallback: accept raw text if it doesn't look like a JSON parse failure.
      if (raw && raw.length > 20 && raw.length < 500 && !raw.trim().startsWith('{')) {
        commentary = raw.trim().slice(0, 400)
      }
    }
    if (!commentary) {
      return res.status(200).json({ commentary: null, fallback: true, reason: 'parse_failed' })
    }
    cacheSet(cacheKey, 'scenario-commentary', { commentary }, 30 * 24 * 60 * 60)
    return res.status(200).json({ commentary })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:scenario-commentary] error:', err.message)
    return res.status(200).json({ commentary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
