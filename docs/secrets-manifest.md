# Secrets Manifest

> **Last reviewed:** 2026-05-06
> **Owner:** Aden (englishaden)
>
> Inventory of every secret the project depends on, where it lives,
> and the rotation cadence. This file is **committed** to git with
> REDACTED placeholders only — never paste real values here.

---

## Where secrets live

- **Local development:** `.env.local` at the project root. Gitignored
  via `.gitignore` line 10. Loaded by Vite (`VITE_*`-prefixed values
  exposed to the browser; everything else stays server-side).
- **Production runtime:** Vercel Project → Settings → Environment
  Variables. Each variable is set per-environment (Production, Preview,
  Development); production values are the canonical source.
- **Personal backup:** Aden keeps a copy of `.env.local` in 1Password
  / Bitwarden under the entry "Tractova — env vars". Update both
  locations on any rotation.

A leaked secret committed to git is a real failure mode — the
pre-commit hook (`scripts/_git-hooks/pre-commit`) scans staged
content for known secret shapes (sk-*, supabase service-role keys,
etc.) and blocks the commit. It is bypassable with `--no-verify`;
NEVER bypass to ship faster.

---

## Inventory

| Variable | Purpose | Browser-exposed? | Rotation |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (public) | n/a |
| `VITE_SUPABASE_ANON_KEY` | Browser-side Supabase auth | Yes (public, RLS-gated) | If RLS misconfigured / leaked |
| `SUPABASE_URL` | Server-side mirror | No | n/a |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access for `api/*.js` | **No — never ship to browser** | **Annually** unless leak suspected |
| `ANTHROPIC_API_KEY` | Lens / Compare / digest insights | No | Annually |
| `RESEND_API_KEY` | Outbound transactional email | No | Semi-annually |
| `VITE_RESEND_AUDIENCE_ID` | Resend audience ID for digest | Yes | n/a |
| `STRIPE_SECRET_KEY` | Billing API server-side | No | **Quarterly** |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | No | When endpoint URL changes / quarterly |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Browser-side checkout | Yes (public) | When Stripe account rotates |
| `CRON_SECRET` | Bearer token gate on `api/refresh-data.js` | No | Semi-annually |
| `VITE_HCAPTCHA_SITEKEY` | hCaptcha widget on auth forms (public sitekey) | Yes (public) | n/a — the paired SECRET lives in Supabase Auth (Bot & Abuse Protection), not in env |
| `STRIPE_PRICE_ID` | Server-side canonical Stripe price allowlist (anti price-substitution) | No | When Stripe price changes |
| `VITE_STRIPE_PRICE_ID` | Browser-side Stripe price id passed to checkout | Yes (public) | When Stripe price changes |
| `CENSUS_API_KEY` | Census ACS / LMI demographic-data refresh | No | Annually |
| `EIA_API_KEY` | EIA substations + offtake-rate data refresh | No | Annually |
| `NREL_API_KEY` | NREL PVWatts capacity-factor refresh | No | Annually |
| `LBNL_TTS_CSV_URL` | Source URL for the LBNL TTS solar-cost CSV (local seed path) | No | n/a — public gov source |
| `HEALTH_CHECK_TOKEN` | Bearer gate on the `api/data-health.js` health-summary telemetry endpoint | No | Semi-annually |
| `AXIOM_TOKEN` | Axiom log-ingest token (server-side observability) | No | Semi-annually |
| `AXIOM_DATASET` | Axiom dataset name for log ingestion | No | n/a |
| `SUPABASE_ANON_KEY` | Server-side anon-key fallback for read-only scripts | No | If RLS misconfigured / leaked |
| `RESTORE_ALLOW_PROD` | Local-only `=1` override to permit `restore-from-snapshot.mjs` into a prod-looking DB | No | n/a — local override flag |
| `TEST_USER_EMAIL` | Local/dev Playwright + audit test-account login | No | n/a — non-prod test account |
| `TEST_USER_PASSWORD` | Local/dev Playwright + audit test-account password | No | When test account rotates |
| `VITE_LIC_TRACT_LOOKUP` | Build-time flag; `=off` disables server-side LIC tract lookup | Yes (public, build flag) | n/a |

> Vercel platform-injected vars (`VERCEL_ENV`, `VERCEL_REGION`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_GIT_COMMIT_SHA`) are read by `api/_cors.js` + `api/lib/_axiomLog.js` but are provided by the platform — not secrets we provision, so they are intentionally omitted from this inventory.

---

## Rotation cadence

Reasoning, summary:

- **Quarterly (Stripe):** Stripe's threat model includes accidental
  exposure of secret keys via support tickets / logs / screenshots.
  Quarterly rotation lowers the half-life of any unnoticed leak. Cost:
  ~5 minutes per rotation (regenerate, update Vercel + 1Password +
  webhook URL if needed).
- **Semi-annually (Resend, CRON_SECRET):** Lower-blast-radius secrets.
  Resend leak = unauthorized email send (recoverable). CRON_SECRET
  leak = unauthorized cron trigger (idempotent endpoints, capped
  blast radius).
- **Annually (Supabase service-role, Anthropic):** Highest-blast-
  radius secrets. Rotation is more disruptive (requires
  coordinating Vercel env update + verifying every cron / API route
  works after the swap). Defense-in-depth via RLS (migration 058)
  and per-route rate limiting.

Aden owns the calendar reminder. Add to personal calendar quarterly.

---

## What to do on suspected leak

Order of operations matters — rotate the leaked secret BEFORE
rolling the deploy or cleaning the source.

1. **Immediately rotate the secret** in its source (Supabase /
   Stripe / Anthropic / Resend dashboard). Old key dies; new key
   issued.
2. **Update Vercel env var** to the new value. Trigger a redeploy
   so all serverless functions pick it up.
3. **Update local `.env.local`** + 1Password backup with the new
   value. Restart `npm run dev`.
4. **If the leak was via a git commit:** `git revert` the commit
   that introduced it AND treat the secret as compromised regardless
   of how recent — git history is permanent on remote.
5. **Audit usage:** check the relevant dashboard (Stripe events,
   Anthropic Console, Supabase logs) for unauthorized activity.
   Document anything anomalous in BUILD_LOG.

---

## Vercel env-var inventory check

Before any deploy that touches a route requiring a new secret,
verify the secret is set in Vercel **Production** environment. Local
`.env.local` is loaded only on `npm run dev`; production reads from
Vercel's stored env. Mismatch = the route fails at runtime with a
nondescript error.

Manual check: `vercel env ls` (requires Vercel CLI). If CLI not
installed, use the Vercel dashboard → Project Settings → Environment
Variables.

---

## Detection layers

- **Pre-commit hook** (`scripts/_git-hooks/pre-commit`) — blocks
  commits containing known secret shapes. Install via
  `node scripts/install-git-hooks.mjs`.
- **GitHub secret scanning** — automatic for public repos; verify
  enabled at GitHub → Settings → Code security and analysis.
- **Citation lint** (`scripts/lint-citations.mjs`) — separate concern,
  but the same defense-in-depth philosophy.

---

## Companion files

- `CLAUDE.md` Section 8 — runtime env-var inventory (no rotation detail).
- `.env.local` — local values, gitignored.
- `scripts/_git-hooks/pre-commit` — detection layer.
