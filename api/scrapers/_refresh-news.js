/**
 * News handler — RSS + AI-classifier ingest from solar/utility trade press
 *
 * Strategy:
 *   1. Fetch RSS XML from a curated list of trade-press feeds.
 *   2. Regex-parse <item>/<entry> blocks (manual parser; no new dependency).
 *   3. Pre-filter by CS/DER/policy keywords -- drops most off-topic noise
 *      before we spend a cent on the AI classifier.
 *   4. Compute SHA-256(normalized_url + normalized_title) -> 16-hex
 *      dedupe_hash (migration 028). Skip articles already in news_feed.
 *   5. AI-classify the survivors with Claude Haiku 4.5 (cheap). Asks for
 *      relevance_score (0-100) + pillar + type + state_ids + tags + summary.
 *   6. Insert rows with relevance_score >= 60, marked auto_classified=true.
 *
 * Cost expectation: ~30-40 articles classified per weekly run × ~600 in/300
 * out tokens × Haiku pricing = pennies/week. Well under any meaningful
 * budget. Anthropic API key required (ANTHROPIC_API_KEY env var).
 *
 * Source attribution: news_feed.source = trade-press outlet name. All inserted
 * rows have auto_classified=true; UI may filter or badge accordingly.
 */
import { createHash } from 'crypto'
import { supabaseAdmin } from './_scraperBase.js'

const RSS_SOURCES = [
  { name: 'PV Magazine USA',    url: 'https://pv-magazine-usa.com/feed/' },
  { name: 'Solar Industry Mag', url: 'https://www.solarindustrymag.com/feed/rss' },
  { name: 'Utility Dive',       url: 'https://www.utilitydive.com/feeds/news/' },
  { name: 'Solar Power World',  url: 'https://www.solarpowerworldonline.com/feed/' },
]

// Pre-filter: only classify articles whose title or description matches one of
// these substrings (case-insensitive). Keeps AI cost bounded.
const CS_PREFILTER_KEYWORDS = [
  'community solar', 'shared solar', 'solar garden', 'solar gardens',
  'distributed energy', 'distributed generation', 'der ', 'd.e.r.',
  'interconnection', 'net metering', 'nem ', 'value of solar',
  'rec ', 'srec', 'solar incentive', 'tariff',
  'puc ', 'public utility commission', 'public service commission',
  'ferc', 'iso queue', 'rto queue', 'queue reform',
  'lmi solar', 'low-income solar', 'low income solar',
  'inflation reduction act', 'ira ', 'itc ', 'energy community',
  'illinois shines', 'smart program', 'susi', 'community choice',
  'capacity factor', 'avoided cost', 'rate case',
]

const RSS_USER_AGENT       = 'Tractova/1.0 (news-classifier; +https://tractova.com)'
const MAX_CLASSIFY_PER_RUN = 40   // hard cap to bound AI spend per run
const MIN_RELEVANCE_SCORE  = 60   // below this, skip insert

export default async function refreshNews() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not configured -- skipping news refresh' }
  }

  // 1. Fetch RSS sources in parallel.
  const rssResults = await Promise.allSettled(RSS_SOURCES.map(src => fetchRss(src)))
  const items = []
  const sourceStats = {}
  for (let i = 0; i < RSS_SOURCES.length; i++) {
    const src = RSS_SOURCES[i]
    const r = rssResults[i]
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const it of r.value) items.push({ ...it, source: src.name })
      sourceStats[src.name] = { fetched: r.value.length }
    } else {
      sourceStats[src.name] = { fetched: 0, error: r.reason?.message || 'fetch failed' }
    }
  }

  if (items.length === 0) {
    return { ok: false, error: 'No RSS items fetched from any source', source_stats: sourceStats }
  }

  // 2. Pre-filter.
  const filtered = items.filter(it => {
    const blob = `${it.title} ${it.description}`.toLowerCase()
    return CS_PREFILTER_KEYWORDS.some(kw => blob.includes(kw))
  })

  // 3. Compute dedupe hashes.
  for (const it of filtered) {
    it.dedupe_hash = sha256Hex(`${normalizeUrl(it.url)}|${normalizeTitle(it.title)}`).slice(0, 16)
  }

  // 4. Skip articles whose hash is already in news_feed.
  const hashes = filtered.map(it => it.dedupe_hash)
  let existingSet = new Set()
  if (hashes.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('news_feed')
      .select('dedupe_hash')
      .in('dedupe_hash', hashes)
    existingSet = new Set((existing || []).map(r => r.dedupe_hash))

    // Touch last_seen_at on already-known articles -- lets us spot articles
    // that have aged out of feeds (no insert, just timestamp refresh).
    if (existingSet.size > 0) {
      await supabaseAdmin
        .from('news_feed')
        .update({ last_seen_at: new Date().toISOString() })
        .in('dedupe_hash', Array.from(existingSet))
    }
  }

  const novel = filtered.filter(it => !existingSet.has(it.dedupe_hash))

  // 5. Cap classified count to bound AI spend per run.
  const toClassify = novel.slice(0, MAX_CLASSIFY_PER_RUN)

  // 6. Classify each (sequential -- ~40 calls × 1-2s well under 60s timeout).
  const inserts = []
  let classified = 0
  let skippedBelowThreshold = 0
  let aiErrors = 0

  for (const it of toClassify) {
    try {
      const verdict = await classifyArticle(it)
      classified++
      if (verdict.relevance_score >= MIN_RELEVANCE_SCORE) {
        inserts.push({
          headline:        it.title.slice(0, 500),
          source:          it.source,
          url:             it.url,
          published_at:    it.published_at, // YYYY-MM-DD
          pillar:          verdict.pillar,
          type:            verdict.type,
          summary:         (verdict.summary || it.description || '').slice(0, 1500),
          tags:            verdict.tags,
          state_ids:       verdict.state_ids,
          is_active:       true,
          dedupe_hash:     it.dedupe_hash,
          auto_classified: true,
          relevance_score: verdict.relevance_score,
          last_seen_at:    new Date().toISOString(),
        })
      } else {
        skippedBelowThreshold++
      }
    } catch (e) {
      aiErrors++
    }
  }

  let inserted = 0
  if (inserts.length > 0) {
    const { error } = await supabaseAdmin.from('news_feed').insert(inserts)
    if (error) {
      return {
        ok: false,
        error: `news_feed insert failed: ${error.message}`,
        inserts_attempted: inserts.length,
      }
    }
    inserted = inserts.length
  }

  return {
    ok: true,
    rss_items_fetched:        items.length,
    pre_filter_passed:        filtered.length,
    already_known_skipped:    existingSet.size,
    novel_candidates:         novel.length,
    ai_classified:            classified,
    ai_errors:                aiErrors,
    skipped_below_threshold:  skippedBelowThreshold,
    inserted:                 inserted,
    source_stats:             sourceStats,
    sample_inserted:          inserts[0]?.headline || null,
  }
}

