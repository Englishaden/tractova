/**
 * Shared CORS helper for API endpoints.
 *
 * Replaces `Access-Control-Allow-Origin: *` with an allow-list against the
 * production origins + local dev. Server-to-server callers (Vercel cron)
 * don't send an Origin header, so they're unaffected — the allow-list only
 * matters for browser fetches.
 *
 * Usage:
 *   import { applyCors } from './_cors.js'
 *   const isOptions = applyCors(req, res)
 *   if (isOptions) return res.status(200).end()
 */

const ALLOWED_ORIGINS = new Set([
  'https://tractova.com',
  'https://www.tractova.com',
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
])

// Vercel preview URLs (project deploys + branch deploys). Conservative match
// on tractova-named projects only; any unrelated *.vercel.app is rejected.
const VERCEL_PREVIEW_RE = /^https:\/\/tractova[a-z0-9-]*\.vercel\.app$/

function isAllowed(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  if (VERCEL_PREVIEW_RE.test(origin)) return true
  return false
}

/**
 * Sets CORS headers on the response. Returns true if the request is a
 * preflight OPTIONS that the caller should short-circuit.
 *
 * - When the Origin is allow-listed, reflects it in Access-Control-Allow-Origin.
 * - When the request has no Origin (server-to-server), no ACAO header is set.
 * - When the Origin is unknown, no ACAO header is set; the browser blocks
 *   the cross-origin response per the spec.
 */
export function applyCors(req, res) {
  const origin = req.headers?.origin
  if (isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return req.method === 'OPTIONS'
}

export { ALLOWED_ORIGINS, VERCEL_PREVIEW_RE }
