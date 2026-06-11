# 00 — Threat Model & Attack-Surface Inventory

**Tractova security audit · 2026-06-10 · PLAN-ONLY**
Owner: Aden (solo founder). Companion docs: `01`–`04` in this folder.

> **How to read this doc.** It answers three questions before any fix is scoped: *what are we protecting*, *who would attack it and why*, and *where can they reach in*. Sections 1–2 set the stakes (assets and actors). Section 3 runs STRIDE per component (the standard six-threat checklist — **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege). Section 4 is the line-by-line attack-surface inventory. Section 5 draws the trust boundaries. Every claim is grounded in the recon maps and spot-checked against source; anything not confirmable from the repo is flagged **UNVERIFIED** with a manual check.

Acronyms on first use: **SPA** = single-page app (the React front-end). **RLS** = row-level security (Postgres per-row access rules). **PostgREST** = the auto-generated REST API Supabase puts in front of Postgres; the browser hits it directly with the public *anon key*. **PII** = personally identifiable information. **SSRF** = server-side request forgery (tricking our server into fetching an attacker-chosen URL). **JWT** = the signed login token Supabase issues. **CVE** = a publicly catalogued software vulnerability.

---

## 1 — What Tractova is, and what we're protecting

Tractova is a niche B2B intelligence platform for distribution-scale solar developers. It scores U.S. counties/states for community-solar and distributed-generation viability by **synthesizing dozens of public (.gov / lab) datasets** into proprietary scores and methodology. Architecture:

- **Front-end:** Vite + React SPA on Vercel (Hobby plan), served as static files.
- **Data plane:** Supabase (Postgres + Auth + RLS). **The SPA talks to Postgres directly via PostgREST using the public anon key** — RLS is the *only* server-side enforcement for that path.
- **Server plane:** 12 top-level `api/*.js` Vercel serverless functions (Hobby 12-function cap). Underscore-prefixed files under `api/` are modules, not routes.
- **Money/comms:** Stripe (billing), Resend (email), Anthropic API (AI insights). 10 cron jobs drive the data pipeline (`vercel.json:46-87`, verified).

### Crown-jewel assets, ranked

| # | Asset | Why it's the crown jewel | Worst-case loss | Current primary control |
|---|---|---|---|---|
| **A1** | **The synthesized dataset, scores & methodology** (the IP) | This *is* the product. Per CLAUDE.md the data legitimacy is the entire value proposition. Tables like `revenue_rates`, `county_geospatial_data`, `solar_cost_index`, `cs_specific_yield`, score columns. | A competitor clones the differentiator overnight at near-zero cost; the moat evaporates. | RLS `using(true)` SELECT — i.e. **anon-readable** (DB map). **This is the weakest link → F-01.** |
| **A2** | **User accounts + PII** | Login integrity and the small amount of PII (email, profile, saved deal pipeline). Saved projects/notes are commercially sensitive to the *user*. | Account takeover, deal-pipeline exposure, reputational hit for a trust-first product. | Supabase Auth + RLS (`auth.uid()=user_id`); per-user tables verified anon-denied live. Session token in `localStorage` (F-10/F-16). |
| **A3** | **Stripe billing integrity** | Paid Pro tier is the revenue. Granting Pro without payment, or losing payment events, is direct financial loss. | Free Pro access; revenue leakage; double-processing. | Webhook signature verify + idempotency ledger (F-37, intact). Privileged-column trigger 071 (F-29, intact). Anon-callable prune fn threatens the ledger → **F-02**. |
| **A4** | **Anthropic / Resend quotas (spend)** | Every Lens insight is a metered paid Anthropic call; Resend has send quotas. Abuse = uncapped bill, not just downtime. | Surprise four-figure Anthropic bill; Resend reputation/quota burn from forced sends. | Per-user rate limit on `api_call_log` — but **fails OPEN on infra error and has no global/daily ceiling** (F-05). Prompt size uncapped (F-03). |
| **A5** | **Admin plane** | One admin profile curates 8+ market tables that feed every user's scores. Compromise = poison the product at the source. | Mass data poisoning; silent score manipulation; no audit trail to detect it. | `isAdminFromBearer` role check; **legacy email fallback still live** (F-25); admin DB writes are **client-direct, RLS-only, and unlogged** (F-06). |
| **A6** | **Data-pipeline integrity (.gov → us)** | 10 crons scrape Census, EIA, NREL, USDA, ArcGIS, state utility portals. A poisoned upstream feeds bad scores into the IP. | Garbage-in scores erode the "honest data" value prop; silent corruption. | SSRF guards on variable-URL fetches (F-33/F-34, intact); but untrusted XLSX parsing (F-07/F-26) and best-effort idempotency. |
| **A7** | **Email / domain reputation** | Resend on `send.tractova.com`; deliverability depends on not being abused as a spam/relay vector. | Domain blacklisting kills transactional + alert email. | Cron-gated send endpoints; admin-only test path (5/hr); D1 PII-by-id logging intact (F-40). |

