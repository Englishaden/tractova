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
