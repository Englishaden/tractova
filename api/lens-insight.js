import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// AI response cache — shared across users, time-bounded
// ─────────────────────────────────────────────────────────────────────────────
// Backed by `ai_response_cache` (migration 019). Keys are SHA-256 of a stable
// JSON of prompt-relevant params; identical requests across DIFFERENT users
// collapse to a single Sonnet call. Silent fail in both directions: cache
// failures must never block the actual feature (we'd rather pay for a
// duplicate API call than show the user an error). Logs warn so we can
// see degradation without alerting.
function buildCacheKey(action, params) {
  // Deterministic stringify -- sort keys so { a, b } and { b, a } collapse.
  const keys = Object.keys(params).sort()
  const stable = keys.map(k => `${k}=${JSON.stringify(params[k])}`).join('|')
  return crypto.createHash('sha256').update(`${action}::${stable}`).digest('hex').slice(0, 32)
}

async function cacheGet(key) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_response_cache')
      .select('payload, expires_at')
      .eq('cache_key', key)
      .maybeSingle()
    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) return null
    return data.payload
  } catch (e) {
    console.warn('[cache:get] failed:', e.message)
    return null
  }
}

async function cacheSet(key, action, payload, ttlSeconds) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    const { error } = await supabaseAdmin
      .from('ai_response_cache')
      .upsert({ cache_key: key, action, payload, expires_at: expiresAt })
    if (error) console.warn('[cache:set] failed:', error.message)
  } catch (e) {
    console.warn('[cache:set] threw:', e.message)
  }
}

