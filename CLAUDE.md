# CLAUDE.md — Tractova Project Safety Net

> Loaded into every session. Its job: make the AI **stop and think** before
> destructive operations. A SESSION-time instruction from Aden overrides this
> for THAT session only; CLAUDE.md is the durable contract.
> Owner: Aden (aden.walker67@gmail.com). Last reviewed 2026-05-25.

---

## 1 — STOP-AND-ASK (surface the op + wait for operation-specific approval)

A generic "continue" from earlier does NOT count. Approval must name the
specific operation (by name or visible diff/SQL).

### 1.1 Database
- **DELETE / TRUNCATE / DROP** on any Supabase table — show the SQL, target table, est. row count; approval = explicit "yes delete N rows from `<table>`" / "yes drop `<table>`".
- **Irreversible migrations** (DROP COLUMN with data, DROP TABLE on a populated table, REVOKE). Writing migration FILES is fine; APPLYING is Aden's manual step — if you ever wire auto-apply, the apply belongs here.
- **UPDATE without a WHERE** (or `WHERE 1=1`).

### 1.2 Git
- **`git push --force` / `--force-with-lease` to main/master** — show commits about to be lost; default answer: don't. Never force-push main.
- **`git reset --hard`**, `git checkout -- <file>` over uncommitted work, `git clean -f`, `git branch -D`, deleting unmerged branches, amending already-pushed commits.

### 1.3 File-system
- **`rm -rf` of any directory not created this session.**
- Overwriting files outside the project tree (`~`, `/etc`, other repos, system config).
- **`Write`/`Edit` into `.env` / `.env.local`** (secrets) — show which var, redacted.

### 1.4 Process / external side-effects
- **`kill` / `taskkill`** of a process you didn't start this session (show PID/cmd/age).
- Anything hitting a **paid service** (Stripe, Resend bulk, Anthropic batch > 1 call, Vercel deploy/promote, GitHub Action triggers) without a per-call OK.
- **`vercel deploy --prod` / `vercel promote`** — prod ships via `git push origin main` + CI, not the CLI.

### 1.5 Cost runaway
- **> 3 agents in parallel** · **> 50 web fetches / session** · **AI calls looped over states/projects/counties** — all need a budget OK first.

### 1.6 Approval format
✅ "yes drop `cs_projects` and reseed from the NREL CSV" (specific) · ✅ "go ahead with that DELETE — show the row count first" (tied to the next op). ❌ "continue" · ❌ a stale "yes" with no op in view. A "just do it, don't ask" is a **one-shot bypass for THAT call only**; the next destructive op re-enters this list.

---

## 2 — TRUST-BUT-VERIFY (auto-execute, but show diff/output/impact)

- All `Edit`/`Write` to project files (tool shows the diff).
- `git add` + `git commit` — show staged file list + message first.
- **`main` is branch-protected (2026-06-12): a direct `git push origin main` is REJECTED.** Ship via a branch + PR — `git switch -c <slice>`, commit, `npm run verify`, `git push -u origin <branch>`, then open the PR (`gh pr create` or hand Aden the compare link). CI gates the merge; Vercel previews the branch and deploys prod on merge. (saved `feedback_auto_push`; pushing a non-`main` branch is auto.)
- `npm run build` / `lint:api` / `test:smoke` / `test:unit` — auto; relay failures.
- Migration FILES (`supabase/migrations/*.sql`) — auto. Aden reviews + applies. The DANGER is APPLYING (his step).
- Seed scripts on dev DB — prefer `--dry-run` first; live run needs an OK if no recent dry-run was visible.

---

## 3 — HALLUCINATION GUARDS (anti-fabrication)

