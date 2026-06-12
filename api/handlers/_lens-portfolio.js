// GATE: pro-bearer (lens-insight.js Pro gate before dispatch)
/**
 * Portfolio analysis — summarize a developer's project portfolio
 * Action: 'portfolio'
 */
import Anthropic from '@anthropic-ai/sdk'
import { PORTFOLIO_PROMPT } from '../_prompts/portfolio.js'
import { MAX_PROJECTS, clampStr } from '../lib/_promptInput.js'

export default async function handlePortfolio(body, res) {
  const { projects } = body
  if (!Array.isArray(projects) || !projects.length) return res.status(400).json({ error: 'No projects provided' })
  // F-03: bound prompt size — reject oversized portfolios instead of
  // concatenating an unbounded array into the Sonnet prompt.
  if (projects.length > MAX_PROJECTS) return res.status(400).json({ error: `Too many projects (max ${MAX_PROJECTS})` })

  const lines = [`PORTFOLIO: ${projects.length} projects\n`]
  projects.forEach((p, i) => {
    lines.push(`${i + 1}. ${clampStr(p.name) || 'Unnamed'} — ${clampStr(p.mw, 12) || '?'}MW ${clampStr(p.technology, 24) || 'Solar'} in ${clampStr(p.state, 24) || '?'}, ${clampStr(p.county, 48) || '?'} County`)
    lines.push(`   Stage: ${clampStr(p.stage, 24) || 'Unknown'} | Score: ${p.score ?? '?'}/100 | IX: ${clampStr(p.ixDifficulty, 24) || '?'} | CS Status: ${clampStr(p.csStatus, 24) || '?'}`)
  })

  const totalMW = projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
  const states = [...new Set(projects.map(p => p.state).filter(Boolean))]
  lines.push(`\nTOTALS: ${totalMW} MW across ${states.length} state${states.length !== 1 ? 's' : ''} (${states.join(', ')})`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 600, system: PORTFOLIO_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      return res.status(200).json(parsed)
    } catch {
      return res.status(200).json({ summary: null, fallback: true, reason: 'parse_failed' })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:portfolio] error:', err.message)
    return res.status(200).json({ summary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
