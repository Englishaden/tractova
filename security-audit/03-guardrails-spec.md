# 03 — Permanent Guardrails Spec (Prevention Layer)

**Date:** 2026-06-10 · **Audience:** Aden · **Status:** Plan-only (nothing in this doc is applied yet)
**Companion docs (same folder):** `00-threat-model.md`, `01-findings.md`, `02-remediation-roadmap.md`, `04-unverified-checklist.md`

> **Principle:** every config below EXTENDS an existing Tractova gate (`scripts/lint-*.mjs`,
> `scripts/_git-hooks/`, `.github/workflows/verify.yml`, `eslint.config.js`, CLAUDE.md §9).
> No parallel tooling where a script already exists. Where a tool is genuinely new
> (gitleaks, Semgrep, osv-scanner), it covers a gap the inventory confirmed has **no**
> automated gate today (git-history secrets, SAST — static application security testing —
> and malicious-package detection).

## Summary — what gets added, where, and which finding it prevents from recurring

| # | Guardrail | Lands in | Prevents recurrence of | New tool? |
|---|---|---|---|---|
| 1.1 | gitleaks staged-diff scan + `.gitleaks.toml` | `scripts/_git-hooks/pre-commit` (new step) + new root config | history-scan gap (inventory §2), F-27 baseline | Yes (gitleaks) |
| 1.2 | `pre-push` hook (static gates + gitleaks + review reminder) | new file `scripts/_git-hooks/pre-push` — **zero installer changes** | "verify before push" is convention-only (inventory) | No |
| 1.3 | api/ security lint: fn-cap, child_process ban, fetch allowlist, GATE declarations | `scripts/lint-api.mjs` (append) | F-33 regressions, 13th-route mistake, ungated endpoints | No |
| 1.4 | secret patterns + `public/` unskip + VITE_ manifest gate | `scripts/lint-secrets.mjs` (edit) | F-11, F-12 | No |
| 1.5 | `react/no-danger`, `no-eval` family | `eslint.config.js` (edit) + lint:js into CI | F-38 regressions (XSS via innerHTML) | No |
| 2 | `.github/workflows/security.yml` (Semgrep, gitleaks, lockfile-lint, osv-scanner) + deploy gating | new workflow + `verify.yml` edits + manual GitHub/Vercel steps | F-15, F-19, SAST gap, "CI gates nothing" deploy path | Yes (Semgrep, osv-scanner) |
| 3 | CSP/header diffs + header regression test | `vercel.json` + new `tests/unit/vercelHeaders.spec.js` | F-14, F-17, F-20, header-regression gap | No |
| 4 | CLAUDE.md §10 secure-coding contract | `CLAUDE.md` (append) | all "AI session writes insecure code" classes | No |
| 5 | §9 checklist additions | `CLAUDE.md` §9 (append rows) | F-01..F-06, F-15, F-21 re-introduction | No |
| 6 | AI second-pass review workflow | session workflow + pre-push reminder + `/security-review` skill | defects that lints can't express | No |

**Rollout order matters** — three gates are red on day one unless sequenced:
1. Fix F-11 (manifest rows for `VITE_STRIPE_PRICE_ID`, `VITE_LIC_TRACT_LOOKUP`) **before** enabling the VITE_ gate (§1.4c) — both are referenced in `src/pages/Search.jsx:207` and `src/components/UpgradePrompt.jsx:100` today and absent from `docs/secrets-manifest.md`.
2. One-time sweep adding `// GATE:` comments to the 12 top-level routes + `api/handlers/_*.js` **before** enabling lint-api Rule 4 (§1.3).
3. Run Semgrep once with `continue-on-error: true` (burn-in week) before flipping it blocking (§2.1).

---

## 1. Pre-commit / pre-push

### 1.1 gitleaks staged-diff scan (pre-commit) + `.gitleaks.toml`

**Why both gitleaks AND `lint-secrets.mjs`:** `lint-secrets.mjs` stays the single source of
truth for Tractova-specific env-line patterns and is dependency-free (always runs). gitleaks
adds ~150 generic detectors + entropy rules and, in CI (§2), the **git-history scan** the
inventory flagged as a total gap. Locally it degrades gracefully if not installed — CI is
the backstop.

**Install (one-time, per machine):**

```powershell
winget install Gitleaks.Gitleaks      # or: scoop install gitleaks
```

**New file `C:\Users\adenw\tractova\.gitleaks.toml` (repo root):**

