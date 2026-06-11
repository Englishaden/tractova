/**
 * In-memory per-instance rate backstop (audit F-05).
 *
 * The primary AI-spend quota lives in `api_call_log` (durable, cross-instance).
 * This module is the SECONDARY guard for the case the durable limiter can't be
 * consulted — a Supabase read error or throw. Without it, that path fails OPEN
 * (`return {ok:true}` / `catch → continue`), so a metering blip removes ALL
 * rate limiting and uncaps Anthropic spend. With it, a metering outage degrades
 * to "a few calls per warm instance per minute" instead of "unlimited."
 *
 * Caveats (deliberate, documented honesty):
 *   - State is module-level, so it is PER warm serverless instance, not global.
 *     Vercel Fluid Compute reuses instances, so a hot instance is throttled, but
 *     a fleet of cold instances each gets its own small budget. This is a
 *     backstop, NOT the primary quota — it only engages on metering failure.
 *   - No external store, no timers; entries self-trim on read. Memory is bounded
 *     by (active users during an outage) × (window), which is tiny.
 *
 * `now` is injectable for deterministic tests (production passes nothing →
 * Date.now()). Date.now() is fine here: this is application code, not a
 * workflow script.
 */

const buckets = new Map() // key -> number[] of call timestamps (ms), within window

/**
 * Sliding-window allow check. Records the call when it allows it.
 *
 * @param {string} key — bucket key, e.g. `lens:${userId}`.
 * @param {{maxInWindow: number, windowMs: number}} opts
 * @param {number} [now] — current epoch ms (tests inject; prod omits).
 * @returns {boolean} true = allowed (and recorded), false = over the cap.
 */
export function memAllow(key, { maxInWindow, windowMs }, now) {
  if (!key || !maxInWindow || !windowMs) return true
  const t = typeof now === 'number' ? now : Date.now()
  const cutoff = t - windowMs
  const recent = (buckets.get(key) || []).filter((ts) => ts > cutoff)
  if (recent.length >= maxInWindow) {
    buckets.set(key, recent) // persist the trim so the map can't grow unbounded
    return false
  }
  recent.push(t)
  buckets.set(key, recent)
  return true
}

/** Test-only reset of all buckets. */
export function _resetMemRateLimit() {
  buckets.clear()
}