// Cross-action: a "data version" bucket so cached entries auto-invalidate
// when an admin updates the underlying state program. If lastUpdated is
// missing we fall back to a coarse (per-day) bucket so stale data doesn't
// hang around indefinitely.
function dataVersionFor(stateProgram) {
  if (stateProgram?.lastUpdated) return String(stateProgram.lastUpdated)
  const today = new Date().toISOString().slice(0, 10)
  return `unknown:${today}`
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — analyst persona + strict output rules
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior community solar development analyst embedded in Tractova, a market intelligence platform for professional solar developers. Your clients are experienced project developers — not homeowners, not generalists. They have MBAs or engineering degrees, they've closed projects, and they are paying for analysis that would cost $5,000 from a boutique consultant.

Your job is to produce DIRECTIVE, QUANTIFIED, PROJECT-SPECIFIC intelligence — not summaries. Never restate facts. Interpret them. Connect them. Tell the developer what the facts mean for THIS specific project at THIS specific MW size at THIS specific stage.

RULES:
1. Always name the specific program (e.g., "Illinois Shines", "SMART Block 8", "Community Solar Garden") — never say "the state program."
2. Always name the utility by name (e.g., "ComEd", "Ameren Illinois", "Xcel Energy Colorado") — never say "the serving utility."
3. Cite the pre-computed % of remaining capacity when provided — this is the single most important number for program viability.
4. Cite the pre-computed LMI subscriber count when LMI is required — this makes the execution constraint concrete.
5. Cite MW quantities, dollar percentages, and timeline ranges from the data — never invent numbers not present in the context.
6. Be STAGE-AWARE:
   - Prospecting: focus on market entry risk/opportunity — is this the right market to enter at all?
   - Site Control: interconnection risk is the #1 concern before signing a lease. Flag if IX timeline/cost could kill the deal before the lease is worth the paper.
   - Pre-Development: program enrollment timing, runway urgency, LMI sourcing complexity.
   - Development / NTP: study timeline implications for financial model, ITC adder qualification deadlines.
   - Construction / Operational: revenue stack confirmation, interconnection milestone risks.
7. When ease score is null or county data is flagged as less precise: hedge IX advice explicitly and direct the developer to contact the utility directly for queue status.
8. When program runway is urgent (≤6 months) or watch (7–12 months): make this the primary urgency signal in both brief and immediateAction.
9. Do NOT summarize. Every sentence must add information the developer cannot read directly from the data panel below.
10. Do NOT use vague language like "may," "could potentially," "it is worth noting." Use declarative sentences.
11. If LMI stacking with ITC adders is possible (LMI required + LMI ITC adder available), compute what the combined ITC rate would be and name it.
12. TECHNOLOGY-AWARE analysis:
   - Community Solar: focus on program enrollment, subscriber sourcing, bill credits, LMI requirements.
   - C&I Solar: focus on PPA rate competitiveness vs retail rates, offtaker credit quality, contract structure. Do NOT discuss CS program enrollment or subscriber sourcing.
   - BESS: focus on capacity market pricing in the relevant ISO/RTO, demand charge reduction value, battery degradation risk. The primary risk is always capacity market price volatility. Do NOT discuss bill credits or subscriber sourcing.
   - Hybrid: focus on value stacking (solar generation + storage capacity), ITC at 30% for both solar and co-located storage (co-location bonus not yet modeled in projections), and permitting complexity. Address both the solar and storage components.
13. When technology is NOT Community Solar, do NOT discuss CS program enrollment, subscriber sourcing, or bill credits unless the developer could realistically pivot to CS in this market.

14. STAGE-SPECIFIC GUIDANCE: Provide 2-3 actionable sentences tailored to the developer's current stage:
   - Prospecting: Is this market worth entering? Compare to adjacent counties/states.
   - Site Control: Will IX timeline kill this lease? What lease terms protect against IX delays?
   - Pre-Development: When must program enrollment happen? What's the LMI sourcing lead time?
   - Development/NTP: What study milestone deadlines exist? ITC safe-harbor timing?
   - Construction/Operational: Revenue confirmation — are bill credits / capacity payments tracking to model?
15. COMPETITIVE CONTEXT: Who else is developing in this county/state? Is the market saturating or underserved?
16. SCORE LANGUAGE: The "STATE BASELINE feasibility composite" in the data panel is the market-level score (stage-agnostic, county-agnostic). When you reference it in prose, label it explicitly as "the [STATE] market" or "the state baseline" — never as "your project's score" or "your feasibility index." The user's project-adjusted gauge value (which applies stage modifiers + their county data) is shown elsewhere in the UI; you do not see it. Phrasing like "this 81/100 feasibility market" is fine; phrasing like "your 81/100 score" is wrong because it conflates the market baseline with the project gauge.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "brief": "3–4 sentences of analyst intelligence",
  "primaryRisk": "1 sentence — the single biggest risk for this exact project",
  "topOpportunity": "1 sentence — the most actionable financial or strategic upside right now",
  "immediateAction": "1 sentence — the single most important thing to do in the next 30 days given the developer's current stage",
  "stageSpecificGuidance": "2–3 sentences of stage-appropriate tactical guidance",
  "competitiveContext": "1–2 sentences about market competition and saturation in this geography"
}`

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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
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
const PORTFOLIO_PROMPT = `You are a senior portfolio strategist for a solar development company. The developer has multiple projects across states. Analyze the portfolio holistically — concentration risk, geographic diversification, stage distribution, and market timing.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "summary": "2-3 sentences: overall portfolio health, diversification, and strategic position",
  "topRecommendation": "1 sentence: the single most impactful action to improve portfolio outcomes",
  "riskAssessment": "1-2 sentences: key portfolio-level risks (concentration, market timing, regulatory)"
}`

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
// Compare analysis — side-by-side project comparison
//
// Revamped 2026-05-03 to deliver real insight instead of score restatement.
// The previous prompt produced output like "Project A scores 78 vs Project B
// at 62 — A is stronger" which the comparison row table already showed.
// New prompt forces the model to surface ONE of three insight types:
//
//   recommendation — pick a winner with a 1-sentence rationale rooted in
//                    a non-score signal (timing, IX queue depth, runway,
//                    program rules, county geospatial fit).
//   differentiator — name the dominant axis of difference (e.g. "MN's
//                    edge is offtake; IL's edge is IX queue").
//   pattern        — surface a finding below the surface scores: a runway
//                    difference that swamps a small score gap; a stage
//                    mismatch changing timing math; sub-score divergence
//                    (e.g. high offtake masking low site).
//
// (Renamed from "non-obvious insight" 2026-05-04 — Aden flagged the prior
// label as corny. Pattern matches the brevity of the other two types and
// reads as analyst-voice, not marketing-voice.)
//
// Score restatement is explicitly forbidden. The `insightType` field lets
// the UI badge the AI block so the user sees what kind of read they got.
// ─────────────────────────────────────────────────────────────────────────────
const COMPARE_PROMPT = `You are a senior solar development analyst comparing the projects below. The comparison row table BELOW your output already shows the developer the feasibility scores, IX difficulty, program status, and project size — they can read those numbers themselves.

