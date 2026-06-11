# 04 — Manual Verification Checklist (Unverified Items)

**Tractova security audit · 2026-06-10 · Doc 4 of 5**

Everything in this document could **not** be confirmed from the repository. Each item lives in a
dashboard, a live database, or DNS — places only you (Aden) can see. Nothing here is a confirmed
finding; an item only *becomes* a finding if the check comes back BAD.

**How to use this doc:** work top-to-bottom in one sitting (~60–90 min). Sections are ordered by
risk; the five checks in the table below are the ones where a BAD answer means an attacker has a
live, exploitable path *today*. Check the box, note GOOD/BAD in the margin, and bring the BAD list
back to the remediation roadmap (doc 02, `02-remediation-roadmap.md`). Finding IDs (F-xx) refer to doc 01.

| Do these 5 first | Why | Item |
|---|---|---|
| CRON_SECRET set in Vercel Production | If missing, anyone can trigger every cron (incl. destructive deletes) with one spoofed header | V-1 |
| Prune-function EXECUTE grant | If open, an anonymous visitor can wipe the Stripe webhook idempotency ledger | S-1 |
| Preview deployments + prod secrets | If previews are public AND share prod env vars, a preview URL is a second, unguarded front door to prod | V-2 + V-3 |
| Migrations 071/072 live | If not applied, any user can self-promote to admin / reassign project ownership | S-2 |
| Supabase Auth settings (password, captcha, enumeration) | Client-side checks are bypassable; only the server-side settings actually hold | S-5 + S-6 |

Legend per item: **Check** = exact click-path / command · **Good** = pass condition ·
**If bad** = immediate action · **Finding** = related finding ID from docs 02/03.
Items marked *(auditor-added)* were not raised by a sub-auditor but belong in this category.

---

## 1. Vercel dashboard (vercel.com → tractova project)

### V-1. CRON_SECRET exists and is non-empty in Production
- [ ] **Check:** Vercel → tractova → Settings → Environment Variables → filter `CRON_SECRET`. CLI alternative: `vercel env ls` (look for `CRON_SECRET` with `Production` in the Environments column).
- **Good:** Present, non-empty, scoped to Production.
- **If bad:** Set it immediately (any 32+ char random string), redeploy. While unset, all 7 cron endpoints (`api/refresh-data.js:90`, `api/refresh-ix-queue.js:80`, `api/refresh-substations.js:243`, `api/check-staleness.js:95`, `api/send-digest.js:62`, `api/send-alerts.js:167`, `api/refresh-capacity-factors.js:104`) fall back to trusting the spoofable `x-vercel-cron: 1` header — an unauthenticated attacker can trigger data refreshes, email blasts, and the `check-staleness` hard-DELETEs. Then update the Vercel cron config to send `Authorization: Bearer <secret>`.
- **Also:** confirm `HEALTH_CHECK_TOKEN` exists in Production (gates `data-health?action=health-summary`, `api/data-health.js:49-53`; fail-closed 503 if unset — so a missing var is availability-only, not a security hole).
- **Finding:** F-31 (gate verified correct in code; this confirms the precondition), F-11 (manifest drift).

