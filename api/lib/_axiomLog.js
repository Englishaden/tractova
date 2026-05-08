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
 *   - **Awaitable.** Returns a Promise. Callers in error paths SHOULD
 *     `await` it so the function instance stays alive long enough for
 *     the fetch to complete. On Vercel serverless, fire-and-forget
 *     fetches get killed when the handler returns — caller awaits
 *     are necessary to get reliable delivery.
 *   - **Bounded.** Fetch has an 8s hard timeout via AbortController.
 *     A hung Axiom endpoint never delays a response by more than 8s.
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

// One-time diagnostic — emits to Vercel function logs the FIRST time
// axiomLog is called per cold-start. Tells us at a glance whether
// AXIOM_TOKEN is reaching the running function. After we confirm
// production is wired, this can be removed in a cleanup commit.
let _firstCallLogged = false

/**
 * Returns a Promise. Callers in error paths SHOULD `await` it so the
 * fetch completes before the function instance is torn down.
 *
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} message — short human-readable label
 * @param {object} [meta] — arbitrary structured fields (route, user_id, error_code, stack, etc.)
 * @returns {Promise<void>}
 */
export async function axiomLog(level, message, meta = {}) {
  // Read env vars at CALL time, not module load. On Vercel, env vars
  // added/changed after a deploy take effect when the function instance
  // cold-starts; module-load capture would freeze the value at first
  // import. Call-time read picks up new values on every cold start.
  const AXIOM_TOKEN   = process.env.AXIOM_TOKEN
  const AXIOM_DATASET = process.env.AXIOM_DATASET

  if (!_firstCallLogged) {
    _firstCallLogged = true
    const tokenShape = AXIOM_TOKEN ? `set (${AXIOM_TOKEN.length} chars, prefix=${AXIOM_TOKEN.slice(0, 6)}…)` : 'MISSING'
    const datasetShape = AXIOM_DATASET ? `set ('${AXIOM_DATASET}')` : 'MISSING'
    // Use console.warn so it shows in Vercel function logs (Hobby tier
    // shows warn + error in the runtime tail).
    console.warn(`[axiom] init: AXIOM_TOKEN=${tokenShape} · AXIOM_DATASET=${datasetShape} · VERCEL_ENV=${process.env.VERCEL_ENV || 'unknown'}`)
  }

  if (!AXIOM_TOKEN || !AXIOM_DATASET) return  // not configured — silent no-op

  const INGEST_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`

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

  // 8s hard timeout — a hung Axiom endpoint should never delay a
  // user response by more than that. Aborts the fetch via AbortSignal.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const r = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AXIOM_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify([event]),  // Axiom ingest expects an array
      signal: controller.signal,
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '(unreadable)')
      console.warn(`[axiom] ingest non-2xx: ${r.status} ${r.statusText} body=${body.slice(0, 200)}`)
    }
  } catch (err) {
    // Console-only fallback — never throw out of the log layer.
    console.warn('[axiom] ingest failed:', err?.message || err)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Convenience wrapper: log + respond with a 500 in one call. Awaits
 * axiomLog so the fetch completes before the function instance is
 * torn down. Returns the express-style res object so callers can
 * `return await logAndRespond500(...)`.
 *
 * @param {object} res — Vercel/Express response object
 * @param {Error|string} err
 * @param {object} [context] — route, user_id, request shape, etc.
 * @returns {Promise<object>}
 */
export async function logAndRespond500(res, err, context = {}) {
  const message = err instanceof Error ? err.message : String(err)
  await axiomLog('error', message, {
    ...context,
    stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
  })
  return res.status(500).json({ error: message })
}