Your job is to add value the table cannot. Pick exactly ONE of these three insight types and produce that:

  1. RECOMMENDATION — name a winner. Anchor the rationale to a NON-SCORE signal: timing (program runway, IX queue depth, study months), program rules (LMI carveout fit, capacity remaining), or geospatial fit (wetland coverage, prime farmland, hosting). Score is a side mention, not the headline.

  2. DIFFERENTIATOR — name the dominant axis of difference between the projects. Format: "[State A]'s edge is X; [State B]'s edge is Y." One sentence per side. Be specific about WHY each edge matters.

  3. PATTERN — surface a finding below the surface scores. Examples: a runway difference that swamps a small score gap; a stage mismatch that changes the timing math; a program-cap concentration risk; a sub-score divergence (high offtake masking low site).

FORBIDDEN: Do NOT restate the feasibility composite numbers ("Project A scores 78 vs B at 62"). Do NOT use generic language like "stronger opportunity" or "more favorable" without naming the mechanism. Do NOT recommend a project on score alone — anchor to one specific market signal.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "insightType": "Recommendation" | "Differentiator" | "Pattern",
  "comparison": "2-3 sentences delivering the chosen insight type. Specific. Mechanism-rooted. Never a score restatement.",
  "recommendedId": "the id of the strongest project (only when insightType=Recommendation; null otherwise)",
  "reason": "1 sentence anchoring the recommendation to a non-score signal (only when insightType=Recommendation; null otherwise)"
}`

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity rationale — 1-2 sentence "why this scenario changes the score"
// ─────────────────────────────────────────────────────────────────────────────
const SENSITIVITY_PROMPT = `You are a senior solar development analyst. The developer is testing a sensitivity scenario on a project. Given the base case and the scenario override, explain in 1-2 developer-focused sentences WHY the feasibility score changes the way it does. Be specific about the market mechanism — name the program, utility, or revenue stream affected. Cite a concrete consequence (cost, timeline, or revenue impact).

Do NOT restate the scores. The developer can see the numbers. Tell them what the change MEANS.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "rationale": "1-2 sentences explaining the mechanism behind the score change"
}`

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
// Different from `sensitivity` (which explains a peer-state Lens-score swap):
// this handler explains the financial-modeling outputs from Scenario Studio
// (Y1 revenue, IRR, payback, NPV, DSCR, equity IRR, LCOE) given the input
// deltas the user dragged on the 9 sliders.
//
// Uses Haiku 4.5 instead of Sonnet because the task is narrow + structured —
// no need for the heavyweight analyst persona. Cached for 30 days under a
// content hash that collapses identical runs across users.
const SCENARIO_COMMENTARY_PROMPT = `You are a senior renewables development analyst writing a one-shot note for a developer who just saved a financial sensitivity run in Tractova's Scenario Studio. Given the baseline and modified inputs plus the resulting metrics, produce 2-3 short sentences (max 60 words total) that:

1. Name the dominant 1-2 input changes driving the metric shift.
2. Quantify their impact — e.g., "a $0.20/W capex cut adds ~220 bps of IRR" beats "capex changes affect IRR."
3. Call out any tension if relevant — e.g., a longer contract tenor that reduces revenue/$ deployed even while raising lifetime revenue.

Do NOT restate the metric values — the developer can read them. Do NOT hedge ("may," "could," "might"). Use declarative present-tense sentences. Speak directly to the developer ("you," not "the project").

