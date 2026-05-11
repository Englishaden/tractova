import Anthropic from '@anthropic-ai/sdk'
import { applyCors } from './_cors.js'
import { buildCacheKey, cacheGet, cacheSet, dataVersionFor } from './lib/_aiCacheLayer.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'
import { axiomLog } from './lib/_axiomLog.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import handlePortfolio from './handlers/_lens-portfolio.js'
import handleCompare from './handlers/_lens-compare.js'
import handleSensitivity from './handlers/_lens-sensitivity.js'
import handleScenarioCommentary from './handlers/_lens-scenario-commentary.js'
import handleNewsSummary from './handlers/_lens-news-summary.js'
import handleDealMemo from './handlers/_lens-deal-memo.js'
import handleUtilityOutreach from './handlers/_lens-utility-outreach.js'
import handleClassifyDocket from './handlers/_lens-classify-docket.js'
import handlePolicyClassify from './handlers/_lens-policy-classify.js'
import handleMemoCreate from './handlers/_lens-memo-create.js'
import handleMemoView from './handlers/_lens-memo-view.js'

// ─────────────────────────────────────────────────────────────────────────────
// Build structured context string from project data
// ─────────────────────────────────────────────────────────────────────────────
export function buildContext({ state, county, mw, stage, technology, stateProgram, countyData, revenueStack, runway, ixQueue, policyEvents }) {
  const mwNum = parseFloat(mw) || 0
  const lines = []

  lines.push(`PROJECT: ${mwNum} MW AC ${technology} | ${county} County, ${stateProgram?.name || state} | Stage: ${stage}`)

  // ── State program ──────────────────────────────────────────────────────────
  if (stateProgram) {
    lines.push(`\nSTATE PROGRAM`)
    lines.push(`  Program name: ${stateProgram.csProgram || 'None'}`)
    lines.push(`  CS status: ${stateProgram.csStatus}`)
    lines.push(`  Capacity remaining: ${stateProgram.capacityMW > 0 ? `${stateProgram.capacityMW} MW` : 'TBD / not disclosed'}`)
    if (stateProgram.capacityMW > 0 && mwNum > 0) {
      const pct = ((mwNum / stateProgram.capacityMW) * 100).toFixed(2)
      lines.push(`  This project as % of remaining capacity: ${pct}%`)
    }
    lines.push(`  LMI required: ${stateProgram.lmiRequired ? `Yes — ${stateProgram.lmiPercent}%` : 'No'}`)
    if (stateProgram.lmiRequired && stateProgram.lmiPercent > 0 && mwNum > 0) {
      const lmiMW = mwNum * (stateProgram.lmiPercent / 100)
      const approxSubscribers = Math.round(lmiMW * 1000 / 2)
      lines.push(`  Approx LMI subscribers to source at ${stateProgram.lmiPercent}% requirement: ~${approxSubscribers.toLocaleString()} households (est. 2 kW avg subscription)`)
    }
    lines.push(`  Interconnection difficulty (state-level): ${stateProgram.ixDifficulty}`)
    if (stateProgram.ixNotes) lines.push(`  IX state notes: ${stateProgram.ixNotes}`)
    lines.push(`  STATE BASELINE feasibility composite: ${stateProgram.feasibilityScore}/100 (the market-level score, stage-agnostic and county-agnostic — what the developer sees when they hover any state on the dashboard map; this is "the market")`)
    if (stateProgram.programNotes) lines.push(`  Program notes: ${stateProgram.programNotes}`)
    if (runway) {
      lines.push(`  Program runway: ~${runway.months} months at current enrollment pace (urgency: ${runway.urgency})`)
      if (stateProgram.enrollmentRateMWPerMonth) {
        lines.push(`  Enrollment rate: ~${stateProgram.enrollmentRateMWPerMonth} MW/month`)
      }
    } else {
      lines.push(`  Program runway: enrollment pace data not available — advise developer to request current block fill rate from program administrator`)
    }
    if (stateProgram.lastUpdated) lines.push(`  Data last updated: ${stateProgram.lastUpdated}`)
  } else {
    lines.push(`\nSTATE PROGRAM: No community solar program data available for ${state}`)
  }

  // ── Site control ───────────────────────────────────────────────────────────
  const sc = countyData?.siteControl
  const geo = countyData?.geospatial
  const hasSeededIX = countyData?.interconnection?.easeScore !== null && countyData?.interconnection?.easeScore !== undefined
  lines.push(`\nSITE CONTROL — ${county} County`)
  if (geo && (geo.wetlandCoveragePct != null || geo.primeFarmlandPct != null)) {
    // LIVE geospatial path (Path B). Authoritative federal sources, all 50 states.
    lines.push(`  COVERAGE: live geospatial (NWI wetlands + SSURGO prime farmland)`)
    if (geo.primeFarmlandPct != null) {
      lines.push(`  Prime farmland: ${geo.primeFarmlandPct.toFixed(1)}% of soil-surveyed area (USDA SSURGO; >=25% → considered "available developable land")`)
    }
    if (geo.wetlandCoveragePct != null) {
      lines.push(`  Wetland coverage: ${geo.wetlandCoveragePct.toFixed(1)}% / category=${geo.wetlandCategory} (USFWS NWI; >=15% triggers wetland warning. Raw % can exceed 100% from polygon overlap — category is the cleaner signal.)`)
      lines.push(`  Wetland feature count in county: ${geo.wetlandFeatureCount?.toLocaleString() || 'n/a'}`)
    }
    // Curated qualitative notes still useful for AI context, when we have them.
    if (sc?.landNotes) lines.push(`  Land notes (curated): ${sc.landNotes}`)
    if (sc?.wetlandNotes) lines.push(`  Wetland notes (curated): ${sc.wetlandNotes}`)
    if (sc?.landUseNotes) lines.push(`  Land use / zoning (curated): ${sc.landUseNotes}`)
  } else if (sc) {
    lines.push(`  COVERAGE: curated only (live geospatial layer pending for this county)`)
    lines.push(`  Available land: ${sc.availableLand ? 'Yes' : 'No'}`)
    if (sc.landNotes) lines.push(`  Land notes: ${sc.landNotes}`)
    lines.push(`  Wetland warning: ${sc.wetlandWarning ? 'YES — significant wetland presence' : 'Low risk'}`)
    if (sc.wetlandNotes) lines.push(`  Wetland notes: ${sc.wetlandNotes}`)
    if (sc.landUseNotes) lines.push(`  Land use / zoning: ${sc.landUseNotes}`)
  } else {
    lines.push(`  Site control data: not available for this county`)
  }

  // ── Interconnection ────────────────────────────────────────────────────────
  const ix = countyData?.interconnection
  lines.push(`\nINTERCONNECTION — ${county} County${hasSeededIX ? '' : ' (ease score not seeded — IX advice is less precise; direct developer to contact utility)'}`)
  if (ix) {
    lines.push(`  Serving utility: ${ix.servingUtility || 'Unknown'}`)
    lines.push(`  Queue status: ${ix.queueStatus || 'Unknown'} (code: ${ix.queueStatusCode || 'unknown'})`)
    lines.push(`  Ease score: ${hasSeededIX ? `${ix.easeScore}/10` : 'Not available'}`)
    lines.push(`  Avg study timeline: ${ix.avgStudyTimeline || 'Not available'}`)
    if (ix.queueNotes) lines.push(`  Queue notes: ${ix.queueNotes}`)
  } else {
    lines.push(`  Interconnection data: not seeded for this county`)
  }

  // ── IX Queue Intelligence ──────────────────────────────────────────────────
  if (ixQueue) {
    lines.push(`\nIX QUEUE INTELLIGENCE — ${ixQueue.iso}`)
    lines.push(`  Total projects in queue: ${ixQueue.totalProjects}`)
    lines.push(`  Total MW pending: ${ixQueue.totalMW} MW`)
    lines.push(`  Avg study timeline: ~${ixQueue.avgStudyMonths} months`)
    lines.push(`  Avg withdrawal rate: ${ixQueue.avgWithdrawalPct}%`)
    lines.push(`  Congestion level: ${ixQueue.congestionLevel}`)
    lines.push(`  Estimated upgrade cost for this project: $${(ixQueue.estimatedUpgradeCost || 0).toLocaleString()}`)
    if (ixQueue.utilities?.length) {
      ixQueue.utilities.forEach(u => {
        lines.push(`  ${u.name}: ${u.projectsInQueue} projects / ${u.mwPending} MW pending / ~${u.avgStudyMonths}mo avg / ${u.queueTrend} trend`)
      })
    }
  }

  // ── Policy Impact Events ───────────────────────────────────────────────────
  // Enacted state bills + their admin-curated financial impact (capex/IRR/
  // ongoing fee/revenue haircut) plus applicability filters. Lens weaves
  // these into primaryRisk / immediateAction / competitiveContext naturally.
  // Admin-curated only; AI proposes drafts but never sets the dollar values.
  if (Array.isArray(policyEvents) && policyEvents.length > 0) {
    const mwNum = parseFloat(mw) || 0
    // Filter to events that actually apply to this project shape. Server-side
    // gating saves prompt tokens + ensures the model doesn't muse about an
    // 1MW-floor policy for a 0.5MW project.
    const applicable = policyEvents.filter(ev => {
      if (ev.min_mw_ac != null && mwNum > 0 && mwNum < ev.min_mw_ac) return false
      if (ev.max_mw_ac != null && mwNum > 0 && mwNum > ev.max_mw_ac) return false
      if (Array.isArray(ev.applicable_technologies) && ev.applicable_technologies.length > 0
          && technology && !ev.applicable_technologies.includes(technology)) return false
      if (Array.isArray(ev.applicable_stages) && ev.applicable_stages.length > 0
          && stage && !ev.applicable_stages.includes(stage)) return false
      return true
    })
    if (applicable.length > 0) {
      lines.push(`\nPOLICY IMPACT EVENTS — ${state} (${applicable.length} active)`)
      for (const ev of applicable) {
        lines.push(`  ${ev.event_name} (${ev.event_type}, effective ${ev.effective_date || 'TBD'}, status: ${ev.status}) — ${ev.pillar}`)
        // Quantified financial impact (only print the metrics that are set).
        const impactBits = []
        if (ev.capex_impact_per_mw_usd != null)   impactBits.push(`capex ${ev.capex_impact_per_mw_usd > 0 ? '+' : '−'}$${Math.abs(ev.capex_impact_per_mw_usd).toLocaleString()}/MW`)
        if (ev.irr_impact_bps != null)            impactBits.push(`IRR ${ev.irr_impact_bps > 0 ? '+' : '−'}${Math.abs(ev.irr_impact_bps)}bps`)
        if (ev.ongoing_fee_per_mw_yr_usd != null) impactBits.push(`ongoing $${ev.ongoing_fee_per_mw_yr_usd.toLocaleString()}/MW/yr`)
        if (ev.revenue_haircut_pct != null)       impactBits.push(`revenue ${ev.revenue_haircut_pct > 0 ? '−' : '+'}${Math.abs(ev.revenue_haircut_pct)}%`)
        if (impactBits.length > 0) {
          lines.push(`    Impact: ${impactBits.join(' · ')} (confidence: ${ev.impact_confidence || 'unstated'})`)
        } else {
          lines.push(`    Impact: not yet quantified — see source for raw details`)
        }
        // Applicability
        const appliesBits = []
        if (ev.applies_to_new_applications)   appliesBits.push('new applications')
        if (ev.applies_to_existing_queue)     appliesBits.push('projects in queue')
        if (ev.applies_to_operating_projects) appliesBits.push('operating projects')
        lines.push(`    Applies to: ${appliesBits.length > 0 ? appliesBits.join(' + ') : 'unspecified'}`)
        // Safe harbor — critical for advising developers whether THIS project is in/out.
        if (ev.safe_harbor_eligible) {
          lines.push(`    Safe harbor: yes — projects past ${ev.safe_harbor_cutoff_date || 'cutoff date'} likely exempt${ev.safe_harbor_notes ? ` (${ev.safe_harbor_notes.slice(0, 160)})` : ''}`)
        } else {
          lines.push(`    Safe harbor: not available for this event`)
        }
        // FEOC interplay — Treasury rules + ITC qualification.
        if (ev.feoc_compliance_required) {
          lines.push(`    FEOC: required${ev.feoc_notes ? ` — ${ev.feoc_notes.slice(0, 160)}` : ''}`)
        }
        if (ev.impact_methodology) {
          lines.push(`    Methodology: ${ev.impact_methodology.slice(0, 220)}`)
        }
        lines.push(`    Source: ${ev.source_url}`)
        lines.push(`    Summary: ${ev.summary}`)
      }
    }
  }

  // ── Revenue stack ──────────────────────────────────────────────────────────
  lines.push(`\nREVENUE STACK`)
  if (technology === 'Community Solar' || !technology) {
    if (revenueStack) {
      lines.push(`  ITC base: ${revenueStack.itcBase}`)
      lines.push(`  ITC adders available: ${revenueStack.itcAdder}`)
      lines.push(`  REC / I-REC market: ${revenueStack.irecMarket}`)
      lines.push(`  Net metering / CS credit structure: ${revenueStack.netMeteringStatus}`)
      lines.push(`  Revenue summary: ${revenueStack.summary}`)
    } else {
      lines.push(`  Revenue stack: not available for ${state} — advise developer to check DSIRE`)
    }
  } else if (technology === 'C&I Solar') {
    const CI_COVERED = ['IL','NY','MA','MN','CO','NJ','ME','MD']
    lines.push(`  Revenue model: PPA-based (contracted rate with anchor tenant)`)
    lines.push(`  ITC: 30% base (no CS-specific adders for C&I)`)
    lines.push(`  Key revenue driver: PPA rate competitiveness vs utility retail rate`)
    lines.push(`  Primary risk: offtaker credit quality and contract term length`)
    if (!CI_COVERED.includes(state)) {
      lines.push(`  COVERAGE NOTE: Tractova does not yet have curated PPA-rate / retail-rate data for ${state}. Avoid quoting specific PPA cents/kWh figures; speak directionally and recommend the developer pull live retail rate data from EIA Form 861 / utility tariffs.`)
    }
  } else if (technology === 'BESS') {
    const isoMap = { IL: 'PJM', NY: 'NYISO', MA: 'ISO-NE', MN: 'MISO', CO: 'SPP', NJ: 'PJM', ME: 'ISO-NE', MD: 'PJM' }
    const iso = isoMap[state] || 'Unknown'
    lines.push(`  Revenue model: Capacity market + demand charge reduction + energy arbitrage`)
    lines.push(`  ISO/RTO region: ${iso}`)
    lines.push(`  ITC: 30% standalone storage (IRA)`)
    lines.push(`  Primary risk: capacity market price volatility and battery degradation`)
    if (iso === 'Unknown') {
      lines.push(`  COVERAGE NOTE: Tractova does not yet have curated capacity-market data for ${state}. Avoid quoting specific $/kW-yr capacity prices or arbitrage spreads; speak directionally and recommend the developer pull live ISO capacity market data.`)
    }
  } else if (technology === 'Hybrid') {
    const HYBRID_COVERED = ['IL','NY','MA','MN','CO','NJ','ME','MD']
    lines.push(`  Revenue model: Combined solar generation + storage capacity/arbitrage`)
    lines.push(`  ITC: 30% for both solar and co-located storage`)
    lines.push(`  Primary risk: permitting complexity for combined facility + ITC co-location qualification`)
    if (!HYBRID_COVERED.includes(state)) {
      lines.push(`  COVERAGE NOTE: Tractova does not yet have curated hybrid-storage economics for ${state}. Avoid quoting specific revenue figures; speak directionally about value-stacking principles.`)
    }
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-tier JSON parser — handles strict JSON, prose-wrapped JSON, raw text
// ─────────────────────────────────────────────────────────────────────────────
export function parseInsightResponse(text) {
  // Tier 1: strict parse
  try {
    const p = JSON.parse(text.trim())
    if (p.brief) return p
  } catch (_) {}

  // Tier 2: extract JSON object from text with surrounding prose
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const p = JSON.parse(match[0])
      if (p.brief) return p
    }
  } catch (_) {}

  // Tier 2.5: regex-extract individual fields from truncated / malformed JSON.
  // Handles the case where max_tokens cuts off the response mid-string, causing
  // Tiers 1 and 2 to fail. We greedily capture up to the first unescaped quote.
  try {
    const extract = (field) => {
      const m = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
      if (!m) return null
      return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t').trim()
    }
    const brief = extract('brief')
    if (brief && brief.length > 20) {
      return {
        brief,
        primaryRisk:            extract('primaryRisk'),
        topOpportunity:         extract('topOpportunity'),
        immediateAction:        extract('immediateAction'),
        stageSpecificGuidance:  extract('stageSpecificGuidance'),
        competitiveContext:     extract('competitiveContext'),
      }
    }
  } catch (_) {}

  // Tier 3: last resort — only use raw text if it doesn't look like JSON
  if (text && text.length > 20 && !text.trim().startsWith('{')) {
    return { brief: text.trim().slice(0, 600), primaryRisk: null, topOpportunity: null, immediateAction: null }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body
  try {
    body = req.body
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
      : await (async () => {
          const chunks = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          return JSON.parse(Buffer.concat(chunks).toString())
        })()
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  // ── Public actions (no auth) — must be before the auth gate ───────────────
  // memo-view: token-gated read of a frozen memo snapshot. Token validation
  // + view-cap enforcement happens inside handleMemoView via service-role.
  if (body.action === 'memo-view') return handleMemoView(body, res)

  // ── Auth gate — Pro subscribers only ──────────────────────────────────────
  const token = req.headers.authorization?.slice(7)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (!user || authErr) return res.status(401).json({ error: 'Unauthorized' })
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier, subscription_status')
    .eq('id', user.id)
    .maybeSingle()
  const isPro = profile?.subscription_tier === 'pro' &&
    ['active', 'trialing'].includes(profile?.subscription_status)
  if (!isPro) return res.status(403).json({ error: 'Pro subscription required' })

  // ── Rate limit — bound Anthropic spend per user ───────────────────────────
  // Two-tier window: hard burst limit (10 calls / minute) catches scripted
  // abuse; sustained limit (60 calls / hour) catches credential leaks.
  // Heavy genuine users do ~30-60 calls/day total, so 60/hr is plenty of
  // headroom while still flagging clear abuse. Silent fail if migration 015
  // hasn't been applied (table missing) -- we don't want the audit/limit
  // layer to break the actual feature.
  const RL_BURST_PER_MIN = 10
  const RL_SUSTAINED_PER_HOUR = 60
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentCalls, error: rlErr } = await supabaseAdmin
      .from('api_call_log')
      .select('called_at')
      .eq('user_id', user.id)
      .gte('called_at', oneHourAgo)
      .order('called_at', { ascending: false })
      .limit(RL_SUSTAINED_PER_HOUR + 1)
    if (!rlErr && recentCalls) {
      if (recentCalls.length >= RL_SUSTAINED_PER_HOUR) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          reason: 'sustained_per_hour',
          limit: RL_SUSTAINED_PER_HOUR,
          retryAfterSec: 3600,
        })
      }
      const oneMinAgo = Date.now() - 60 * 1000
      const burstCount = recentCalls.filter(c => new Date(c.called_at).getTime() > oneMinAgo).length
      if (burstCount >= RL_BURST_PER_MIN) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          reason: 'burst_per_minute',
          limit: RL_BURST_PER_MIN,
          retryAfterSec: 60,
        })
      }
    }
  } catch (_err) {
    // Rate-limit infrastructure failure must never block legitimate use.
    // Log and continue.
    console.warn('[lens-insight:ratelimit] check failed:', _err.message)
  }

  // ── If no API key, return fallback immediately (no error) ──────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ insight: null, fallback: true, reason: 'no_api_key' })
  }

  // ── Log this call (best-effort, fire-and-forget) ───────────────────────────
  // Insert before action routing so the call counts even if the action throws.
  // No await so we don't slow down the response by the supabase round-trip.
  const action = body.action
  supabaseAdmin
    .from('api_call_log')
    .insert([{ user_id: user.id, action: action || 'verdict', model: 'claude-sonnet-4-6' }])
    .then(({ error }) => { if (error) console.warn('[lens-insight:log] insert failed:', error.message) })

  // ── Action routing — multiplex specialized agents through this endpoint ────
  if (action === 'portfolio')    return handlePortfolio(body, res)
  if (action === 'compare')      return handleCompare(body, res)
  if (action === 'sensitivity')  return handleSensitivity(body, res)
  if (action === 'scenario-commentary') return handleScenarioCommentary(body, res)
  if (action === 'news-summary') return handleNewsSummary(body, res)
  if (action === 'deal-memo')    return handleDealMemo(body, res)
  if (action === 'utility-outreach') return handleUtilityOutreach(body, res, user)
  if (action === 'classify-docket') return handleClassifyDocket(body, res)
  if (action === 'policy-classify') return handlePolicyClassify(body, res)
  if (action === 'memo-create')  return handleMemoCreate(body, res, user)

  // ── Fetch policy_impact_events for this state ────────────────────────────
  // Admin-curated enacted-bill effects (capex/IRR/ongoing fee/safe harbor
  // /FEOC). buildContext folds these into the prompt; the Sonnet verdict
  // then naturally addresses policy implications in primaryRisk +
  // immediateAction. Empty array if migration 059 isn't applied yet OR the
  // state has no published events — caller treats that as "no policy
  // context" and prompts read identically to pre-policy behavior.
  // MUST fetch before the cache-key build below — dataVersionFor folds
  // the max(verified_at) across these into the key, so a new policy edit
  // forces a fresh Sonnet call instead of serving a stale verdict.
  let policyEvents = []
  if (body.state) {
    const { data, error: peErr } = await supabaseAdmin
      .from('policy_impact_events')
      .select('*')
      .eq('state', body.state)
      .eq('is_active', true)
      .eq('review_status', 'published')
      .order('effective_date', { ascending: false, nullsFirst: false })
      .limit(8)
    if (!peErr && Array.isArray(data)) policyEvents = data
    // Silent fall-through on errors: missing table (migration not yet applied)
    // or transient Supabase error should not block a Lens run.
  }

  // ── Cache check (verdict, 6h TTL, shared across users) ────────────────────
  // Round MW to 1 decimal so 4.99 vs 5.00 share a hit. Data-version baked in
  // so admin program edits AND policy_impact_events publishes invalidate
  // stale entries automatically.
  const verdictKey = buildCacheKey('verdict', {
    state:       body.state,
    county:      body.county,
    mw:          Math.round((parseFloat(body.mw) || 0) * 10) / 10,
    stage:       body.stage,
    technology:  body.technology,
    dataVersion: dataVersionFor(body.stateProgram, policyEvents),
  })
  const cachedVerdict = await cacheGet(verdictKey)
  if (cachedVerdict) {
    return res.status(200).json({ insight: cachedVerdict, cached: true })
  }

  // ── Build context + call Claude (single-project analysis) ─────────────────
  // Timeout: 45s. vercel.json sets maxDuration=60 for this function, so we
  // have ~15s of buffer for parsing + cache write + serialization. Original
  // 25s budget was tight against Sonnet 4.6's p99 response time — the
  // 2026-05-10 audit caught two MA calls timing out at 25.5s when Sonnet
  // ran a fraction longer than its typical 22-23s. Bumping closes that
  // tail-latency gap; no upside to running tighter than the platform cap.
  const contextText = buildContext({ ...body, policyEvents })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextText }],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const rawText = message.content?.[0]?.text || ''
    const insight = parseInsightResponse(rawText)

    if (!insight) {
      return res.status(200).json({ insight: null, fallback: true, reason: 'parse_failed' })
    }

    // Fire-and-forget cache write. Don't block the response on it; if the
    // upsert fails we just pay for the next call.
    cacheSet(verdictKey, 'verdict', insight, 6 * 60 * 60)

    return res.status(200).json({ insight })

  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight] error:', err.message)
    await axiomLog('error', 'lens-insight verdict path failed', {
      route:  'api/lens-insight',
      action: body.action || 'verdict',
      state:  body.state,
      county: body.county,
      mw:     body.mw,
      error:  err.message,
      stack:  err.stack?.slice(0, 2000),
    })
    return res.status(200).json({ insight: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
