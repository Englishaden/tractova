import Anthropic from '@anthropic-ai/sdk'

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

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences, no trailing text. Exact schema:
{
  "brief": "3–4 sentences of analyst intelligence",
  "primaryRisk": "1 sentence — the single biggest risk for this exact project",
  "topOpportunity": "1 sentence — the most actionable financial or strategic upside right now",
  "immediateAction": "1 sentence — the single most important thing to do in the next 30 days given the developer's current stage"
}`

// ─────────────────────────────────────────────────────────────────────────────
// Build structured context string from project data
// ─────────────────────────────────────────────────────────────────────────────
function buildContext({ state, county, mw, stage, technology, stateProgram, countyData, revenueStack, runway }) {
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
      lines.push(`  Program runway: enrollment rate not seeded — cannot compute`)
    }
    if (stateProgram.lastUpdated) lines.push(`  Data last updated: ${stateProgram.lastUpdated}`)
  } else {
    lines.push(`\nSTATE PROGRAM: No program data seeded for ${state}`)
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

  // ── Revenue stack ──────────────────────────────────────────────────────────
  lines.push(`\nREVENUE STACK`)
  if (revenueStack) {
    lines.push(`  ITC base: ${revenueStack.itcBase}`)
    lines.push(`  ITC adders available: ${revenueStack.itcAdder}`)
    lines.push(`  REC / I-REC market: ${revenueStack.irecMarket}`)
    lines.push(`  Net metering / CS credit structure: ${revenueStack.netMeteringStatus}`)
    lines.push(`  Revenue summary: ${revenueStack.summary}`)
  } else {
    lines.push(`  Revenue stack: not seeded for ${state} — advise developer to check DSIRE`)
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

  // Tier 3: use raw text as brief only
  if (text && text.length > 20) {
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

  // ── If no API key, return fallback immediately (no error) ──────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ insight: null, fallback: true, reason: 'no_api_key' })
  }

  // ── Build context + call Claude ────────────────────────────────────────────
  const contextText = buildContext(body)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
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
    return res.status(200).json({ insight: null, fallback: true, reason: 'api_error' })
  }
}