**Ranking logic:** A1 first because its loss is *strategic and permanent* (the moat) and it's currently the least-protected (anon-readable). A2/A3 next as direct user-trust and revenue harms. A4 is uncapped-spend (recoverable but painful). A5/A6 are integrity-of-the-source. A7 is real but the controls are comparatively solid.

---

## 2 — Threat actors & motivations

Scoped realistically for a niche B2B SaaS run by one founder. **No nation-state modelling** — the economics don't attract APT-grade adversaries. Actors are ordered by likelihood × impact.

| Actor | Motivation | Capability | Most likely path | Maps to |
|---|---|---|---|---|
| **Competitor / data scraper** | Steal the synthesized dataset — the entire differentiator — for free. | Low-skill: a `curl` loop against the public PostgREST endpoint with the anon key (lifted from the JS bundle). | Walk every `using(true)` table via `?select=*&limit=...` pagination. | **A1 · F-01** |
| **Bot / fraudulent signup** | Burn Anthropic quota (cost amplification) or farm free-tier value. | Scripted signups + scripted Lens calls; fail-open rate limiter helps them. | Mass-create accounts (captcha is the gate — **UNVERIFIED live**), hammer `lens-insight`, exploit uncapped prompt arrays. | **A4 · F-03, F-05** |
| **Credential-stuffer / account-takeover** | Hijack a paying user's account and their deal pipeline. | Reuses breached creds; opportunistic. | `signInWithPassword` brute/stuff; enumerate accounts via the distinct "email not confirmed" error; steal `localStorage` token via any XSS. | **A2 · F-09, F-10** |
| **Opportunistic CVE / endpoint scanner** | Spray known exploits + probe misconfig; not targeting Tractova specifically. | Automated scanners hitting public endpoints + npm advisories. | Hit unauth public endpoints (`last-refresh`, `memo-view`), fuzz for stack traces (F-15), test the anon-callable prune RPC (F-02). | **A3, A5 · F-02, F-15** |
| **Supply-chain (npm)** | Slip malicious code into a transitive dependency that runs in build or runtime. | Typosquat / compromised maintainer / lockfile tamper. | A poisoned package executes at build (secrets in env) or in a serverless fn. No lockfile-lint/OSV gate today. | All assets · **F-17–F-20** |
| **Malicious .gov-source / MITM** | Feed poisoned data through a scraped upstream (or a hijacked utility CDN link). | Requires compromising/MITMing an upstream host — moderate effort, plausible for utility-CDN (non-`.gov`) sources. | Serve a malformed/oversized XLSX or off-origin redirect to the MD scraper; corrupt scores silently. | **A6 · F-07, F-26** |
| **Curious / shared-machine insider** | Read another user's Pro results or session left in a browser. | No tooling; physical/session access. | `sessionStorage` Pro results readable post-logout until tab close (F-stale); localStorage token on a shared machine. | **A2** |