### V-2. Env-var environment scoping — do PREVIEW deploys get PROD secrets? ← key question
- [ ] **Check:** Settings → Environment Variables. For each of `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `HEALTH_CHECK_TOKEN`, read the **Environments** column.
- **Good:** Each is **Production only** — OR Preview rows exist but hold separate test/staging keys (e.g. Stripe test-mode key, a second Supabase project).
- **If bad** (scoped to "All Environments" / Preview shares prod values): every preview deployment is a fully armed copy of prod — same database, same Stripe account, same Anthropic budget. Combined with a public preview URL (V-3) this is the single biggest unverified exposure. Note that `api/_cors.js:30-31` deliberately allows `VERCEL_URL`/`VERCEL_BRANCH_URL` origins, so preview API routes accept their own browser traffic. Fix: rescope each secret to Production only; create test-mode equivalents for Preview if you need working previews.
- **Finding:** none yet — becomes a new High finding if bad. Context: F-27, F-35.

### V-3. Deployment Protection on Preview deployments
- [ ] **Check:** Settings → Deployment Protection. Note the setting for Preview (Vercel Authentication / password / off) and for Production.
- **Good:** Preview = "Vercel Authentication" (only your logged-in Vercel account can open preview URLs). Production = unprotected (it's a public site) — that's intended.
- **If bad** (Preview = public/off): anyone who guesses or scrapes a `*-tractova.vercel.app` URL gets the full app. Severity depends entirely on V-2: public previews + prod secrets = urgent; public previews + no secrets = previews just fail to boot. Fix: enable Vercel Authentication for Preview (available on Hobby).
- **Finding:** pairs with V-2.

### V-4. Full Production env inventory vs the manifest
- [ ] **Check:** `vercel env ls` (or the dashboard list) and diff against `docs/secrets-manifest.md` **plus** the in-use-but-undocumented vars the audit found in code: `HEALTH_CHECK_TOKEN`, `AXIOM_TOKEN`, `AXIOM_DATASET`, `EIA_API_KEY`, `NREL_API_KEY`, `CENSUS_API_KEY`, `STRIPE_PRICE_ID`, `VITE_STRIPE_PRICE_ID`, `LBNL_TTS_CSV_URL`.
- **Good:** Every var in Vercel is either in the manifest or on the list above; **no `VITE_`-prefixed var holds a sensitive value** (everything `VITE_*` is compiled into the public browser bundle); no stale/unknown vars the repo never references.
- **If bad:** Delete stale vars (each one is an un-rotated credential nobody is watching); move any sensitive `VITE_*` value to a server-only name; add missing vars to `docs/secrets-manifest.md` + CLAUDE.md §7.
- **Finding:** F-11.

### V-5. `VITE_HCAPTCHA_SITEKEY` set for the Production build
- [ ] **Check:** Settings → Environment Variables → `VITE_HCAPTCHA_SITEKEY`, scoped to include Production. (It's a PUBLIC sitekey — fine to be `VITE_`.)
- **Good:** Present in Production builds.
- **If bad:** the client (`src/lib/captcha.js`) falls back to hCaptcha's universal TEST sitekey, whose tokens are only rejected if the Supabase-side captcha secret is enforced (S-6). Set the real sitekey and redeploy.
- **Finding:** signup-friction context for F-01 (bulk-exfiltration via throwaway accounts).

### V-6. `AXIOM_TOKEN` + `AXIOM_DATASET` set in Production
- [ ] **Check:** Settings → Environment Variables → both vars present for Production.
- **Good:** Both present. (Axiom is the only durable log store — see V-10.)
- **If bad:** all `axiomLog()` forwarding is a **silent no-op** (`api/lib/_axiomLog.js:78`) and your only logs are the ~1-hour Vercel tail. Set both, then confirm events actually arrive (item A-3).
- **Finding:** F-22.

### V-7. Vercel Firewall / Attack Challenge Mode / BotID
- [ ] **Check:** Vercel → tractova → **Firewall** tab. Note whether Attack Challenge Mode, any custom WAF (web application firewall) rules, or rate limits are configured.
- **Good:** At minimum, awareness of current state; ideally a rate limit on `/api/*`.
- **If bad** (nothing configured — likely): the app's only rate limiting is `api/_rate-limit.js`, which **fails open** on any Supabase error (F-05). An infra-layer limit is the backstop for the public memo-view and last-refresh endpoints. Note this protects only Vercel routes — direct Supabase reads bypass Vercel entirely (see S-16).
- **Finding:** F-05.

### V-8. Production install command uses the lockfile (`npm ci`)
- [ ] **Check:** Settings → Build & Development Settings → Install Command; or open the latest Production deployment → Build Logs → read the `Running "install" command` line. (`vercel.json:2` sets `buildCommand` but no `installCommand`, so the repo can't prove this.)
- **Good:** `npm ci` (installs exactly what `package-lock.json` pins).
- **If bad** (`npm install` or blank/default): the prod build can silently resolve newer transitive versions than the lockfile. Fix: add `"installCommand": "npm ci"` to `vercel.json` (also the F-20 remediation).
- **Finding:** F-20.

### V-9. Git integration — does a failing CI still deploy?
- [ ] **Check:** Settings → Git. Look for "Ignored Build Step" and any deploy-gating config.
- **Good:** You understand the current behavior. Reality on Hobby: a direct push to `main` triggers the Vercel deploy **regardless** of the GitHub `Verify` workflow outcome — CI (`.github/workflows/verify.yml`) is advisory unless something gates the deploy.
- **If bad** (no gating, which is expected): accept the risk consciously, or mitigate via GitHub branch protection (G-2) + your existing local pre-push verify habit. Document the decision.
- **Finding:** F-42 context (the audit gate only blocks if something enforces it).

### V-10. Runtime log retention / Log Drains
- [ ] **Check:** tractova project → Logs tab — note how far back you can scroll. Settings → Log Drains — any drain configured?
- **Good:** You know the window (Hobby has historically been ~1h live tail; Log Drains require Pro) and Axiom forwarding (V-6/A-3) is the compensating durable store.
- **If bad** (no Axiom, no drain): you have effectively zero forensic record of any incident older than an hour. Prioritize the F-22 remediation.
- **Finding:** F-22.

### V-11. Request-body size limits on POST endpoints
- [ ] **Check:** Settings → Functions (and `vercel.json` — already verified: no per-route body limit configured). Confirm no override raises the platform default (~4.5 MB) for `api/lens-insight.js` or `api/refresh-data.js`.
- **Good:** Platform default ~4.5 MB is the outer bound (the in-code caps — 2 MB CSV at `api/scrapers/_refresh-ix-manual.js`, 6 MB base64 PDF at `api/handlers/_lens-policy-classify.js` — sit under it).
- **If bad** (a higher limit was set): the F-03 prompt-amplification math worsens proportionally; remove the override.
- **Finding:** F-03.

---

## 2. Supabase dashboard (supabase.com → project)

> SQL items: Dashboard → SQL Editor. The editor runs as `postgres` (bypasses RLS — Row Level
> Security, Postgres' per-row permission system), so it's fine for *inspection*; the negative
> test in S-2 must run as a normal user instead.

### S-1. EXECUTE grant on the prune function — do NOT call the function
- [ ] **Check:** SQL Editor:
  ```sql
  select proname, proacl from pg_proc
  where proname = 'prune_webhook_events_older_than_days';
  ```
- **Good:** `proacl` explicitly lists only `postgres`/`service_role` — **no** `anon=X`, no `authenticated=X`, and **not NULL** (NULL means Postgres' default applies, which grants EXECUTE to PUBLIC — i.e., everyone, including the anon API role).
- **If bad** (NULL or anon/authenticated present): an anonymous visitor can call it via PostgREST RPC and wipe the Stripe webhook idempotency ledger (defined in `supabase/migrations/060_webhook_events_processed.sql:52` as SECURITY DEFINER). Apply the F-02 fix:
  ```sql
  revoke all on function public.prune_webhook_events_older_than_days(int) from public, anon, authenticated;
  ```
  Do **not** test by calling the function — it deletes rows.
- **Finding:** F-02.

### S-2. Migrations 071 + 072 actually applied (trigger + WITH CHECK live)
- [ ] **Check 1 (trigger):**
  ```sql
  select tgname, tgenabled from pg_trigger
  where tgrelid = 'public.profiles'::regclass and not tgisinternal;
  ```
  Expect `profiles_guard_privileged_columns` with `tgenabled = 'O'` (enabled).
- [ ] **Check 2 (policy):**
  ```sql
  select policyname, cmd, qual, with_check from pg_policies
  where tablename in ('profiles','projects');
  ```
  The `projects` UPDATE policy must show a non-null `with_check` equal to `(auth.uid() = user_id)`.
- [ ] **Check 3 (negative test, as a normal user — NOT the SQL editor's postgres role):** use the SQL editor's role-impersonation dropdown (impersonate an `authenticated` user) or call PostgREST with a real user JWT, and run `update profiles set role = 'admin' where id = auth.uid();`
- **Good:** Trigger present + enabled; WITH CHECK present; negative test fails with error `42501` (insufficient privilege).
- **If bad:** apply `supabase/migrations/071_profiles_privileged_column_guard.sql` and/or `072_projects_update_with_check.sql` now — without them, users can self-grant admin/Pro or reassign project ownership. This invalidates F-29/F-30 (which verified the repo *files*, not the live DB).
- **Finding:** F-29, F-30.

### S-3. Live SELECT policies on the synthesized-data tables (any hidden tier gate?)
- [ ] **Check:**
  ```sql
  select tablename, policyname, cmd, roles, qual from pg_policies
  where schemaname = 'public' and cmd = 'SELECT' order by tablename;
  ```
  Focus: `revenue_rates`, `solar_cost_index`, `county_geospatial_data`, `nmtc_lic_tracts`, `ix_queue_data`, `cs_projects`, `hosting_capacity_data`.
- **Good (confirms the finding):** each is `using (true)` — i.e., the migrations tell the truth and there is no tier gate. This *confirms F-01 as written*; "good" here means "the audit's picture is accurate," not "the data is safe."
- **If bad** (a tier predicate exists live that migrations don't show): F-01's severity drops — but you also have undocumented drift between migrations and prod schema, which needs its own fix (capture the live policy into a migration file).
- **Finding:** F-01.

### S-4. PostgREST "Max Rows" (per-request read ceiling)
- [ ] **Check:** Project Settings → API → **Max rows** (db-max-rows).
- **Good:** A deliberate value (e.g. 1000 or lower). Understand it only caps rows *per request* — pagination still allows full-table reads, just in more requests.
- **If bad** (very high / default with no thought): set it to the smallest value the app tolerates. This is friction, not a fix, for F-01.
- **Finding:** F-01.

### S-5. Auth core settings: password length, anti-enumeration, rate limits, email-domain rules
- [ ] **Check:** Authentication → Providers (Email) + → Rate Limits:
  - Minimum password length **≥ 10** (the client enforces 10 in JS but that's bypassable with curl).
  - **"Confirm email" ON** — makes `signInWithPassword` return a generic "Invalid login credentials" instead of leaking whether the account exists.
  - Sign-in / sign-up / OTP / recovery **rate limits** configured (brute-force + enumeration defense — the app logs no failed logins itself).
  - Any email-domain allow/deny list for signups (disposable-email friction for F-01's throwaway-account vector) — likely none; note current state.
- **Good:** All four as described.
- **If bad:** flip each setting in the dashboard; no code change needed. The enumeration gap directly feeds F-09.
- **Finding:** F-09, F-01 (signup friction), CLAUDE.md §9 A1/A2.

### S-6. hCaptcha secret enforced server-side (TEST tokens rejected)
- [ ] **Check:** Authentication → Attack Protection (Bot & Abuse Protection) — confirm hCaptcha is **enabled** with a SECRET key set.
- **Good:** Enabled + secret present. This is what makes the universal TEST-sitekey token (which the client falls back to when `VITE_HCAPTCHA_SITEKEY` is unset — see V-5) get **rejected**.
- **If bad:** captcha is decorative — bots sign up freely. Enable it and set the secret (it pairs with the public sitekey in Vercel).
- **Finding:** F-01 signup-friction precondition.

### S-7. Redirect URL allowlist (password-reset link safety)
- [ ] **Check:** Authentication → URL Configuration → Redirect URLs.
- **Good:** Only `tractova.com` origins (+ `/update-password` path), localhost dev entries at most. **No wildcard** that an attacker could register (e.g. `https://*.vercel.app` would match anyone's deployment).
- **If bad:** a permissive entry turns the password-reset email into an open redirect that can deliver the recovery token to an attacker page. Tighten the list. (The client side is safe — `SignIn.jsx` passes a fixed `${window.location.origin}/update-password` — but Supabase validates against THIS list.)
- **Finding:** related to F-16 (token-in-URL handling).

### S-8. Other sessions revoked on password change
- [ ] **Check:** Authentication → Settings — look for refresh-token rotation / "sign out other sessions on password change" behavior for your GoTrue version (if no toggle exists, test it: log in on two browsers, reset the password in one, see if the other stays alive).
- **Good:** A password reset kills other devices' sessions.
- **If bad:** a stolen refresh token survives the victim's password reset — the standard "I reset my password, am I safe?" expectation breaks. Mitigation: document it; consider calling `auth.signOut({ scope: 'global' })` after password update in `UpdatePassword.jsx`.
- **Finding:** related to F-10 (session-theft blast radius).

### S-9. Exactly one admin profile has `role='admin'`
- [ ] **Check:** SQL Editor: `select id, role from profiles where role = 'admin';`
- **Good:** Exactly one row, and it's your account.
- **If bad** (zero rows): the legacy admin-email fallback in `is_admin()` is the ONLY thing keeping admin access working — do NOT remove it (F-25's fix) until this row exists. Populate it first. (More than one row: investigate immediately.)
- **Finding:** F-25 (gates its remediation).

### S-10. Is `admin_audit_log` really empty/unwritten?
- [ ] **Check:** SQL Editor: `select count(*), max(created_at) from admin_audit_log;`
- **Good (confirms the finding):** 0 rows / NULL — matching the code analysis that `logAdminAction()` is dead code and no trigger writes it.
- **If bad** (rows exist): something out-of-band writes it — identify what before sizing the F-06 fix, so you don't double-log.
- **Finding:** F-06.

### S-11. `news_feed` content hygiene (poisoned-feed precondition)
- [ ] **Check:** SQL Editor:
  ```sql
  select id, url, headline from news_feed
  where url !~* '^https?://' or headline ~ '[<>]';
  ```
- **Good:** Zero rows — no stored row has a non-http(s) URL or raw angle brackets in a headline.
- **If bad:** a feed delivered injectable content at some point — delete those rows and prioritize the email-header/news-href injection fixes (doc 02) before the next digest send.
- **Finding:** injection findings' threat-model precondition (see also C-3).

### S-12. Storage buckets — no orphaned policy-PDF bucket
- [ ] **Check:** Storage → Buckets.
- **Good:** No bucket exists at all, or none holds policy PDFs (the code path forwards `pdfBase64` inline to Anthropic and never persists it; the repo has zero `storage.from`/`.upload(` calls).
- **If bad** (a bucket exists, created out-of-band): confirm it is **private** with policies restricting download to admins; delete it if it's an abandoned experiment.
- **Finding:** none — closes an input-validation question.

### S-13. Network restrictions + PITR/backups (can you recover from the weekly deletes?)
- [ ] **Check:** Project Settings → Database: (a) Network Restrictions — is direct Postgres access IP-limited? (b) Backups — what's the retention; is PITR (point-in-time recovery, restore to any minute) available on your plan?
- **Good:** (a) restrictions set if you never connect from random networks; (b) you KNOW the backup window and accept that `check-staleness` hard-DELETEs `data_updates` >1yr and `cron_runs` >6mo weekly (`api/check-staleness.js:191-199`) with no soft-delete.
- **If bad** (no/short backups): the observability history is unrecoverable the moment the cron runs. Either accept in writing or implement the F-24 export-before-delete fix.
- **Finding:** F-24.

### S-14. Supabase log retention (how far back can you investigate?)
- [ ] **Check:** Logs & Analytics — open Auth logs and Postgres logs; scroll to find the oldest visible entry. Free plan ≈ 1 day; Pro is longer.
- **Good:** You know the exact window and it's documented in the incident-response notes. Failed-login data lives ONLY here — the app does not mirror it.
- **If bad** (~1 day and that's unacceptable): plan upgrade or scheduled export; pairs with F-21/F-22 remediation.
- **Finding:** F-21, F-22.

### S-15. *(auditor-added)* Supabase account security: 2FA on the dashboard login itself
- [ ] **Check:** Your Supabase account → Account Settings → Two-factor authentication. (Solo-founder reality: the dashboard account IS root on the whole product.)
- **Good:** 2FA (two-factor authentication) enabled with an authenticator app; recovery codes stored in 1Password/Bitwarden.
- **If bad:** enable now. Do the same review for Vercel, GitHub, Stripe, Resend, Axiom while you're at it.
- **Finding:** none — account-takeover hygiene.

### S-16. *(auditor-added, raised in ip-abuse notes)* API-layer rate limiting on PostgREST itself
- [ ] **Check:** Project Settings → API — any built-in rate limiting available on your plan? Note that anon reads hit Supabase **directly** (the SPA uses the anon key), bypassing Vercel and `api/_rate-limit.js` entirely.
- **Good:** You know what (if anything) throttles a scripted anon reader.
- **If bad** (nothing): this is the F-01 reality — the only ceilings are Max Rows (S-4) and Supabase's infra-level abuse detection. Feeds directly into the F-01 remediation decision (doc 02).
- **Finding:** F-01.

---

## 3. Stripe dashboard (dashboard.stripe.com)

### ST-1. *(auditor-added)* Webhook endpoint configuration
- [ ] **Check:** Developers → Webhooks. Confirm: exactly one endpoint pointing at `https://tractova.com/api/<webhook-route>`; the subscribed events match what the handler processes (checkout/subscription lifecycle); the endpoint's **signing secret** is the same value as `STRIPE_WEBHOOK_SECRET` in Vercel Production (compare last-4 in each console — never paste full values anywhere); no stale/disabled second endpoint lingering.
- **Good:** One live endpoint, minimal event list, matching secret.
- **If bad:** delete stale endpoints (each leaks events + has its own secret); if secrets mismatch, every webhook fails signature verification and paid-tier grants silently stop — roll the secret and update Vercel in one motion.
- **Finding:** F-37 (code side verified intact; this is the console side).

### ST-2. *(auditor-added)* Restricted API key instead of the full secret key
- [ ] **Check:** Developers → API keys. Is the key in Vercel (`STRIPE_SECRET_KEY`) the account's full secret key (`sk_live_...`) or a **restricted key** (`rk_live_...`) limited to Checkout Sessions, Billing Portal, Customers, Subscriptions?
- **Good:** Restricted key with only the permissions the code uses.
- **If bad** (full secret key — likely the default): a leaked key can refund, transfer, and read everything. Create a restricted key scoped to the operations in `api/` Stripe calls, swap it into Vercel, then roll the old full key.
- **Finding:** none — blast-radius reduction; complements F-27.

---

## 4. GitHub repo settings (github.com/englishaden/tractova → Settings)

### G-1. Secret scanning + Push protection enabled
- [ ] **Check:** Settings → Code security and analysis → "Secret scanning" AND "Push protection" both **Enabled**. (Claimed at `docs/secrets-manifest.md:114` but only checkable in the UI — and note that line says "automatic for public repos"; if the repo is **private**, these are NOT automatic on the free plan, so verify, don't assume.)
- **Good:** Both enabled.
- **If bad:** enable both. Push protection is the one that stops a secret BEFORE it lands in history (the local pre-commit hook is bypassable with `--no-verify`).
- **Finding:** F-12, F-27 context.

### G-2. Branch protection on `main` — does the Verify workflow block anything?
- [ ] **Check:** Settings → Branches → rule for `main`. Is "Require status checks to pass" on, and does it include **"Lint / unit / build"** (the job name in `.github/workflows/verify.yml:15`, which contains the secret-scan + dependency-audit gates at lines 37-41)? Then open the **Actions** tab and confirm the Verify workflow is green on recent pushes to `main`.
- **Good:** Rule exists with that required check; recent runs green.
- **If bad** (no rule — likely, since you push directly to main): the entire CI gate is advisory. Pragmatic options for a solo dev: keep direct-push but rely on the local pre-push verify habit (documented trade-off), or protect main and work via PRs. Either way, remember V-9: Vercel deploys on push regardless of CI outcome.
- **Finding:** F-42 context, F-19/F-20 enforcement.

### G-3. Dependabot ALERTS toggle (separate from version updates)
- [ ] **Check:** Settings → Code security and analysis → "Dependabot alerts" = Enabled. (`.github/dependabot.yml` only configures version-update PRs; the security-alert feed is this separate toggle.)
- **Good:** Enabled (ideally + "Dependabot security updates").
- **If bad:** enable — it's free and is the only push-style notification you'd get for a new CVE in the 850-package lockfile between weekly `npm audit` runs.
- **Finding:** F-19.

### G-4. *(auditor-added)* Repo visibility + collaborator audit
- [ ] **Check:** Settings → General → Danger Zone shows current visibility (public/private). Settings → Collaborators and teams → list everyone with access. Also Settings → Integrations/GitHub Apps → review installed apps' permissions.
- **Good:** Visibility matches your intent (note: if PRIVATE, revisit G-1's "automatic" claim; if PUBLIC, the synthesized-data pipeline code is readable by competitors — a conscious choice). Collaborators = just you. No over-permissioned third-party apps.
- **If bad:** remove stale collaborators/apps; reconcile the secrets-manifest claim with actual visibility.
- **Finding:** F-11 context (manifest accuracy).

---

## 5. Axiom (app.axiom.co)

### A-1. AXIOM_TOKEN is ingest-scoped, not a personal/org API token
- [ ] **Check:** app.axiom.co → Settings → API Tokens → find the token in use; read its scopes.
- **Good:** Ingest-only, restricted to the `tractova-logs` dataset.
- **If bad** (org-wide / read+write token): a leak from Vercel would expose ALL Axiom data + admin ops. Create an ingest-scoped replacement, swap in Vercel, revoke the old one. (Related: F-13 — the probe script prints token prefix+suffix, so treat the current token as semi-exposed in local terminal history.)
- **Finding:** F-13.

### A-2. Any monitors/alerts configured on the dataset?
- [ ] **Check:** Axiom → Monitors.
- **Good:** At least one monitor (e.g. on `level=error` events or webhook-signature failures) with a notification channel.
- **If bad** (none — expected): F-23's "no alerting" gap is fully open. Creating two monitors (error-rate spike; Stripe signature failure) is a 15-minute, zero-code mitigation.
- **Finding:** F-23.

### A-3. Forwarding is genuinely live (events actually arriving)
- [ ] **Check:** Axiom → Datasets → `tractova-logs` (or whatever `AXIOM_DATASET` names) → query the last 24-48h.
- **Good:** Recent events present from prod traffic/crons. (The one-time `[axiom] init` diagnostic in `api/lib/_axiomLog.js:46-47` — whose comment says remove after confirming wired — can then be deleted.)
- **If bad** (silence): forwarding is a no-op despite the rotation log's 2026-05-07 "set + verified" claim — re-check V-6, then the token validity.
- **Finding:** F-22.

---

## 6. Resend + DNS *(all auditor-added — email spoofing posture)*

### R-1. Resend domain verification (SPF + DKIM on send.tractova.com)
- [ ] **Check:** resend.com → Domains → `send.tractova.com` — status "Verified", all DNS records green. CLI cross-check: `nslookup -type=txt send.tractova.com` (SPF: a TXT starting `v=spf1` including Resend) and the DKIM selector records Resend lists.
- **Good:** Verified; SPF (Sender Policy Framework — which servers may send for the domain) and DKIM (DomainKeys Identified Mail — cryptographic signing) both pass.
- **If bad:** fix the DNS records in Namecheap — until then, digest/alert emails will increasingly land in spam or be spoofable.
- **Finding:** none — delivery + anti-spoofing hygiene for send-digest/send-alerts.

### R-2. DMARC policy on the root domain
- [ ] **Check:** `nslookup -type=txt _dmarc.tractova.com`.
- **Good:** A record exists, e.g. `v=DMARC1; p=quarantine` (or `p=none` with `rua=` reporting as a starting point). DMARC (Domain-based Message Authentication, Reporting and Conformance) tells receivers what to do with mail that fails SPF/DKIM — without it, anyone can spoof `@tractova.com` to your users.
- **If bad** (no record): add `v=DMARC1; p=none; rua=mailto:hello@tractova.com` now (monitoring mode), tighten to `p=quarantine` after a clean week. Per the email/DNS memory: this is a root-domain record — don't touch the Resend subdomain or hello@ forwarding MX records while adding it.
- **Finding:** none — spoofing/phishing defense for a product that emails users.

---

## 7. Command-line spot-checks (run from your machine)

### C-1. Production response headers actually apply to /api/*
- [ ] **Check:**
  ```
  curl -sI https://tractova.com/
  curl -sI "https://tractova.com/api/data-health?action=last-refresh"
  ```
- **Good:** (a) Both responses carry the CSP/HSTS/COOP/CORP set from `vercel.json`'s headers block (Vercel should apply the `/(.*)`-scoped headers to function routes — this verifies it); (b) `X-Frame-Options: SAMEORIGIN` coexisting with CSP `frame-ancestors 'none'` is fine — modern browsers prefer frame-ancestors; SAMEORIGIN is a legacy fallback.
- **If bad** (API responses missing CSP/HSTS): add an explicit `/api/(.*)` headers entry to `vercel.json`.
- **Finding:** F-41, F-14.

### C-2. Anon PostgREST bulk-read reality check (ONE page only — do not scrape your own prod)
- [ ] **Check:** From outside the app, with only the public anon key:
  ```
  curl -s "https://<project-ref>.supabase.co/rest/v1/revenue_rates?select=*" ^
    -H "apikey: <anon key>" -H "Range: 0-9"
  ```
  Then repeat with `Range: 10-19` to confirm pagination advances. **Stop after two pages** — that's sufficient proof.
- **Good (confirms F-01):** Both pages return rows. "Good" = the audit's claim is demonstrated, informing the doc-05 remediation; it does not mean the exposure is acceptable.
- **If bad** (denied): a live policy gates it that migrations don't show — see S-3's drift note; F-01 needs re-scoring.
- **Finding:** F-01.

### C-3. RSS source hosts — still owned, valid TLS
- [ ] **Check:** For each of the four feed hosts in `api/scrapers/_refresh-news.js:29-32` (`pv-magazine-usa.com`, `www.pv-tech.org`, `www.utilitydive.com`, `www.solarpowerworldonline.com`): `curl -sI https://<host>/` — expect HTTP 200/301 with a valid cert (curl fails loudly on cert errors); eyeball that each is still the legitimate publication (not a parked/for-sale page).
- **Good:** All four live, valid TLS, legitimate owners.
- **If bad** (expired/parked domain): that feed is an attacker-controllable content channel into the news pipeline and digest emails — remove it from the source list immediately and run S-11.
- **Finding:** injection findings' delivery-vector precondition.

### C-4. Registry tarball spot-check (optional — lowest priority)
- [ ] **Check:** In a clean temp dir: `npm pack stripe@22.1.1 @supabase/supabase-js@2.105.3` and compare each printed `shasum`/`integrity` against the matching `integrity` field in `package-lock.json`.
- **Good:** Hashes match (lockfile URLs/hashes were already verified to point at registry.npmjs.org for all 850 packages; this samples actual contents).
- **If bad** (mismatch): treat as a supply-chain incident — do not deploy; investigate which machine produced the lockfile entry.
- **Finding:** F-19.

---

## 8. Ask-yourself / local-machine items

### L-1. Did the post-05-31 credential rotation ever happen?
- [ ] **Check:** Your own memory + `docs/SECURITY_ROTATION_LOG.md` (all rows still show 2026-05-06/07 baselines). The 2026-05-31 audit left "rotate live creds in `.env.local`" as your action item.
- **Good:** Rotation done → add dated rows per secret to the rotation log.
- **If bad** (not done): it stays an open prior-audit action item (no secret was ever committed to git, so this is hygiene, not breach response). Schedule it; rotating the Stripe key pairs naturally with ST-2's restricted-key swap.
- **Finding:** prior-audit carryover, not a new finding.

### L-2. Password-manager backup includes the two newest secrets
- [ ] **Check:** 1Password/Bitwarden entry "Tractova — env vars" (`docs/secrets-manifest.md:20-22`) — does it contain the CURRENT `.env.local` including `HEALTH_CHECK_TOKEN` and `AXIOM_TOKEN`?
- **Good:** Both present and current.
- **If bad:** update the entry — otherwise a laptop loss permanently orphans those two secrets (Axiom token recoverable from Axiom; HEALTH_CHECK_TOKEN would just need regeneration, but you'd lose time discovering that).
- **Finding:** F-11 context.

### L-3. `.claude/settings.local.json` hardening still in place
- [ ] **Check:** On this machine, open `.claude/settings.local.json` (gitignored, local-only) — confirm the 2026-06-01 changes persist: exec wildcards removed; `git restore` / `git rm` in the deny list.
- **Good:** Hardening intact.
- **If bad** (reverted by a settings rewrite): re-apply — this file is the guardrail that keeps AI sessions from running destructive git/file ops unprompted.
- **Finding:** none — session-tooling safety.

---

## Completion tally

| Console | Items | Highest-stake item |
|---|---|---|
| Vercel | 11 (V-1…V-11) | V-1 CRON_SECRET / V-2 preview secrets |
| Supabase | 16 (S-1…S-16) | S-1 prune ACL / S-2 migrations live |
| Stripe | 2 (ST-1, ST-2) | ST-1 webhook secret match |
| GitHub | 4 (G-1…G-4) | G-1 push protection |
| Axiom | 3 (A-1…A-3) | A-3 forwarding live |
| Resend/DNS | 2 (R-1, R-2) | R-2 DMARC |
| CLI spot-checks | 4 (C-1…C-4) | C-2 anon bulk-read proof |
| Local/ask | 3 (L-1…L-3) | L-1 rotation status |
| **Total** | **45** | |

When done: anything marked BAD goes into doc 02's remediation queue with the linked finding ID;
anything that *confirmed* a finding's precondition (S-3, C-2, S-10) keeps that finding at its
current severity. Re-run this checklist after the remediation sprint and date the boxes.
