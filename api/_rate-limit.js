/**
 * Shared rate-limit helper for API endpoints.
 *
 * Single-tier sliding-window quota backed by `api_call_log` (migration 015).
 * Mirrors the two-tier pattern in api/lens-insight.js:349-391 but
 * generalized so any endpoint can opt in with one line:
 *
 *     const rl = await checkRateLimit(supabaseAdmin, user.id, {
 *       action: 'checkout-session',
 *       windowMs: 60 * 60 * 1000,   // 1 hour
 *       maxCalls: 5,
 *     })
 *     if (!rl.ok) return res.status(429).json(rl.response)
 *
 * Behavior:
 *   - Counts rows in `api_call_log` for the given user_id + action within
 *     the rolling window. Caller is responsible for inserting the call
 *     row AFTER success (so failures don't burn quota).
 *   - Silent fail: if the rate-limit infrastructure is broken (table
 *     missing, supabase down), the helper returns `{ok: true}` so
 *     legitimate users aren't locked out. Logs the warning.
 *   - Returns the same 429 shape used by lens-insight for consistency.
 */

/**
 * @param {SupabaseClient} supabaseAdmin — service-role client.
 * @param {string} userId — UUID of the authenticated user.
 * @param {{action: string, windowMs: number, maxCalls: number}} opts
 * @returns {Promise<{ok: boolean, response?: object, count?: number}>}
 */
export async function checkRateLimit(supabaseAdmin, userId, { action, windowMs, maxCalls }) {
  if (!userId || !action || !windowMs || !maxCalls) {
    return { ok: true }
  }
  try {
    const since = new Date(Date.now() - windowMs).toISOString()
    const { data, error } = await supabaseAdmin
      .from('api_call_log')
      .select('called_at')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('called_at', since)
      .limit(maxCalls + 1)
    if (error) {
      console.warn(`[rate-limit:${action}] query failed:`, error.message)
      return { ok: true }
    }
    const count = data?.length ?? 0
    if (count >= maxCalls) {
      const retryAfterSec = Math.ceil(windowMs / 1000)
      return {
        ok: false,
        count,
        response: {
          error: 'Rate limit exceeded',
          reason: `${action}_rate_limit`,
          limit: maxCalls,
          windowSec: retryAfterSec,
          retryAfterSec,
        },
      }
    }
    return { ok: true, count }
  } catch (err) {
    console.warn(`[rate-limit:${action}] check threw:`, err?.message)
    return { ok: true }
  }
}

/**
 * Best-effort log of a successful call. Fire-and-forget — the caller
 * doesn't await this so a slow round-trip doesn't slow the response.
 *
 * @param {SupabaseClient} supabaseAdmin — service-role client.
 * @param {string} userId — UUID of the authenticated user.
 * @param {string} action — short tag, e.g. 'checkout-session'.
 * @param {object} [meta] — optional extra metadata to merge into the row.
 */
export function logRateLimited(supabaseAdmin, userId, action, meta = {}) {
  if (!userId || !action) return
  supabaseAdmin
    .from('api_call_log')
    .insert([{ user_id: userId, action, ...meta }])
    .then(({ error }) => {
      if (error) console.warn(`[rate-limit:${action}] log insert failed:`, error.message)
    })
}
