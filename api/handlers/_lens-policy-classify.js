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
import { expandIfUrl } from '../lib/_urlFetch.js'

// ─────────────────────────────────────────────────────────────────────────────
// Tool schema — forces Haiku to emit structured output. Prompt-only
// extraction is unreliable: Haiku reads "$2.80/kW AC monthly" in source text
// but won't put 33.60 in annual_fee_per_kw_yr unless the API contract
// REQUIRES it. Tool use makes the required fields a hard constraint —
// the model can't return without populating them.
// ─────────────────────────────────────────────────────────────────────────────
const CLASSIFY_TOOL = {
  name: 'submit_policy_classification',
  description: 'Submit the classified policy event with all extracted fields. raw_provisions is required — extract every dollar amount, percentage, and fee figure that appears verbatim in the source text. Use null only when the source does not state the value.',
  input_schema: {
    type: 'object',
    properties: {
      state:           { type: 'string',   description: '2-letter US state code (uppercase). Empty string if not determinable.' },
      event_name:      { type: 'string',   description: 'e.g. "LD 1777", "VDER Tranche 6"' },
      event_type:      { type: 'string',   enum: ['enacted_bill', 'puc_order', 'tariff_change', 'rule_filing', 'executive_order'] },
      effective_date:  { type: ['string', 'null'], description: 'ISO YYYY-MM-DD. Null if not stated verbatim in source.' },
      status:          { type: 'string',   enum: ['pending', 'enacted', 'partially_effective', 'overturned', 'expired'] },
      pillar:          { type: 'string',   enum: ['offtake', 'ix', 'site', 'cross-cutting'] },

      // ── REQUIRED structured raw provisions — extract verbatim numbers ────
      raw_provisions: {
        type: 'object',
        description: 'Numeric provisions extracted verbatim from source. Use null only when the value is not stated in the source. ALWAYS convert monthly fees to annual: $X/kW/month → $(X*12)/kW/yr.',
        properties: {
          rate_cut_pct: {
            type: ['number', 'null'],
            description: 'Percent cut to compensation rate (NEB tariff, bill credit, REC value). Positive = cut. E.g., "reduces NEB by 30%" → 30.',
          },
          one_time_fee_per_kw: {
            type: ['number', 'null'],
            description: '$/kW one-time fee on new projects. E.g., "$200/kW grid-impact fee" → 200.',
          },
          annual_fee_per_kw_yr: {
            type: ['number', 'null'],
            description: '$/kW/yr recurring fee. CONVERT MONTHLY TO ANNUAL. "$2.80/kW/month" → 33.60 (= 2.80 × 12). "$10/kW/yr" → 10.',
          },
          retroactive_one_time_fee_per_kw: {
            type: ['number', 'null'],
            description: '$/kW one-time fee on EXISTING / operating projects only (not new applications). Used when the bill levies a one-time charge on already-built plants.',
          },
        },
        required: ['rate_cut_pct', 'one_time_fee_per_kw', 'annual_fee_per_kw_yr', 'retroactive_one_time_fee_per_kw'],
      },

      // Applicability
      applies_to_new_applications:    { type: 'boolean' },
      applies_to_existing_queue:      { type: 'boolean' },
      applies_to_operating_projects:  { type: 'boolean' },
      // Safe harbor — critical for advising whether THIS project is in/out
      safe_harbor_eligible:           { type: 'boolean' },
      safe_harbor_cutoff_date:        { type: ['string', 'null'], description: 'ISO YYYY-MM-DD' },
      safe_harbor_notes:              { type: ['string', 'null'], description: '1-2 sentences naming the gate (COD / IS / spend / other)' },
      // FEOC
      feoc_compliance_required:       { type: 'boolean' },
      feoc_notes:                     { type: ['string', 'null'] },
      // Sourcing
      summary:                        { type: 'string',           description: '1-2 sentence why-developers-care, Tractova analyst voice' },
      analyst_note:                   { type: ['string', 'null'], description: '3-5 sentence longer rationale + caveats. Mention any tier structure or thresholds.' },
      source_url:                     { type: 'string',           description: 'URL of the source if present in input; else empty string' },
    },
    required: [
      'state', 'event_name', 'event_type', 'status', 'pillar',
      'raw_provisions',
      'applies_to_new_applications', 'applies_to_existing_queue', 'applies_to_operating_projects',
      'safe_harbor_eligible', 'feoc_compliance_required',
      'summary', 'source_url',
    ],
  },
}

