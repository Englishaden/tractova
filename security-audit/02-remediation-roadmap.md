# Tractova Security Audit — Phased Remediation Roadmap

**Doc 02 of 5 · 2026-06-10 · Companion docs:** `00-threat-model.md`, findings detail (`01-findings.md`), `03-guardrails-spec.md` (CI/hooks), manual-verification checklist (`04-unverified-checklist.md`). The executive summary is §1 of `01-findings.md` — there is no separate doc 05.

---

## Summary

The 2026-06-10 audit confirmed **27 findings: 0 Critical, 1 High, 6 Medium, 20 Low**, plus **17 prior-fix controls re-verified intact** (doc 01 §3 — no action). No secret was found in the repo, git history, or client bundle (F-27), so **nothing needs emergency rotation based on repo evidence**. The one open rotation question is the leftover 2026-05-31 ".env.local creds" task, which only Aden can answer (P0-4 below).

That means P0 is **not** a firefight. It is a ~3-hour block of (a) two tiny fixes and (b) a live-dashboard verification sweep, because several findings change severity depending on live state the repo cannot show — most importantly whether `CRON_SECRET` is actually set in Vercel production. **If any P0 sweep check fails, the escalation table in §P0 tells you what jumps to same-day.**

The single biggest item by value and effort is **F-01** (the entire synthesized dataset — the product's IP — is bulk-readable by an unauthenticated visitor straight off the Supabase REST endpoint). It is split across P1 (stop the bleeding) and P2 (the durable architecture), because the durable fix requires a product decision about what the free tier shows.

| Phase | Theme | Items | Focused hours |
|---|---|---|---|
| **P0** — same day | Live-state verification + two 10-minute fixes + rotation question | 5 | ~3–4 h |
| **P1** — this week | The High (first stage) + all cheap Mediums + cheap high-value Lows | 12 | ~12–15 h |
| **P2** — hardening (weeks 2–4) | Remaining Mediums/Lows, structural re-architecture, logging/alerting | 17 | ~22–28 h |
| **P3** — guardrails | CI gates + hooks so this class of finding can't regress silently | see doc 03 | ~4–6 h |

**House constraints respected throughout:** migrations are *written by Claude, applied manually by Aden* (every "apply migration" step below is Aden's step); Vercel Hobby caps the project at **12 top-level `api/*.js` functions** (the project is AT cap — every new endpoint below multiplexes into an existing function, e.g. `api/lens-insight.js` actions or `api/handlers/_*.js` modules); prod ships via `git push origin main` + CI, never `vercel deploy --prod`.

**Effort key:** S = ≤1 h · M = 2–4 h · L = 1–3 days.

---

## P0 — Fix before anything else (same day, ~3–4 h)

No confirmed Criticals exist, so P0 is dominated by **closing the unknowns that could BE criticals**. Do these in order.

| # | Finding(s) | What to do | Effort | Dependency ordering | Verify |
|---|---|---|---|---|---|
| P0-1 | (unverified list; backs F-02, F-05, F-22, F-25, F-29–31) | Run the **live-state verification sweep** — the 4-block dashboard checklist below (Vercel env, Supabase, GitHub, Anthropic console). Record pass/fail per item. | M (~2 h) | Nothing depends on it landing first, but **everything in P1/P2 that touches live state assumes its results** — do it before any other security work today. | The sweep IS the verification. Capture results into the manual-verification doc (doc 04). Read-only probes that help: `node scripts/probe-rls-policies.mjs`, `node scripts/probe-cron-runs.mjs`, `node scripts/probe-axiom.mjs` (after P0-3), `node scripts/check-migrations.mjs`. |
| P0-2 | **F-02** (Medium) | Write migration revoking EXECUTE on `prune_webhook_events_older_than_days(int)` from `public, anon, authenticated` — an anonymous visitor can currently RPC-wipe the Stripe webhook idempotency ledger. | S | Claude writes `supabase/migrations/08x_*.sql` today → **Aden applies manually** (house rule). Can be batched with F-08's migration in one SQL-editor session. Do NOT test by calling the function — it is destructive. | After apply: SQL editor `select proname, proacl from pg_proc where proname='prune_webhook_events_older_than_days';` — proacl must not list anon/authenticated. Service-role maintenance path is unaffected (bypasses grants), so nothing breaks. `npm run verify` not needed (no app code touched). |
| P0-3 | **F-13** (Low, but it's a secret-hygiene leak in a tool run routinely) | Replace `scripts/probe-axiom.mjs:68` token prefix+suffix print with the presence+length-only shape from `api/lib/_axiomLog.js:71`. | S (5 min) | None. Land before P0-1's Axiom check so the sweep itself doesn't print token fragments into the terminal/transcript. | Run `node scripts/probe-axiom.mjs` — output shows `token: set (N chars)` only. `npm run lint:secrets` still clean. |
| P0-4 | (unverified; F-27 context) | **Answer the open 2026-05-31 rotation question**: was the "rotate live creds in `.env.local`" task ever done? If yes → add dated rows to `docs/SECURITY_ROTATION_LOG.md`. If no → rotate now (Supabase service-role key, Anthropic, Stripe, Resend, CRON_SECRET) and log it. | S–M (depends on answer) | Rotation is Aden-only (dashboard access). **Rotate BEFORE P3's stricter secret-lint/hooks land** — never commit a guardrail that would flag a value still in service. After any rotation, update Vercel env + redeploy via `git push` (empty commit is fine) so functions pick up new values. | Post-rotation: `node scripts/probe-axiom.mjs` and one cron endpoint smoke (`api/data-health?action=last-refresh`) to confirm services still authenticate; `docs/SECURITY_ROTATION_LOG.md` has dated rows. |
| P0-5 | **F-05/F-23 backstop** | Set a **hard monthly spend cap in the Anthropic Console** (console.anthropic.com → billing/limits). 5-minute action that bounds the worst case of every AI-spend finding before the code fixes land in P1. | S (5 min) | None. Do it during P0-1's console block. | Cap visible in Anthropic Console; pick a number ~3× normal monthly burn (check `node scripts/check-api-usage.mjs` for the baseline). |

### P0-1 sweep blocks (full step-by-step lives in doc 04)

1. **Vercel** (dashboard → tractova → Settings): `CRON_SECRET` present, Production scope · `HEALTH_CHECK_TOKEN`, `AXIOM_TOKEN`, `AXIOM_DATASET`, `VITE_HCAPTCHA_SITEKEY` present · server secrets (service-role key, Stripe, Anthropic, Resend, CRON_SECRET) scoped **Production only** or Preview uses test keys · Deployment Protection state for Preview · Install Command (is it `npm ci`?) · Firewall/Attack-Challenge state.
2. **Supabase** (dashboard): prune-fn ACL (pairs with P0-2) · migrations 071/072 live (`pg_trigger`/`pg_policies` queries from doc 04) · exactly one `profiles.role='admin'` row (gates F-25) · Auth: password min ≥10, "Confirm email" ON, rate limits, hCaptcha SECRET set, redirect-URL allowlist tractova-only · API "Max rows" (db-max-rows) value (feeds F-01) · PITR/backup retention (feeds F-24).
3. **GitHub** (repo → Settings → Code security): Secret scanning + Push protection enabled · Dependabot alerts enabled · branch protection requires the Verify workflow.
4. **Anthropic console**: spend cap (P0-5). **Axiom**: token is ingest-scoped; dataset shows recent events (proves `axiomLog` forwarding is live, feeds F-22).

### P0 escalation table — if a sweep check FAILS

| Failed check | Becomes | Same-day action |
|---|---|---|
| `CRON_SECRET` missing in Vercel prod | **Critical** — anyone sending `x-vercel-cron: 1` can trigger every cron incl. `check-staleness.js` DELETEs and email sends | Set the var in Vercel immediately, redeploy (`git push` empty commit). Log in rotation log. |
| Preview deployments public AND share prod env vars | **Critical** — full app + prod keys on an unauthenticated preview URL | Enable Deployment Protection for Preview and/or rescope secrets to Production-only. |
| Prune-fn ACL open to anon | Confirms F-02 is live-exploitable | Apply P0-2's migration today (already planned). |
| Migration 071 or 072 not actually applied | **Critical** — privilege-escalation guard absent | Apply from `supabase/migrations/` now; verify with the `pg_trigger`/`pg_policies` queries. |
| `AXIOM_TOKEN`/`AXIOM_DATASET` unset | All log forwarding is a silent no-op; only log store is the ~1h Vercel tail | Set vars; pull F-22 from P2 into P1. |
| hCaptcha secret absent in Supabase Auth | Bot signups unthrottled (test-sitekey tokens accepted) | Configure provider + secret in Supabase Auth settings. |

---

## P1 — This week (~12–15 focused hours)

The High (first stage), every cheap Medium, and the Lows that are ≤1 h with real attack-surface payoff.

| # | Finding(s) | What to do | Effort | Dependency ordering | Verify |
|---|---|---|---|---|---|
| P1-1 | **F-01 stage A** (High) | **Product decision (Aden, ~1 h):** define exactly which columns/rows of the synthesized tables (`revenue_rates`, `solar_cost_index`, `county_geospatial_data`, `nmtc_lic_tracts`, `ix_queue_data`, `cs_projects`, `hosting_capacity_data`) the anon/free tier may see, vs Pro-only. Honest minimum to pull from anon: `confidence_tier`, percentile/`p*_per_watt`, calibrated-rate/score columns. Also decide the **scoring-engine server-side question** here (does scoring move behind an endpoint in P2, or stay client-side with data-gating only?) — it determines the P2 architecture. | S–M | **Blocks P1-2 and P2-1.** Nothing technical depends on it; do it first this week. | Decision recorded in BUILD_LOG.md (single source of truth, per house rules). |
| P1-2 | **F-01 stage B** (High) | Stop the bulk-walk: (a) set Supabase **db-max-rows** to a small value (dashboard, 5 min); (b) for the highest-value table (`revenue_rates`, per `supabase/migrations/003_revenue_rates.sql:48-49`) write a migration creating a `revenue_rates_public` VIEW with only the approved preview columns, GRANT SELECT on the view to anon/authenticated, and REVOKE SELECT on the base table; (c) repoint the SPA reads at the view. | M–L | **Strict order to avoid breaking prod:** 1) migration creating view + grants (Aden applies — additive, safe); 2) SPA repoint ships via `git push` and is **confirmed live on prod**; 3) only then Aden applies the REVOKE on the base table. Requires P1-1. RLS tier-gating for Pro columns is P2-1. | `npm run verify` before push (house rule). **NEW TEST REQUIRED:** (a) Playwright smoke — free-tier page still renders its scores; (b) a probe/unit test asserting an anon REST `select=*` against the base table returns permission-denied while the `_public` view succeeds. After db-max-rows: one anon paginated read from outside the app confirms the cap (single page only — don't hammer prod). |
| P1-3 | **F-05 stage A** (Medium) | Make the spend-bearing rate limiter in `api/lens-insight.js:363-387` **fail CLOSED** (or degrade to a conservative in-memory bucket) when the `api_call_log` query errors; add a per-user daily cap (~200 lens calls/day) and a tract-resolve sub-cap (~30/day/user). | M | None — pure server code. P0-5's console cap is the interim backstop. Global daily ceiling re-architecture is P2-3. | `npm run lint:api` + `npm run test:unit`. **NEW TEST REQUIRED:** unit test — rate-limit check that throws/errors yields a 429 (not ok:true); unit test — call #201 in a day is rejected. |
| P1-4 | **F-03** (Medium) | Cap client-supplied arrays/objects before prompt-building in `api/handlers/_lens-portfolio.js`, `_lens-compare.js` (25 projects, string fields truncated), `_lens-sensitivity.js` (30 override entries, values ≤200 chars, scenario ≤500). Return 400 over-cap rather than silently truncating. | S | None. Pairs naturally with P1-3 (same files/PR). | `npm run test:unit`. **NEW TEST REQUIRED:** unit test — 26 projects → 400; oversized override → 400. Existing pro-smoke suite (`npm run test:smoke:pro`) confirms normal Lens flows still pass. |
| P1-5 | **F-04 stage A** (Medium) | Fix the cross-user verdict-cache poisoning in `api/lens-insight.js:476-497`: fold a SHA-256 of the full canonicalized context (or `contextText`) into `buildCacheKey`, so no client-supplied field influences the prompt without also keying the cache. | S–M | None. The deeper fix (server fetches context from DB itself) is P2-2 and supersedes part of this — do this cheap fix anyway; it's 30 minutes of insurance. | **NEW TEST REQUIRED:** unit test — two requests differing only in a context field produce different cache keys. `npm run test:unit`. |
| P1-6 | **F-08** (Low, regression) | Migration replacing the two hardcoded `auth.jwt()->>'email'` write policies on `nmtc_lic_tracts` (`supabase/migrations/080_nmtc_lic_tracts.sql:38-47`) with `public.is_admin()`, matching migration 058's canonical pattern. Idempotent (drop policy if exists + create). | S | Claude writes → **Aden applies**. Batch with P0-2's migration if not yet applied. Must land **before** P2-12 (F-25 removes the email fallback from `is_admin()` — if 080's email policies survived that removal they'd be the only admin gate left on that table... and they'd still work, but the regression would mask itself; fix order keeps the model clean). | After apply: `node scripts/probe-rls-policies.mjs` or SQL `select policyname, qual from pg_policies where tablename='nmtc_lic_tracts';` shows `is_admin()` in both write policies. |
| P1-7 | **F-09** (Low) | Collapse the distinct "email not confirmed" sign-in error in `src/pages/SignIn.jsx:254-260` into the generic "Invalid email or password." (keep only the captcha branch distinct). | S | Confirm in P0-1 sweep that Supabase "Confirm email" obfuscation is ON first — that setting determines what the server even returns; fix the client branch after. | `npm run verify` (smoke suite covers sign-in). Manual: wrong-password vs unconfirmed-account attempts return identical UI text. |
| P1-8 | **F-15** (Low) | Strip `stack` and raw `err.message` from all client-facing 500 responses (three cron-refresh handlers incl. `api/refresh-ix-queue.js:66-70`, webhook, `send-*`); return generic `{ error: 'Internal server error' }`, mirroring `api/data-health.js:143`. Server-side `console.error`/`axiomLog` keep the detail. | S | None. | `npm run lint:api` + `npm run test:unit`. Manual: force one handler error locally, confirm response body is generic. (P3 adds a lint rule so this can't regress — see doc 03.) |
| P1-9 | **F-14** (Low) | Tighten CSP `img-src` in `vercel.json:17` from `https:` (any host) to `'self' data:` + the specific hosts actually used. | S | Ship in its own commit so a CSP mistake is a one-line revert. After deploy, click through prod pages with DevTools console open (CSP violations are loud). | `npm run verify` before push; post-deploy manual prod check — no CSP violation reports in console on Dashboard/Library/Memo pages. |
| P1-10 | **F-07** (Low-M, known-accepted scope fix) | Add the off-origin rejection in `findXlsxUrl` (`api/scrapers/_refresh-md-dg.js:52`) so the MD scraper can never follow a runtime-discovered link off `energy.maryland.gov`; correct both xlsx `reason` fields in `scripts/audit-allowlist.json` to name the real host list. | S | None. Keeps the exceljs-migration D-day (Q3 2026) tracked in the allowlist unchanged. | `npm run lint:audit` still green (allowlist edit is rationale-only). **NEW TEST REQUIRED:** unit test — `findXlsxUrl` throws on an absolute off-origin href. |
| P1-11 | **F-11** (Low) | Fix env-var inventory drift: add the ~12 missing rows to `docs/secrets-manifest.md` (HEALTH_CHECK_TOKEN, AXIOM_TOKEN/DATASET, EIA/NREL/CENSUS keys, STRIPE_PRICE_ID pair, etc.), mirror the secret ones into CLAUDE.md §7, bump "Last reviewed". | S | **After P0-1** — the sweep's `vercel env ls` diff is the input, so the manifest documents reality, not intention. | Manifest rows match the sweep's actual Vercel inventory; `npm run lint:secrets` clean. |
| P1-12 | **F-12** (Low) | Extend `scripts/lint-secrets.mjs`: stop skipping `public/` (deployed verbatim), add Axiom/GitHub-PAT/Slack-webhook patterns + env-assignment rules for the newly documented vars. | S | **Run the stricter lint locally BEFORE committing it.** If it catches a real value anywhere, rotate that secret first (P0-4 principle: rotate before the guardrail lands), then commit. After P1-11 so the pattern list matches the documented inventory. | `npm run lint:secrets` green on the full tree; deliberately plant a fake `xaat-...` token in a scratch file and confirm the lint catches it, then delete the scratch file. |

**Suggested P1 batching for Aden's long-block style** (one commit per slice, per house preference): Slice 1 = P1-3 + P1-4 + P1-5 (all `api/lens-insight.js` + handlers, one test file). Slice 2 = P1-7 + P1-8 + P1-9 (small client/server hygiene). Slice 3 = P1-10 + P1-11 + P1-12 (scraper + docs + lint). Migrations (P1-2, P1-6) ride their own track since apply is manual.

---

## P2 — Hardening (weeks 2–4, ~22–28 focused hours)

Remaining Mediums/Lows plus the structural items: the full data-tier architecture, rate-limit re-architecture, the scoring-engine decision's implementation, and the logging/alerting stack.

| # | Finding(s) | What to do | Effort | Dependency ordering | Verify |
|---|---|---|---|---|---|
| P2-1 | **F-01 stage C** (High, structural) | Roll the view + REVOKE pattern from P1-2 across ALL synthesized tables; add Pro-tier RLS predicates (`subscription_tier='pro'` via `profiles`) on full-column access; route bulk/aggregate reads through a server function with a per-user/IP row budget. **No new top-level api file** — multiplex the bulk-read action into `api/lens-insight.js` or an existing data endpoint (12-function cap). Implement whichever scoring-engine outcome P1-1 decided. | L (2–3 days) | Requires P1-1 (decision) + P1-2 (pattern proven on one table). Same view→SPA-deploy→revoke ordering per table. Each table's migration: Claude writes, **Aden applies**. | `npm run verify` per slice. **NEW TEST REQUIRED:** extend the P1-2 probe into a loop over all synthesized tables — anon base-table read denied, view read OK, Pro-JWT full read OK (pro-smoke fixture exists: `test:smoke:pro`). |
| P2-2 | **F-04 stage B** (Medium) | Stop trusting client context entirely: fetch `stateProgram`/`countyData`/`ixQueue`/`revenueStack` server-side inside the lens handler before prompt-build + cache-key. | M | After P2-1's data layer settles (server reads must respect the same canonical tables). Supersedes the P1-5 key fix for these fields (keep the hash anyway for any remaining client inputs). | `npm run test:unit` + `test:smoke:pro` (Lens verdict flow). Unit test from P1-5 still passes. |
| P2-3 | **F-05 stage B** (Medium) | Rate-limit re-architecture: absolute **global** daily AI ceiling checked before `client.messages.create`, durable counters (`api_call_log`-backed) with the fail-closed semantics from P1-3 preserved. | M | After P1-3. Coordinates with P2-7 (denial events should log to `security_events`). | **NEW TEST REQUIRED:** unit test — global ceiling reached → 429 for ALL users; `node scripts/check-api-usage.mjs` shows counters incrementing. |
| P2-4 | **F-06** (Medium) | Admin-write audit trail: AFTER INSERT/UPDATE/DELETE trigger on the 7 admin-curated tables inserting actor/op/table/PK/jsonb-diff into `admin_audit_log`. Delete the dead `logAdminAction()` in `api/_admin-auth.js:74-87` so it can't be mistaken for live coverage. | M | Trigger migration: Claude writes, **Aden applies**. Independent of other items. | After apply: make one admin edit in the UI, then SQL `select count(*), max(created_at) from admin_audit_log;` shows the row. **NEW TEST REQUIRED:** none beyond this manual probe (DB trigger, no app code path) — but record the probe in doc 04 as a quarterly check. |
| P2-5 | **F-16** (Low) | Switch Supabase client to explicit PKCE (Proof Key for Code Exchange — keeps tokens out of the URL fragment): explicit `auth: { flowType: 'pkce', ... }` in `src/lib/supabase.js`. | M | **Coordinate code + dashboard in one window:** verify Supabase email/recovery templates use the `?code=` callback format BEFORE shipping the client change, or recovery links break. Test on a throwaway account immediately after deploy. | Manual end-to-end: signup confirm + password-recovery flows on prod with a test account. `test:smoke` auth flows green. |
| P2-6 | **F-10** (Low) | Make the localStorage session-storage decision explicit and reviewable: explicit `auth: { storage, storageKey }` block + code comment naming the CSP as compensating control. (The httpOnly-cookie proxy is a someday-item; record it, don't build it.) | S | Ride the same `src/lib/supabase.js` edit as P2-5 (one commit). | `npm run verify`; sign-in/sign-out smoke unchanged. |
| P2-7 | **F-21** (Low) | Durable security-event log: `security_events` table (deny-all RLS like `api_call_log`) + shared `logSecurityEvent()` helper called on every 401/403/429 and cron-secret mismatch. | M | Table migration: Claude writes, **Aden applies**, BEFORE the helper code ships (writes would fail otherwise). Feeds P2-9 alerts. | **NEW TEST REQUIRED:** unit test — a 403 path calls the logger; post-deploy probe: trigger one bad-token request, see the row via SQL. |
| P2-8 | **F-22** (Low) | Route security-relevant denials through `axiomLog` so they outlive the ~1h Vercel Hobby tail; write the honest retention runbook; remove the stale one-time `[axiom] init` diagnostic (`api/lib/_axiomLog.js:68-76`) once P0-1 confirmed forwarding is live. | S | After P0-1 (Axiom confirmed wired) and alongside P2-7 (same call sites). | `node scripts/probe-axiom.mjs`; Axiom dataset shows a test denial event. |
| P2-9 | **F-23** (Low) | Stand up the 5 cheap alerts: Axiom monitors on webhook-signature failures + denial spikes; cron silent-death check in `check-staleness`; scheduled `check-api-usage` spend email; Anthropic console cap (done in P0-5). | M | Requires P2-7 + P2-8 (the events must exist to alert on). Cron-death check extends existing `api/check-staleness.js` — no new function file. | Fire a synthetic event for each monitor once and confirm the alert email/notification arrives. Record alert inventory in the runbook. |
| P2-10 | **F-24** (Low) | Guard the weekly `cron_runs`/`data_updates` prunes in `api/check-staleness.js:187-208`: archive-before-delete (or extend retention to ≥12 months) + abort if the delete would remove >N% of the table + log prune counts. | S | Archive table = migration (**Aden applies**) before code ships. Log target = `security_events`/`admin_audit_log` from P2-7/P2-4 if landed; plain `cron_runs` row otherwise. | **NEW TEST REQUIRED:** unit test — prune aborts when cutoff logic would delete over the sanity threshold. `node scripts/probe-cron-runs.mjs` after the next weekly run. |
| P2-11 | **F-26** (Low, known-accepted scope) | Byte-cap the 4 XLSX scraper fetch paths (content-length check + streaming size guard, ~25 MB) before `XLSX.read`; fold the note into the xlsx allowlist rationale. | S | None. Same allowlist file as P1-10 — fine to do earlier if convenient. | `npm run lint:audit` green. **NEW TEST REQUIRED:** unit test — oversized content-length rejected before buffering. |
| P2-12 | **F-25** (Low, known-accepted) | Drop the legacy admin-email fallback: remove the `LEGACY_ADMIN_EMAIL` block in `api/_admin-auth.js:60-64` + migration replacing `is_admin()`'s email clause. | S | **Hard dependency:** P0-1 confirmed exactly one live `profiles.role='admin'` row, AND P1-6 (F-08) applied first (so no table still depends on email-based policies). Migration: **Aden applies**. Keep the code change and migration in the same window — apply migration first, then ship the code commit. | Admin UI still works on prod immediately after (curation page loads, one test write succeeds → also exercises P2-4's audit trigger). |
| P2-13 | **F-17** (Low) | Vendor the map topojson (us-atlas/world-atlas data into the bundle), then remove `https://cdn.jsdelivr.net` from `connect-src` in `vercel.json`. | S | **Vendor + deploy first (or same deploy), CSP removal second** — never remove the CSP host while prod still fetches from it. Interacts with P2-14 (us-atlas dependency placement). | `npm run verify` (build catches a bad import); post-deploy: maps render on Dashboard/Library with DevTools network tab showing zero jsdelivr requests. |
| P2-14 | **F-18** (Low) | Dependency cleanup: `npm uninstall shadcn cobe radix-ui`; fix the `Slot` import in `src/components/shadcn/ui/badge.jsx` to `@radix-ui/react-slot`; place `us-atlas` per P2-13's outcome; update the stale `dependabot.yml` comments. | S | After P2-13 decides whether us-atlas is a runtime dep. Note: `npm uninstall`/`install` mutates the lockfile — this is the one P2 item that should ALSO precede P3's lockfile-lint gate landing, so the gate's first run is green. | `npm run verify` (build + unit + smoke); `npm run lint:audit` green. |
| P2-15 | **F-20** (Low) | Supply-chain pinning: `"installCommand": "npm ci"` in `vercel.json`; repo-root `.npmrc` with `save-exact=true`; exact-pin the 4 security-critical deps. | S | After P2-14 (do all package.json/lockfile churn in one slice). Verify the next prod deploy's build log shows `npm ci`. | Vercel deployment build log line "Running install command: npm ci"; `npm run verify` locally. |
| P2-16 | **F-28** (Low, docs) | Add `LibraryMap.jsx` to the d3-color allowlist consumers list in `scripts/audit-allowlist.json` (rationale accuracy only). | S | None. Batch with any allowlist-touching slice (P1-10/P2-11). | `npm run lint:audit` green. |
| P2-17 | **F-44** (Low) | Neutralize spreadsheet-formula injection in the Library export: add a `sanitizeCell` prefix-quote guard (`/^[=+\-@\t\r]/` → `'`+value) in `src/lib/exportHelpers.js` and map every string field of `buildExportRows` through it. | S | None — pure client code, no migration. Batch with any `src/lib` hygiene slice. | `npm run test:unit`. **NEW TEST REQUIRED:** unit test — a `=`/`+`/`@`-leading project name / `ixNotes` value is prefix-quoted in the exported row. |

---

## P3 — Guardrails (CI + hooks)

Full specification lives in **`03-guardrails-spec.md`** — do not duplicate it here. Roadmap-level notes only:

| # | Finding(s) | What | Dependency ordering |
|---|---|---|---|
| P3-1 | **F-19** | `lockfile-lint` (registry-host + integrity validation) and a weekly OSV-scanner (Open Source Vulnerabilities database) job in `.github/workflows/verify.yml`. | **After P2-14/P2-15** so the first gated lockfile is the cleaned, pinned one. |
| P3-2 | F-12 follow-through | The strengthened secret-lint from P1-12 wired into pre-commit + CI per the guardrails spec. | **Any secret a new pattern would catch must be rotated BEFORE the hook lands** (P0-4 principle). |
| P3-3 | F-15 follow-through | `lint:api` rule banning `stack`/raw `err.message` in client-facing responses, so P1-8 can't regress. | After P1-8 (the rule must be born green). |
| P3-4 | doc 03 scope | Remaining CI gates, branch-protection required checks, scheduled re-verification probes (incl. the doc 04 quarterly live-state checks). | Per `03-guardrails-spec.md`. |

---

## Calendar (focused hours, Aden's long-block style)

| When | Work | Hours |
|---|---|---|
| **Day 1 (same day)** | P0-1 sweep + P0-2/P0-3 fixes + P0-4 rotation answer + P0-5 cap. Any escalation-table hits handled same-day. | 3–4 h |
| **Day 2** | P1-1 product decision → P1-2 stage B started (view migration written + db-max-rows set); Slice 1 (P1-3/4/5 + new unit tests). | 5–6 h |
| **Day 3** | P1-2 finished (SPA repoint deployed → revoke applied); Slice 2 (P1-7/8/9); Slice 3 (P1-10/11/12); P1-6 migration applied. | 5–6 h |
| **P0+P1 total** | | **~13–16 h ≈ one long block + one normal day** |
| **Weeks 2–3** | P2-1 (the big structural rock, 2–3 days) + P2-2/3; logging stack P2-7/8/9/10. | ~16–20 h |
| **Week 4** | P2-4/5/6, P2-11–16 cleanup slices; then P3 per guardrails spec. | ~8–12 h |

Items needing **Aden personally** (can't be delegated to Claude): all migration applies, all dashboard checks/settings (P0-1, db-max-rows, Anthropic cap, Axiom monitors), the P0-4 rotation answer, and the P1-1 product decision. Everything else is Claude-buildable with Aden reviewing diffs.

---

## Definition of done

### P0 done when:
- [ ] All 4 sweep blocks executed; results recorded in doc 04 with pass/fail per check
- [ ] Every escalation-table miss either passed or was remediated same-day
- [ ] F-02 migration written AND applied; `proacl` query confirms anon/authenticated revoked
- [ ] `probe-axiom.mjs` prints presence+length only (F-13)
- [ ] 05-31 rotation question answered; `docs/SECURITY_ROTATION_LOG.md` updated either way
- [ ] Anthropic console hard spend cap set

### P1 done when:
- [ ] Free-vs-Pro data-surface decision + scoring-engine direction recorded in BUILD_LOG.md
- [ ] db-max-rows set; `revenue_rates` behind a public view; anon base-table read returns permission-denied; free-tier UI verified working on prod
- [ ] Lens limiter fails closed; per-user daily + tract-resolve caps live; portfolio/compare/sensitivity inputs capped with 400s — **each with a passing new unit test**
- [ ] Verdict cache key covers full context (new unit test passing)
- [ ] `nmtc_lic_tracts` policies use `is_admin()` (probe confirms)
- [ ] Sign-in errors indistinguishable for unconfirmed vs wrong-password
- [ ] No 500 response carries `stack`/raw `err.message`
- [ ] CSP `img-src` tightened; prod click-through shows zero CSP violations
- [ ] MD scraper rejects off-origin links (new unit test); xlsx allowlist rationale corrected
- [ ] secrets-manifest + CLAUDE.md §7 match the actual Vercel inventory; strengthened `lint:secrets` green
- [ ] `npm run verify` green on main; all new tests in the suite

### P2 done when:
- [ ] All synthesized tables follow the view/REVOKE/tier-RLS pattern; bulk reads budgeted server-side; pro-smoke + anon-denial probes green across every table
- [ ] Lens context fetched server-side; global AI ceiling enforced fail-closed
- [ ] Admin writes produce `admin_audit_log` rows (manual probe confirmed); `logAdminAction` dead code removed
- [ ] PKCE flow live; recovery + confirm emails tested end-to-end; storage decision documented in code
- [ ] `security_events` receiving denials; Axiom monitors + cron-death + spend alerts each fired once synthetically and delivered
- [ ] Prune archive/sanity-guard live; maps vendored with jsdelivr out of CSP; deps cleaned and pinned; `npm ci` confirmed in the prod build log
- [ ] Legacy admin-email fallback fully removed (code + `is_admin()`), admin UI verified after
- [ ] Library export cells formula-injection-sanitized (F-44); new unit test passing
- [ ] `npm run verify` green; BUILD_LOG.md updated per slice

### P3 done when:
- [ ] Every gate in `03-guardrails-spec.md` implemented, born-green, and required by branch protection
- [ ] No gate was committed while a value it would flag was still in service (rotation-first rule honored)
