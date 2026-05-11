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
import { buildCacheKey, cacheGet, cacheSet, supabaseAdmin } from '../lib/_aiCacheLayer.js'

// ─────────────────────────────────────────────────────────────────────────────
// URL fetcher — if the admin pastes a URL (alone or as the first token of
// the input), fetch the page server-side and use its text content. Avoids
// the admin copy-pasting article body manually.
//
// Cautious by design: 15s timeout, 200KB raw cap, basic HTML strip, no
// JS-rendered content (most state legislatures + trade press serve static
// HTML so this works for ~90% of sources). Returns null on fetch failure;
// caller falls back to using the input as literal text.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAndExtractUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Tractova/1.0 (policy-classifier; +https://tractova.com)',
        'Accept':     'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!resp.ok) return { ok: false, status: resp.status, text: null }
    // Read up to 200KB raw — most articles are 30-60KB, bill text PDFs are
    // larger but we can't usefully parse those anyway without a PDF lib.
    const reader = resp.body?.getReader?.()
    let html = ''
    if (reader) {
      let total = 0
      while (total < 200_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += new TextDecoder().decode(value)
        total += value.length
      }
      reader.cancel().catch(() => {})
    } else {
      html = await resp.text()
    }
    return { ok: true, status: resp.status, text: stripHtml(html).slice(0, 24000) }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, status: null, text: null, error: err?.message || String(err) }
  }
}

// Strip script/style/nav/header/footer, then all remaining tags, decode
// entities, collapse whitespace. Conservative — keeps article body content
// without trying to be smart about <article> vs <div>.
function stripHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  return text.replace(/\s+/g, ' ').trim()
}