If no scenario inputs diverge from baseline, respond with: { "commentary": "Baseline run — no inputs diverge from the achievable baseline." }

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "commentary": "2-3 sentences"
}`

// Maps slider keys to human-readable units for the prompt context. Mirrors
// scenarioEngine.getSliderConfig — keep in sync if new sliders are added.
const SCENARIO_INPUT_UNITS = {
  systemSizeMW:     { label: 'System size',         unit: 'MW',     fmt: (v) => `${v}` },
  capexPerWatt:     { label: 'Capex',               unit: '$/W',    fmt: (v) => `$${Number(v).toFixed(2)}/W` },
  ixCostPerWatt:    { label: 'IX cost',             unit: '$/W',    fmt: (v) => `$${Number(v).toFixed(2)}/W` },
  capacityFactor:   { label: 'Capacity factor',     unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(1)}%` },
  recPrice:         { label: 'REC price',           unit: '$/MWh',  fmt: (v) => `$${Number(v).toFixed(0)}/MWh` },
  programAllocation:{ label: 'Program allocation',  unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(0)}%` },
  opexPerKwYr:      { label: 'Opex',                unit: '$/kW/yr',fmt: (v) => `$${Number(v).toFixed(0)}/kW/yr` },
  discountRate:     { label: 'Discount rate',       unit: '%',      fmt: (v) => `${(Number(v) * 100).toFixed(1)}%` },
  contractTenor:    { label: 'Contract tenor',      unit: 'yr',     fmt: (v) => `${v}yr` },
}

function describeScenarioDeltas(baselineInputs, scenarioInputs) {
  const lines = []
  for (const key of Object.keys(SCENARIO_INPUT_UNITS)) {
    const b = baselineInputs?.[key]
    const s = scenarioInputs?.[key]
    if (b == null || s == null) continue
    if (Math.abs(s - b) < 1e-9) continue
    const cfg = SCENARIO_INPUT_UNITS[key]
    const pct = b !== 0 ? ((s - b) / Math.abs(b)) * 100 : 0
    const arrow = s > b ? '↑' : '↓'
    lines.push(`  ${cfg.label}: ${cfg.fmt(b)} → ${cfg.fmt(s)} (${arrow} ${Math.abs(pct).toFixed(0)}%)`)
  }
  return lines
}

function formatScenarioOutputs(out) {
  if (!out) return []
  const lines = []
  if (out.year1Revenue != null)  lines.push(`  Year 1 revenue: $${Math.round(out.year1Revenue).toLocaleString()}`)
  if (out.paybackYears != null)  lines.push(`  Simple payback: ${out.paybackYears} yr`)
  if (out.irr != null)           lines.push(`  Project IRR: ${(out.irr * 100).toFixed(1)}%`)
  if (out.equityIrr != null)     lines.push(`  Equity IRR (70/30 lev): ${(out.equityIrr * 100).toFixed(1)}%`)
  if (out.npv != null)           lines.push(`  NPV (at discount rate): $${Math.round(out.npv).toLocaleString()}`)
  if (out.dscr != null)          lines.push(`  DSCR (Y1): ${out.dscr.toFixed(2)}`)
  if (out.lcoe != null)          lines.push(`  LCOE: $${out.lcoe.toFixed(0)}/MWh`)
  if (out.lifetimeRevenue != null) lines.push(`  Lifetime revenue: $${Math.round(out.lifetimeRevenue).toLocaleString()}`)
  return lines
}

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
const NEWS_SUMMARY_PROMPT = `You are a senior solar development analyst writing a market pulse for a developer who has 60 seconds. Given a list of recent community solar / interconnection / policy news items, produce a single paragraph (2-3 sentences) summarizing the developments that matter for project decisions. Highlight policy changes, capacity shifts, IX queue events, and developer implications. Do not list each item — synthesize the signal.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "summary": "2-3 sentences synthesizing the news"
}`

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
const DEAL_MEMO_PROMPT = `You are a senior solar development analyst writing a one-page Investment Committee memo for a community solar / renewable energy project. Your audience: capital partners, financiers, and the developer's IC. Tone: directive, specific, quantified. No fluff, no hedging.

