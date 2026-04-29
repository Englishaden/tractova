import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
    lines.push(`  Feasibility score: ${stateProgram.feasibilityScore}/100`)
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
  const hasSeededIX = countyData?.interconnection?.easeScore !== null && countyData?.interconnection?.easeScore !== undefined
  lines.push(`\nSITE CONTROL — ${county} County`)
  if (sc) {
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
    lines.push(`  Revenue model: PPA-based (contracted rate with anchor tenant)`)
    lines.push(`  ITC: 30% base (no CS-specific adders for C&I)`)
    lines.push(`  Key revenue driver: PPA rate competitiveness vs utility retail rate`)
    lines.push(`  Primary risk: offtaker credit quality and contract term length`)
  } else if (technology === 'BESS') {
    const isoMap = { IL: 'PJM', NY: 'NYISO', MA: 'ISO-NE', MN: 'MISO', CO: 'SPP', NJ: 'PJM', ME: 'ISO-NE', MD: 'PJM' }
    const iso = isoMap[state] || 'Unknown'
    lines.push(`  Revenue model: Capacity market + demand charge reduction + energy arbitrage`)
    lines.push(`  ISO/RTO region: ${iso}`)
    lines.push(`  ITC: 30% standalone storage (IRA)`)
    lines.push(`  Primary risk: capacity market price volatility and battery degradation`)
  } else if (technology === 'Hybrid') {
    lines.push(`  Revenue model: Combined solar generation + storage capacity/arbitrage`)
    lines.push(`  ITC: 30% for both solar and co-located storage`)
    lines.push(`  Primary risk: permitting complexity for combined facility + ITC co-location qualification`)
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

  // ── If no API key, return fallback immediately (no error) ──────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ insight: null, fallback: true, reason: 'no_api_key' })
  }

  // ── Action routing — multiplex specialized agents through this endpoint ────
  const action = body.action
  if (action === 'portfolio')    return handlePortfolio(body, res)
  if (action === 'compare')      return handleCompare(body, res)
  if (action === 'sensitivity')  return handleSensitivity(body, res)
  if (action === 'news-summary') return handleNewsSummary(body, res)
  if (action === 'deal-memo')    return handleDealMemo(body, res)

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
// ─────────────────────────────────────────────────────────────────────────────
const COMPARE_PROMPT = `You are a senior solar development analyst. Compare these projects side-by-side and identify which is the strongest opportunity and why. Consider feasibility score, interconnection difficulty, program status, project size, and market conditions.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "comparison": "2-3 sentences highlighting the key tradeoffs between these projects",
  "recommendedId": "the id of the strongest project",
  "reason": "1 sentence explaining why this project is recommended"
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
