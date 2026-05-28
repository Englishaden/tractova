/**
 * Market Brief — weekly editorial paragraph on the dashboard above MetricsBar.
 *
 * Public endpoint (no auth gate). Cached weekly so the brief stays consistent
 * across the cycle and Sonnet token cost stays near-zero: one call per ISO
 * week per data version, shared across every visitor (signed-in + /preview).
 *
 * Always returns 200 JSON. Caller (MarketBrief.jsx) renders a hard static
 * fallback if `brief` is null, so the slot above MetricsBar never degrades.
 *
 * GET /api/market-brief
 *   → { brief, callouts, generatedAt, cached }    (success)
 *   → { brief: null, fallback: true, reason }     (api error / cold + no key)
 */
import Anthropic from '@anthropic-ai/sdk'
import { applyCors } from './_cors.js'
import { buildCacheKey, cacheGet, cacheSet } from './lib/_aiCacheLayer.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

// ISO week (1-53) — matches the plan's `market_brief::YYYY-WW` cache key.
// Using ISO week (Mon-start) instead of calendar week so the brief rolls over
// in lockstep with the existing Mon-08:00 cron schedule (vercel.json).
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// ─── System prompt ──────────────────────────────────────────────────────────

const MARKET_BRIEF_PROMPT = `You are a senior community-solar market intelligence analyst writing the weekly market brief for the Tractova Dashboard. Your reader is an experienced solar developer who has 15 seconds before they scroll. Deliver one decisive paragraph (~50 words, two to three sentences) summarizing what changed this week and what it means for someone evaluating where to develop next.

VOICE: Bloomberg market wrap. Declarative. No hedging ("may", "could", "potentially"). No restating the data — interpret it. Name specific states when the data supports it. Connect a policy event to a market move, an enrollment number to a runway, a queue change to a developer decision.

INPUTS YOU'LL RECEIVE:
- Recent policy + market news items (last 14 days, pillar-tagged)
- Score deltas (states whose feasibility score moved this week)
- A coverage stat (# states with active programs, total MW pipeline)

RULES:
1. Lead with the week's defining signal — the biggest mover, the most material policy shift, or the most binding constraint.
2. If two or three states clearly stand out (top movers, hottest news), name them.
3. End with a "so what" — what should a developer do or watch next?
4. Never reference price, IRR, payback, NPV, or $/MW figures. Tractova is signal-based, not financial.
5. Never mention Tractova in third person. The brief IS Tractova's voice.

OUTPUT: Respond ONLY with a valid JSON object. No preamble, no markdown fences. Exact schema:
{
  "brief": "the 2-3 sentence paragraph",
  "callouts": ["State Name", "State Name"]
}

Callouts: 0-3 state names (full name, no abbrev) that the brief explicitly references. Used for inline chips. Omit the field or pass an empty array when the brief is structural rather than state-specific.`

// ─── Context builder ────────────────────────────────────────────────────────