```toml
# Tractova gitleaks config — extends the default ruleset.
# Allowlist philosophy: only paths that DOCUMENT secret shapes by design
# (mirrors META_FILES in scripts/lint-secrets.mjs) plus the one public-by-design
# JWT (Supabase anon key, RLS-gated).
title = "tractova"

[extend]
useDefault = true

[allowlist]
description = "Tractova-tuned false positives"
paths = [
  '''docs/secrets-manifest\.md''',
  '''docs/SECURITY_ROTATION_LOG\.md''',
  '''CLAUDE\.md''',
  '''scripts/lint-secrets\.mjs''',
  '''scripts/_git-hooks/.*''',
  '''scripts/audit-allowlist\.json''',
  '''security-audit/.*''',
  '''package-lock\.json''',
]
regexes = [
  # Supabase ANON key is public by design (shipped in the browser bundle, RLS-gated).
  # gitleaks' generic-jwt rule flags any eyJ... string; allow ONLY this assignment shape.
  '''VITE_SUPABASE_ANON_KEY\s*[=:]\s*["']?eyJ[A-Za-z0-9_\-\.]+''',
  # CI placeholder (verify.yml:56)
  '''placeholder-anon-key-for-ci-build-only''',
]
```

**Edit `scripts/_git-hooks/pre-commit`** — insert between step 1 (lint-secrets) and step 2
(lint:api), i.e. after line 32:

```bash
# 1b. gitleaks staged deep-scan (generic detectors + entropy). lint-secrets
# above remains the always-on, dependency-free gate; CI runs gitleaks on the
# FULL history, so skipping here when uninstalled is safe, not silent.
if command -v gitleaks >/dev/null 2>&1; then
  if ! gitleaks git --pre-commit --staged --redact --no-banner; then
    echo "  Block: gitleaks flagged a possible secret in the staged diff."
    echo "  False positive? Extend [allowlist] in .gitleaks.toml (path or regex)."
    exit 1
  fi
else
  echo "  ! gitleaks not installed — staged deep-scan skipped (CI runs it on full history)."
  echo "    Install: winget install Gitleaks.Gitleaks"
fi
```

(`gitleaks git --pre-commit --staged` is the v8.19+ syntax; on an older binary use
`gitleaks protect --staged --redact`. Verify with `gitleaks version` at install time.)

### 1.2 New `pre-push` hook — closes the "verify is a convention" gap

`scripts/install-git-hooks.mjs` already copies **every** non-md file in
`scripts/_git-hooks/` into `.git/hooks/` (install-git-hooks.mjs:37-46), so adding this file
requires **no installer change** — just re-run `node scripts/install-git-hooks.mjs` once.

**New file `scripts/_git-hooks/pre-push`:**

```bash
#!/usr/bin/env bash
# Tractova pre-push hook — static security gates before anything reaches
# origin (Vercel deploys main on push, so this is the last LOCAL gate).
# Deliberately excludes `npm run build` + Playwright (slow / needs dev server);
# CI runs the build, and `npm run verify` stays the rule for visible-feature
# changes (MEMORY: feedback_pre_push_verify).
set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "pre-push: lint:api + lint:secrets + lint:js + lint:audit + test:unit"
npm run --silent lint:api
node scripts/lint-secrets.mjs          # full tracked tree, not just staged
npm run --silent lint:js
npm run --silent lint:audit
npm run --silent test:unit

# Full-history secret scan when gitleaks is available (fast: seconds on ~900 commits)
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --redact --no-banner . || { echo "pre-push: gitleaks found leaks in history"; exit 1; }
fi

# Security-sensitive paths in this push -> remind about the AI second pass (§6).
# Warn-only: a hook can't run the review itself.
RANGE_FILES="$(git diff --name-only origin/main..HEAD 2>/dev/null || true)"
if echo "$RANGE_FILES" | grep -qE '^(api/|supabase/migrations/|vercel\.json|package(-lock)?\.json|src/lib/supabase|src/lib/pwnedPassword|src/pages/Sign|src/pages/UpdatePassword|scripts/lint-|\.github/workflows/|\.gitleaks\.toml)'; then
  echo ""
  echo "  ! Security-sensitive paths in this push."
  echo "    Run the /security-review second pass (CLAUDE.md §10 / guardrails spec §6) if not already done."
fi
exit 0
```

### 1.3 `scripts/lint-api.mjs` — security semantics (today it is syntax-only)

Append after the existing syntax loop (lint-api.mjs:46). Add `readFileSync` to the
existing `node:fs` import on line 13. Runs everywhere lint:api already runs: pre-commit,
pre-push (§1.2), CI (`verify.yml:31-32`), `npm run verify`.

