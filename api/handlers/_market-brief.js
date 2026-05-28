/**
 * Market Brief — weekly editorial paragraph for the Dashboard.
 * Action: 'market-brief' (PUBLIC — routed before the auth gate in lens-insight.js)
 *
 * Cached weekly so the brief stays consistent across the cycle and Sonnet
 * token cost stays near-zero: one call per ISO week per data version, shared
 * across every visitor (signed-in + /preview unauth).
 *
 * Always returns 200 JSON. Caller (MarketBrief.jsx) renders a hard static
 * fallback if `brief` is null, so the slot above MetricsBar never degrades.
 *
 * Note: lives here (vs. its own top-level api/market-brief.js) so it doesn't
 * count against the Hobby plan's 12-Serverless-Function cap. Routed through
 * the existing lens-insight multiplexer alongside the other handlers.
 */
import Anthropic from '@anthropic-ai/sdk'
import { buildCacheKey, cacheGet, cacheSet } from '../lib/_aiCacheLayer.js'
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'
import { MARKET_BRIEF_PROMPT } from '../prompts/market-brief.js'

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

export default async function handleMarketBrief(_body, res) {
  const week = isoWeekKey()

  // Weekly cache bucket — first visitor of the week pays the Sonnet call;
  // every other visitor (signed-in + /preview unauth) hits cache. TTL 8 days
  // so a missed Mon-08:00 cron doesn't blank the brief mid-rollover.
  const cacheKey = buildCacheKey('market_brief', { week })
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return res.status(200).json({ ...cached, cached: true })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ brief: null, fallback: true, reason: 'no_api_key' })
  }

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
    cacheSet(cacheKey, 'market_brief', payload, 8 * 24 * 60 * 60)
    return res.status(200).json(payload)
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[market-brief] error:', err.message)
    return res.status(200).json({ brief: null, fallback: true, reason: `api_error: ${String(err.message || err).slice(0, 120)}` })
  }
}