// Derive impact_confidence from extraction completeness. The handler picks
// this — not the model — because confidence should reflect what was actually
// extracted, not the model's subjective sense of certainty.
function computeImpactConfidence(rawProvisions) {
  if (!rawProvisions) return 'low'
  const populated = ['rate_cut_pct', 'one_time_fee_per_kw', 'annual_fee_per_kw_yr', 'retroactive_one_time_fee_per_kw']
    .filter(f => rawProvisions[f] != null).length
  if (populated >= 2) return 'high'
  if (populated === 1) return 'medium'
  return 'low'
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
  //   v=4: URL fetcher in place — cache key now keyed on EXPANDED text.
  //   v=5: Switched to Anthropic tool use for structured output. Prompt-only
  //        extraction was unreliable; Haiku read the numbers in source but
  //        wouldn't populate raw_provisions JSON. Tool's required schema
  //        forces the model to emit structured fields.
  const classifyKey = buildCacheKey('policy-classify', {
    v:     5,
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
        model:       'claude-haiku-4-5-20251001',
        max_tokens:  2000,
        system:      POLICY_CLASSIFY_PROMPT,
        tools:       [CLASSIFY_TOOL],
        tool_choice: { type: 'tool', name: 'submit_policy_classification' },
        messages:    [{ role: 'user', content: userContent }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    // Extract from the tool_use content block. With tool_choice forced,
    // Haiku is guaranteed to emit a tool_use block instead of text. The
    // input field is already a parsed object — no JSON parsing needed.
    const toolBlock = message.content?.find(b => b?.type === 'tool_use')
    if (!toolBlock?.input || typeof toolBlock.input !== 'object') {
      return res.status(200).json({
        draft:    null,
        fallback: true,
        reason:   'tool_use_missing — model returned text instead of tool call',
      })
    }
    const parsed = { ...toolBlock.input }

    // Force the four DERIVED impact fields to null — handler computes them.
    for (const f of ['capex_impact_per_mw_usd', 'irr_impact_bps', 'ongoing_fee_per_mw_yr_usd', 'revenue_haircut_pct']) {
      parsed[f] = null
    }

    // Normalize empty-string dates to null (some browser date inputs
    // misparse '' as today's date).
    for (const f of ['effective_date', 'safe_harbor_cutoff_date']) {
      if (parsed[f] === '') parsed[f] = null
    }

    // ── Derive impact from extracted raw_provisions + state baselines ────
    const rawProvisions = parsed.raw_provisions || {}
    const stateForDerive = (parsed.state || stateHint || '').toUpperCase()
    if (stateForDerive) {
      const derived = await deriveImpact(rawProvisions, stateForDerive)
      Object.assign(parsed, derived.impacts)
      const aiNote = parsed.impact_methodology ? `${parsed.impact_methodology}\n\n— Derived: ` : '— Derived: '
      parsed.impact_methodology = aiNote + derived.methodology
      parsed.discovery_metadata = {
        ...(parsed.discovery_metadata || {}),
        raw_provisions: rawProvisions,
        baselines_used: derived.baselines,
      }
    }

    // Derive confidence from extraction completeness (not from the model's
    // self-assessment). 2+ provisions = high, 1 = medium, 0 = low.
    parsed.impact_confidence = computeImpactConfidence(rawProvisions)

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
