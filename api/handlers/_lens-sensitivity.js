/**
 * Sensitivity rationale — 1-2 sentence "why this scenario changes the score"
 * Action: 'sensitivity'
 */
import Anthropic from '@anthropic-ai/sdk'
import { SENSITIVITY_PROMPT } from '../_prompts/sensitivity.js'
import { MAX_OVERRIDE_ENTRIES, clampStr } from '../lib/_promptInput.js'

export default async function handleSensitivity(body, res) {
  const { state, county, mw, stage, technology, scenario, baseScore, newScore, override, stateProgram, countyData } = body
  if (!scenario) return res.status(400).json({ error: 'scenario required' })

  const lines = []
  lines.push(`PROJECT: ${clampStr(mw, 12) || '?'} MW ${clampStr(technology, 24) || 'Solar'} | ${clampStr(county, 48) || '?'} County, ${clampStr(state, 24) || '?'} | Stage: ${clampStr(stage, 24) || '?'}`)
  if (stateProgram?.csProgram) lines.push(`Program: ${clampStr(stateProgram.csProgram, 80)} (${clampStr(stateProgram.csStatus, 24)})`)
  if (countyData?.interconnection?.servingUtility) lines.push(`Utility: ${clampStr(countyData.interconnection.servingUtility, 80)}`)
  // F-03: cap the free-text scenario and the override map so they can't
  // balloon the prompt to full-context size.
  lines.push(`\nSCENARIO: ${clampStr(scenario, 500)}`)
  if (override && typeof override === 'object') {
    Object.entries(override).slice(0, MAX_OVERRIDE_ENTRIES).forEach(([k, v]) => lines.push(`  ${clampStr(k, 60)}: ${clampStr(v, 200)}`))
  }
  lines.push(`\nSCORE IMPACT: ${baseScore ?? '?'} → ${newScore ?? '?'} (delta: ${newScore != null && baseScore != null ? (newScore - baseScore > 0 ? '+' : '') + (newScore - baseScore) : '?'})`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 200, system: SENSITIVITY_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.rationale) return res.status(200).json(parsed)
    } catch {}
    // Fallback: return raw text trimmed if JSON parse failed but text looks usable
    if (raw && raw.length > 20 && raw.length < 400) {
      return res.status(200).json({ rationale: raw.trim().replace(/^["{]|["}]$/g, '').slice(0, 300) })
    }
    return res.status(200).json({ rationale: null, fallback: true, reason: 'parse_failed' })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:sensitivity] error:', err.message)
    return res.status(200).json({ rationale: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
