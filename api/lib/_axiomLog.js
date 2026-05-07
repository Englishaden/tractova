/**
 * Lightweight Axiom logger for serverless functions.
 *
 * Posts structured events to the Axiom HTTPS ingest endpoint
 * (https://api.axiom.co/v1/datasets/<dataset>/ingest). Used in place
 * of (or alongside) `console.error` / `console.warn` to forward
 * critical events to a queryable dashboard.
 *
 * Design rules:
 *   - **Silent fail-open.** If `AXIOM_TOKEN` or `AXIOM_DATASET` env
 *     vars aren't set, the helper is a no-op. Dev / preview / fresh
 *     clones unaffected.
 *   - **Fire-and-forget.** Caller doesn't await — log delivery never
 *     blocks the actual feature. A slow Axiom endpoint can't slow a
 *     user response.
 *   - **Best-effort.** A failed Axiom call is swallowed (one
 *     `console.warn` and move on). We will not lose the actual
 *     feature behavior because the log layer hiccupped.
 *
 * Why HTTPS-direct instead of Vercel Log Drains: Log Drains require
 * the Vercel Pro tier. This module gives us most of the same
 * value (queryable forwarded errors) on Hobby. The trade-off is we
 * only capture events we explicitly instrument; unhandled exceptions
 * caught by Vercel's runtime layer are still only visible in the
 * Vercel function-log tail (~1 hour retention on Hobby).
 *
 * Env vars (set in Vercel Project → Settings → Environment Variables):
 *   AXIOM_TOKEN    — Ingest token from Axiom Settings → API Tokens.
 *                    Scope it to a single dataset for least privilege.
 *   AXIOM_DATASET  — Dataset name (e.g., 'tractova-logs').
 *
 * Usage:
 *   import { axiomLog } from './lib/_axiomLog.js'
 *
 *   axiomLog('error', 'Stripe webhook signature failed', {
 *     event_id: event?.id,
 *     route:    'api/webhook',
 *   })
 */

const AXIOM_TOKEN   = process.env.AXIOM_TOKEN
const AXIOM_DATASET = process.env.AXIOM_DATASET
const INGEST_URL    = AXIOM_DATASET
  ? `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`
  : null

/**
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} message — short human-readable label
 * @param {object} [meta] — arbitrary structured fields (route, user_id, error_code, stack, etc.)
 */
export function axiomLog(level, message, meta = {}) {
  if (!AXIOM_TOKEN || !INGEST_URL) return  // not configured — silent no-op

  const event = {
    _time: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : String(message),
    service: 'tractova-api',
    region:  process.env.VERCEL_REGION || null,
    deploy:  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || null,
    env:     process.env.VERCEL_ENV || 'unknown',
    ...meta,
  }

  // Truncate very long fields so we don't blow Axiom's per-event size cap.
  for (const k of Object.keys(event)) {
    if (typeof event[k] === 'string' && event[k].length > 4000) {
      event[k] = event[k].slice(0, 4000) + '…(truncated)'
    }
  }

  // Fire-and-forget. No await; failures swallowed.
  fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AXIOM_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify([event]),  // Axiom ingest expects an array
  }).catch(err => {
    // Console-only fallback — never throw out of the log layer.
    console.warn('[axiom] ingest failed:', err?.message || err)
  })
}

/**
 * Convenience wrapper: log + respond with a 500 in one call. Returns
 * the express-style res object so callers can `return logAndRespond500(...)`.
 *
 * @param {object} res — Vercel/Express response object
 * @param {Error|string} err
 * @param {object} [context] — route, user_id, request shape, etc.
 */
export function logAndRespond500(res, err, context = {}) {
  const message = err instanceof Error ? err.message : String(err)
  axiomLog('error', message, {
    ...context,
    stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
  })
  return res.status(500).json({ error: message })
}
