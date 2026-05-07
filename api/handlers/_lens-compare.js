/**
 * Compare — multi-project side-by-side analysis
 * Action: 'compare'
 */
import Anthropic from '@anthropic-ai/sdk'
import { COMPARE_PROMPT } from '../prompts/compare.js'

export default async function handleCompare(body, res) {
  const { projects } = body
  if (!projects?.length || projects.length < 2) return res.status(400).json({ error: 'Need at least 2 projects' })

  const lines = [`COMPARING ${projects.length} PROJECTS:\n`]
  projects.forEach((p, i) => {
    lines.push(`PROJECT ${i + 1} (id: ${p.id})`)
    lines.push(`  Name: ${p.name || 'Unnamed'}`)
    lines.push(`  Location: ${p.state || '?'}, ${p.county || '?'} County`)
    lines.push(`  Size: ${p.mw || '?'} MW AC ${p.technology || 'Solar'}`)
    lines.push(`  Stage: ${p.stage || 'Unknown'}`)
    lines.push(`  Feasibility Score: ${p.feasibilityScore ?? '?'}/100`)
    lines.push(`  IX Difficulty: ${p.ixDifficulty || '?'}`)
    lines.push(`  CS Status: ${p.csStatus || '?'}`)
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
