/**
 * Policy-event auto-scan scraper — migrated from top-level api/scan-policy-
 * candidates.js to stay under Vercel Hobby's 12-function-per-deployment cap.
 * Now dispatched as a "source" of api/refresh-data.js (?source=policy_scan).
 *
 * Pulls high-relevance, recent news_feed items and asks Haiku whether each
 * describes an ENACTED state-level policy worth tracking. Confirmed
 * candidates land as drafts in policy_impact_events with
 * review_status='pending_admin_review', discovered_via='news_ai_suggest'.
 * Admin reviews them via /admin → Policy Impact tab's pending filter.
 *
 * De-dupe: skips news_feed items whose id already appears in a
 * policy_impact_events.discovery_metadata.news_feed_id — each news item
 * generates at most one draft over its lifetime.
 *
 * Cadence: weekly via Vercel cron (vercel.json — "0 9 * * 1", Mon 09:00
 * UTC, two hours after the Sunday news refresh so fresh news is available).
 *
 * Cost: caps at MAX_CANDIDATES candidates per run × ~$0.01 Haiku =
 * pennies per week. Hard cap protects against runaway costs if news_feed
 * suddenly returns hundreds of policy alerts.
 */
import { supabaseAdmin } from './_scraperBase.js'
import handlePolicyClassify from '../handlers/_lens-policy-classify.js'

const MAX_CANDIDATES         = 12   // hard cap per run; protects against cost runaway
const NEWS_LOOKBACK_DAYS     = 14   // only consider news items seen in this window
const MIN_RELEVANCE_SCORE    = 80   // policy-alerts only at the top end of the news classifier
const ENACTED_BILL_KEYWORDS  = [
  'signed into law', 'signs into law', 'enacted', 'passes', 'passed',
  'puc orders', 'commission orders', 'commission approves',
  'rule finalized', 'final rule', 'tariff approved', 'effective',
]

export default async function refreshPolicyScan() {
  const t0 = Date.now()

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
    return { ok: false, error: `news_feed read failed: ${newsErr.message}` }
  }

  if (!candidates || candidates.length === 0) {
    return { ok: true, news_scanned: 0, drafts_created: 0, note: 'no candidates in window' }
  }

  const candidateIds = candidates.map(c => c.id)
  const { data: existingDrafts } = await supabaseAdmin
    .from('policy_impact_events')
    .select('discovery_metadata')
    .in('discovery_metadata->>news_feed_id', candidateIds)
  const alreadyDiscovered = new Set(
    (existingDrafts || []).map(r => r.discovery_metadata?.news_feed_id).filter(Boolean)
  )
  const novel = candidates.filter(c => !alreadyDiscovered.has(c.id))

  // Keyword pre-filter — only consider items whose headline/summary hints at
  // an ENACTED policy. Filters out "considering", "proposed", "filed for
  // comment" etc. so we don't waste Haiku calls on speculation.
  const enacted = novel.filter(c => {
    const blob = `${c.headline} ${c.summary || ''}`.toLowerCase()
    return ENACTED_BILL_KEYWORDS.some(kw => blob.includes(kw))
  }).slice(0, MAX_CANDIDATES)

  let draftsCreated = 0
  let aiErrors      = 0
  let skipped       = 0
  const samples     = []

  for (const item of enacted) {
    const rawText = [
      item.url,
      `Headline: ${item.headline}`,
      item.summary && `Summary: ${item.summary}`,
      item.source && `Source: ${item.source}`,
      item.published_at && `Published: ${item.published_at}`,
      item.state_ids?.length && `State(s) implicated: ${item.state_ids.join(', ')}`,
    ].filter(Boolean).join('\n\n')

    const stateHint = (item.state_ids?.length === 1) ? item.state_ids[0] : null

    // Reuse the admin quick-add classifier via a mini res shim so we get
    // the JSON back without serving an HTTP response.
    let draftResp = null
    const shim = {
      status: (_code) => ({
        json: (body) => { draftResp = body; return shim }
      })
    }
    try {
      await handlePolicyClassify({ rawText, stateHint }, shim)
    } catch {
      aiErrors++
      continue
    }

    if (!draftResp?.draft || draftResp.fallback) { aiErrors++; continue }
    const draft = draftResp.draft

    if (!draft.state || !draft.event_name) { skipped++; continue }

    const insertPayload = {
      state:                          draft.state.toUpperCase(),
      event_name:                     draft.event_name,
      event_type:                     draft.event_type || 'enacted_bill',
      effective_date:                 draft.effective_date || null,
      status:                         draft.status || 'enacted',
      pillar:                         draft.pillar || 'cross-cutting',
      // Impact dollar / IRR fields stay null — the classifier handler
      // already enforces this; explicit-zero defense in depth.
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
    if (samples.length < 3) {
      samples.push({ state: insertPayload.state, event_name: insertPayload.event_name, headline: item.headline })
    }
  }

  return {
    ok:               true,
    news_scanned:     candidates.length,
    already_known:    alreadyDiscovered.size,
    enacted_filtered: enacted.length,
    drafts_created:   draftsCreated,
    skipped,
    ai_errors:        aiErrors,
    sample_drafts:    samples,
    duration_ms:      Date.now() - t0,
  }
}
