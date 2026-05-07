/**
 * Deal Memo — IC-grade structured analysis for export to PDF / sales artifact
 * Action: 'deal-memo'
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEAL_MEMO_PROMPT } from '../prompts/deal-memo.js'
import { buildCacheKey, cacheGet, cacheSet, dataVersionFor } from '../lib/_aiCacheLayer.js'
import { buildContext } from '../lens-insight.js'

export default async function handleDealMemo(body, res) {
  const { project, stateProgram, countyData, runway, ixQueue } = body
  if (!project) return res.status(400).json({ error: 'project required' })

  // Cache check (24h TTL, keyed on project_id + stage + data version).
  // Re-opening the same project to share / re-export hits the cache; an
  // admin program update or a stage change invalidates automatically.
  const memoKey = buildCacheKey('deal-memo', {
    projectId:   project.id || null,
    stage:       project.stage || null,
    technology:  project.technology || null,
    mw:          Math.round((parseFloat(project.mw) || 0) * 10) / 10,
    dataVersion: dataVersionFor(stateProgram),
  })
  if (project.id) {
    const cachedMemo = await cacheGet(memoKey)
    if (cachedMemo) {
      return res.status(200).json({ memo: cachedMemo, cached: true })
    }
  }

  // Reuse buildContext if state/county/mw etc are provided
  const contextBody = {
    state: project.state,
    county: project.county,
    mw: project.mw,
    stage: project.stage,
    technology: project.technology,
    stateProgram, countyData, runway, ixQueue,
  }
  const contextText = buildContext(contextBody)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 800, system: DEAL_MEMO_PROMPT, messages: [{ role: 'user', content: contextText }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.siteControlSummary || parsed.ixSummary || parsed.revenueSummary || parsed.recommendation) {
        if (project.id) cacheSet(memoKey, 'deal-memo', parsed, 24 * 60 * 60)
        return res.status(200).json({ memo: parsed })
      }
    } catch {}
    return res.status(200).json({ memo: null, fallback: true, reason: 'parse_failed' })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:deal-memo] error:', err.message)
    return res.status(200).json({ memo: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