- **Never cite a source URL** without WebFetching it OR confirming from a file in the tree. Training-data-only recall → label "(unverified)" or skip.
- **Never quote a number from a report** without finding it in an actual file on disk.
- **Never reference an API endpoint, schema column, or config key** you haven't read in the codebase (Grep/Read first — a filename is not proof the table exists; read the migration body).
- **Never state a migration "applied" or a cron "succeeded"** without probing live state (`scripts/probe-*.mjs` / query `cron_runs`).
- Past failure modes (named so they're not repeated): Lazard LCOE cited from memory not the PDF; cs_specific_yield treated as observed when it was derived. Fix = fetch/read the actual source; separate observed-vs-synthesis.

---

## 4 — COST CIRCUIT BREAKERS

- One Lens insight ≈ 6K tokens (Haiku) — one-offs fine; loops need a budget OK.
- Subagents ~$0.10–0.30 each — max 3 parallel; synthesize their output before spawning more.
- Web fetches > 50/session → stop and ask. Mass refactors touching > 20 files → present scope first.
- Long sessions cost more per turn — when the work's done, summarize and stop.

---

## 5 — HIGH-CONFIDENCE-MISTAKE PROTOCOL

Before ANY Section-1 op, even if you think you're pre-authorized:
1. **Write the operation** in plain English (e.g. "DELETE FROM cs_projects WHERE state='NY', ~840 rows").
2. **Write what could go wrong** + recovery cost.
3. **Write the evidence it's safe** (who approved, which file/flag, dry-run output, no live reader).
4. **Ask explicitly**, with the above written, and wait for an op-named approval.

**Skip conditions:** a single `Edit` on a non-config project file · `Read`/`Grep`/`Glob` · `npm run build`/`lint`/`test:*` · a one-shot bypass tied to THIS call.

---

## 6 — SAFE-FALLBACK ESCAPE HATCHES (prefer the reversible path)

`git revert`/branch over `reset --hard` · write a sibling file over overwriting · rename `col_DEPRECATED` over `DROP COLUMN` · `UPDATE … SET deleted_at = now()` over `DELETE` · ship one iteration + show output before extending · find the non-`--force` path (there almost always is one).

---

## 7 — Env-var manifest (inventory only — never commit values)

Runtime secrets live in `.env.local` (dev) + Vercel Project Settings (prod):
`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` (server-only, never browser) · `ANTHROPIC_API_KEY` · `RESEND_API_KEY` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `VITE_STRIPE_PUBLISHABLE_KEY` · `CRON_SECRET` · `VITE_RESEND_AUDIENCE_ID` (optional) · `VITE_HCAPTCHA_SITEKEY` (PUBLIC — hCaptcha sitekey for the auth-form widget; pairs with the hCaptcha SECRET stored in Supabase Auth, not here) · `STRIPE_PRICE_ID` (server-side price allowlist) · `VITE_STRIPE_PRICE_ID` (PUBLIC — checkout price id) · `CENSUS_API_KEY` · `EIA_API_KEY` · `NREL_API_KEY` (gov data-refresh keys) · `LBNL_TTS_CSV_URL` (LBNL solar-cost CSV source URL) · `HEALTH_CHECK_TOKEN` (gates the data-health telemetry endpoint) · `AXIOM_TOKEN` · `AXIOM_DATASET` (server-side log ingestion) · `SUPABASE_ANON_KEY` (server-side anon fallback for read scripts) · `RESTORE_ALLOW_PROD` (local restore-to-prod override) · `TEST_USER_EMAIL` · `TEST_USER_PASSWORD` (local/dev test account, non-prod) · `VITE_LIC_TRACT_LOOKUP` (PUBLIC — build flag). Vercel-platform-injected `VERCEL_*` vars are not provisioned by us (omitted).
New var → update this list + `docs/secrets-manifest.md` + verify it's set in Vercel before the next deploy.

Companion files: `BUILD_LOG.md` (session log, single source of truth) · `docs/data-trust-audit.md` · `docs/secrets-manifest.md` · `.claude/settings.local.json` (permissions).

---

## 8 — Quick reference

**Stop and ask:** DELETE/TRUNCATE/DROP · force-push · `rm -rf` of non-session dirs · editing `.env*` · killing processes · spending > $0.50 in one sweep.
**Just do it:** file `Edit`/`Write` in the tree · `git add`/`commit` · push a **branch** + open a PR (main is protected — never push main directly) · `build`/`lint:api`/`test:*` · `Read`/`Grep`/`Glob` · writing a migration FILE.
**When unsure → ask.** A 30-second pause costs nothing; an unwanted DELETE costs hours.

---

## 9 — Security checklist (review before each deploy touching auth / data / $)

From the 2026-05-31 security audit. Run through this when a change touches
authentication, authorization, the DB layer, payments, or any server-side fetch.

- [ ] **profiles privileged columns stay locked.** No new code/policy lets the `authenticated`/`anon` role write `role`, `subscription_tier`, `subscription_status`, or `stripe_customer_id`. The migration-071 BEFORE-UPDATE guard must remain; re-check `pg_policies` + `pg_trigger` for `profiles` after any RLS change. (C1)
- [ ] **Server-side authz on a FRESH lookup.** Every `api/*` handler verifies the JWT and re-checks tier/role against the DB — never trusts a client field, cookie, hidden input, URL param, or price id. Default-deny.
- [ ] **Admin vs Pro vs cron are distinct gates.** Admin-only actions call `isAdminFromBearer` (the Pro gate is NOT admin). Cron-only endpoints require `Bearer CRON_SECRET` (or admin JWT) — the `x-vercel-cron` header alone is not a trust boundary. (I1, C4)
- [ ] **No SSRF.** Any server-side `fetch(userOrAdminUrl)` goes through `api/lib/_urlFetch.js`-style guards: http/https only, resolved host not in a private/loopback/link-local/reserved range, redirects followed manually and re-validated. (I1)
- [ ] **Secrets.** Nothing secret in the client bundle or logs (log presence+length, never a prefix). `npm run lint:secrets` clean. New env var → `docs/secrets-manifest.md` + Vercel + § 7 list. Compare tokens with `timingSafeEqualStr`. (L2, L3)
- [ ] **Dependencies.** `npm audit` reviewed; any new high+ advisory is fixed or added to `scripts/audit-allowlist.json` with an ACCURATE, current rationale + `review_due`. (M3)
- [ ] **Headers / CORS / redirects.** CSP + CORS allow-list unchanged or tightened — no `*`, no attacker-registerable wildcard, no reflected-origin on authed endpoints. User-supplied redirect targets (Stripe URLs) validated against our own origins via `isAllowedRedirectUrl`. (C3, L1)
- [ ] **Input + output.** Server-side validation on every input; no string-concat SQL (PostgREST/parameterized only); no `dangerouslySetInnerHTML`; no untrusted workbook parsing (xlsx read path is gov-source-only — D-day for the exceljs migration is tracked in the allowlist).
- [ ] **Payments.** Stripe webhook signature verified on the raw body; paid tier granted ONLY by a verified webhook event; `client_reference_id` validated against a real profile.
- [ ] **PII.** Event logs / metadata store `user_id`, not email; public surfaces never render raw email. (D1)
- [ ] **Supabase Auth settings (live, not in repo):** password min length ≥ 10; "Confirm email" obfuscation on (anti-enumeration); auth rate limits configured. (A1, A2) **Leaked-password protection is handled app-side** (`src/lib/pwnedPassword.js` HIBP k-anonymity check in SignUp/UpdatePassword) because the native Supabase HIBP toggle is Pro-plan-gated — keep that check wired on both flows. **Server-side enforcement deliberately NOT built** (decision 2026-05-31): it would require re-routing signup through the backend (`admin.createUser`), re-implementing Supabase's confirmation-email/resend/rate-limit/anti-enumeration plumbing by hand. Bypassing the client check only weakens the user's OWN account (no adversarial gain), so the cost/risk is disproportionate. Revisit only if abuse appears.
- [ ] **Migration grant hygiene.** New SECURITY DEFINER function → explicit `REVOKE … FROM public, anon, authenticated` in the same migration (F-02). New write policy → `public.is_admin()`, never an email literal (F-08). New table/view/column readable by anon/authenticated → explicit IP-exposure sign-off from Aden (F-01).
- [ ] **AI spend path.** New/changed Anthropic-calling handler: input caps before prompt build (F-03); cache key covers EVERY input that shapes the prompt (F-04); rate limiter fails CLOSED on metering errors and a daily cap exists (F-05).
- [ ] **Client-facing errors generic.** No `err.message` / stack in any 4xx/5xx body — full detail to `console.error`/`axiomLog` only (F-15).
- [ ] **Denials observable.** New gate branches log 401/403/429 (F-21); admin write paths hit `admin_audit_log` (the migration-085 trigger for client-direct writes, or `logAdminAction` for service-role admin paths) (F-06).
- [ ] **Post-deploy header probe.** `curl -sI https://tractova.com` → CSP / HSTS / XCTO present and matching `vercel.json` (`tests/unit/vercelHeaders.spec.js` covers the repo side; this covers what Vercel actually serves) (F-14, F-41).
- [ ] **Env inventory.** Any new env var — including server-only non-VITE vars the lint can't see — added to `docs/secrets-manifest.md` + § 7 (F-11).

---

## 10 — Secure-coding contract (every session, every diff)

1. **Queries:** PostgREST builders / parameterized only. Never string-concat SQL or build filter strings from user input.
2. **Gates:** every route entrypoint (`api/*.js`, `api/handlers/_*.js`) opens with `// GATE: public|pro-bearer|admin-bearer|cron-secret|webhook-signature`, and the named gate is enforced on a FRESH DB lookup before any work. Default-deny.
3. **Inputs:** schema-validate every client field at the top of the handler — type, length cap, array `.slice` cap, enum allowlist. Reject (400) over silently truncating. Anything feeding an AI prompt gets an explicit size cap (`api/lib/_promptInput.js`).
4. **Secrets:** only via `process.env` / `import.meta.env`. New var → `docs/secrets-manifest.md` + § 7 + Vercel BEFORE deploy. Never log a value — presence + length only.
5. **Routes:** never a 13th top-level `api/*.js` (Hobby cap). New actions multiplex via `api/lens-insight.js` + `api/handlers/_*.js`.
6. **Fetches:** server-side fetch of a variable URL goes through `api/lib/_urlFetch.js`; constant-URL fetches stay constant (no user/admin string into the URL).
7. **Admin actions:** every admin write produces an audit row (migration-085 trigger for client-direct writes; `logAdminAction` for service-role admin paths). No silent admin mutations.
8. **Denials:** every new 401/403/429 branch logs a security event (`axiomLog` at minimum).
9. **Errors:** clients get generic bodies; `err.message`/stack go to server logs only.
10. **DOM:** no `dangerouslySetInnerHTML` (ESLint `react/no-danger` enforces). Rich text renders via `src/lib/markdownRender.jsx`.
11. **Migrations:** admin RLS uses `public.is_admin()` — never an email literal. Every SECURITY DEFINER function gets an explicit `REVOKE`. Making any column anon-readable is an IP-exposure decision Aden approves explicitly.
12. **Dependencies:** before adding any package, `npm view <pkg>` (age, maintainers, repo, weekly downloads) and state the result in the commit message. Pin exact versions; no postinstall scripts without review.
13. **Headers:** never loosen `vercel.json` CSP/headers without a written rationale in the commit + BUILD_LOG (`tests/unit/vercelHeaders.spec.js` will fail the change anyway).
14. **Second pass:** a diff touching `api/`, migrations, auth pages, `vercel.json`, or `package.json` gets the `/security-review` second pass before push.
