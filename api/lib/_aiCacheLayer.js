/**
 * Shared AI response cache for api/lens-insight.js handlers.
 *
 * Backed by `ai_response_cache` (migration 019). Keys are SHA-256 of a stable
 * JSON of prompt-relevant params; identical requests across DIFFERENT users
 * collapse to a single Sonnet call. Silent fail in both directions: cache
 * failures must never block the actual feature (we'd rather pay for a
 * duplicate API call than show the user an error). Logs warn so we can
 * see degradation without alerting.
 *
 * Mirrors the helper-module convention used by api/_cors.js and
 * api/scrapers/_scraperBase.js: ESM imports, JSDoc-style file header,
 * leading underscore in the filename to flag this as an internal helper.
 * Re-exports the shared `supabaseAdmin` client from `_supabaseAdmin.js`
 * for callers that want both the cache helpers AND the client from one
 * import path.
 */
import crypto from 'crypto'
import { supabaseAdmin } from './_supabaseAdmin.js'

// Re-export so existing callers that already imported `supabaseAdmin`
// from this file (api/handlers/_lens-memo-create.js, _lens-memo-view.js)
// keep working without a churn-y rename across all of them.
export { supabaseAdmin }

// ─────────────────────────────────────────────────────────────────────────────
// AI response cache — shared across users, time-bounded
// ─────────────────────────────────────────────────────────────────────────────
// Backed by `ai_response_cache` (migration 019). Keys are SHA-256 of a stable
// JSON of prompt-relevant params; identical requests across DIFFERENT users
// collapse to a single Sonnet call. Silent fail in both directions: cache
// failures must never block the actual feature (we'd rather pay for a
// duplicate API call than show the user an error). Logs warn so we can
// see degradation without alerting.
export function buildCacheKey(action, params) {
  // Deterministic stringify -- sort keys so { a, b } and { b, a } collapse.
  const keys = Object.keys(params).sort()
  const stable = keys.map(k => `${k}=${JSON.stringify(params[k])}`).join('|')
  return crypto.createHash('sha256').update(`${action}::${stable}`).digest('hex').slice(0, 32)
}

export async function cacheGet(key) {
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

export async function cacheSet(key, action, payload, ttlSeconds) {
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
export function dataVersionFor(stateProgram) {
  if (stateProgram?.lastUpdated) return String(stateProgram.lastUpdated)
  const today = new Date().toISOString().slice(0, 10)
  return `unknown:${today}`
}
