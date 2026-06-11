import { describe, it, expect, beforeAll } from 'vitest'

// Verdict cache key integrity (audit F-04). The poisoning fix folds a hash of
// the client-supplied prompt context into the key, so a crafted context can no
// longer collide with the honest entry and be served to another user — while
// identical honest inputs still collapse to one cached Sonnet call.
//
// _aiCacheLayer.js re-exports the shared supabaseAdmin client, which is
// constructed at module load and needs env vars. buildCacheKey/hashContext are
// pure (crypto only), so we stub dummy env and dynamic-import to exercise them
// without a live Supabase config.
let buildCacheKey, hashContext
beforeAll(async () => {
  process.env.VITE_SUPABASE_URL ||= 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
  ;({ buildCacheKey, hashContext } = await import('../../api/lib/_aiCacheLayer.js'))
})

describe('hashContext', () => {
  it('is stable for identical input (cross-user cache sharing preserved)', () => {
    const ctx = { countyData: { ease: 7 }, ixQueue: { totalMW: 50 } }
    expect(hashContext(ctx)).toBe(hashContext({ ...ctx }))
  })

  it('is order-independent at the top level', () => {
    const a = hashContext({ countyData: { x: 1 }, ixQueue: { y: 2 } })
    const b = hashContext({ ixQueue: { y: 2 }, countyData: { x: 1 } })
    expect(a).toBe(b)
  })

  it('differs when any context field changes (poisoned ≠ honest)', () => {
    const honest = hashContext({ countyData: { easeScore: 7 } })
    const poisoned = hashContext({ countyData: { easeScore: 1 } })
    expect(poisoned).not.toBe(honest)
  })

  it('handles null/undefined without throwing', () => {
    expect(typeof hashContext(null)).toBe('string')
    expect(typeof hashContext(undefined)).toBe('string')
  })
})

describe('buildCacheKey with contextHash', () => {
  const base = {
    state: 'NY', county: 'Albany', mw: 5, stage: 'Development',
    technology: 'Community Solar', dataVersion: 'v1', buildContextVersion: 6,
  }
  it('two requests differing only in context hash produce different keys', () => {
    const k1 = buildCacheKey('verdict', { ...base, contextHash: hashContext({ countyData: { a: 1 } }) })
    const k2 = buildCacheKey('verdict', { ...base, contextHash: hashContext({ countyData: { a: 2 } }) })
    expect(k1).not.toBe(k2)
  })
  it('identical inputs produce identical keys', () => {
    const ctx = { countyData: { a: 1 } }
    const k1 = buildCacheKey('verdict', { ...base, contextHash: hashContext(ctx) })
    const k2 = buildCacheKey('verdict', { ...base, contextHash: hashContext({ ...ctx }) })
    expect(k1).toBe(k2)
  })
})
