import { describe, it, expect, beforeEach } from 'vitest'
import { memAllow, _resetMemRateLimit } from '../../api/lib/_memRateLimit.js'

// In-memory per-instance rate backstop (audit F-05). Engages only when the
// durable api_call_log limiter can't be consulted; bounds throughput so a
// metering outage degrades to "a few calls" instead of failing OPEN.
// `now` is injected for deterministic windowing.

beforeEach(() => _resetMemRateLimit())

describe('memAllow', () => {
  it('allows up to the cap, then rejects within the window', () => {
    const opts = { maxInWindow: 3, windowMs: 60_000 }
    const t = 1_000_000
    expect(memAllow('u1', opts, t)).toBe(true)
    expect(memAllow('u1', opts, t)).toBe(true)
    expect(memAllow('u1', opts, t)).toBe(true)
    expect(memAllow('u1', opts, t)).toBe(false) // 4th in-window call refused
  })

  it('refills after the window slides past old calls', () => {
    const opts = { maxInWindow: 2, windowMs: 60_000 }
    expect(memAllow('u2', opts, 0)).toBe(true)
    expect(memAllow('u2', opts, 0)).toBe(true)
    expect(memAllow('u2', opts, 0)).toBe(false)
    // 61s later the first two calls have aged out of the window.
    expect(memAllow('u2', opts, 61_000)).toBe(true)
  })

  it('keys are independent per user', () => {
    const opts = { maxInWindow: 1, windowMs: 60_000 }
    expect(memAllow('a', opts, 0)).toBe(true)
    expect(memAllow('a', opts, 0)).toBe(false)
    expect(memAllow('b', opts, 0)).toBe(true) // different key, own budget
  })

  it('fails open on missing options (never blocks when misconfigured)', () => {
    expect(memAllow('x', { maxInWindow: 0, windowMs: 1000 }, 0)).toBe(true)
    expect(memAllow('', { maxInWindow: 5, windowMs: 1000 }, 0)).toBe(true)
  })
})