```js
// ── Security rules (guardrails spec 2026-06-10) — beyond syntax ──────────────

// Rule 1: Vercel Hobby function cap — never a 13th top-level route.
// (MEMORY: project_vercel_hobby_function_cap — new actions multiplex through
// api/lens-insight.js + api/handlers/_*.js.)
const topLevelRoutes = readdirSync('api')
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
if (topLevelRoutes.length > 12) {
  console.error(`✗ ${topLevelRoutes.length} top-level api/*.js routes — Vercel Hobby cap is 12.`)
  console.error('  Route new actions through api/lens-insight.js + api/handlers/_*.js.')
  process.exit(1)
}

// Rule 2: child_process is banned under api/ (no shell-outs in serverless handlers).
const CHILD_PROCESS_RE =
  /require\(\s*['"](?:node:)?child_process['"]\s*\)|from\s+['"](?:node:)?child_process['"]/

// Rule 3: fetch() requires either the SSRF guard (api/lib/_urlFetch.js, finding F-33)
// or an entry here naming the trust root. Seeded with every callsite verified
// 2026-06-10 (constant vendor/gov URLs). A NEW file calling fetch() fails until
// reviewed and added — that review friction is the point.
const FETCH_ALLOWLIST = new Set([
  'api/lib/_urlFetch.js',                       // the SSRF guard itself
  'api/lib/_axiomLog.js',                       // constant Axiom ingest URL
  'api/check-staleness.js',                     // constant api.resend.com
  'api/send-digest.js',                         // constant api.resend.com
  'api/send-alerts.js',                         // constant api.resend.com + exact-host Slack allowlist (F-34)
  'api/refresh-data.js',                        // self-probe, constant origin
  'api/refresh-capacity-factors.js',            // NREL, constant base URL
  'api/refresh-substations.js',                 // EIA/HIFLD, constant base URLs
  'api/handlers/_tract-resolve.js',             // Census geocoder, constant base (F-43)
  'api/scrapers/_scraperBase.js',               // shared scraper fetch, gov sources
  'api/scrapers/_refresh-ca-dg.js',
  'api/scrapers/_refresh-flood-nri.js',
  'api/scrapers/_refresh-geospatial-farmland.js',
  'api/scrapers/_refresh-hosting-capacity.js',
  'api/scrapers/_refresh-md-dg.js',             // page-discovered link — constrain off-origin per F-07
  'api/scrapers/_refresh-news.js',
  'api/scrapers/_refresh-nj-dg.js',
  'api/scrapers/_refresh-ny-dg.js',
  'api/scrapers/_refresh-solar-costs.js',
  'api/scrapers/_refresh-va-dg.js',
  'api/scrapers/_refresh-wi-dg.js',
])
const FETCH_RE = /\bfetch\s*\(/

// Rule 4: every route entrypoint declares its auth gate near the top so a reviewer
// (human or AI) can diff intent vs. code. Top-level api/*.js (Vercel routes) and
// api/handlers/_*.js (multiplexed actions) only; api/lib/, api/scrapers/,
// api/_prompts/ are modules, not entrypoints.
// ROLLOUT: one-time sweep adds these comments BEFORE this rule ships (else red day one).
const GATE_RE =
  /\/\/\s*GATE:\s*(public|pro-bearer|admin-bearer|cron-secret|webhook-signature)\b/
const needsGate = f =>
  /^api\/[^/_][^/]*\.js$/.test(f) || /^api\/handlers\/_[^/]+\.js$/.test(f)

let secFailed = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (CHILD_PROCESS_RE.test(src)) {
    console.error(`✗ ${f}: child_process is banned under api/ (CLAUDE.md §10)`)
    secFailed += 1
  }
  if (FETCH_RE.test(src) && !FETCH_ALLOWLIST.has(f)) {
    console.error(`✗ ${f}: direct fetch() — route variable URLs through api/lib/_urlFetch.js,`)
    console.error('  or add this file to FETCH_ALLOWLIST in scripts/lint-api.mjs with a trust-root comment.')
    secFailed += 1
  }
  if (needsGate(f) && !GATE_RE.test(src.slice(0, 2000))) {
    console.error(`✗ ${f}: missing "// GATE: <public|pro-bearer|admin-bearer|cron-secret|webhook-signature>"`)
    secFailed += 1
  }
}
if (secFailed > 0) {
  console.error(`\n${secFailed} security-lint failure(s) under api/`)
  process.exit(1)
}
console.log('✓ api security lint OK (fn-cap, child_process, fetch allowlist, GATE declarations)')
```

### 1.4 `scripts/lint-secrets.mjs` — three edits (F-11, F-12)

**(a) Stop skipping `public/`** (it deploys verbatim to prod — F-12). Delete line 64:

```js
  if (p.startsWith('public/')) return true   // upstream data files   ← DELETE this line
```

**(b) Add patterns** to `SECRET_PATTERNS` (after line 41), and change the five existing
`env-*` patterns to tolerate quotes (`=` → `=["']?` in lines 37-41):

```js
  ['supabase-secret',  /\bsb_secret_[A-Za-z0-9_\-]{20,}/],           // new Supabase key format
  ['supabase-pub',     /\bsb_publishable_[A-Za-z0-9_\-]{20,}/],      // public, but never hardcode
  ['github-pat',       /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})/],
  ['private-key-pem',  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['postgres-url',     /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],   // creds-in-URL
  ['slack-webhook',    /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/],
  ['axiom',            /\bxaat-[A-Za-z0-9\-]{20,}/],
  ['env-health',       /^HEALTH_CHECK_TOKEN=["']?[A-Za-z0-9_\-]{10,}/m],
  ['env-axiom',        /^AXIOM_TOKEN=["']?[A-Za-z0-9_\-]{10,}/m],
  ['env-test-pass',    /^TEST_USER_PASSWORD=["']?\S{8,}/m],
  ['env-eia',          /^EIA_API_KEY=["']?[A-Za-z0-9]{10,}/m],
  ['env-nrel',         /^NREL_API_KEY=["']?[A-Za-z0-9]{10,}/m],
  ['env-census',       /^CENSUS_API_KEY=["']?[A-Za-z0-9]{10,}/m],
```

**(c) VITE_ manifest gate** — append after the existing hits report (line 126). Any
`VITE_*` token referenced in code ships to the browser bundle, so an uninventoried one is
an unreviewed exposure decision. **Land F-11's manifest rows first** (see Rollout order).

```js
// ── VITE_ env-var manifest gate (F-11 / CLAUDE.md §10) ───────────────────────
// Every VITE_* referenced in src|api|scripts|vite.config must have an inventory
// row in docs/secrets-manifest.md (and CLAUDE.md §7 for the secret-adjacent ones).
const VITE_SCOPE = /^(src|api|scripts)\/.*\.(js|jsx|mjs)$|^vite\.config\.(js|mjs)$/
let manifestVars = null
try {
  const md = readFileSync(resolve(ROOT, 'docs/secrets-manifest.md'), 'utf8')
  manifestVars = new Set(Array.from(md.matchAll(/VITE_[A-Z0-9_]+/g), m => m[0]))
} catch { /* manifest moved — skip rather than hard-fail on a doc rename */ }

