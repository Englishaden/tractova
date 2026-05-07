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
import handleMemoCreate from './handlers/_lens-memo-create.js'
import handleMemoView from './handlers/_lens-memo-view.js'

// ─────────────────────────────────────────────────────────────────────────────
// Build structured context string from project data
// ─────────────────────────────────────────────────────────────────────────────
export function buildContext({ state, county, mw, stage, technology, stateProgram, countyData, revenueStack, runway, ixQueue }) {
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
  if (action === 'memo-create')  return handleMemoCreate(body, res, user)

  // ── Cache check (verdict, 6h TTL, shared across users) ────────────────────
  // Round MW to 1 decimal so 4.99 vs 5.00 share a hit. Data-version baked in
  // so admin program edits invalidate stale entries automatically.
  const verdictKey = buildCacheKey('verdict', {
    state:       body.state,
    county:      body.county,
    mw:          Math.round((parseFloat(body.mw) || 0) * 10) / 10,
    stage:       body.stage,
    technology:  body.technology,
    dataVersion: dataVersionFor(body.stateProgram),
  })
  const cachedVerdict = await cacheGet(verdictKey)
  if (cachedVerdict) {
    return res.status(200).json({ insight: cachedVerdict, cached: true })
  }

  // ── Build context + call Claude (single-project analysis) ─────────────────
  const contextText = buildContext(body)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

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
    axiomLog('error', 'lens-insight verdict path failed', {
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
