/**
 * Weekly scan: news_feed → policy_impact_events draft candidates.
 *
 * Pulls high-relevance, recent news_feed items and asks Haiku whether each
 * describes an ENACTED state-level policy worth tracking. Confirmed
 * candidates land as drafts in policy_impact_events with
 * review_status='pending_admin_review', discovered_via='news_ai_suggest'.
 * Admin reviews them via /admin → Policy Impact tab's pending filter.
 *
 * Cadence: weekly via Vercel cron (vercel.json — "0 8 * * 1", Mon 08:00
 * UTC, one hour after the Sunday news refresh so fresh news is available).
 *
 * Auth: same shape as api/refresh-data.js — Vercel cron header OR
 * CRON_SECRET bearer OR admin JWT for manual ops triggers.
 *
 * Cost: caps at MAX_CANDIDATES candidates per run × ~$0.01 Haiku =
 * pennies per week. Hard cap protects against runaway costs if news_feed
 * suddenly returns hundreds of policy alerts.
 *
 * De-dupe: skips news_feed items whose id already appears in a
 * policy_impact_events.discovery_metadata.news_feed_id — each news item
 * generates at most one draft over its lifetime.
 */
import { isAdminFromBearer } from './_admin-auth.js'
import { applyCors } from './_cors.js'
import { axiomLog } from './lib/_axiomLog.js'
import { supabaseAdmin, logCronRun } from './scrapers/_scraperBase.js'
import handlePolicyClassify from './handlers/_lens-policy-classify.js'