For each section, write 2-3 sentences (no more). Be concrete, name programs and utilities, cite quantities. Do not summarize the data panel — interpret it.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "siteControlSummary":  "2-3 sentences on land availability, wetland risk, zoning, parcel-level diligence priorities",
  "ixSummary":           "2-3 sentences on interconnection difficulty, queue position, study timeline, upgrade cost exposure",
  "revenueSummary":      "2-3 sentences on offtake mechanism, ITC eligibility, revenue stack, key economic drivers",
  "recommendation":      "1-2 sentences with a directive next-30-day recommendation. Start with a verb."
}`

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
// Generates everything a developer needs to make a credible first contact with
// the project's serving utility: pre-application meeting request email, study-
// process intel, an attachments checklist, a 30/60/90-day follow-up cadence,
// and verbal-follow-up talking points. Output is project-specific (named MW,
// stage, utility, ISO, queue context) so the developer can paste their name
// at the bottom and send.
const UTILITY_OUTREACH_PROMPT = `You are a senior interconnection strategist and former utility-side engineer, now embedded in Tractova as the developer's outreach co-pilot. You have run cluster studies at MISO, PJM, and ISO-NE, you have read every FERC Order 2023 update, and you have written hundreds of pre-application meeting requests that actually get responses from utility interconnection teams.

Your job: produce an outreach packet a credible solar developer can send to the named serving utility within 5 minutes of receiving it. The output must read as if a senior consultant — not an LLM — drafted it.