if (manifestVars) {
  const viteHits = []
  for (const file of files) {
    if (!VITE_SCOPE.test(file) || shouldSkipPath(file)) continue
    const content = getContent(file)
    for (const m of content.matchAll(/\bVITE_[A-Z0-9_]+\b/g)) {
      if (!manifestVars.has(m[0])) viteHits.push(`${file}: ${m[0]}`)
    }
  }
  if (viteHits.length) {
    console.error('\n  ! lint-secrets: VITE_ var(s) referenced but missing from docs/secrets-manifest.md:')
    for (const h of [...new Set(viteHits)]) console.error(`    ${h}`)
    console.error('  Add an inventory row (+ CLAUDE.md §7) before committing.')
    process.exit(1)
  }
}
```

### 1.5 `eslint.config.js` — dangerous-DOM/eval rules (and lint:js into CI, §2.3)

There is **no sanctioned `dangerouslySetInnerHTML` wrapper today and zero usages**
(verified by grep 2026-06-10); the sanctioned rich-text path is
`src/lib/markdownRender.jsx` (F-38), which builds React elements without innerHTML.
So the rule is a flat ban — if a wrapper is ever genuinely needed, it gets its own file
plus an explicit per-file override here. `eval`/`new Function`: zero usages, safe to enable.

Add to the `rules` block (eslint.config.js:41-52):

```js
      // ── Security (guardrails spec 2026-06-10) — all verified zero-hit at adoption ──
      // No raw HTML injection. Rich text renders via src/lib/markdownRender.jsx (F-38).
      'react/no-danger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
