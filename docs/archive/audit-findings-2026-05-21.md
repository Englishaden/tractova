# UI/UX + functionality audit — 2026-05-21 (comprehensive)

Round 2 of the audit arc, run with the new headless audit tool
(`npm run audit:visual`). Round 1 (`docs/audit-findings-2026-05-19.md`)
was cut short by Playwright MCP browser instability and covered only
public routes via code-level review. This round walked the **full
authed surface**.

## Method + coverage

- **Tool:** `scripts/visual-audit.mjs` — headless Chromium, no visible
  window. Captures full-page screenshots + console messages + failed
  HTTP responses (with URLs) per route × viewport.
- **Authed run:** `npm run audit:visual -- --auth` against the local
  dev server (real Supabase data, Pro session) — **12 routes × desktop
  (1440×900) + mobile (390×844) = 24 checks.** Routes: `/` (Dashboard),
  `/about`, `/preview`, `/glossary`, `/signin`, `/signup`, `/privacy`,
  `/terms`, `/search` (Lens form), `/search?...` (Lens result),
  `/library`, `/profile`.
- **Public run:** earlier pass against `https://tractova.com` (prod),
  8 public routes × 2 viewports = 16 checks.

## Result

**All 24 authed checks render clean** after the fixes below. No layout
breaks, no missing data, no white screens across desktop or mobile.

---

## Findings + fixes

### F-G1 — Glossary duplicate React keys (FIXED)

`/glossary` logged `Encountered two children with the same key` twice
per page load (desktop + mobile). Root cause: `GLOSSARY_TERMS` in
`src/data/glossaryTerms.js` merges a hand-authored base list with
definition-derived terms (`...GLOSSARY_NEW_TERMS`). Two definition
titles — `NTP (Notice to Proceed)` and `IX Queue (Interconnection
Queue)` — duplicate base entries, so `key={t.term}` collided twice.
The file comment already stated the intent ("Only new terms not
already present below") but the dedup was never implemented.

**Fix:** dedupe the final export by `term`, first-occurrence-wins
(base terms are canonical). Robust against any future collision.
Post-fix audit: `/glossary` clean on both viewports (0 errors).

### F1 — `--color-primary` token drift (FIXED)

`src/index.css` defined `--color-primary` / `--color-primary-600` as
the legacy `#0f6e56`, while the May-2026 color audit had moved every
component literal to canonical `#0F766E` (Tailwind teal-700). So all
`bg-primary` / `text-primary` / `border-primary` / `ring-primary`
utilities (56 usages across 14 files) rendered a slightly different
teal than the style-literal eyebrows.

**Fix (surgical):**
- `--color-primary` → `#0F766E`
- `--color-primary-600` → `#0F766E` (== primary)
- `--color-primary-700` → `#115E59` (Tailwind teal-800; the darker
  hover / dark-text step. Also matches the `#115E59` dark-teal chip
  literals already used in 5 components, so `text-primary-700` (17×)
  and `bg-primary-700` hover (7×) now harmonize with them.)
- Stale comment at `index.css:246` updated.

Lighter ramp steps (`--color-primary-50` … `-300`) were **left as-is**:
they're already harmonious teals, weren't the flagged drift, and
changing them would shift dozens of subtle backgrounds (e.g.
`bg-primary-50`, 22×) without review benefit. Revisit only if a
fully-Tailwind teal ramp is wanted later.

### F-D1 — `/api/lens-insight` 404 on Dashboard/preview (dev-only, NOT a prod bug)

The Dashboard (`/`) and `/preview` fire a `GET /api/lens-insight` on
desktop that 404s under `vite dev` (Vite doesn't run the Vercel
serverless functions). Confirmed dev-only: the prod run showed
`/preview` clean. Same class as the Footer's `/api/data-health` fetch,
which the code already guards with `if (!import.meta.env.PROD) return`.

**Not fixed** — no prod impact. Optional future polish: guard the
Dashboard/preview lens-insight prefetch the same way to silence the
dev console. Low priority.

---

## Tooling note

`scripts/visual-audit.mjs` gained a `page.on('response')` handler this
round, so 4xx/5xx responses now appear in `findings.md` **with their
URLs** (the browser console only logs a bare "Failed to load
resource"). That's what let F-D1 be traced to `/api/lens-insight`
rather than left as an unattributed 404.

## Carried forward

- **Onboarding revamp (Huly plan)** — separate arc; not part of this
  audit. Plan at `~/.claude/plans/huly-onboarding-revamp.md` (carries
  the no-employer-naming standing rule).
