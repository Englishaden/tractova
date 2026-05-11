/**
 * Policy Impact Classifier — admin-side AI assist for policy_impact_events.
 * Action: 'policy-classify'
 *
 * Takes raw bill / article text, returns a JSON draft of the structured
 * fields for the policy_impact_events form to pre-fill. Critically: the
 * model is instructed to leave dollar / IRR fields null — those are
 * admin-curated only (honest-data-freshness tenet).
 *
 * Auth: Pro / admin via the parent lens-insight.js gate (line 250). The
 * orchestrator already verifies the JWT + subscription tier before
 * dispatching here, so no separate auth check needed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { POLICY_CLASSIFY_PROMPT } from '../prompts/policy-classify.js'
import { buildCacheKey, cacheGet, cacheSet } from '../lib/_aiCacheLayer.js'

export default async function handlePolicyClassify(body, res) {
  const { rawText, stateHint, eventNameHint } = body
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 60) {
    return res.status(400).json({
      error:  'rawText required (paste at least 60 characters of bill / article content)',
      reason: 'missing_text',
    })
  }

  // Cache 24h. Bump `v` whenever the system prompt changes materially so
  // existing cached drafts get re-fired against the new prompt.
  //   v=1: initial — explicit no-AI-dollars rule + safe-harbor + FEOC fields
  const classifyKey = buildCacheKey('policy-classify', {
    v:     1,
    text:  rawText.trim(),
    state: (stateHint || '').toUpperCase(),
    name:  eventNameHint || '',
  })
  const cached = await cacheGet(classifyKey)
  if (cached) {
    return res.status(200).json({ draft: cached, cached: true })
  }

  // Cap input at 12K chars — bill text excerpts run longer than docket pages
  // but anything past 12K is noise (table of contents, fiscal notes, etc.).
  // Admin should paste the substantive sections, not the whole PDF.
  const trimmed = rawText.trim().slice(0, 12000)

  // Optional priming line — if the admin pre-filled a state or event name
  // in the form, we prepend it as a hint so the model doesn't have to
  // re-derive what's already known.
  const userContent = [
    stateHint     && `Hint: state = ${stateHint.toUpperCase()}`,
    eventNameHint && `Hint: event_name = ${eventNameHint}`,
    trimmed,
  ].filter(Boolean).join('\n\n')

  // Timeout: 30s. Haiku typically returns in 3-6s for this prompt; tail
  // latency rarely exceeds 12s but we leave headroom inside the 60s
  // function ceiling for parse + cache write.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system:     POLICY_CLASSIFY_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    const raw = message.content?.[0]?.text || ''
    let parsed = null
    // Tier 1: strict
    try { parsed = JSON.parse(raw.trim()) } catch (_) {}
    // Tier 2: extract from prose-wrapped output
    if (!parsed) {
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch (_) {}
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(200).json({ draft: null, fallback: true, reason: 'parse_failed' })
    }

    // Defense in depth: force the four impact-number fields to null even
    // if the model ignored the prompt's "leave these null" instruction.
    // Honest-data-freshness tenet — never silently surface AI-estimated
    // dollar figures as Tractova-curated impact.
    for (const f of ['capex_impact_per_mw_usd', 'irr_impact_bps', 'ongoing_fee_per_mw_yr_usd', 'revenue_haircut_pct']) {
      parsed[f] = null
    }

    // Normalize empty-string dates to null (date inputs misparse '' in
    // some browsers). Same defensive pattern classify-docket uses.
    for (const f of ['effective_date', 'safe_harbor_cutoff_date']) {
      if (parsed[f] === '') parsed[f] = null
    }

    // Drafts from this path always land in the admin review queue.
    parsed.review_status  = 'pending_admin_review'
    parsed.discovered_via = 'manual'  // admin paste counts as manual discovery; cron path stamps news_ai_suggest

    cacheSet(classifyKey, 'policy-classify', parsed, 24 * 60 * 60)
    return res.status(200).json({ draft: parsed })

  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:policy-classify] error:', err.message)
    return res.status(200).json({
      draft:    null,
      fallback: true,
      reason:   `api_error: ${String(err.message || err).slice(0, 120)}`,
    })
  }
}