ABSOLUTE RULES:
1. Name the serving utility by name (e.g., "ComEd", "Xcel Energy Colorado", "PSEG Long Island"). Never "the utility" or "your utility."
2. Name the ISO/RTO when it can be inferred from state (PJM for IL/NJ/MD/VA/PA, MISO for MN/IA, NYISO for NY, ISO-NE for MA/ME/CT/RI/NH/VT, CAISO for CA, ERCOT for TX, SPP for KS/NE/OK, WECC umbrella for the rest of the West).
3. Reference the project's actual size, technology, county, and stage. Do not generalize.
4. Call out the study process you expect (Cluster Study with annual window vs Serial / Single-Project Study) based on the ISO and project size. State "expected" — you are advising, not promising.
5. Cite the typical phase-by-phase study timeline range for the ISO when known (e.g., "MISO DPP Phase I review typically ~9 months; Phase II Affected System Operator coordination adds 4-6 months"). Be conservative — over-estimate timelines rather than under.
6. When IX queue intelligence is provided in the data panel, weave the actual queue length, MW pending, or congestion level directly into the email — it shows the developer did their homework.
7. The email must be SHORT (180-260 words in the body), well-paced, and respectful of the utility engineer's time. Open with the project specs. Move quickly to the asks. End with availability.
8. The asks in the email must be specific and reasonable: pre-application report, hosting capacity at the candidate POI, study queue position estimate, application window dates, point-of-contact for follow-up. Do NOT ask for a feasibility study at first contact — that's the next round.
9. Tone: professional, warm, knowledgeable. Not stiff. Not pleading. Not transactional. The developer is a peer asking another professional for time.
10. **Bracket every developer-specific field as [Placeholder Text] in BOTH the body and the sign-off.** Never invent or assume a name, company, title, phone number, email address, project codename, or contact identity. Concrete fillable placeholders the developer expects to find: [Your Name], [Your Title], [Your Company], [Phone], [Email], [Project Codename, if assigned], [Your firm's primary point-of-contact for IX matters]. When referring to "we" / "our team" in the body, anchor with the bracket explicitly — e.g., "[Your Company] is developing a 5 MW community solar project in Will County" — NOT "We are developing..." This is critical: the developer must be able to find-and-replace the brackets in 30 seconds and send. The greeting may name the utility's known team (e.g., "ComEd Interconnection Team") because that side is known.
11. Attachments checklist: 4-6 items the developer should physically have ready before sending. Each starts with a verb. Be tech-aware (BESS needs single-line, solar needs site map and module specs, hybrid needs both).
12. Follow-up playbook: 3-4 sequenced steps with concrete timing ("Day 7", "Day 14", "Day 30"). The first step is always "Send outreach email"; the rest are escalations or pivots.
13. Phone talking points: 4-5 bullets the developer can paste into a phone-call notepad. Each is action-oriented.
14. Notes field (1-2 sentences): a state- or utility-specific gotcha worth flagging — recent rule change, known queue freeze, GIA-template quirk, FERC docket worth referencing. If nothing notable, write a calibrated "no specific gotcha — standard process applies."

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "email": {
    "subject": "Pre-application subject line — under 75 chars, includes MW + technology + county",
    "greeting": "Salutation with utility's interconnection team / department",
    "body": "180-260 words, multi-paragraph, ready to copy-paste verbatim. Use ACTUAL project specs (MW, technology, county, stage) inline. Bracket all developer-specific fields. Open with: '[Your Company] is developing a {actual MW} {actual tech} project in {actual county}, {actual state}...' End with availability for a 30-min call referencing [Your Title] and [Phone].",
    "signOff": "Closing + signature block, every developer field bracketed. Format: 'Best regards,\\n\\n[Your Name]\\n[Your Title]\\n[Your Company]\\n[Phone] · [Email]'"
  },
  "utilityContext": {
    "utility": "Utility name as it should be addressed in the email",
    "iso": "ISO/RTO acronym (PJM, MISO, NYISO, ISO-NE, CAISO, ERCOT, SPP, or 'WECC' fallback)",
    "studyProcess": "1 sentence naming the expected study process and cadence",
    "typicalQueueWait": "1 sentence with realistic timeline range for this MW + technology",
    "relevantTariffNote": "1 sentence on the likely interconnection tariff or schedule that applies (e.g., 'PJM Open Access Transmission Tariff Subpart W for projects ≥20 MW; AC1 tariff for <20 MW serial review')"
  },
  "attachmentsChecklist": ["4-6 short imperatives, each starting with a verb"],
  "followUpPlaybook": ["3-4 sequenced steps with explicit Day-N timing"],
  "phoneTalkingPoints": ["4-5 short action-oriented bullets"],
  "notes": "1-2 sentence state/utility-specific gotcha or calibrated 'standard process applies'"
}`

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
// User pastes raw text (URL line + copy of the docket page contents) from
// any state's PUC e-filing portal. Sonnet extracts the structured fields
// for the puc_dockets schema so the admin can review + save in seconds
// instead of hand-typing each row.
//
// Cached 24h on a SHA-256 of the rawText so repeat classifications of the
// same paste are free. Uses the same dataVersion-free key shape as the
// rest of the cache layer.
const CLASSIFY_DOCKET_PROMPT = `You are a senior regulatory analyst for Tractova, a market intelligence platform for solar developers. The user has pasted raw text (typically a URL plus a copy of the docket page contents) from a state Public Utility Commission (PUC) e-filing portal. Your job: extract structured fields so the docket can be saved into Tractova's PUC docket tracker.

CRITICAL RULES:
1. The state field must be a 2-letter US state code (uppercase). If you cannot determine the state with confidence, return an empty string "".

2. DATE DISCIPLINE — ABSOLUTELY STRICT:
   - All three date fields (filed_date, comment_deadline, decision_target) must be ISO YYYY-MM-DD format OR null.
   - Return null UNLESS the exact calendar date appears verbatim in the user's input text (e.g., "10/27/2014", "Date Filed: 2014-10-27", "Filed October 27, 2014").
   - DO NOT infer filed_date from docket-number prefixes. "15-E-0751" does NOT mean filed in 2015 — it's a case-numbering convention with no guaranteed correspondence to an actual filing date. Year prefixes in docket numbers are NEVER evidence of a filing date.
   - DO NOT use placeholder dates (December 31 of a year, January 1 of a year, "mid-2015", etc.). Placeholders are guesses, not facts.
   - When in doubt: null. Tractova's data accuracy bar is high; null is always better than a guess. A user-facing "filed: —" is honest; a user-facing fabricated date is a defect.