**Explicitly out of scope:** nation-state, physical datacenter compromise, Supabase/Vercel/Stripe platform breach (their responsibility), and social-engineering of the founder (process control, not code).

---

## 3 — STRIDE analysis per component

Each component gets the six-threat pass. **bold** = a live confirmed finding; *italic* = control intact / accepted; plain = inherent surface to keep in mind.

### 3.1 The SPA (React front-end, static on Vercel)

| Threat | Assessment |
|---|---|
| **S**poofing | Login is Supabase Auth; tokens in `localStorage` (`src/lib/supabase.js:19-22`, verified — no `auth` options block). Captcha on signup/signin/reset, **but falls back to hCaptcha's public TEST sitekey if `VITE_HCAPTCHA_SITEKEY` unset at build** — UNVERIFIED whether prod env is set. |
| **T**ampering | No `dangerouslySetInnerHTML` anywhere in `src/` (grep-clean). One un-allowlisted `href={item.url}` from `news_feed` (**F-NewsFeed**, client map gap #2) — a poisoned admin-curated row could inject `javascript:`. Markdown render scheme-allowlists (*F-38 intact*). |
| **R**epudiation | Client-side only; no client-side audit expectation. Admin writes go client-direct and are **unlogged** (F-06) — covered under admin plane. |
| **I**nfo disclosure | **Session token in `localStorage` → any XSS = full session theft (F-10).** Pro results persist in `sessionStorage`, readable post-logout on shared machines (client gap #9). Source maps off (*verified default*). VITE_ vars are public-by-design. |
| **D**enial of service | Static SPA on CDN; low DoS surface. |
| **E**levation | Admin gate is **cosmetic** (`profiles.role==='admin'` client check with email fallback) — real enforcement is RLS on the 8 admin tables (**UNVERIFIED for 5 pre-001 tables**, DB gap #3). |

### 3.2 The `api/*` serverless functions (12 routes)

| Threat | Assessment |
|---|---|
| **S**poofing | JWT verified via `supabaseAdmin.auth.getUser`; cron secret compared constant-time (*F-31 intact*). **Legacy admin-email fallback still live (F-25)** — any error in the role lookup grants admin to the hardcoded email. |
| **T**ampering | Stripe redirect URLs validated (*F-36 intact*). `_health-export` sets `Content-Disposition` filename from unsanitized `?table` (header-injection surface, API gap #8). |
| **R**epudiation | **Auth denials, rate-limit trips, and cron-secret mismatches are never logged to any queryable store (F-21).** Vercel Hobby log tail ~1h; Axiom only captures instrumented events and may be a no-op if unset (F-22). |
| **I**nfo disclosure | **500 handlers return `err.message` + truncated stack to the client (F-15).** `data-health?action=last-refresh` is **fully public** and leaks cron freshness timestamps (API gap #4). `?debug=1` echoes upstream Census bytes (admin-gated). |
| **D**enial of service / spend | **Rate limiters fail OPEN on Supabase error → all metering off during an outage (F-05).** No global/daily Anthropic ceiling. **Lens prompts built from uncapped client arrays (F-03).** `refresh-ix-queue` / `refresh-substations` have **no HTTP-method filter** (API gap #1) — any verb past auth runs the scraper. |
| **E**levation | SSRF guard is the single chokepoint for variable-URL fetches (*F-33 intact*). `classify-docket` / `policy-classify` fetch arbitrary URLs but are Pro+admin gated and SSRF-guarded. |

### 3.3 Supabase direct-access path (browser → PostgREST, anon key under RLS)

| Threat | Assessment |
|---|---|
| **S**poofing | Anon key is public (in the bundle by design); identity beyond "anonymous vs logged-in-uid" comes only from the JWT. |
| **T**ampering | Per-user write tables guarded by `auth.uid()=user_id`; `projects` UPDATE has WITH CHECK (*F-30 intact*); profiles privileged columns trigger-guarded (*F-29 intact*). profiles UPDATE still lacks WITH CHECK (DB gap #4 — future privileged column would be unguarded). |
| **R**epudiation | `project_events` is append-only audit per project; admin curation is **not** audited (F-06). |
| **I**nfo disclosure | **Every market/synthesized table is `using(true)` = anon-readable → the IP is bulk-exfiltratable (F-01).** S-class tables (cron_runs, api_call_log, etc.) correctly anon-denied (live-verified). **5 pre-001 tables have no repo-tracked RLS (DB gap #3, UNVERIFIED).** |
| **D**enial of service | PostgREST `db-max-rows` UNVERIFIED — no row budget seen, so bulk walks are cheap. |
| **E**levation | **`prune_webhook_events_older_than_days()` is SECURITY DEFINER with no EXECUTE revoke → if Supabase defaults stand, any anon caller can wipe the Stripe idempotency ledger (F-02, UNVERIFIED live ACL).** `is_admin()` retains the email-fallback OR-clause (F-25); 080 reintroduced email-literal write policies on `nmtc_lic_tracts` (F-08). |

### 3.4 Stripe webhook (`api/webhook.js`)

| Threat | Assessment |
|---|---|
| **S**poofing | *Signature verified on the raw body via `constructEvent` (F-37 intact).* No JWT (correct — Stripe is the caller). |
| **T**ampering | *`client_reference_id` validated against a real profile; Pro granted only by verified event (F-37).* |
| **R**epudiation | Idempotency ledger `webhook_events_processed` dedups replays — but **processing continues if the dedup probe throws** (API gap #12), degrading to best-effort. |
| **I**nfo disclosure | Minimal; webhook responses are terse. 500 path should not leak (cross-check F-15 pattern). |
| **D**enial of service | **The idempotency ledger can be wiped by F-02, re-opening replay races.** |
| **E**levation | Privileged-column writes funnel through service-role; the 071 trigger only permits service-role to touch tier/status (*F-29 intact*). |

### 3.5 Cron pipeline (10 jobs → scraper endpoints)

| Threat | Assessment |
|---|---|
| **S**poofing | *Vercel injects `Authorization: Bearer CRON_SECRET`; endpoints compare constant-time and never trust `x-vercel-cron` alone when the secret is set (F-31 intact).* CRON_SECRET set in prod is **UNVERIFIED**. |
| **T**ampering | **Untrusted utility XLSX parsed by NJ/VA/WI/CA/MD scrapers (F-07/F-26)** — several from utility CDNs (azureedge.net), not strictly `.gov`. MD scraper follows a **runtime-discovered absolute URL** into `XLSX.read` (F-07). |
| **R**epudiation | Cron runs logged to `cron_runs` — but **`check-staleness` self-prunes `cron_runs` (>6mo) and `data_updates` (>1yr) every week with no guard/backup (F-24)**, eroding the audit trail. |
| **I**nfo disclosure | Scrapers read public sources; low disclosure. |
| **D**enial of service | **Workbooks read fully into memory with no byte cap (F-26)** — an oversized upstream file can exhaust the function. No method filter on two scraper endpoints (API gap #1). |
| **E**levation | Scrapers run as service-role (RLS-bypassing) — a parsing bug that writes attacker-controlled rows poisons the IP directly (A6). |

### 3.6 Email (Resend: alerts, digest, staleness)

| Threat | Assessment |
|---|---|
| **S**poofing | Send endpoints cron-gated; admin TEST path role-checked except **`send-digest` still uses hardcoded `user.email===ADMIN_EMAIL`** (API gap #2, F-25-adjacent). |
| **T**ampering | Slack webhook target is user-set but *SSRF-guarded by exact-host allowlist (F-34 intact)*. |
| **R**epudiation | *PII logged by `profile.id`, not email (F-40 intact).* |
| **I**nfo disclosure | Public surfaces never render raw email (*D1 intact*). |
| **D**enial of service | Admin TEST path rate-limited 5/hr; cron path unthrottled by design. Forced-send abuse needs admin, so low. |
| **E**levation | None beyond the admin-gate consistency gap (send-digest hardcoded email). |

### 3.7 Admin surface (`/admin` UI + client-direct curation writes)

| Threat | Assessment |
|---|---|
| **S**poofing | Client gate cosmetic; **legacy email fallback in both client and server (F-25)**. |
| **T**ampering | Admin writes go **directly to Supabase with the anon key under RLS** (`src/lib/programData.js`) — client gate is decorative; RLS on the 8 tables is the real control (**5 of them UNVERIFIED**). |
| **R**epudiation | **No audit trail — `admin_audit_log` + `logAdminAction()` are dead code (F-06).** A rogue/compromised admin leaves no trace. |
| **I**nfo disclosure | `data-health` admin actions can `export` whole tables (≤10k rows) — tagged with `exported_by: user.email`. |
| **D**enial of service | n/a meaningfully. |
| **E**levation | A single compromised admin = full product-data poisoning (A1/A6). The email fallback (F-25) + 080 email policy (F-08) keep an attacker-known literal as a trust anchor. |

---

## 4 — Attack-surface inventory

Every externally reachable entry point from the recon maps. **Auth** = gate that must pass. **RL** = rate limit. **Data exposed** = what a successful call returns/touches. **Abuse value** = why an attacker cares. Cited line refs are from the API/client/DB maps (spot-verified for `vercel.json`, `_cors.js`, `_admin-auth.js`, `supabase.js`).

### 4.1 Server routes — `api/*` functions

| Route / action | Auth | RL | Data exposed | Abuse value |
|---|---|---|---|---|
| `POST /api/webhook` (Stripe) | Stripe sig verify | none | Grants/revokes Pro on `profiles` | High — billing integrity; dedup degrades on probe error (gap #12) |
| `POST /api/lens-insight` (gated actions) | JWT + Pro tier | 10/min + 60/hr per user, **fail-open** | Anthropic insights; writes `ai_response_cache` | High — **paid spend amplification (F-03/F-05)**; cache poisoning (F-04) |
| `POST /api/lens-insight` `memo-view` | **PUBLIC** (token ≥16 chars) | **none** | Frozen memo snapshot; increments view_count via service-role | Med — token enumeration/abuse, no RL (gap #11) |
| `POST /api/lens-insight` `market-brief` | **PUBLIC** | shared limiter | Weekly cached Anthropic brief | Low-Med — public AI surface |
| `POST /api/lens-insight` `classify-docket`/`policy-classify` | **Pro + admin** | yes | Fetches arbitrary URL (SSRF-guarded) + Anthropic; base64 PDF ≤6MB | Med — admin-gated large-doc ingest (gap #10) |
| `GET/POST /api/refresh-data` | CRON_SECRET ∥ admin JWT ∥ x-vercel-cron(no-secret) | none | Triggers scrapers; `?debug=1` echoes Census bytes | Med — admin-gated; `ix_manual` admin-only |
| `* /api/refresh-ix-queue` | CRON_SECRET ∥ admin JWT ∥ cron | none | Runs 6 utility scrapers; writes `ix_queue_data` | Med — **no method filter (gap #1)**; untrusted XLSX |
| `* /api/refresh-substations` | CRON_SECRET ∥ admin JWT ∥ cron | none | EIA scrape; writes `substations` | Med — **no method filter (gap #1)** |
| `GET/POST /api/refresh-capacity-factors` | CRON_SECRET ∥ admin JWT ∥ cron | none | NREL PVWatts; writes `revenue_rates` | Low |
| `GET/POST /api/send-alerts` | CRON_SECRET ∥ admin JWT(→TEST) ∥ cron | TEST 5/hr | Resend send; user Slack webhook (SSRF-guarded) | Med — email reputation |
| `GET/POST /api/send-digest` | CRON_SECRET ∥ **hardcoded admin email**(→TEST) ∥ cron | none | Resend digest | Low-Med — **gate inconsistency (gap #2)** |
| `GET/POST /api/check-staleness` | CRON_SECRET ∥ cron — **no admin path** | none | RPC freshness; **DELETEs cron_runs/data_updates** | Med — **unguarded destructive prune (F-24)** |
| `GET /api/data-health` `last-refresh` | **PUBLIC** | none | Cron freshness timestamps | Low-Med — **operational leak to anon (gap #4)** |
| `GET /api/data-health` `health-summary` | HEALTH_CHECK_TOKEN | none | Aggregate counts (no PII) | Low |
| `GET /api/data-health` `export` / staging / freshness | admin JWT | none | Full table dumps ≤10k rows; staging promote | Med — **unsanitized `?table` filename (gap #8)**; no audit (F-06) |
| `POST /api/create-checkout-session` | JWT | 5/hr | Stripe checkout URL (validated redirect) | Med — client-supplied priceId/URLs, server-validated |
| `GET/POST /api/create-portal-session` | JWT | none | Stripe portal URL; invoice list | Low-Med |

### 4.2 Browser → Supabase PostgREST (anon key, RLS-enforced)

| Surface | Auth | RL | Data exposed | Abuse value |
|---|---|---|---|---|
| SELECT on market/synthesized tables (`revenue_rates`, `county_geospatial_data`, `solar_cost_index`, `cs_specific_yield`, `cs_projects`, `nmtc_lic_tracts`, etc.) | **anon (`using(true)`)** | **none / db-max-rows UNVERIFIED** | **The entire synthesized dataset** | **Critical — F-01, the IP is freely scrapable** |
| SELECT/INSERT/UPDATE/DELETE on per-user tables (`projects`, `saved_*`, `scenario_snapshots`, `project_events`, `cancellation_feedback`) | JWT, `auth.uid()=user_id` | none | Caller's own rows only (live-verified anon=0) | Low — ownership enforced |
| UPDATE `profiles` (non-privileged cols + `slack_webhook_url`) | JWT, own row; 071 trigger guards tier/role/stripe | none | Own profile; alert prefs | Med — `slack_webhook_url` is user-set fetch target (SSRF-adjacent, guarded by F-34) |
| INSERT/UPDATE on 8 admin-curated tables | **RLS `is_admin()` (5 pre-001 UNVERIFIED)** | none | Market data that feeds all scores | **High — poisoning vector if RLS gap (gap #3); unlogged (F-06)** |
| RPC `get_data_freshness` / `get_dashboard_metrics` | anon-callable, invoker RLS | none | Public-table aggregates; **enumerates internal cron names** | Low |
| RPC `prune_webhook_events_older_than_days` | **SECURITY DEFINER, EXECUTE not revoked** | none | **Deletes the Stripe idempotency ledger** | **Med — F-02, anon could wipe replay defense (UNVERIFIED ACL)** |
| Realtime channel on `profiles` UPDATE | JWT | n/a | Own profile updates (authz UNVERIFIED) | Low — confirm realtime authz |

### 4.3 Auth & public web surfaces (SPA)

| Surface | Auth | RL | Data exposed | Abuse value |
|---|---|---|---|---|
| `signUp` (SignUp.jsx) | captcha (TEST-sitekey fallback UNVERIFIED); HIBP/length client-only fail-open | Supabase Auth limits UNVERIFIED | Account creation | Med — **bot signups burn AI quota (A4)**; client checks replayable |
| `signInWithPassword` (SignIn.jsx) | captcha | Supabase Auth limits UNVERIFIED | Session JWT | Med — **enumeration via distinct "email not confirmed" (F-09)**; cred-stuffing |
| `resetPasswordForEmail` / `updateUser` recovery | captcha (none on update step, by design) | UNVERIFIED | Password reset | Med — recovery flow; no captcha on update |
| `/memo/:token` (MemoView) | **public token** | server-side view-cap, **no RL** | Frozen shared memo | Med — token enumeration (gap #11) |
| Stripe checkout redirect (`UpgradePrompt.jsx`) | JWT bearer | server 5/hr | Redirect to Stripe URL | Low — server-validated |
| CSV upload (`IxManualUpload.jsx` → `ix_manual`) | admin JWT | none | Writes `ix_queue_data` | Low-Med — admin-only; text-parsed client-side |

### 4.4 External-source ingestion (cron-driven, no inbound auth — the source is the "input")

| Surface | Trust | Data exposed | Abuse value |
|---|---|---|---|
| Census / EIA / NREL / USDA / ArcGIS fetches | `.gov`/lab hosts, fixed | Writes market tables | Low-Med — MITM/poisoning needs upstream compromise |
| NJ/VA/WI/CA/MD utility XLSX scrapers | **utility CDNs (azureedge.net, sitecore) — not strictly `.gov`** | Parsed into `ix_queue_data` | **Med — untrusted workbook parse (F-07/F-26); MD follows runtime URL** |
| RSS news feeds + Anthropic classify | 4 fixed feeds | Writes `news_feed` | Low-Med — poisoned item → un-allowlisted href (client gap #2) |

---

## 5 — Trust boundaries (ASCII)

Lines crossing a `╪` or `═══` boundary are where identity/trust changes hands and where a control must sit. **Bold callouts** mark where a confirmed finding weakens the boundary.

```
                            ┌─────────────────────────────────────────────┐
   ATTACKERS / SCRAPERS     │              PUBLIC INTERNET                 │
   (competitor, bot,        │                                             │
    cred-stuffer, scanner)  └───────────────────┬─────────────────────────┘
        │                                       │
        │  curl + anon key (from bundle)        │  normal user / browser
        ▼                                       ▼
 ══════════════════════════════ TRUST BOUNDARY 1 ══════════════════════════════
        │                                       │
        │                          ┌────────────────────────┐
        │                          │   SPA (static, Vercel)  │  CDN-served
        │                          │   anon key + JWT in     │  ◀── token in
        │                          │   localStorage          │      localStorage
        │                          └───────┬────────┬────────┘   ⚠ F-10: XSS=theft
        │                                  │        │
        │  (A) browser→PostgREST           │        │  (B) browser→api/*
        │      DIRECT, anon key            │        │      JWT bearer
        ▼                                  ▼        ▼
 ═════════════════════════ TRUST BOUNDARY 2 (RLS / JWT gate) ═══════════════════
        │                                  │        │
        ▼                                  ▼        ▼
 ┌──────────────────────────┐     ┌──────────────────────────────────────┐
 │  Supabase PostgREST      │     │  api/* serverless (12 fns)           │
 │  ── RLS is the ONLY gate │     │  ── JWT + Pro/admin + cron-secret    │
 │  ⚠ F-01 market tables    │     │  ⚠ F-03/F-05 spend uncapped/fail-open│
 │     using(true)=anon-read│     │  ⚠ F-15 stack traces leak            │
 │  ⚠ F-02 prune RPC        │     │  ⚠ F-25 legacy email admin fallback  │
 │     anon-executable?     │     │  ⚠ F-21 denials unlogged             │
 └──────────┬───────────────┘     └───┬──────────┬──────────┬────────────┘
            │ service-role             │ service- │ Stripe   │ Anthropic /
            │ (RLS bypass)             │ role     │ SDK      │ Resend
            ▼                          ▼          ▼          ▼
 ┌────────────────────────────────────────────┐  │   ┌───────────────────┐
 │   Postgres (Supabase) — the data plane     │◀─┘   │ 3rd-party paid     │
 │   profiles · projects · market/IP tables   │      │ services (A4 spend)│
 └────────────────────────────────────────────┘      └───────────────────┘
            ▲                          ▲
            │ service-role writes      │
 ═══════ TRUST BOUNDARY 3 (cron secret) ═══════        ══ TRUST BOUNDARY 4 ══
            │                          │                  (Stripe → us)
   ┌────────┴──────────┐      ┌────────┴─────────┐      ┌──────────────────┐
   │ Vercel Cron       │      │ Scraper fetches  │      │ Stripe webhook   │
   │ Bearer CRON_SECRET│      │ to EXTERNAL srcs │      │ POST + signature │
   │ (F-31 intact)     │      │ .gov + utility   │      │ (F-37 intact)    │
   └───────────────────┘      │ CDNs ⚠ F-07/F-26 │      │ ⚠ F-02 ledger    │
                              └────────┬─────────┘      │   wipe re-opens  │
                                       │ untrusted XLSX │   replay         │
                                       ▼                └──────────────────┘
 ═══════════════════ TRUST BOUNDARY 5 (untrusted upstream) ════════════════════
                          ┌──────────────────────────┐
                          │ External .gov / lab /     │
                          │ utility-CDN data sources  │  ◀── MITM/poisoning
                          │ (Census, EIA, NREL, NJ/MD │      actor (A6)
                          │  utility XLSX, RSS)       │
                          └──────────────────────────┘
```

**Boundary summary:**
- **TB1 (Internet → SPA):** anyone can load the SPA and lift the anon key. Nothing secret should depend on the SPA hiding it.
- **TB2 (SPA → data/api):** the *critical* boundary. Path **(A)** browser→PostgREST is guarded **only by RLS** — F-01 (anon-readable IP) and F-02 (anon-executable prune) live here. Path **(B)** browser→api is guarded by JWT + tier/admin + the fail-open rate limiter (F-05).
- **TB3 (Cron → api):** `CRON_SECRET` constant-time compare, intact (F-31); confirm the secret is actually set in prod.
- **TB4 (Stripe → webhook):** signature-verified (F-37); the idempotency ledger behind it is threatened by F-02.
- **TB5 (Upstream → cron):** the source data is *untrusted input*; utility-CDN XLSX (F-07/F-26) is the soft spot.

---

## 6 — UNVERIFIED items (manual checks required before relying on these)

These cannot be confirmed from the repo alone; each needs an out-of-band check before the threat model treats it as fact.

| # | Claim | How to verify |
|---|---|---|
| U1 | RLS write-policy state of the 5 pre-001 tables (`state_programs`, `news_feed`, `county_intelligence`, `revenue_stacks`, `data_updates`) | Supabase SQL editor: `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename in (...);` and `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r';` |
| U2 | EXECUTE ACL on `prune_webhook_events_older_than_days` (F-02) — do **not** call it to test | `select proacl from pg_proc where proname='prune_webhook_events_older_than_days';` — if `anon`/`authenticated` appear, F-02 is live |
| U3 | `CRON_SECRET`, `AXIOM_TOKEN`, `AXIOM_DATASET`, `VITE_HCAPTCHA_SITEKEY` actually set in Vercel Production | Vercel → Settings → Environment Variables (presence only; never print values) |
| U4 | Supabase Auth settings: captcha secret active, password min length ≥10, confirm-email obfuscation on, auth rate limits | Supabase dashboard → Authentication → Settings |
| U5 | PostgREST `db-max-rows` bulk-read cap (affects F-01 scrape cost) | Supabase → Settings → API → Max Rows |
| U6 | `profiles_guard_privileged_columns` trigger attached + enabled live (F-29 depends on it) | `select tgname, tgenabled from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal;` |
| U7 | Realtime authorization on the `profiles` channel | Supabase → Realtime settings / channel authorization |

---

*End of 00 — Threat Model & Attack-Surface Inventory. Risk-ranked findings (F-01…F-43) are detailed in the companion findings doc; this document supplies the actor/asset/boundary context that ranks them.*