const MAX_CANDIDATES         = 12   // hard cap per run; protects against cost runaway
const NEWS_LOOKBACK_DAYS     = 14   // only consider news items seen in this window
const MIN_RELEVANCE_SCORE    = 80   // policy-alerts only at the top end of the news classifier
const ENACTED_BILL_KEYWORDS  = [
  'signed into law', 'signs into law', 'enacted', 'passes', 'passed',
  'puc orders', 'commission orders', 'commission approves',
  'rule finalized', 'final rule', 'tariff approved', 'effective',
]

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // ── Auth (mirrors api/refresh-data.js pattern) ──────────────────────────
  const authHeader = req.headers.authorization
  let isAuthed = false
  let authMode = ''
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
      isAuthed = true; authMode = 'cron-secret'
    } else {
      const adminCheck = await isAdminFromBearer(supabaseAdmin, authHeader)
      if (adminCheck.ok) { isAuthed = true; authMode = adminCheck._legacyFallback ? 'admin-legacy-email' : 'admin' }
    }
  }
  if (!isAuthed && req.headers['x-vercel-cron']) { isAuthed = true; authMode = 'vercel-cron' }
  if (!isAuthed) return res.status(401).json({ error: 'Unauthorized' })

  const startedAt = new Date()
  const t0 = Date.now()

  // ── 1. Pull recent high-relevance policy-alert news items ───────────────
  const sinceISO = new Date(Date.now() - NEWS_LOOKBACK_DAYS * 86_400_000).toISOString()
  const { data: candidates, error: newsErr } = await supabaseAdmin
    .from('news_feed')
    .select('id, headline, summary, url, published_at, state_ids, tags, source, relevance_score, type')
    .gte('last_seen_at', sinceISO)
    .gte('relevance_score', MIN_RELEVANCE_SCORE)
    .eq('type', 'policy-alert')
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })
    .limit(MAX_CANDIDATES * 3) // overshoot — most get filtered by dedupe / keyword check

  if (newsErr) {
    await logCronRun('policy-scan', { ok: false, error: `news_feed read failed: ${newsErr.message}` }, authMode, startedAt)
    return res.status(500).json({ error: 'news_feed read failed', detail: newsErr.message })
  }

  if (!candidates || candidates.length === 0) {
    await logCronRun('policy-scan', { ok: true, news_scanned: 0, drafts_created: 0, note: 'no candidates in window' }, authMode, startedAt)
    return res.status(200).json({ ok: true, news_scanned: 0, drafts_created: 0 })
  }

  // ── 2. De-dupe against existing drafts ──────────────────────────────────
  // Skip news items whose id is already in policy_impact_events.discovery_metadata.news_feed_id.
  // Each news item generates at most one draft over its lifetime regardless
  // of review_status (so rejected drafts don't get re-proposed).
  const candidateIds = candidates.map(c => c.id)
  const { data: existingDrafts } = await supabaseAdmin
    .from('policy_impact_events')
    .select('discovery_metadata')
    .in('discovery_metadata->>news_feed_id', candidateIds)
  const alreadyDiscovered = new Set(
    (existingDrafts || []).map(r => r.discovery_metadata?.news_feed_id).filter(Boolean)
  )
  const novel = candidates.filter(c => !alreadyDiscovered.has(c.id))

  // ── 3. Keyword pre-filter — only consider items whose headline/summary
  // hints at an ENACTED policy. Filters out "considering", "proposed",
  // "filed for comment" etc. so we don't waste Haiku calls on speculation.
  const enacted = novel.filter(c => {
    const blob = `${c.headline} ${c.summary || ''}`.toLowerCase()
    return ENACTED_BILL_KEYWORDS.some(kw => blob.includes(kw))
  }).slice(0, MAX_CANDIDATES)

  // ── 4. Classify each via Haiku ──────────────────────────────────────────
  let draftsCreated = 0
  let aiErrors      = 0
  let skipped       = 0
  const samples     = []

  for (const item of enacted) {
    // Build a "rawText" the policy-classify handler expects. Use the
    // headline + summary + source URL; the handler caps at 12K chars.
    const rawText = [
      item.url,
      `Headline: ${item.headline}`,
      item.summary && `Summary: ${item.summary}`,
      item.source && `Source: ${item.source}`,
      item.published_at && `Published: ${item.published_at}`,
      item.state_ids?.length && `State(s) implicated: ${item.state_ids.join(', ')}`,
    ].filter(Boolean).join('\n\n')

    const stateHint = (item.state_ids?.length === 1) ? item.state_ids[0] : null

    // Call the same handler the admin quick-add uses. We invoke it with a
    // mini res shim so we get the JSON back without serving an HTTP response.
    let draftResp = null
    const shim = {
      status: (_code) => ({
        json: (body) => { draftResp = body; return shim }
      })
    }
    try {
      await handlePolicyClassify({ rawText, stateHint }, shim)
    } catch (err) {
      aiErrors++
      continue
    }

    if (!draftResp?.draft || draftResp.fallback) { aiErrors++; continue }
    const draft = draftResp.draft

    // Validate: must have state + event_name to be worth staging.
    if (!draft.state || !draft.event_name) { skipped++; continue }

    // Insert as pending_admin_review draft. Service-role bypasses RLS so we
    // can write even though review_status is not 'published'.
    const insertPayload = {
      state:                          draft.state.toUpperCase(),
      event_name:                     draft.event_name,
      event_type:                     draft.event_type || 'enacted_bill',
      effective_date:                 draft.effective_date || null,
      status:                         draft.status || 'enacted',
      pillar:                         draft.pillar || 'cross-cutting',
      // The four impact fields stay null — the handler already enforces this,
      // but explicit-zero defense in depth.
      capex_impact_per_mw_usd:        null,
      irr_impact_bps:                 null,
      ongoing_fee_per_mw_yr_usd:      null,
      revenue_haircut_pct:            null,
      impact_confidence:              draft.impact_confidence || 'medium',
      impact_methodology:             draft.impact_methodology || null,
      applies_to_new_applications:    !!draft.applies_to_new_applications,
      applies_to_existing_queue:      !!draft.applies_to_existing_queue,
      applies_to_operating_projects:  !!draft.applies_to_operating_projects,
      safe_harbor_eligible:           !!draft.safe_harbor_eligible,
      safe_harbor_cutoff_date:        draft.safe_harbor_cutoff_date || null,
      safe_harbor_notes:              draft.safe_harbor_notes || null,
      feoc_compliance_required:       !!draft.feoc_compliance_required,
      feoc_notes:                     draft.feoc_notes || null,
      summary:                        draft.summary || item.headline,
      analyst_note:                   draft.analyst_note || null,
      source_url:                     draft.source_url || item.url,
      discovered_via:                 'news_ai_suggest',
      discovery_metadata:             { news_feed_id: item.id, headline: item.headline },
      review_status:                  'pending_admin_review',
      is_active:                      true,
    }

    const { error: insertErr } = await supabaseAdmin
      .from('policy_impact_events')
      .insert(insertPayload)
    if (insertErr) {
      console.warn('[policy-scan] insert failed:', insertErr.message)
      aiErrors++
      continue
    }

    draftsCreated++
    if (samples.length < 3) samples.push({ state: insertPayload.state, event_name: insertPayload.event_name, headline: item.headline })
  }

  const summary = {
    ok:               true,
    news_scanned:     candidates.length,
    already_known:    alreadyDiscovered.size,
    enacted_filtered: enacted.length,
    drafts_created:   draftsCreated,
    skipped:          skipped,
    ai_errors:        aiErrors,
    sample_drafts:    samples,
    duration_ms:      Date.now() - t0,
  }
  await logCronRun('policy-scan', summary, authMode, startedAt)

  return res.status(200).json(summary)
}
