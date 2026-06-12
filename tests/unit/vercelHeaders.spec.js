// Regression gate for vercel.json security headers (guardrails spec section 3).
// Headers are declared-only config — nothing else asserts they stay tight, so a
// PR that loosens the CSP would otherwise pass every gate. Rides the existing
// test:unit step (CI + pre-push + npm run verify).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const all = Object.fromEntries(
  cfg.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]),
)
const csp = all['Content-Security-Policy']
const directive = (name) => csp.split(';').find(d => d.trim().startsWith(name)) || ''

describe('vercel.json security headers', () => {
  it('keeps the non-CSP security headers present', () => {
    for (const k of ['Strict-Transport-Security', 'X-Content-Type-Options',
      'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy']) expect(all[k], k).toBeTruthy()
    expect(all['Strict-Transport-Security']).toContain('preload')
  })

  it('script-src has no unsafe-inline and no bare unsafe-eval', () => {
    const script = directive('script-src')
    expect(script).not.toContain("'unsafe-inline'")
    // 'wasm-unsafe-eval' (WASM compile only, for hCaptcha) is allowed; a bare
    // 'unsafe-eval' is not.
    expect(script.replace(/'wasm-unsafe-eval'/g, '')).not.toContain('unsafe-eval')
  })

  it('keeps frame-ancestors none, object-src none, base-uri self', () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
  })

  it('img-src has no bare https: wildcard (F-14)', () => {
    expect(directive('img-src')).not.toMatch(/\shttps:(\s|;|$)/)
  })

  it('connect-src is exactly the reviewed allowlist (edit deliberately when it changes)', () => {
    const hosts = directive('connect-src').trim().split(/\s+/).slice(1).sort()
    expect(hosts).toEqual([
      "'self'",
      'https://*.supabase.co',
      'https://api.anthropic.com',
      'https://api.stripe.com',
      'https://api.resend.com',
      'https://cdn.jsdelivr.net',
      'https://api.pwnedpasswords.com',
      'https://hcaptcha.com',
      'https://*.hcaptcha.com',
    ].sort())
  })
})