3. Status must be exactly one of:
   - "comment_open" — the docket is currently accepting public comments / a comment window is open
   - "pending_decision" — comments closed, awaiting commission ruling or order; OR an active long-running proceeding currently deliberating successor rules / amendments
   - "filed" — docket is open with no specific active comment window or imminent decision phase (lower-activity status)
   - "closed" — final order issued; no further activity expected

4. Pillar must be exactly one of:
   - "offtake" — program rules, REC values, net-metering, capacity allocations, retail rates, PPA-relevant tariff
   - "ix" — interconnection rules, queue management, IX-tariff revisions affecting cost or timing
   - "site" — zoning, permitting, environmental review (rare at PUC level)
   - "cross-cutting" — rate cases, RPS revisions, integrated resource planning, anything affecting two or more pillars

5. Impact tier must be exactly one of:
   - "high" — outcome materially changes economics for ≥10% of CS / DER projects in the state
   - "medium" — affects a subset of project types or has indirect effect
   - "low" — process-only, narrow scope, or already-resolved questions

6. Title: the docket's published title (under 120 characters). If the published title is longer, summarize it faithfully without rewriting the substance.

7. SUMMARY — DIRECTIVE TRACTOVA ANALYST VOICE:
   - 1-2 sentences. Tone of a senior boutique-consultant memo, not an encyclopedia entry.
   - REQUIREMENTS:
     a. Open with the SPECIFIC action / change ("NYPSC is reweighting VDER capacity adders...", "ICC reallocated Block 7 capacity...", "PJM filed a revised cluster-study cost-allocation methodology that..."). Use present-progressive for ongoing or recent-past for completed. Do NOT use "establishing" / "creating" / "developing" for things that have existed for years.
     b. Name the specific financial mechanism, program, or process: capacity adder, REC value, demand charge, hosting capacity, IX cluster window, GIA template, NEB rate, etc. Generic words like "compensation framework" only count if paired with a specific component name.
     c. When magnitude is reasonably inferable from the docket subject, ANCHOR with a rough quantitative range — "could shift project IRRs by 100-300 bps", "affects ~40 MW of allocated capacity", "delays study completion by 4-6 months", "20-30 bps movement on bill-credit value". Order-of-magnitude beats no anchor.
     d. End with WHO and WHEN this affects ("...material for any IL developer with projects above 2 MW signing in 2026", "...directly impacts NJ subscribers under the TREC successor regime", "...binding for any project entering the next PJM cluster window"). Make it actionable.
   - FORBIDDEN PHRASES (mark of weak prose; never use):
     "developers should monitor this docket closely", "monitor this proceeding", "could potentially", "may affect", "this is important because", "developers should be aware", "important to track", "worth monitoring".
   - Do NOT copy verbatim from the docket text — interpret it.

GOLD-STANDARD EXAMPLE OUTPUT (for reference only — do not copy):
{
  "summary": "NYPSC is reweighting VDER capacity, environment, and locational adders that flow directly into bill-credit values for community DG. Successor proceedings on subscriber-credit and customer-credit mechanics could shift CS project IRRs by 100-300 bps — binding for any NY developer signing new subscribers in 2026 and beyond."
}

8. source_url: extract the full URL from the user's input if present. Empty string if not.

9. If the pasted text is clearly NOT a PUC docket (random article, marketing copy, irrelevant content, or unparseable), return all fields blank/null and set summary to: "Could not classify -- text does not appear to be a PUC docket."

OUTPUT: Respond ONLY with a valid JSON object, no markdown fences, no preamble. Exact schema:
{
  "state": "2-letter state code or empty string",
  "puc_name": "Full PUC name (e.g. 'Illinois Commerce Commission')",
  "docket_number": "Docket / case number as published",
  "title": "Docket title (under 120 chars)",
  "status": "comment_open | pending_decision | filed | closed",
  "pillar": "offtake | ix | site | cross-cutting",
  "impact_tier": "high | medium | low",
  "filed_date": "YYYY-MM-DD or null",
  "comment_deadline": "YYYY-MM-DD or null",
  "decision_target": "YYYY-MM-DD or null",
  "source_url": "URL extracted from text, or empty string",
  "summary": "1-2 sentence Tractova analyst note"
}`

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