async function fetchRss(src) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(src.url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': RSS_USER_AGENT,
        'Accept':     'application/rss+xml, application/xml, text/xml',
      },
    })
    clearTimeout(timeoutId)
    if (!resp.ok) throw new Error(`${src.name}: HTTP ${resp.status}`)
    const xml = await resp.text()
    return parseRssXml(xml)
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

// Lightweight RSS 2.0 / Atom parser. Pulls title/link/description/pubDate from
// each <item> or <entry> block. Handles CDATA + basic HTML entity decode.
// Not bulletproof for every feed in the wild, but the four sources we ship
// with all conform to either RSS 2.0 or Atom 1.0 -- both shapes are covered.
function parseRssXml(xml) {
  const itemBlocks = []
  const rssRegex  = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  const atomRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = rssRegex.exec(xml))  !== null) itemBlocks.push(m[1])
  while ((m = atomRegex.exec(xml)) !== null) itemBlocks.push(m[1])

  const items = []
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')

    // Atom: <link href="..."/> ; RSS: <link>...</link>
    let link = extractTag(block, 'link')
    if (!link) {
      const linkAttr = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)
      if (linkAttr) link = linkAttr[1]
    }

    const description = extractTag(block, 'description') ||
                        extractTag(block, 'summary')     ||
                        extractTag(block, 'content')     || ''

    const pubDate = extractTag(block, 'pubDate')   ||
                    extractTag(block, 'published') ||
                    extractTag(block, 'updated')   || ''

    if (!title || !link) continue

    const publishedDate = parsePubDate(pubDate)
    if (!publishedDate) continue   // can't insert without a date (column is NOT NULL)

    items.push({
      title:        decodeEntities(stripTags(title)).trim(),
      url:          link.trim(),
      description:  decodeEntities(stripTags(description)).slice(0, 2000),
      published_at: publishedDate,
    })
  }
  return items
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = block.match(re)
  if (!match) return ''
  let val = match[1]
  const cdata = val.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (cdata) val = cdata[1]
  return val
}

function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, '')
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function parsePubDate(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)   // YYYY-MM-DD for Postgres date column
}

function normalizeUrl(u) {
  return (u || '').trim().toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
}

function normalizeTitle(t) {
  return (t || '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex')
}

// Anthropic API call: classify a single article. Returns:
//   { relevance_score, pillar, type, state_ids, tags, summary }
async function classifyArticle(item) {
  const prompt = `You are classifying a solar / energy industry article for relevance to a US community-solar developer intelligence platform (Tractova). Tractova users are commercial-solar project developers building 1-5 MW community-solar arrays.

Score the article 0-100 for relevance to a developer making siting / offtake / interconnection / financing decisions:
  80-100  highly actionable -- state policy change, IX queue reform, REC/incentive update, major program ruling
  60-79   useful context    -- market trends, comparable deals, capacity statistics
  0-59    not relevant      -- residential rooftop, utility-scale only, EV-only, BESS-only, international

Article:
Title: ${item.title}
Source: ${item.source}
Date: ${item.published_at}
Description: ${(item.description || '').slice(0, 600)}

Return ONLY a single JSON object (no commentary, no markdown fence):
{
  "relevance_score": <int 0-100>,
  "pillar":          "offtake" | "ix" | "site",
  "type":            "policy-alert" | "market-update",
  "state_ids":       ["IL","NY",...],
  "tags":            ["community-solar","ix-queue", ...],
  "summary":         "<=200 char neutral summary"
}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          process.env.ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    throw new Error(`Anthropic ${resp.status}: ${errBody.slice(0, 200)}`)
  }

  const payload = await resp.json()
  const text = payload?.content?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in classifier response: ${text.slice(0, 100)}`)

  let parsed
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}`)
  }

  const score = parseInt(parsed.relevance_score, 10)
  return {
    relevance_score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    pillar:    ['offtake','ix','site'].includes(parsed.pillar) ? parsed.pillar : 'offtake',
    type:      ['policy-alert','market-update'].includes(parsed.type) ? parsed.type : 'market-update',
    state_ids: Array.isArray(parsed.state_ids) ? parsed.state_ids.filter(s => /^[A-Z]{2}$/.test(s)).slice(0, 10) : [],
    tags:      Array.isArray(parsed.tags) ? parsed.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 40)).slice(0, 10) : [],
    summary:   typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
  }
}
