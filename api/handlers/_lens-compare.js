/**
 * Compare — multi-project side-by-side analysis
 * Action: 'compare'
 */
import Anthropic from '@anthropic-ai/sdk'
import { COMPARE_PROMPT } from '../_prompts/compare.js'
import { MAX_PROJECTS, clampStr } from '../lib/_promptInput.js'

export default async function handleCompare(body, res) {
  const { projects } = body
  if (!Array.isArray(projects) || projects.length < 2) return res.status(400).json({ error: 'Need at least 2 projects' })
  // F-03: bound prompt size — reject oversized comparisons.
  if (projects.length > MAX_PROJECTS) return res.status(400).json({ error: `Too many projects (max ${MAX_PROJECTS})` })

  const lines = [`COMPARING ${projects.length} PROJECTS:\n`]
  projects.forEach((p, i) => {
    lines.push(`PROJECT ${i + 1} (id: ${clampStr(p.id, 40)})`)
    lines.push(`  Name: ${clampStr(p.name) || 'Unnamed'}`)
    lines.push(`  Location: ${clampStr(p.state, 24) || '?'}, ${clampStr(p.county, 48) || '?'} County`)
    lines.push(`  Size: ${clampStr(p.mw, 12) || '?'} MW AC ${clampStr(p.technology, 24) || 'Solar'}`)
    lines.push(`  Stage: ${clampStr(p.stage, 24) || 'Unknown'}`)
    lines.push(`  Feasibility Score: ${p.feasibilityScore ?? '?'}/100`)
    lines.push(`  IX Difficulty: ${clampStr(p.ixDifficulty, 24) || '?'}`)
    lines.push(`  CS Status: ${clampStr(p.csStatus, 24) || '?'}`)
    lines.push('')
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 500, system: COMPARE_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      return res.status(200).json(parsed)
    } catch {
      return res.status(200).json({ comparison: null, fallback: true, reason: 'parse_failed' })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:compare] error:', err.message)
    return res.status(200).json({ comparison: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