```

Scope note: `eslint.config.js` deliberately covers `src/**` only; the equivalent api/-side
bans (child_process, fetch) live in `lint-api.mjs` (§1.3) so each surface has exactly one
owner — no parallel tooling.

---

## 2. CI pipeline

### 2.1 New file `.github/workflows/security.yml` (full file, copy-paste)

Deliberately a **separate workflow** from `verify.yml`: security scans pull remote rule
registries/databases and should also run on a weekly cron with no commits. `npm audit`
gating is **not duplicated here** — it stays in `verify.yml` via the existing
`scripts/audit-check.mjs` (`lint:audit`).

```yaml
name: Security

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 12 * * 1'   # Mondays ~08:00 ET — fresh OSV/gitleaks pass even with no commits
  workflow_dispatch:

permissions:
  contents: read

jobs:
  semgrep:
    name: Semgrep SAST (OWASP + Tractova rules)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    container:
      image: semgrep/semgrep
    # BURN-IN: set `continue-on-error: true` on this job for the first week,
    # triage registry-rule hits (inline `// nosemgrep: <rule-id>` with a reason,
    # or .semgrepignore), then remove the flag to make it blocking.
    steps:
      - uses: actions/checkout@v4
      - name: Scan (fail on ERROR-severity findings)
        run: >
          semgrep scan
          --config p/owasp-top-ten
          --config p/javascript
          --config .semgrep/tractova-rules.yml
          --severity ERROR
          --error
          --metrics=off

  gitleaks:
    name: Gitleaks (full git history)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # full history — closes the history-scan gap
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # GITLEAKS_LICENSE only required for ORG-owned repos; englishaden/tractova
          # is personal-account — free. Reads .gitleaks.toml at repo root automatically.

  supply-chain:
    name: Lockfile tamper + malicious-package scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: lockfile-lint — registry-host + integrity pinning (F-19)
        run: >
          npx --yes lockfile-lint --path package-lock.json --type npm
          --allowed-hosts npm --validate-https --validate-integrity
      - name: osv-scanner — OSV advisories incl. MAL-* malicious packages (F-19)
        uses: google/osv-scanner-action/osv-scanner-action@v2
        with:
          scan-args: |-
            --lockfile=package-lock.json
```

(Pin both third-party actions to the current release tag on first install — the existing
`dependabot.yml` github-actions ecosystem then keeps them bumped weekly.)

**osv-scanner vs "more Dependabot" — decision: osv-scanner.** Dependabot is already
configured (`.github/dependabot.yml`) and keeps doing version bumps; its alerts don't
*gate* anything, and neither Dependabot nor `npm audit` checks the OSV `MAL-*`
malicious-package database (the typosquat/compromised-release class F-19 names). osv-scanner
fills exactly that gap with zero config against the existing lockfile. Keep Dependabot; add
osv-scanner. Nothing is replaced.

### 2.2 New file `.semgrep/tractova-rules.yml` (full file, copy-paste)

Custom rules cover only what `lint-api.mjs`/ESLint **cannot express** (AST shapes).
`fetch`/`child_process`/`no-danger` are deliberately NOT mirrored here — `lint-api.mjs`
(§1.3) and ESLint (§1.5) own them and both run in CI, so a Semgrep copy would just be a
second allowlist to keep in sync.

```yaml
rules:
  - id: tractova-stack-to-client
    languages: [javascript]
    severity: ERROR
    message: >
      Never return err.message / err.stack to the client on 5xx (finding F-15).
      Send a generic body; log the full error server-side via axiomLog/console.error
      (pattern: api/data-health.js:143).
    paths:
      include: ["api"]
    patterns:
      - pattern-either:
          - pattern: $RES.status(500).json({ ..., stack: $X, ... })
          - pattern: $RES.status(500).json({ ..., error: $E.message, ... })
          - pattern: $RES.status(500).json({ ..., message: $E.message, ... })
          - pattern: $RES.status(500).json({ ..., detail: $E.stack, ... })

  - id: tractova-admin-email-literal
    languages: [javascript]
    severity: ERROR
    message: >
      Admin checks must use the role column / public.is_admin(), never a hardcoded
      email (findings F-08, F-25). The owner email in auth logic is a regression.
    paths:
      include: ["api", "src"]
      exclude: ["api/_admin-auth.js"]   # tracked legacy fallback — remove this exclude when F-25 lands
    patterns:
      - pattern-regex: aden\.walker67@gmail\.com

  - id: tractova-service-role-key-in-client
    languages: [javascript]
    severity: ERROR
    message: >
      SUPABASE_SERVICE_ROLE_KEY is server-only (CLAUDE.md §7) — it must never be
      referenced under src/ (it would ship in the browser bundle).
    paths:
      include: ["src"]
    patterns:
      - pattern-regex: SUPABASE_SERVICE_ROLE_KEY

  - id: tractova-rls-write-using-true
    languages: [generic]
    severity: ERROR
    message: >
      A write-capable RLS policy with using(true) is world-writable (cf. F-01/F-02
      class). Gate on auth.uid() / public.is_admin() / tier predicates.
      If a historical migration trips this, add a per-file paths.exclude here
      (migrations are immutable history) so only NEW migrations are gated.
    paths:
      include: ["supabase/migrations"]
    patterns:
      - pattern-regex: (?is)create\s+policy[^;]{0,400}for\s+(insert|update|delete|all)[^;]{0,400}using\s*\(\s*true\s*\)
```

**New file `.semgrepignore`** (keeps registry-rule noise out of non-runtime trees):

```
node_modules/
dist/
backups/
docs/
public/
tests/
security-audit/
```

### 2.3 Edits to the existing `.github/workflows/verify.yml`

**(a) Add the missing ESLint step** (the inventory's "lint:js absent from CI" gap) — insert
after the "File-size budgets" step (verify.yml:43-44):

```yaml
      - name: ESLint (runtime-crash + security rules)
        run: npm run lint:js
```

**(b) Deploy gating — the CI-gates-nothing problem.** Vercel deploys `main` on push,
regardless of CI. Two options:

- **Option A — classic branch protection (forces PR flow; breaks direct-push):**
  github.com/englishaden/tractova → Settings → Branches → Add rule for `main` →
  check *Require a pull request before merging* + *Require status checks to pass* and
  select: `Lint / unit / build`, `Semgrep SAST (OWASP + Tractova rules)`,
  `Gitleaks (full git history)`, `Lockfile tamper + malicious-package scan` →
  check *Do not allow bypassing the above settings*. **MANUAL STEP — GitHub UI.**
  Tradeoff: every change needs a PR; that ends the current commit-to-main + auto-push loop.

- **Option B — release-branch promote (RECOMMENDED: keeps direct-push, gates the deploy):**
  Vercel builds a `release` branch that CI fast-forwards only when green; pushes to `main`
  stay frictionless but a red CI run never reaches prod.
  1. **MANUAL STEP (one-time, Aden):** `git push origin main:release`, then Vercel dashboard →
     Project → Settings → Git → **Production Branch = `release`**.
  2. Append this job to `verify.yml`:

```yaml
  promote:
    name: Promote main → release (prod deploy gate)
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      actions: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Wait for the Security workflow on this SHA
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          for i in $(seq 1 30); do
            c=$(gh api "repos/${{ github.repository }}/actions/workflows/security.yml/runs?head_sha=${{ github.sha }}&per_page=1" \
                 --jq '.workflow_runs[0].conclusion // "pending"')
            [ "$c" = "success" ] && exit 0
            [ "$c" = "failure" ] && { echo "Security workflow failed — not promoting"; exit 1; }
            sleep 20
          done
          echo "Timed out waiting for Security workflow"; exit 1
      - name: Fast-forward release
        run: git push origin HEAD:release
```

  Note: with Option B, *preview* deploys of `main` still happen on every push (harmless);
  only **production** waits for green. During the Semgrep burn-in week (§2.1) the Security
  workflow still concludes `success` because of `continue-on-error`, so promotion is not
  blocked by triage noise.

---

## 3. Security-header / CSP changes to `vercel.json` (findings-justified only)

Headers were verified unchanged since 05-31 (F-41); only three diffs are justified.

**(a) F-14 — `img-src` wildcard.** In the CSP value (vercel.json:17):

```diff
- img-src 'self' data: https:;
+ img-src 'self' data: https://www.tractova.com;
```

**(b) F-20 — lockfile-authoritative prod installs.** Top of vercel.json (after line 2):

```diff
   "buildCommand": "npm run build",
+  "installCommand": "npm ci",
   "outputDirectory": "dist",
```

**(c) F-17 — CONDITIONAL: only after the topojson vendoring lands** (maps import local
JSON instead of fetching cdn.jsdelivr.net at runtime). Then, in connect-src (vercel.json:17):

```diff
- connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.resend.com https://cdn.jsdelivr.net https://api.pwnedpasswords.com https://hcaptcha.com https://*.hcaptcha.com;
+ connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.resend.com https://api.pwnedpasswords.com https://hcaptcha.com https://*.hcaptcha.com;
```

Do NOT apply (c) before the code change — it would break USMap/LibraryMap/DashboardGlobe.

**(d) Header regression gate** (inventory: "a PR loosening CSP passes every gate") — a
plain Vitest spec, so it rides the existing `test:unit` step in CI and pre-push.
**New file `tests/unit/vercelHeaders.spec.js`:**

```js
// Regression gate for vercel.json security headers (guardrails spec §3).
// Headers are declared-only config — nothing else asserts they stay tight.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const all = Object.fromEntries(
  cfg.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]),
)
const csp = all['Content-Security-Policy']

describe('vercel.json security headers', () => {
  it('keeps the non-CSP headers present', () => {
    for (const k of ['Strict-Transport-Security', 'X-Content-Type-Options',
      'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy']) expect(all[k], k).toBeTruthy()
    expect(all['Strict-Transport-Security']).toContain('preload')
  })
  it('keeps script-src free of unsafe-inline/unsafe-eval and wildcards', () => {
    const script = csp.split(';').find(d => d.trim().startsWith('script-src'))
    expect(script).not.toMatch(/unsafe-inline|unsafe-eval|https:\s|[*]\s*$/)
  })
  it('keeps frame-ancestors none, object-src none, base-uri self', () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
  })
  it('img-src has no bare https: wildcard (F-14)', () => {
    const img = csp.split(';').find(d => d.trim().startsWith('img-src'))
    expect(img).not.toMatch(/\shttps:(\s|$)/)   // passes only after the F-14 diff lands
  })
  it('connect-src is the exact reviewed allowlist (edit deliberately when it changes)', () => {
    const connect = csp.split(';').find(d => d.trim().startsWith('connect-src')).trim()
    expect(connect.split(/\s+/).slice(1).sort()).toMatchSnapshot()
  })
})
```

(The snapshot makes any connect-src change an explicit, reviewed diff. The img-src test is
written for the post-F-14 state — land them in the same commit.)

---

## 4. CLAUDE.md §10 — Secure-coding contract (verbatim, append to CLAUDE.md)

```markdown
## 10 — Secure-coding contract (every session, every diff)

1. **Queries:** PostgREST builders / parameterized only. Never string-concat SQL or filter strings from user input.
2. **Gates:** every route entrypoint (`api/*.js`, `api/handlers/_*.js`) opens with `// GATE: public|pro-bearer|admin-bearer|cron-secret|webhook-signature` — lint:api fails without it — and the named gate is enforced on a FRESH DB lookup before any work. Default-deny.
3. **Inputs:** schema-validate every client field at the top of the handler — type, length cap, array `.slice` cap, enum allowlist. Reject (400) over silently truncating. Anything feeding an AI prompt gets an explicit size cap.
4. **Secrets:** only via `process.env` / `import.meta.env`. New var → docs/secrets-manifest.md + §7 + Vercel BEFORE deploy (lint:secrets enforces the VITE_ half). Never log a value — presence + length only.
5. **Routes:** never a 13th top-level `api/*.js` (Hobby cap; lint:api enforces). New actions multiplex via api/lens-insight.js + api/handlers/_*.js.
6. **Fetches:** server-side fetch of a variable URL goes through api/lib/_urlFetch.js; constant-URL fetches need a FETCH_ALLOWLIST entry in scripts/lint-api.mjs with a trust-root comment.
7. **Admin actions:** every admin write produces an audit row (admin_audit_log trigger / logSecurityEvent). No silent admin mutations.
8. **Denials:** every new 401/403/429 branch logs a security event (axiomLog at minimum).
9. **Errors:** clients get generic bodies; err.message/stack go to server logs only.
10. **DOM:** no `dangerouslySetInnerHTML` (ESLint enforces). Rich text renders via src/lib/markdownRender.jsx.
11. **Migrations:** admin RLS uses `public.is_admin()` — never an email literal. Every SECURITY DEFINER function gets explicit `REVOKE ... FROM public, anon, authenticated`. Making any column anon-readable is an IP-exposure decision Aden approves explicitly.
12. **Dependencies:** before adding any package: `npm view <pkg>` (age, maintainers, repo, weekly downloads) and state the result in the commit message. Pin exact versions; no postinstall scripts without review.
13. **Headers:** never loosen vercel.json CSP/headers without a written rationale in the commit + BUILD_LOG (tests/unit/vercelHeaders.spec.js will fail the change anyway).
14. **Second pass:** a diff touching api/, migrations, auth pages, vercel.json, or package.json gets the §-security-review second pass before push (guardrails spec §6).
```

(14 rules, 16 content lines — within the 25-line budget.)

---

## 5. Pre-deploy security regression checklist — ADDITIONS to CLAUDE.md §9

Only the rows the 2026-06-10 findings show are missing; everything already in §9 stays.

```markdown
- [ ] **Migration grant hygiene.** New SECURITY DEFINER function → explicit `REVOKE ... FROM public, anon, authenticated` in the same migration (F-02). New write policy → `public.is_admin()`, never an email literal (F-08). New table/view/column readable by anon/authenticated → explicit IP-exposure sign-off from Aden (F-01).
- [ ] **AI spend path.** New/changed Anthropic-calling handler: input caps before prompt build (F-03); cache key covers EVERY input that shapes the prompt (F-04); rate limiter fails CLOSED on metering errors and a daily cap exists (F-05).
- [ ] **Client-facing errors generic.** No err.message / stack in any 4xx/5xx body — Semgrep `tractova-stack-to-client` backs this (F-15).
- [ ] **Denials observable.** New gate branches log 401/403/429 (F-21); admin write paths hit admin_audit_log (F-06).
- [ ] **Post-deploy header probe.** `curl -sI https://tractova.com` → CSP / HSTS / XCTO present and matching vercel.json (F-14, F-41; tests/unit/vercelHeaders.spec.js covers the repo side, this covers what Vercel actually serves).
- [ ] **Dependency delta.** Any package.json/lockfile change: npm-view legitimacy check recorded; lockfile-lint + osv-scanner green in the Security workflow (F-18, F-19, F-20).
- [ ] **Env inventory.** Any new env var — including server-only non-VITE vars, which the lint can't see — added to docs/secrets-manifest.md + §7 (F-11).
```

---

## 6. AI second-pass review workflow

**Trigger (mechanical, not judgment):** the session's cumulative diff vs `origin/main`
touches ANY of:
`api/**` · `supabase/migrations/**` · `src/lib/supabase.js` · `src/lib/pwnedPassword.js` ·
`src/pages/SignIn|SignUp|UpdatePassword*` · `vercel.json` · `package.json` /
`package-lock.json` · `scripts/lint-*.mjs` · `.github/workflows/**` · `.gitleaks.toml` ·
`api/_cors.js`. The pre-push hook (§1.2) greps the push range for exactly these paths and
prints the reminder — warn-only, because a git hook can't invoke the AI.

**Where it hooks into the session workflow:** Tractova sessions run in worktrees and close
with commit → push → FF-merge to main (MEMORY: project_session_workflow). The second pass
slots in **after the slice is code-complete, before the commit that gets pushed**:

1. Run the **`/security-review` skill** (built-in; reviews pending changes on the current
   branch). It is the default mechanism — the prompt below is the fallback for when the
   skill is unavailable, or when Aden wants a review in a fresh session with no
   contaminating context (a clean-context reviewer is more honest about its own code).
2. Record the one-line verdict in the BUILD_LOG session entry
   (e.g. `security second-pass: SECURITY-PASS (3 files reviewed)`).
3. `SECURITY-BLOCK` → fix and re-run before pushing. Never push over a BLOCK; a deliberate
   risk-acceptance instead gets written into BUILD_LOG with rationale, like the
   audit-allowlist convention.

**The exact review prompt (fallback / fresh-session form):**

```text
Act as a security reviewer making a second pass on this branch's diff vs origin/main.
Read first: CLAUDE.md §9 + §10, security-audit/03-guardrails-spec.md.
Scope: the changed lines and the functions/policies/handlers they touch — nothing else.
Do not propose style changes. For each changed file, check in order:
1. GATE — which of public/pro-bearer/admin-bearer/cron-secret/webhook-signature applies;
   is it enforced on a fresh DB lookup; does the // GATE: comment match the code?
2. INPUT — every client-supplied field validated (type, length/array cap, enum) before
   use? Anything reaching an AI prompt explicitly capped (F-03)?
3. EXPOSURE — does any new table/view/column become readable by anon/authenticated?
   Any synthesized-IP columns leaving the Pro gate (F-01)?
4. MIGRATIONS — SECURITY DEFINER without REVOKE (F-02)? Email-literal policy instead of
   public.is_admin() (F-08)? using(true) on a write policy?
5. ERRORS/LOGGING — err.message/stack to client (F-15)? New 401/403/429 branch without a
   security-event log (F-21)? Admin write without an audit row (F-06)?
6. SECRETS/HEADERS/DEPS — new env var in manifest+§7 (F-11)? CSP/vercel.json loosened?
   New dependency: npm view age/repo/downloads checked (§10.12)?
Output: a table (file:line · risk · severity · concrete fix), then EXACTLY one final line:
SECURITY-PASS  or  SECURITY-BLOCK: <one-sentence reason>.
```

**Why this layer exists when §§1-2 already lint:** the lints catch *expressible* patterns;
the second pass catches the inexpressible ones the findings actually contained — a cache
key missing one input (F-04), a rate limiter failing open (F-05), a column that's
technically valid SQL but gives away the product (F-01). One reviewer pass per
security-touching slice, verdict on the record, is the cheapest control that covers that
class.

---

## Unverified / manual-only items in this spec

| Item | Why unverified | How to check |
|---|---|---|
| GitHub Actions enabled + green on remote | Not visible from the repo | github.com/englishaden/tractova → Actions tab |
| Branch protection state on `main` | GitHub UI only | Settings → Branches (Option A, §2.3b) |
| Vercel Production Branch switch to `release` | Vercel dashboard only | Project → Settings → Git (Option B, §2.3b) |
| gitleaks/osv-scanner action current version tags | No registry fetch in this read-only session | Check the actions' GitHub releases pages at install time, pin, let Dependabot bump |
| GitHub native secret-scanning enabled | GitHub UI only | Settings → Code security and analysis (docs/secrets-manifest.md:114 already prescribes this) |