async function buildBriefContext() {
  const ctx = { lines: [], hasNews: false, hasMovers: false }

  // News — last 14 days, top 12 by published_at
  try {
    const cutoff = new Date(Date.now() - 14 * 86400 * 1000).toISOString().slice(0, 10)
    const { data: news } = await supabaseAdmin
      .from('news_feed')
      .select('headline, source, pillar, type, summary, published_at, state_ids')
      .eq('is_active', true)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(12)
    if (Array.isArray(news) && news.length > 0) {
      ctx.hasNews = true
      ctx.lines.push(`RECENT NEWS (last 14 days, ${news.length} items):`)
      news.forEach((n, i) => {
        const states = Array.isArray(n.state_ids) && n.state_ids.length > 0 ? ` [${n.state_ids.join(',')}]` : ''
        ctx.lines.push(`${i + 1}. [${n.pillar || 'general'}${states}] ${n.headline}${n.source ? ` — ${n.source}` : ''}`)
        if (n.summary) ctx.lines.push(`   ${n.summary.slice(0, 220)}`)
      })
    }
  } catch (e) {
    console.warn('[market-brief] news fetch failed:', e.message)
  }

  // Movers — top WoW deltas from state_programs_snapshots
  try {
    const cutoff = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
    const { data: snaps } = await supabaseAdmin
      .from('state_programs_snapshots')
      .select('state_id, feasibility_score, snapshot_at')
      .gte('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: false })

    if (Array.isArray(snaps) && snaps.length > 0) {
      const byState = new Map()
      for (const row of snaps) {
        if (!byState.has(row.state_id)) byState.set(row.state_id, [])
        byState.get(row.state_id).push(row)
      }
      const movers = []
      for (const [state, rows] of byState.entries()) {
        if (rows.length < 2) continue
        const latest = rows[0]
        const latestTs = new Date(latest.snapshot_at).getTime()
        const prev = rows.slice(1).find(r => latestTs - new Date(r.snapshot_at).getTime() >= 4 * 86400 * 1000)
        if (!prev) continue
        const delta = Math.round(parseFloat(latest.feasibility_score) - parseFloat(prev.feasibility_score))
        if (delta === 0) continue
        movers.push({ state, delta, cur: parseFloat(latest.feasibility_score) })
      }
      movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      const top = movers.slice(0, 6)
      if (top.length > 0) {
        ctx.hasMovers = true
        ctx.lines.push(`\nSCORE MOVERS (week-over-week, top ${top.length}):`)
        top.forEach(m => {
          const arrow = m.delta > 0 ? '+' : ''
          ctx.lines.push(`  ${m.state}: ${arrow}${m.delta} pts (now ${m.cur}/100)`)
        })
      }
    }
  } catch (e) {
    console.warn('[market-brief] snapshots fetch failed:', e.message)
  }

  // Coverage — state-program count + MW pipeline (always present)
  try {
    const { data: programs } = await supabaseAdmin
      .from('state_programs')
      .select('id, name, cs_status, capacity_mw')
    if (Array.isArray(programs)) {
      const active = programs.filter(p => p.cs_status === 'active')
      const limited = programs.filter(p => p.cs_status === 'limited')
      const totalMW = [...active, ...limited].reduce((s, p) => s + (p.capacity_mw || 0), 0)
      ctx.lines.push(`\nCOVERAGE (current):`)
      ctx.lines.push(`  Active CS programs: ${active.length} states`)
      ctx.lines.push(`  Limited programs: ${limited.length} states`)
      ctx.lines.push(`  Total addressable pipeline: ${totalMW.toLocaleString()} MW`)
      ctx.lines.push(`  Largest active programs by remaining capacity: ${
        active.slice().sort((a, b) => (b.capacity_mw || 0) - (a.capacity_mw || 0))
          .slice(0, 5)
          .map(p => `${p.name} (${(p.capacity_mw || 0).toLocaleString()} MW)`)
          .join(', ')
      }`)
    }
  } catch (e) {
    console.warn('[market-brief] programs fetch failed:', e.message)
  }

  return ctx
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseBriefResponse(raw) {
  if (!raw) return null
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)
    if (parsed.brief && typeof parsed.brief === 'string' && parsed.brief.length > 20) {
      return {
        brief: parsed.brief.trim().slice(0, 600),
        callouts: Array.isArray(parsed.callouts)
          ? parsed.callouts.filter(c => typeof c === 'string').slice(0, 3)
          : [],
      }
    }
  } catch {}
  if (raw.length > 20 && raw.length < 800 && !raw.trim().startsWith('{')) {
    return { brief: raw.trim().slice(0, 600), callouts: [] }
  }
  return null
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const week = isoWeekKey()

  // Cache check — weekly bucket. The cache key bakes the week in so a new
  // week always re-fires; within a week, every visitor shares the same Sonnet
  // call regardless of auth state. cacheSet TTL is 8 days (one-day overlap
  // so the new week's call doesn't see an empty cache mid-rollover).
  const cacheKey = buildCacheKey('market_brief', { week })
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return res.status(200).json({ ...cached, cached: true })
  }

  // No API key → return null brief; component renders static fallback.
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ brief: null, fallback: true, reason: 'no_api_key' })
  }

  // Build context from live data sources
  const ctx = await buildBriefContext()
  if (!ctx.hasNews && !ctx.hasMovers) {
    // Cold start — no signal to brief on. Static fallback is the right answer.
    return res.status(200).json({ brief: null, fallback: true, reason: 'no_signal' })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: MARKET_BRIEF_PROMPT,
        messages: [{ role: 'user', content: ctx.lines.join('\n') }],
      },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const raw = message.content?.[0]?.text || ''
    const parsed = parseBriefResponse(raw)
    if (!parsed) {
      return res.status(200).json({ brief: null, fallback: true, reason: 'parse_failed' })
    }

    const payload = { brief: parsed.brief, callouts: parsed.callouts, generatedAt: new Date().toISOString(), week }
    // Cache 8 days so a missed cron doesn't blank the brief mid-rollover.
    cacheSet(cacheKey, 'market_brief', payload, 8 * 24 * 60 * 60)
    return res.status(200).json(payload)
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[market-brief] error:', err.message)
    return res.status(200).json({ brief: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
