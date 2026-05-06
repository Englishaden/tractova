import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { applyCors } from './_cors.js'
import { buildCacheKey, cacheGet, cacheSet, dataVersionFor } from './lib/_aiCacheLayer.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { PORTFOLIO_PROMPT } from './prompts/portfolio.js'
import { COMPARE_PROMPT } from './prompts/compare.js'
import { SENSITIVITY_PROMPT } from './prompts/sensitivity.js'
import {
  SCENARIO_COMMENTARY_PROMPT,
  describeScenarioDeltas,
  formatScenarioOutputs,
} from './prompts/scenario-commentary.js'
import { NEWS_SUMMARY_PROMPT } from './prompts/news-summary.js'
import { DEAL_MEMO_PROMPT } from './prompts/deal-memo.js'
import { UTILITY_OUTREACH_PROMPT } from './prompts/utility-outreach.js'
import { CLASSIFY_DOCKET_PROMPT } from './prompts/classify-docket.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// Build structured context string from project data
// ─────────────────────────────────────────────────────────────────────────────
function buildContext({ state, county, mw, stage, technology, stateProgram, countyData, revenueStack, runway, ixQueue }) {
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
function parseInsightResponse(text) {
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
    return res.status(200).json({ insight: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio analysis — summarize a developer's project portfolio
// ─────────────────────────────────────────────────────────────────────────────
async function handlePortfolio(body, res) {
  const { projects } = body
  if (!projects?.length) return res.status(400).json({ error: 'No projects provided' })

  const lines = [`PORTFOLIO: ${projects.length} projects\n`]
  projects.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name || 'Unnamed'} — ${p.mw || '?'}MW ${p.technology || 'Solar'} in ${p.state || '?'}, ${p.county || '?'} County`)
    lines.push(`   Stage: ${p.stage || 'Unknown'} | Score: ${p.score ?? '?'}/100 | IX: ${p.ixDifficulty || '?'} | CS Status: ${p.csStatus || '?'}`)
  })

  const totalMW = projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
  const states = [...new Set(projects.map(p => p.state).filter(Boolean))]
  lines.push(`\nTOTALS: ${totalMW} MW across ${states.length} state${states.length !== 1 ? 's' : ''} (${states.join(', ')})`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 600, system: PORTFOLIO_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      return res.status(200).json(parsed)
    } catch {
      return res.status(200).json({ summary: null, fallback: true, reason: 'parse_failed' })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:portfolio] error:', err.message)
    return res.status(200).json({ summary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity rationale — 1-2 sentence "why this scenario changes the score"
// ─────────────────────────────────────────────────────────────────────────────
async function handleSensitivity(body, res) {
  const { state, county, mw, stage, technology, scenario, baseScore, newScore, override, stateProgram, countyData } = body
  if (!scenario) return res.status(400).json({ error: 'scenario required' })

  const lines = []
  lines.push(`PROJECT: ${mw || '?'} MW ${technology || 'Solar'} | ${county || '?'} County, ${state || '?'} | Stage: ${stage || '?'}`)
  if (stateProgram?.csProgram) lines.push(`Program: ${stateProgram.csProgram} (${stateProgram.csStatus})`)
  if (countyData?.interconnection?.servingUtility) lines.push(`Utility: ${countyData.interconnection.servingUtility}`)
  lines.push(`\nSCENARIO: ${scenario}`)
  if (override) {
    Object.entries(override).forEach(([k, v]) => lines.push(`  ${k}: ${v}`))
  }
  lines.push(`\nSCORE IMPACT: ${baseScore ?? '?'} → ${newScore ?? '?'} (delta: ${newScore != null && baseScore != null ? (newScore - baseScore > 0 ? '+' : '') + (newScore - baseScore) : '?'})`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 200, system: SENSITIVITY_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.rationale) return res.status(200).json(parsed)
    } catch {}
    // Fallback: return raw text trimmed if JSON parse failed but text looks usable
    if (raw && raw.length > 20 && raw.length < 400) {
      return res.status(200).json({ rationale: raw.trim().replace(/^["{]|["}]$/g, '').slice(0, 300) })
    }
    return res.status(200).json({ rationale: null, fallback: true, reason: 'parse_failed' })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:sensitivity] error:', err.message)
    return res.status(200).json({ rationale: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario commentary — 2-3 sentence narrative for a saved Scenario Studio run
// ─────────────────────────────────────────────────────────────────────────────
async function handleScenarioCommentary(body, res) {
  const { stateId, technology, mw, county, baselineInputs, scenarioInputs, outputs, baselineOutputs } = body
  if (!baselineInputs || !scenarioInputs || !outputs) {
    return res.status(400).json({ error: 'baselineInputs, scenarioInputs, outputs required' })
  }

  // Round numeric inputs for cache hashing so 0.18001 vs 0.18 collapse.
  const round = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) {
      out[k] = typeof v === 'number' ? Math.round(v * 10000) / 10000 : v
    }
    return out
  }
  const cacheKey = buildCacheKey('scenario-commentary', {
    stateId,
    technology,
    mw: Math.round((parseFloat(mw) || 0) * 10) / 10,
    baseline: round(baselineInputs),
    scenario: round(scenarioInputs),
    outputs:  round(outputs),
  })
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return res.status(200).json({ commentary: cached.commentary, cached: true })
  }

  const deltas = describeScenarioDeltas(baselineInputs, scenarioInputs)
  if (deltas.length === 0) {
    const fallback = 'Baseline run — no inputs diverge from the achievable baseline.'
    cacheSet(cacheKey, 'scenario-commentary', { commentary: fallback }, 30 * 24 * 60 * 60)
    return res.status(200).json({ commentary: fallback })
  }

  const lines = []
  lines.push(`PROJECT: ${mw || '?'} MW ${technology || 'Solar'}${county ? ` | ${county} County` : ''}${stateId ? `, ${stateId}` : ''}`)
  lines.push(`\nSCENARIO INPUTS (changes from baseline):`)
  lines.push(...deltas)
  if (baselineOutputs) {
    lines.push(`\nBASELINE OUTPUTS:`)
    lines.push(...formatScenarioOutputs(baselineOutputs))
  }
  lines.push(`\nSCENARIO OUTPUTS:`)
  lines.push(...formatScenarioOutputs(outputs))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        system: SCENARIO_COMMENTARY_PROMPT,
        messages: [{ role: 'user', content: lines.join('\n') }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    let commentary = null
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.commentary && typeof parsed.commentary === 'string') {
        commentary = parsed.commentary.trim()
      }
    } catch {
      // Fallback: accept raw text if it doesn't look like a JSON parse failure.
      if (raw && raw.length > 20 && raw.length < 500 && !raw.trim().startsWith('{')) {
        commentary = raw.trim().slice(0, 400)
      }
    }
    if (!commentary) {
      return res.status(200).json({ commentary: null, fallback: true, reason: 'parse_failed' })
    }
    cacheSet(cacheKey, 'scenario-commentary', { commentary }, 30 * 24 * 60 * 60)
    return res.status(200).json({ commentary })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:scenario-commentary] error:', err.message)
    return res.status(200).json({ commentary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// News pulse summary — 2-3 sentence rollup of recent items for a state or feed
// ─────────────────────────────────────────────────────────────────────────────
async function handleNewsSummary(body, res) {
  const { items, state } = body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required' })
  }

  const lines = []
  if (state) lines.push(`STATE FOCUS: ${state}`)
  lines.push(`RECENT NEWS (${items.length} items):\n`)
  items.slice(0, 12).forEach((it, i) => {
    lines.push(`${i + 1}. [${it.pillar || 'general'}] ${it.headline || ''}${it.source ? ` — ${it.source}` : ''}`)
    if (it.summary) lines.push(`   ${it.summary}`)
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 300, system: NEWS_SUMMARY_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      if (parsed.summary) return res.status(200).json(parsed)
    } catch {}
    if (raw && raw.length > 20 && raw.length < 600) {
      return res.status(200).json({ summary: raw.trim().replace(/^["{]|["}]$/g, '').slice(0, 500) })
    }
    return res.status(200).json({ summary: null, fallback: true, reason: 'parse_failed' })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:news-summary] error:', err.message)
    return res.status(200).json({ summary: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal Memo — IC-grade structured analysis for export to PDF / sales artifact
// ─────────────────────────────────────────────────────────────────────────────
async function handleDealMemo(body, res) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Utility Outreach Kit — consultant-grade pre-application packet
// ─────────────────────────────────────────────────────────────────────────────
async function handleUtilityOutreach(body, res, _user) {
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

// ─────────────────────────────────────────────────────────────────────────────
// PUC Docket Classifier — admin-side AI assist for the docket tracker
// ─────────────────────────────────────────────────────────────────────────────
async function handleClassifyDocket(body, res) {
  const { rawText } = body
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 40) {
    return res.status(400).json({ error: 'rawText required (paste at least 40 characters of docket page content)' })
  }

  // Cache check (24h TTL, keyed on hash of rawText + prompt version). Bump
  // `v` whenever the system prompt is materially updated so existing cached
  // classifications get re-fired against the new prompt rather than returning
  // stale output.
  //   v=1: initial prompt
  //   v=2: stricter date discipline + directive summary tone (no inferred dates,
  //        no encyclopedia-style "monitor closely" phrasing, gold-standard example)
  const classifyKey = buildCacheKey('classify-docket', { v: 2, rawText: rawText.trim() })
  const cached = await cacheGet(classifyKey)
  if (cached) {
    return res.status(200).json({ classification: cached, cached: true })
  }

  // Cap at 8K chars to keep input tokens bounded and stay well under the
  // 60s function timeout. PUC docket pages rarely exceed 8K chars of
  // useful content; anything more is noise (footer, nav, related links).
  const trimmed = rawText.trim().slice(0, 8000)

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
    return res.status(200).json({ classification: parsed })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:classify-docket] error:', err.message)
    return res.status(200).json({ classification: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}

async function handleCompare(body, res) {
  const { projects } = body
  if (!projects?.length || projects.length < 2) return res.status(400).json({ error: 'Need at least 2 projects' })

  const lines = [`COMPARING ${projects.length} PROJECTS:\n`]
  projects.forEach((p, i) => {
    lines.push(`PROJECT ${i + 1} (id: ${p.id})`)
    lines.push(`  Name: ${p.name || 'Unnamed'}`)
    lines.push(`  Location: ${p.state || '?'}, ${p.county || '?'} County`)
    lines.push(`  Size: ${p.mw || '?'} MW AC ${p.technology || 'Solar'}`)
    lines.push(`  Stage: ${p.stage || 'Unknown'}`)
    lines.push(`  Feasibility Score: ${p.feasibilityScore ?? '?'}/100`)
    lines.push(`  IX Difficulty: ${p.ixDifficulty || '?'}`)
    lines.push(`  CS Status: ${p.csStatus || '?'}`)
    lines.push('')
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      { model: 'claude-sonnet-4-6', max_tokens: 500, system: COMPARE_PROMPT, messages: [{ role: 'user', content: lines.join('\n') }] },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      return res.status(200).json(parsed)
    } catch {
      return res.status(200).json({ comparison: null, fallback: true, reason: 'parse_failed' })
    }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[lens-insight:compare] error:', err.message)
    return res.status(200).json({ comparison: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Memo Share — frozen Deal Memo snapshot accessible via opaque token URL
// ─────────────────────────────────────────────────────────────────────────────
//
// Two paths:
//   handleMemoCreate (auth'd): owner generates a token + stores frozen memo +
//                              project snapshot. Returns { token, url, expiresAt }.
//   handleMemoView (public):   recipient hits with token, gets memo if not expired
//                              and view_count < max_views. Increments view_count.
//
// Tokens self-expire (90 days) and have a view cap (100) to bound abuse.
//
async function handleMemoCreate(body, res, user) {
  const { project, stateProgram, countyData, memo, scenario } = body
  if (!project?.id) return res.status(400).json({ error: 'project.id required' })
  if (!memo) return res.status(400).json({ error: 'memo required' })

  // Verify the project actually belongs to this user (defense in depth -- the
  // RLS policy also enforces this, but explicit check returns a cleaner error).
  const { data: projectRow, error: projectErr } = await supabaseAdmin
    .from('projects')
    .select('id, user_id, name')
    .eq('id', project.id)
    .maybeSingle()
  if (projectErr || !projectRow || projectRow.user_id !== user.id) {
    return res.status(403).json({ error: 'Project not found or access denied' })
  }

  // Freeze the memo + a project snapshot so the shared link shows what the
  // owner saw at share time, even if the underlying state data changes later.
  // ownerUserId is embedded so MemoView can detect "this viewer owns this
  // project" without an extra DB round-trip; sharedByName uses the user's
  // display name (never raw email -- email is PII and the shared URL is
  // public, so anyone with the link could otherwise harvest it).
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || null
  const snapshot = {
    memo,
    project: {
      id: project.id,
      name: project.name,
      state: project.state,
      stateName: project.stateName,
      county: project.county,
      mw: project.mw,
      stage: project.stage,
      technology: project.technology,
      servingUtility: project.servingUtility,
      feasibilityScore: project.feasibilityScore,
    },
    stateProgram: stateProgram || null,
    countyData: countyData || null,
    // Optional saved scenario from scenario_snapshots. When the owner
    // toggled "Include in PDF + share" on a card, the row rides into
    // the snapshot so the recipient sees the deal memo + scenario in
    // a single token-protected URL. We embed the row inline (rather
    // than referencing scenario_snapshots.id) so the snapshot is
    // hermetic — even if the owner later deletes the saved scenario,
    // the shared link still renders.
    scenario: scenario && typeof scenario === 'object' ? {
      name: scenario.name,
      baseline_inputs: scenario.baseline_inputs,
      scenario_inputs: scenario.scenario_inputs,
      outputs: scenario.outputs,
    } : null,
    sharedAt: new Date().toISOString(),
    sharedByName: displayName,
    ownerUserId: user.id,
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('share_tokens')
    .insert([{ project_id: project.id, user_id: user.id, memo: snapshot }])
    .select('token, expires_at')
    .single()

  if (insertErr) {
    console.error('[lens-insight:memo-create] insert error:', insertErr.message)
    return res.status(500).json({ error: 'Failed to create share token' })
  }

  // Audit-log the share so the V3 project Audit tab shows who shared / when.
  // Fire-and-forget: a failure here must not break the share flow.
  // Migration 018 widens project_events.kind to include 'shared'; if the
  // migration hasn't run yet, the insert silently fails on the check
  // constraint (matches the existing fail-soft pattern for audit writes).
  supabaseAdmin
    .from('project_events')
    .insert([{
      project_id: project.id,
      user_id: user.id,
      kind: 'shared',
      detail: `Shared deal memo · expires ${new Date(inserted.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      meta: { token: inserted.token, sharedBy: user.email || null },
    }])
    .then(({ error: auditErr }) => {
      if (auditErr) console.warn('[lens-insight:memo-create] audit log failed:', auditErr.message)
    })

  return res.status(200).json({
    token: inserted.token,
    url: `/memo/${inserted.token}`,
    expiresAt: inserted.expires_at,
  })
}

async function handleMemoView(body, res) {
  const { token } = body
  if (!token || typeof token !== 'string' || token.length < 16) {
    return res.status(400).json({ error: 'Invalid token' })
  }

  const { data: row, error } = await supabaseAdmin
    .from('share_tokens')
    .select('token, memo, expires_at, view_count, max_views')
    .eq('token', token)
    .maybeSingle()

  if (error || !row) return res.status(404).json({ error: 'Memo not found' })

  if (new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This memo link has expired' })
  }

  if (row.view_count >= row.max_views) {
    return res.status(410).json({ error: 'This memo link has reached its view limit' })
  }

  // Increment view count fire-and-forget (don't slow the response).
  supabaseAdmin
    .from('share_tokens')
    .update({ view_count: row.view_count + 1 })
    .eq('token', token)
    .then(({ error: updErr }) => {
      if (updErr) console.warn('[lens-insight:memo-view] view_count bump failed:', updErr.message)
    })

  return res.status(200).json({ memo: row.memo, expiresAt: row.expires_at })
}
