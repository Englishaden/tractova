/**
 * One-off: seed policy_impact_events for the 19 CS-program states.
 * For each URL, POSTs to prod /api/lens-insight policy-classify and writes
 * the resulting draft directly into policy_impact_events via service-role,
 * mimicking what the admin Quick-Add UI's auto-publish toggle does.
 *
 * discovered_via='manual_batch' so these are distinguishable from
 * admin-curated and news-scan rows.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of raw.split(/\r?\n/)) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const URLS = [
  // NY — VDER explainer + DER valuation order context
  ['NY', 'https://www.utilitydive.com/news/new-york-issues-der-valuation-order-under-rev-docket-to-transition-from-net/437775/'],
  ['NY', 'https://www.ascendanalytics.com/blog/new-york-vder-program-value-of-distributed-energy-resources'],
  // IL — Illinois Shines PY 2025-26
  ['IL', 'https://illinoisshines.com/welcome-to-illinois-shines-program-year-2025-26/'],
  ['IL', 'https://www.concentro.io/blog/illinois-shines'],
  // MA — SMART 3.0 finalized Sept 2025
  ['MA', 'https://pv-magazine-usa.com/2025/09/03/massachusetts-finalizes-smart-3-0-following-emergency-solar-regulations/'],
  ['MA', 'https://www.solarpowerworldonline.com/2025/09/massachusetts-issues-final-smart-3-0-solar-regulations-sets-incentive-capacity-for-2025/'],
  // CO — Inclusive CS effective 2026
  ['CO', 'https://solarbuildermag.com/news/details-on-colorados-push-for-dispatchable-distributed-energy/'],
  ['CO', 'http://leg.colorado.gov/bills/hb19-1003'],
  // MN — credit cuts April 2025
  ['MN', 'https://sahanjournal.com/climate-environment/community-solar-rate-change/'],
  ['MN', 'https://minnesotareformer.com/2025/08/05/xcel-can-pay-lower-rate-to-community-solar-subscribers-minnesota-appeals-court-rules/'],
  // NJ — March 2026 BPU orders, 3,000 MW expansion
  ['NJ', 'https://www.jdsupra.com/legalnews/new-jersey-bpu-issues-march-4-2026-6120957/'],
  ['NJ', 'https://re-nj.com/bpu-greenlights-massive-expansion-of-community-solar-launching-new-3000-megawatt-block/'],
  // MD — permanent program live 2025
  ['MD', 'https://psc.maryland.gov/regulated-utilities/electricity/renewable-energy/community-solar-program/'],
  ['MD', 'https://ilsr.org/articles/marylands-community-solar-program/'],
  // ME — non-LD-1777: CCA (LD 2112) + plug-in solar (LD 1730)
  ['ME', 'https://pv-magazine-usa.com/2026/04/28/maine-becomes-the-11th-state-to-allow-community-choice-aggregation/'],
  ['ME', 'https://pv-magazine-usa.com/2026/04/03/maine-becomes-third-state-to-pass-plug-in-solar-legislation/'],
  // CA — April 2026 CPUC proposed decision
  ['CA', 'https://pv-magazine-usa.com/2026/04/09/california-proposed-decision-on-community-solar-virtually-ensures-no-projects-will-be-built/'],
  ['CA', 'https://www.solarpowerworldonline.com/2026/04/advocacy-groups-say-cpuc-decision-virtually-ensures-no-community-solar-will-get-built-in-california/'],
  // MI — SB 518/519 Sept 2025
  ['MI', 'https://communitysolaraccess.org/news/bipartisan-bills-introduced-to-expand-community-solar-access-in-michigan'],
  ['MI', 'https://michigansolarpartners.com/2025/11/05/michigan-solar-policy-update-2025/'],
  // CT — SCEF Year 7 + PA 25-173
  ['CT', 'https://ctmirror.org/2026/04/28/ct-solar-programs-reauthorize-costs/'],
  ['CT', 'https://portal.ct.gov/pura/electric/office-of-technical-and-regulatory-analysis/clean-energy-programs/new-clean-energy-programs'],
  // FL — utility-led SolarTogether
  ['FL', 'https://www.utilitydive.com/news/florida-signs-off-on-fpls-15-gw-community-solar-program-despite-lack-of-c/573428/'],
  ['FL', 'https://www.moserbaersolar.com/policy-and-regulatory-framework/floridas-community-solar-revolution-powering-local-energy-independence/'],
  // HI — CBRE Tranche 2
  ['HI', 'https://puc.hawaii.gov/energy/cbre/'],
  ['HI', 'https://puc.hawaii.gov/energy/implementation-of-executive-order-no-25-01/'],
  // NM — tariff finalization Nov 2024 / 2025, 300 MW expansion 2026
  ['NM', 'https://nmpoliticalreport.com/2025/01/10/new-mexico-regulators-consider-requests-to-reconsider-aspects-of-community-solar-program/'],
  ['NM', 'https://www.poweradvisoryllc.com/reports/new-mexico-community-solar-program-finally-launches-and-finds-its-footing'],
  // OR — UM 1930
  ['OR', 'https://www.energytrust.org/incentives/community-solar-project-development/'],
  ['OR', 'https://apps.puc.state.or.us/edockets/docket.asp?DocketID=21222'],
  // RI — Community Remote Net Metering
  ['RI', 'https://energy.ri.gov/renewable-energy/net-metering'],
  ['RI', 'https://ilsr.org/article/energy-democracy/rhode-islands-community-solar-program/'],
  // VA — Dominion shared solar minimum bill + SB 254/HB 807 (525 MW expansion)
  ['VA', 'https://www.solarpowerworldonline.com/2026/03/community-solar-expansion-legislation-sent-to-virginia-governor/'],
  ['VA', 'https://communitysolaraccess.org/news/virginia-regulators-advance-dominions-shared-solar-program-expanding-access-to-a-key-energy-affordability-solution'],
  // WA — Fair Access to Community Solar Act
  ['WA', 'https://communitysolaraccess.org/news/fair-access-to-community-solar-bill-would-expand-affordable-energy-access-across-washington-state'],
  ['WA', 'https://communitysolaraccess.org/news/new-study-reveals-community-solar-could-generate-1-76-billion-in-economic-benefits-for-washington-state'],
  // WI — bipartisan legislation status
  ['WI', 'https://www.renewwisconsin.org/clean-energy-legislative-update-september-2025/'],
  ['WI', 'https://seia.org/state-solar-policy/wisconsin-solar/'],
]

const supaAnon  = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const supaAdmin = createClient(process.env.SUPABASE_URL,     process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: auth, error: authErr } = await supaAnon.auth.signInWithPassword({
  email:    process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
})
if (authErr || !auth?.session) {
  console.error('auth failed:', authErr?.message)
  process.exit(1)
}
const jwt = auth.session.access_token
console.log('Authed as', process.env.TEST_USER_EMAIL)

// Skip URLs we've already inserted via prior batch runs.
const { data: existing } = await supaAdmin
  .from('policy_impact_events')
  .select('source_url')
  .eq('discovered_via', 'manual')
const existingUrls = new Set((existing || []).map(r => r.source_url).filter(Boolean))
// Existing state coverage (from prior inserts) — so we don't burn budget
// on second-URL-for-NY when other states still have zero.
const { data: existingByState } = await supaAdmin
  .from('policy_impact_events')
  .select('state')
const stateCoverage = new Map()
for (const r of (existingByState || [])) {
  stateCoverage.set(r.state, (stateCoverage.get(r.state) || 0) + 1)
}
// Reorder: states with 0 rows first (1 URL each), then states with 1 row
// (second URL), then states with 2+ (third URL). Within a tier, original
// order preserved. This maximizes state coverage if we run out of quota.
const pending = URLS.filter(([, u]) => !existingUrls.has(u))
const seenInThisRun = new Map()  // state → count of URLs scheduled this run
const tiered = pending.map((pair, idx) => {
  const [state] = pair
  const existingCount = stateCoverage.get(state) || 0
  const scheduledCount = seenInThisRun.get(state) || 0
  seenInThisRun.set(state, scheduledCount + 1)
  return { pair, originalIdx: idx, tier: existingCount + scheduledCount }
})
tiered.sort((a, b) => a.tier - b.tier || a.originalIdx - b.originalIdx)
const todo = tiered.map(t => t.pair)
console.log(`Already in DB: ${existingUrls.size}   To process: ${todo.length} / ${URLS.length}`)
console.log(`Order: ${todo.slice(0, 5).map(([s]) => s).join(',')} ... ${todo.slice(-5).map(([s]) => s).join(',')}\n`)

const THROTTLE_MS = 8000  // 8s/call → 7.5/min, under 10/min burst limit
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const out = []
let inserted = 0
let failed   = 0

for (let i = 0; i < todo.length; i++) {
  const [state, url] = todo[i]
  const tag = `[${(i+1).toString().padStart(2,'0')}/${todo.length}] ${state}`
  process.stdout.write(`${tag} ${url.slice(0, 70)} ... `)

  // throttle (skip on first iteration)
  if (i > 0) await sleep(THROTTLE_MS)

  let resp, body, json, attempt = 0
  while (true) {
    attempt++
    try {
      const t0 = Date.now()
      resp = await fetch('https://www.tractova.com/api/lens-insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'policy-classify', rawText: url, stateHint: state }),
      })
      body = await resp.text()
      try { json = JSON.parse(body) } catch {}
      var ms = Date.now() - t0

      if (resp.status === 429 && attempt <= 2) {
        const sec = json?.retryAfterSec || 65
        process.stdout.write(`429 → wait ${sec}s ... `)
        await sleep(sec * 1000 + 2000)
        continue
      }
      break
    } catch (err) {
      console.log(`THROWN — ${err.message}`)
      failed++
      out.push({ state, url, ok: false, reason: err.message })
      resp = null
      break
    }
  }
  if (!resp) continue

  try {
    if (!resp.ok || (!json?.draft && !json?.drafts) || json.fallback) {
      console.log(`FAIL (${resp.status}, ${ms}ms) — ${json?.reason || body.slice(0,80)}`)
      failed++
      out.push({ state, url, ok: false, reason: json?.reason || `http ${resp.status}` })
      continue
    }

    // Tiered policies return drafts[] (one per MW band). Single-tier returns
    // drafts=[draft] (post v=6) or just draft (legacy cache hits). Iterate.
    const allDrafts = Array.isArray(json.drafts) && json.drafts.length > 0
      ? json.drafts
      : (json.draft ? [json.draft] : [])
    if (allDrafts.length === 0 || !allDrafts[0].state || !allDrafts[0].event_name) {
      console.log(`SKIP — classifier returned no state/event_name (${ms}ms)`)
      failed++
      out.push({ state, url, ok: false, reason: 'no state/event_name' })
      continue
    }

    let tiersInserted = 0
    let lastInsertErr = null
    for (const draft of allDrafts) {
      const payload = {
        state:                          draft.state.toUpperCase(),
        event_name:                     draft.event_name,
        event_type:                     draft.event_type || 'enacted_bill',
        effective_date:                 draft.effective_date || null,
        status:                         draft.status || 'enacted',
        pillar:                         draft.pillar || 'cross-cutting',
        capex_impact_per_mw_usd:        draft.capex_impact_per_mw_usd ?? null,
        irr_impact_bps:                 draft.irr_impact_bps ?? null,
        ongoing_fee_per_mw_yr_usd:      draft.ongoing_fee_per_mw_yr_usd ?? null,
        revenue_haircut_pct:            draft.revenue_haircut_pct ?? null,
        impact_confidence:              draft.impact_confidence || 'low',
        impact_methodology:             draft.impact_methodology || null,
        applies_to_new_applications:    !!draft.applies_to_new_applications,
        applies_to_existing_queue:      !!draft.applies_to_existing_queue,
        applies_to_operating_projects:  !!draft.applies_to_operating_projects,
        safe_harbor_eligible:           !!draft.safe_harbor_eligible,
        safe_harbor_cutoff_date:        draft.safe_harbor_cutoff_date || null,
        safe_harbor_notes:              draft.safe_harbor_notes || null,
        feoc_compliance_required:       !!draft.feoc_compliance_required,
        feoc_notes:                     draft.feoc_notes || null,
        min_mw_ac:                      draft.min_mw_ac ?? null,
        max_mw_ac:                      draft.max_mw_ac ?? null,
        summary:                        draft.summary || 'Imported via batch seed',
        analyst_note:                   draft.analyst_note || null,
        source_url:                     draft.source_url || url,
        discovered_via:                 'manual',
        discovery_metadata:             { batch_seed: true, batch_run_at: new Date().toISOString(), raw_provisions: draft.raw_provisions ?? null, tier_label: draft.discovery_metadata?.tier_label ?? null },
        review_status:                  'published',
        is_active:                      true,
        verified_at:                    new Date().toISOString(),
      }
      const { error: insErr } = await supaAdmin.from('policy_impact_events').insert(payload)
      if (insErr) { lastInsertErr = insErr.message; continue }
      tiersInserted++
    }
    if (tiersInserted === 0) {
      console.log(`INSERT FAIL — ${lastInsertErr || 'unknown'}`)
      failed++
      out.push({ state, url, ok: false, reason: lastInsertErr || 'no tiers inserted' })
      continue
    }
    const tierTag = tiersInserted > 1 ? ` (${tiersInserted} tiers)` : ''
    console.log(`OK (${ms}ms) — ${allDrafts[0].state} ${allDrafts[0].event_name}${tierTag} [${allDrafts[0].event_type}/${allDrafts[0].pillar}, conf=${allDrafts[0].impact_confidence}]`)
    inserted += tiersInserted
    out.push({ state, url, ok: true, draft_state: allDrafts[0].state, event_name: allDrafts[0].event_name, ms, tiers: tiersInserted })
  } catch (err) {
    console.log(`THROWN — ${err.message}`)
    failed++
    out.push({ state, url, ok: false, reason: err.message })
  }
}

console.log('\n─────────────────────────────')
console.log(`Inserted: ${inserted} / ${URLS.length}   Failed: ${failed}`)
console.log('By state:')
const byState = {}
out.forEach(r => { byState[r.state] = byState[r.state] || { ok: 0, fail: 0 }; byState[r.state][r.ok ? 'ok' : 'fail']++ })
Object.entries(byState).sort().forEach(([s, c]) => console.log(`  ${s}: ${c.ok} ok / ${c.fail} fail`))
