/**
 * Constant-time string comparison for secret / token checks (audit L2).
 *
 * Plain `a === b` short-circuits on the first differing byte, leaking timing
 * that — in theory — could narrow a secret. The tokens here (CRON_SECRET,
 * HEALTH_CHECK_TOKEN) are high-entropy and network jitter dwarfs the signal,
 * so this is defense-in-depth — but crypto.timingSafeEqual is the correct
 * primitive and costs nothing.
 *
 * Returns false (never throws) on non-string input or length mismatch; the
 * length check leaks only the secret's length, which is not sensitive here.
 * Callers treat false as "unauthorized".
 */
import crypto from 'node:crypto'

export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