// If the input starts with a URL (with or without other text after), fetch
// the URL and use the extracted page text + any trailing text from the user.
// If fetch fails, fall through to treating the original input as literal text.
async function expandIfUrl(text) {
  const trimmed = text.trim()
  const urlMatch = trimmed.match(/^(https?:\/\/[^\s]+)(?:\s|$)/i)
  if (!urlMatch) return { text: trimmed, fetched: false }
  const url = urlMatch[1]
  const remainder = trimmed.slice(urlMatch[0].length).trim()
  const fetched = await fetchAndExtractUrl(url)
  if (!fetched.ok || !fetched.text || fetched.text.length < 100) {
    return { text: trimmed, fetched: false, fetchError: fetched.error || `HTTP ${fetched.status}` }
  }
  // Compose: source URL header + fetched body + any admin notes appended after.
  const composed = [
    `Source URL: ${url}`,
    fetched.text,
    remainder && `\nAdmin notes appended:\n${remainder}`,
  ].filter(Boolean).join('\n\n')
  return { text: composed, fetched: true, fetchedFrom: url, fetchedBytes: fetched.text.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive per-MW impact from raw provisions + state baseline data.
//
// Reads revenue_rates for the state (bill_credit_cents_kwh, rec_per_mwh,
// capacity_factor_pct, installed_cost_per_watt) and translates the AI-
// extracted raw provisions into the four impact fields the Lens prompt
// consumes. All math is transparent — admin can read the methodology
// string and verify against the source.
//
// IRR-bps is approximated via solar industry rules of thumb:
//   - 1% revenue cut ≈ -18 bps equity IRR (typical CS deal levered)
//   - $100K/MW capex add ≈ -50 bps IRR drag (against $2.7M/MW baseline)
//   - $1K/MW/yr ongoing fee ≈ NPV-equivalent revenue haircut
//
// Methodology field documents every step so this is verifiable, not opaque.
async function deriveImpact(rawProvisions, state) {
  if (!rawProvisions || typeof rawProvisions !== 'object') {
    return { impacts: {}, methodology: 'No raw_provisions extracted from source; impact not derivable.', baselines: null }
  }
  const hasAny =
    rawProvisions.rate_cut_pct != null ||
    rawProvisions.one_time_fee_per_kw != null ||
    rawProvisions.annual_fee_per_kw_yr != null ||
    rawProvisions.retroactive_one_time_fee_per_kw != null
  if (!hasAny) {
    return {
      impacts: {},
      methodology: 'Source contained no quantifiable provisions (rate cuts, fees, etc.). Paste the bill text itself or a more detailed summary for derived impact.',
      baselines: null,
    }
  }

  // Baseline: revenue_rates row for the state. Falls back to "unknown
  // baseline" if not present (rare — table covers all 50 states).
  const { data: rates } = await supabaseAdmin
    .from('revenue_rates')
    .select('bill_credit_cents_kwh, rec_per_mwh, capacity_factor_pct, installed_cost_per_watt')
    .eq('state_id', state)
    .maybeSingle()
  if (!rates) {
    return {
      impacts: {},
      methodology: `No revenue_rates baseline for ${state}; impact not derivable. Add the state to revenue_rates first.`,
      baselines: null,
    }
  }

  const baselineRevPerMwh = (rates.bill_credit_cents_kwh || 0) * 10 + (rates.rec_per_mwh || 0)
  const annualMwhPerMw    = (rates.capacity_factor_pct / 100) * 8760
  const baselineRevPerMwYr = baselineRevPerMwh * annualMwhPerMw
  const baselineCapexPerMw = (rates.installed_cost_per_watt || 0) * 1_000_000

  const impacts = {}
  const steps = []
  let irrBps = 0

  if (rawProvisions.rate_cut_pct != null) {
    const cut = Math.abs(Number(rawProvisions.rate_cut_pct))
    impacts.revenue_haircut_pct = cut  // stored as positive number; sign convention is "% reduction"
    const dollarLoss = baselineRevPerMwYr * cut / 100
    steps.push(`Revenue haircut: ${cut}% rate cut → on baseline $${baselineRevPerMwh.toFixed(0)}/MWh × ${annualMwhPerMw.toFixed(0)} MWh/MW/yr = $${dollarLoss.toLocaleString()}/MW/yr revenue loss.`)
    irrBps -= cut * 18  // ~18 bps per 1% revenue cut (solar deal rule of thumb)
  }

  if (rawProvisions.one_time_fee_per_kw != null) {
    const feePerMw = Number(rawProvisions.one_time_fee_per_kw) * 1000
    impacts.capex_impact_per_mw_usd = feePerMw
    steps.push(`Capex impact: $${rawProvisions.one_time_fee_per_kw}/kW one-time × 1000 kW/MW = +$${feePerMw.toLocaleString()}/MW added to capex.`)
    if (baselineCapexPerMw > 0) {
      irrBps -= (feePerMw / 100_000) * 50  // ~50 bps per $100K/MW capex add
    }
  }

  if (rawProvisions.annual_fee_per_kw_yr != null) {
    const feePerMwYr = Number(rawProvisions.annual_fee_per_kw_yr) * 1000
    impacts.ongoing_fee_per_mw_yr_usd = feePerMwYr
    steps.push(`Ongoing fee: $${rawProvisions.annual_fee_per_kw_yr}/kW/yr × 1000 kW/MW = $${feePerMwYr.toLocaleString()}/MW/yr ongoing.`)
    if (baselineRevPerMwYr > 0) {
      const equivPct = feePerMwYr / baselineRevPerMwYr * 100
      irrBps -= equivPct * 18  // recurring fee ≈ revenue haircut equivalent
    }
  }

  if (rawProvisions.retroactive_one_time_fee_per_kw != null) {
    // Stored separately in methodology — it hits existing queue / operating
    // projects, not new applications. The applies_to_existing_queue flag
    // surfaces this to the Lens prompt; methodology spells out the $$$.
    const retroPerMw = Number(rawProvisions.retroactive_one_time_fee_per_kw) * 1000
    steps.push(`Retroactive fee on existing queue: $${rawProvisions.retroactive_one_time_fee_per_kw}/kW × 1000 kW/MW = +$${retroPerMw.toLocaleString()}/MW. Applies to existing-queue + operating projects only.`)
  }

  if (irrBps !== 0) {
    impacts.irr_impact_bps = Math.round(irrBps)
    steps.push(`IRR impact (approximation): ${impacts.irr_impact_bps} bps. Rule-of-thumb: 1% revenue cut ≈ −18 bps, $100K/MW capex add ≈ −50 bps. Exact requires Scenario Studio sensitivity run.`)
  }

  return {
    impacts,
    methodology: steps.join(' ') + ` Baselines: ${state} bill credit $${baselineRevPerMwh.toFixed(0)}/MWh, ${rates.capacity_factor_pct}% CF (${Math.round(annualMwhPerMw)} MWh/MW/yr), $${(rates.installed_cost_per_watt).toFixed(2)}/W installed.`,
    baselines: {
      state,
      revenue_per_mwh: Math.round(baselineRevPerMwh),
      annual_mwh_per_mw: Math.round(annualMwhPerMw),
      installed_cost_per_watt: rates.installed_cost_per_watt,
      capacity_factor_pct: rates.capacity_factor_pct,
    },
  }
}

export default async function handlePolicyClassify(body, res) {
  const { rawText, stateHint, eventNameHint } = body
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 5) {
    return res.status(400).json({
      error:  'rawText required (paste a URL OR at least 60 characters of bill / article content)',
      reason: 'missing_text',
    })
  }

  // Auto-expand URLs to page text. Admin can paste either a URL alone or
  // raw article text — both flow through the same path. URL fetch fallback
  // lands the admin back at "fetch failed; paste the text instead" so they
  // know to copy-paste manually.
  const expanded = await expandIfUrl(rawText)
  let usableText = expanded.text
  if (!expanded.fetched && /^https?:\/\//i.test(rawText.trim()) && usableText.length < 60) {
    return res.status(200).json({
      draft:    null,
      fallback: true,
      reason:   `url_fetch_failed: ${expanded.fetchError || 'page returned too little content'} — paste the article text manually instead`,
    })
  }
  if (usableText.trim().length < 60) {
    return res.status(400).json({
      error:  'After URL expansion, content is too short (min 60 chars)',
      reason: 'expanded_too_short',
    })
  }

  // Cache 24h. Bump `v` whenever the system prompt changes materially so
  // existing cached drafts get re-fired against the new prompt.
  //   v=1: initial — explicit no-AI-dollars rule + safe-harbor + FEOC fields
  //   v=2: AI now extracts raw_provisions; handler derives $/MW from state
  //        baselines. Same response shape but the four impact fields are
  //        now COMPUTED, not null.
  //   v=3: stricter prompt — explicit worked example showing monthly→annual
  //        conversion + flat raw_provisions schema (citations removed).
  //        Earlier runs returned numbers in prose; this anchors structured
  //        extraction.
  //   v=4: URL fetcher in place — cache key now keyed on EXPANDED text so
  //        the same URL hits the same cache slot regardless of fetch
  //        timestamp.
  const classifyKey = buildCacheKey('policy-classify', {
    v:     4,
    text:  usableText.trim(),
    state: (stateHint || '').toUpperCase(),
    name:  eventNameHint || '',
  })
  const cached = await cacheGet(classifyKey)
  if (cached) {
    return res.status(200).json({ draft: cached, cached: true })
  }

  // Cap input at 12K chars — bill text excerpts run longer than docket pages
  // but anything past 12K is noise (table of contents, fiscal notes, etc.).
  // For URL-expanded text we still cap here — URL fetcher already limited to
  // 24K post-strip, this is the second guard.
  const trimmed = usableText.trim().slice(0, 12000)

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

    // Force the four "derived" impact fields to null before derivation
    // overwrites them with computed values. Belt-and-braces in case the
    // model ignored the prompt and populated them with hallucinations.
    for (const f of ['capex_impact_per_mw_usd', 'irr_impact_bps', 'ongoing_fee_per_mw_yr_usd', 'revenue_haircut_pct']) {
      parsed[f] = null
    }

    // Normalize empty-string dates to null (date inputs misparse '' in
    // some browsers). Same defensive pattern classify-docket uses.
    for (const f of ['effective_date', 'safe_harbor_cutoff_date']) {
      if (parsed[f] === '') parsed[f] = null
    }

    // ── Derive impact from extracted raw_provisions + state baselines ────
    // This is the meaningful work: AI extracts provisions from text, the
    // handler computes per-MW $ impact using transparent multiplication
    // against revenue_rates baselines. impact_methodology gets the full
    // chain so the admin (and the Lens prompt) can verify.
    const rawProvisions = parsed.raw_provisions || {}
    const stateForDerive = (parsed.state || stateHint || '').toUpperCase()
    if (stateForDerive) {
      const derived = await deriveImpact(rawProvisions, stateForDerive)
      Object.assign(parsed, derived.impacts)
      // Append the derivation chain to any AI-written methodology so we
      // preserve the analyst's research lead + the computed proof.
      const aiNote = parsed.impact_methodology ? `${parsed.impact_methodology}\n\n— Derived: ` : '— Derived: '
      parsed.impact_methodology = aiNote + derived.methodology
      // Stash baselines + raw_provisions in discovery_metadata for the
      // admin UI to surface (and for any future re-derivation when
      // baselines change).
      parsed.discovery_metadata = {
        ...(parsed.discovery_metadata || {}),
        raw_provisions: rawProvisions,
        baselines_used: derived.baselines,
      }
    }

    // Drafts from this path always land in the admin review queue.
    parsed.review_status  = 'pending_admin_review'
    parsed.discovered_via = parsed.discovered_via || 'manual'

    cacheSet(classifyKey, 'policy-classify', parsed, 24 * 60 * 60)
    return res.status(200).json({
      draft:        parsed,
      fetchedUrl:   expanded.fetched ? expanded.fetchedFrom : null,
      fetchedBytes: expanded.fetched ? expanded.fetchedBytes : null,
    })

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
