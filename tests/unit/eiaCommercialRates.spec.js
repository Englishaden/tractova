import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildRetailSalesUrl,
  parseCommercialRate,
  fetchCommercialRates,
  offtakeScoreFromRate,
} from '../../api/lib/_eiaCommercialRates.js'

// Pure EIA commercial-rate helpers (Phase 4b) — the shared fetch/parse/formula
// behind both the substations cron and the offtake-rate derivation. The live
// EIA call is key-gated (Vercel only); these pin the URL shape, the rate
// validation, and the disclosed offtake formula — incl. a regression guard tying
// the committed sidecar scores to the formula (the two-layer-honesty contract).

describe('buildRetailSalesUrl', () => {
  it('targets the commercial sector, latest annual price, one row', () => {
    const u = new URL(buildRetailSalesUrl('IL', 'KEY123'))
    expect(u.origin + u.pathname).toBe('https://api.eia.gov/v2/electricity/retail-sales/data/')
    expect(u.searchParams.get('api_key')).toBe('KEY123')
    expect(u.searchParams.get('frequency')).toBe('annual')
    expect(u.searchParams.get('data[0]')).toBe('price')
    expect(u.searchParams.get('facets[stateid][]')).toBe('IL')
    expect(u.searchParams.get('facets[sectorid][]')).toBe('COM')
    expect(u.searchParams.get('sort[0][direction]')).toBe('desc')
    expect(u.searchParams.get('length')).toBe('1')
  })
})

describe('parseCommercialRate', () => {
  it('extracts a valid ¢/kWh price + period', () => {
    const json = { response: { data: [{ price: '12.96', period: '2024' }] } }
    expect(parseCommercialRate(json)).toEqual({ rateCentsKwh: 12.96, period: '2024' })
  })
  it('rejects missing / empty payloads', () => {
    expect(parseCommercialRate({}).error).toBeTruthy()
    expect(parseCommercialRate({ response: { data: [] } }).error).toBeTruthy()
    expect(parseCommercialRate({ response: { data: [{ period: '2024' }] } }).error).toBeTruthy()
  })
  it('rejects out-of-band / non-numeric prices (0 < c <= 100)', () => {
    expect(parseCommercialRate({ response: { data: [{ price: '0' }] } }).error).toBeTruthy()
    expect(parseCommercialRate({ response: { data: [{ price: '-3' }] } }).error).toBeTruthy()
    expect(parseCommercialRate({ response: { data: [{ price: '250' }] } }).error).toBeTruthy()
    expect(parseCommercialRate({ response: { data: [{ price: 'n/a' }] } }).error).toBeTruthy()
  })
})

describe('fetchCommercialRates — parallel, fault-isolated', () => {
  it('returns a per-state result, isolating one failure from the rest', async () => {
    const fake = async (url) => {
      const sid = new URL(url).searchParams.get('facets[stateid][]')
      if (sid === 'NY') return { ok: false, status: 503 }
      return { ok: true, json: async () => ({ response: { data: [{ price: sid === 'IL' ? '11.0' : '20.0', period: '2024' }] } }) }
    }
    const out = await fetchCommercialRates(['IL', 'NY', 'MA'], 'KEY', fake)
    expect(out.find(r => r.stateId === 'IL').rateCentsKwh).toBe(11.0)
    expect(out.find(r => r.stateId === 'NY').error).toContain('503')
    expect(out.find(r => r.stateId === 'MA').rateCentsKwh).toBe(20.0)
  })
  it('throws without an API key', async () => {
    await expect(fetchCommercialRates(['IL'], '')).rejects.toThrow('EIA_API_KEY')
  })
})

describe('offtakeScoreFromRate — disclosed formula clamp(round(34 + 1.8c), 45, 72)', () => {
  it('computes + clamps', () => {
    expect(offtakeScoreFromRate(15.06)).toBe(61)  // AL
    expect(offtakeScoreFromRate(7.68)).toBe(48)   // ND (lowest)
    expect(offtakeScoreFromRate(0.5)).toBe(45)    // floor
    expect(offtakeScoreFromRate(40)).toBe(72)     // ceil
    expect(offtakeScoreFromRate(null)).toBeNull()
  })

  it('every committed sidecar new_cohort score equals the formula applied to its rate', () => {
    // Two-layer-honesty contract: the sidecar `score` MUST be the disclosed
    // formula applied to the observed rate — never a hand-edited value.
    const sidecar = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/eia-861/commercial-retail-rates.json'), 'utf8')
    )
    for (const [state, row] of Object.entries(sidecar.new_cohort)) {
      expect(offtakeScoreFromRate(row.commercial_cents_kwh), `${state} score`).toBe(row.score)
    }
  })
})
