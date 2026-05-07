/**
 * News pulse summary — 2-3 sentence rollup of recent items for a state or feed
 * Action: 'news-summary'
 */
import Anthropic from '@anthropic-ai/sdk'
import { NEWS_SUMMARY_PROMPT } from '../prompts/news-summary.js'

export default async function handleNewsSummary(body, res) {
  const { items, state } = body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required' })
  }

  const lines = []
  if (state) lines.push(`STATE FOCUS: ${state}`)
  lines.push(`RECENT NEWS (${items.length} items):\n`)
  items.slice(0, 12).forEach((it, i) => {
    lines.push(`${i + 1}. [${it.pillar || 'general'}] ${it.headline || ''}${it.source ? ` — ${it.source}` : ''}`)
    if (it.summary) lines.push(`   ${it.summary}`)
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 300, system: NEWS_SUMMARY_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.summary) return res.status(200).json(parsed)
    } catch {}
    if (raw && raw.length > 20 && raw.length < 600) {
      return res.status(200).json({ summary: raw.trim().replace(/^["{]|["}]$/g, '').slice(0, 500) })
    }
    return res.status(200).json({ summary: null, fallback: true, reason: 'parse_failed' })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:news-summary] error:', err.message)
    return res.status(200).json({ summary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
