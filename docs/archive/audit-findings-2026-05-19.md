# UI/UX + functionality audit — 2026-05-19

Run after the About Us page shipped, as prep for the onboarding revamp
asset-capture session. Auditor: Claude (session worktree
`distracted-elbakyan-98ed43`).

## Method + coverage

- **Browser walk** — local dev server (`npm run dev`) against real
  Supabase data, at desktop width.
  - Walked clean (0 console errors, real data rendered): `/` Landing,
    `/preview` Dashboard, `/about`, `/glossary`.
- **Code-level consistency sweep** — design tokens, nav clearance,
  page chrome, across all `src/pages` + `src/components`.

### Not covered this round

- **Authed routes** (`/search`, `/library`, `/profile`, `/admin`) —
  require sign-in. Recommend `npm run test:smoke:all` (the existing
  `auth.setup` pro-smoke suite already walks these) for the functional
  pass.
- **Exhaustive per-route visual diffing + responsive/mobile** — the
  Playwright MCP browser in this environment was unstable (dropped its
  connection between most calls; would not hold a viewport resize).
  A full visual + mobile sweep is best folded into the onboarding
  asset-capture session, where a human is in the browser anyway.

---

## Findings

### F1 — `--color-primary` token never updated to canonical teal (significant)

The May 2026 color audit (commit `5bd249c`, "consolidate legacy primary
teal #0F6E56 → canonical #0F766E") changed component-level **literal**
colors but never updated the **CSS token**.

- `src/index.css:41` — `--color-primary-600: #0f6e56;`
- `src/index.css:45` — `--color-primary: #0f6e56;`
- The whole `--color-primary-*` ramp (50–900) is built around the
  legacy `#0f6e56`.

Result: all **56 uses** of `bg-primary` / `text-primary` /
`hover:bg-primary-700` (across 14 files) render the **old** teal
`#0f6e56`, while `style={{ color: '#0F766E' }}` literals render the
**canonical** teal. Two teals are live simultaneously — e.g. on
Landing, the `bg-primary` "Create a free account" button vs. the
`#0F766E` mono eyebrows. `#0f6e56` = rgb(15,110,86); `#0F766E` =
rgb(15,118,110) — close, but distinguishable side by side.

**Fix:** update `--color-primary` + the `--color-primary-*` ramp in
`src/index.css` to the `#0F766E` family, and refresh the stale comment
at `src/index.css:239` ("our teal at #0f6e56"). One file, but it
visually shifts every primary button site-wide — **present scope /
get sign-off before applying** (CLAUDE.md §4, mass change).

### F2 — teal palette has 4+ variants in use (informational)

Beyond the two above: `#115E59` (dark teal, used for chip text in 5
components against an `rgba(20,184,166,0.1)` fill), `#0D9488` (the NTP
stage color in `v3Tokens.js` / `searchShared.jsx`), and `#14B8A6`
(bright accent). Some are intentionally semantic (stage colors, the
accent). Worth a deliberate call on whether the `#115E59` chip-text
treatment should be canonicalized once F1 is resolved.

---

## Consistency — PASS

- **Nav clearance** — `pt-14` on hero-first pages (Landing, About) and
  centered auth pages; `pt-20` on content pages. Consistent by page
  type; About correctly matches Landing.
- **Footer** — present on every route; the new `/about` link renders
  in order (About · Privacy · Terms).
- **Mono eyebrow pattern** — `font-mono` + `uppercase` +
  `tracking-[0.2x]` used consistently across page headers.
- **About Us page** — uses only canonical `#0F766E` + `#14B8A6`, no
  `bg-primary`; internally consistent and unaffected by the F1 fix.

---

## Recommended next steps

1. Decide on F1 — if approved, it's a quick `index.css` change plus a
   visual re-check of primary buttons.
2. Run `npm run test:smoke:all` in a connected environment for the
   authed-route functional pass.
3. Fold the exhaustive visual + mobile sweep into the onboarding
   asset-capture session.
