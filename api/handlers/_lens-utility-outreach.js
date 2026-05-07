/**
 * Utility Outreach Kit — consultant-grade pre-application packet
 * Action: 'utility-outreach'
 */
import Anthropic from '@anthropic-ai/sdk'
import { UTILITY_OUTREACH_PROMPT } from '../prompts/utility-outreach.js'
import { buildCacheKey, cacheGet, cacheSet, dataVersionFor } from '../lib/_aiCacheLayer.js'
import { buildContext } from '../lens-insight.js'

export default async function handleUtilityOutreach(body, res, _user) {
  const { project, stateProgram, countyData, ixQueue, runway } = body
  if (!project) return res.status(400).json({ error: 'project required' })

  // Cache check (24h TTL, keyed on project + stage + data version).
  // The kit's bracketed-placeholder design means there's nothing user-
  // specific in the output, so cross-user sharing is safe and intended.
  const outreachKey = buildCacheKey('utility-outreach', {
    projectId:   project.id || null,
    stage:       project.stage || null,
    technology:  project.technology || null,
    mw:          Math.round((parseFloat(project.mw) || 0) * 10) / 10,
    dataVersion: dataVersionFor(stateProgram),
  })
  if (project.id) {
    const cachedKit = await cacheGet(outreachKey)
    if (cachedKit) {
      return res.status(200).json({ kit: cachedKit, cached: true })
    }
  }

  // Reuse buildContext so the model sees the same data panel as the verdict
  // and Deal Memo flows -- consistency across artifacts is part of the
  // perceived quality.
  const contextBody = {
    state:      project.state,
    county:     project.county,
    mw:         project.mw,
    stage:      project.stage,
    technology: project.technology,
    stateProgram, countyData, runway, ixQueue,
  }
  const contextText = buildContext(contextBody)

  // Internal abort 50s gives a 10s buffer under the 60s platform timeout
  // (configured in vercel.json under functions["api/lens-insight.js"]).
  // If Sonnet legitimately exceeds 50s, we return a JSON fallback rather
  // than letting the platform serve its default HTML error page (which
  // would break res.json() on the client).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 50000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        // 1,800 fits the full schema with comfortable headroom (full kit
        // serializes to ~900 tokens at the 260-word email ceiling).
        // Lower than 2,400 keeps p95 latency under the 50s abort.
        max_tokens: 1800,
        system: UTILITY_OUTREACH_PROMPT,
        messages: [{ role: 'user', content: contextText }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    const raw = message.content?.[0]?.text || ''
    // Two-tier parse: strict, then prose-extracted. The schema is bigger than
    // the verdict's so a fenced or trailing-text response is a real risk.
    let parsed = null
    try { parsed = JSON.parse(raw.trim()) } catch (_) {}
    if (!parsed) {
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch (_) {}
    }

    if (!parsed?.email?.body) {
      return res.status(200).json({ kit: null, fallback: true, reason: 'parse_failed' })
    }

    if (project.id) cacheSet(outreachKey, 'utility-outreach', parsed, 24 * 60 * 60)

    return res.status(200).json({ kit: parsed })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:utility-outreach] error:', err.message)
    return res.status(200).json({ kit: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
