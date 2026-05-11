/**
 * PUC Docket Classifier — admin-side AI assist for the docket tracker
 * Action: 'classify-docket'
 */
import Anthropic from '@anthropic-ai/sdk'
import { CLASSIFY_DOCKET_PROMPT } from '../prompts/classify-docket.js'
import { buildCacheKey, cacheGet, cacheSet } from '../lib/_aiCacheLayer.js'
import { expandIfUrl } from '../lib/_urlFetch.js'

export default async function handleClassifyDocket(body, res) {
  const { rawText } = body
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 5) {
    return res.status(400).json({ error: 'rawText required (paste a URL or at least 40 characters of docket page content)' })
  }

  // Auto-expand URL paste — same path as policy-classify. If admin pastes
  // a URL alone, fetch the docket page server-side and pass the text body
  // to the classifier.
  const expanded = await expandIfUrl(rawText)
  let usableText = expanded.text
  if (!expanded.fetched && /^https?:\/\//i.test(rawText.trim()) && usableText.length < 60) {
    return res.status(200).json({
      classification: null,
      fallback:       true,
      reason:         `url_fetch_failed: ${expanded.fetchError || 'page returned too little content'} — paste the docket page contents manually instead`,
    })
  }
  if (usableText.trim().length < 40) {
    return res.status(400).json({ error: 'After URL expansion, content is too short (min 40 chars)' })
  }

  // Cache check (24h TTL, keyed on hash of EXPANDED rawText + prompt version).
  //   v=1: initial prompt
  //   v=2: stricter date discipline + directive summary tone
  //   v=3: URL fetcher in place — key on expanded text so same URL hits cache
  const classifyKey = buildCacheKey('classify-docket', { v: 3, rawText: usableText.trim() })
  const cached = await cacheGet(classifyKey)
  if (cached) {
    return res.status(200).json({ classification: cached, cached: true, fetchedUrl: expanded.fetched ? expanded.fetchedFrom : null })
  }

  // Cap at 8K chars to keep input tokens bounded and stay well under the
  // 60s function timeout. PUC docket pages rarely exceed 8K chars of
  // useful content; anything more is noise (footer, nav, related links).
  const trimmed = usableText.trim().slice(0, 8000)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: CLASSIFY_DOCKET_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    const raw = message.content?.[0]?.text || ''
    let parsed = null
    try { parsed = JSON.parse(raw.trim()) } catch (_) {}
    if (!parsed) {
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch (_) {}
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(200).json({ classification: null, fallback: true, reason: 'parse_failed' })
    }

    // Normalize empty-string dates to null so the form's date inputs
    // stay clean (date inputs misparse '' as today's date in some browsers).
    for (const k of ['filed_date', 'comment_deadline', 'decision_target']) {
      if (parsed[k] === '') parsed[k] = null
    }

    cacheSet(classifyKey, 'classify-docket', parsed, 24 * 60 * 60)
    return res.status(200).json({
      classification: parsed,
      fetchedUrl:     expanded.fetched ? expanded.fetchedFrom : null,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:classify-docket] error:', err.message)
    return res.status(200).json({ classification: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
