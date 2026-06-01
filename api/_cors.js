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

// Vercel preview / branch deploys. C3: the old `tractova-*.vercel.app` regex
// matched ANY subdomain on the shared vercel.app domain — including one an
// attacker could register (e.g. tractova-evil.vercel.app) — so it was not a
// real allow-list. Instead, allow only the EXACT hostnames Vercel injects for
// THIS deployment. (Same-origin preview calls don't need CORS at all; this
// just covers genuine cross-origin preview/prod cases without a wildcard.)
function vercelOwnOrigins() {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter(Boolean).map(h => `https://${h}`)
}

function isAllowed(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  if (vercelOwnOrigins().includes(origin)) return true
  return false
}

// L1: validate a user-supplied redirect target (Stripe success / cancel /
// return URLs) resolves to an origin we control, to block open-redirect /
// phishing via our own checkout links.
export function isAllowedRedirectUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false
  let u
  try { u = new URL(urlStr) } catch { return false }
  return isAllowed(u.origin)
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

export { ALLOWED_ORIGINS }
